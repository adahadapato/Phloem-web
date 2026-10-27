import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router'
import { unwrap } from '../../../api/apiError'
import type { ShipmentStatus } from '../../../api/contracts/enums'
import { getParcel, moveParcel, receiveParcel } from '../../../api/services/adminService'
import { Button } from '../../../components/ui/Button'
import { shipmentCategories } from '../../../components/ui/labels'
import { Price } from '../../../components/ui/Price'
import { StatusBanner } from '../../../components/ui/StatusBanner'
import { useCountry } from '../../../state/CountryContext'
import { RouteText, ShipmentChip, ShipmentTimeline } from '../../shipping/ShipmentParts'
import styles from '../Admin.module.css'

const NOTE_MAX = 200   // ShipmentEvent.NoteMaxLength
const MIN_KG = 0.1
const MAX_KG = 1000

type Message = { text: string; isError: boolean } | null

/** The step after each status, as a button ("Mark in transit"), for the hub. */
function nextStep(status: ShipmentStatus, to: string): { status: ShipmentStatus; label: string } | null {
  switch (status) {
    case 'Paid': return { status: 'InTransit', label: 'Mark in transit (it has left)' }
    case 'InTransit': return { status: 'ArrivedInDestination', label: `Mark arrived in ${to}` }
    case 'ArrivedInDestination': return { status: 'OutForDelivery', label: 'Mark out for delivery' }
    case 'OutForDelivery': return { status: 'Delivered', label: 'Mark delivered' }
    default: return null
  }
}

/**
 * Admin → one parcel (/admin/shipping/parcels/:trackingNumber): who sends it to whom, the items and declared values,
 * weights and prices, the full timeline with staff notes, and on the right what the hub does next:
 * <b>Receive and weigh</b> (sets the final price; the sender is emailed to pay), wait for payment, then move it
 * along: in transit → arrived → out for delivery → delivered, each with an optional note.
 */
export default function AdminParcelPage() {
  const { trackingNumber = '' } = useParams()
  const { countries } = useCountry()
  const queryClient = useQueryClient()
  const query = useQuery({ queryKey: ['admin', 'parcel', trackingNumber], queryFn: async ({ signal }) => unwrap(await getParcel(trackingNumber, signal)) })
  const [weight, setWeight] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<Message>(null)

  if (query.isPending) return <p className="muted" aria-busy="true">Loading…</p>
  if (query.isError) {
    return (
      <div className={styles.error}>
        <Link to="/admin/shipping/parcels" className={styles.back}>‹ Parcels</Link>
        <StatusBanner isError message={(query.error as { status?: number }).status === 404 ? "This parcel doesn't exist." : "We couldn't load this parcel."} />
        <Button small variant="outline" onClick={() => query.refetch()}>Try again</Button>
      </div>
    )
  }

  const s = query.data
  const toName = countries.find((c) => c.country === s.toCountry)?.name ?? s.toCountry
  const symbol = countries.find((c) => c.currency === s.currency)?.currencySymbol ?? ''
  const next = nextStep(s.status, toName)

  const done = async (text: string) => {
    await queryClient.invalidateQueries({ queryKey: ['admin'] })
    setMessage({ text, isError: false })
    setNote(''); setWeight('')
  }

  const onReceive = async (e: FormEvent) => {
    e.preventDefault()
    const kg = Number(weight.trim().replace(',', '.'))
    if (!(kg >= MIN_KG && kg <= MAX_KG)) { setMessage({ text: `Enter the weight in kg (${MIN_KG} to ${MAX_KG}).`, isError: true }); return }
    setBusy(true); setMessage(null)
    const result = await receiveParcel(s.trackingNumber, kg)
    setBusy(false)
    if (!result.ok) { setMessage({ text: result.error.displayMessage, isError: true }); return }
    await done(`Received and weighed: ${kg} kg. Final price ${symbol}${result.value.toFixed(2)}. ${s.senderName} has been emailed to pay.`)
  }

  const onMove = async () => {
    if (!next) return
    setBusy(true); setMessage(null)
    const result = await moveParcel(s.trackingNumber, next.status, note.trim() || null)
    setBusy(false)
    if (!result.ok) { setMessage({ text: result.error.displayMessage, isError: true }); return }
    await done(`${s.trackingNumber}: ${next.label.replace('Mark ', '').replace(' (it has left)', '')}.`)
  }

  return (
    <>
      <Link to="/admin/shipping/parcels" className={styles.back}>‹ Parcels</Link>
      <StatusBanner message={message?.text} isError={message?.isError} />

      <div className={styles.shopLayout}>
        <div>
          <section className={styles.panel} aria-label="Parcel">
            <div className={styles.shopTop}>
              <div>
                <h1 className={styles.title}>{s.trackingNumber}</h1>
                <p className={styles.metaRow}>
                  <ShipmentChip status={s.status} />
                  <RouteText from={s.fromCountry} to={s.toCountry} />
                  <span className="muted">{s.speed}</span>
                </p>
              </div>
            </div>
            <div className={styles.twoCols}>
              <div>
                <p className={styles.colTitle}>Sender</p>
                <p className={styles.colText}>{s.senderName}<br /><a href={`tel:${s.senderPhone}`}>{s.senderPhone}</a></p>
              </div>
              <div>
                <p className={styles.colTitle}>Recipient</p>
                <p className={styles.colText}>
                  {s.recipientName}<br /><a href={`tel:${s.recipientPhone}`}>{s.recipientPhone}</a><br />
                  {s.recipientAddressLine}<br />{s.recipientCity}, {s.recipientRegionOrPostcode}<br />{toName}
                </p>
              </div>
            </div>
          </section>

          <section className={styles.panel} aria-labelledby="items-title">
            <h2 id="items-title" className={styles.sectionTitle} style={{ margin: 0 }}>What's inside</h2>
            <ul className={styles.itemList}>
              {s.items.map((i, n) => (
                <li key={n}>
                  <span className={styles.rowText}>
                    <strong>{i.quantity} × {i.description}</strong>
                    <span className="muted">{shipmentCategories.find((c) => c.value === i.category)?.label ?? i.category} · {symbol}{i.unitDeclaredValue.toFixed(2)} each</span>
                  </span>
                  <Price amount={i.totalDeclaredValue} currency={s.currency} />
                </li>
              ))}
            </ul>
            <p className={styles.metaRow} style={{ justifyContent: 'space-between' }}>
              <span className="muted">Declared value for customs</span>
              <strong><Price amount={s.totalDeclaredValue} currency={s.currency} /></strong>
            </p>
          </section>

          <section className={styles.panel} aria-labelledby="journey-title">
            <h2 id="journey-title" className={styles.sectionTitle} style={{ margin: 0 }}>Journey</h2>
            <ShipmentTimeline status={s.status} timeline={s.timeline} />
          </section>
        </div>

        <aside className={styles.actionsPanel} aria-label="What the hub does next">
          <dl className={styles.facts} style={{ gridTemplateColumns: '1fr auto' }}>
            <dt>Estimated weight</dt><dd>{s.estimatedWeightKg} kg</dd>
            <dt>Weighed</dt><dd>{s.weighedWeightKg !== null ? `${s.weighedWeightKg} kg` : '—'}</dd>
            <dt>{s.finalPrice !== null ? 'Final price' : 'Estimated price'}</dt>
            <dd><Price amount={s.finalPrice ?? s.estimatedPrice} currency={s.currency} /></dd>
          </dl>

          {s.status === 'Booked' && (
            <form className={styles.stackForm} onSubmit={onReceive}>
              <p className={styles.waitNote}>Waiting to be dropped off at the hub.</p>
              <label>
                <span>Weighed at the hub (kg)</span>
                <input inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder={`e.g. ${s.estimatedWeightKg}`} />
              </label>
              <Button type="submit" variant="cta" full busy={busy} busyText="Saving…">Receive and weigh</Button>
              <span className={styles.priceHint}>Sets the final price and emails {s.senderName} to pay.</span>
            </form>
          )}
          {s.status === 'ReceivedAtHub' && (
            <p className={styles.waitNote}>At the hub. Waiting for {s.senderName} to pay {symbol}{(s.finalPrice ?? 0).toFixed(2)}; then it can leave.</p>
          )}
          {next && (
            <div className={styles.stackForm}>
              <label>
                <span>Note for the timeline (optional)</span>
                <input value={note} maxLength={NOTE_MAX} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Flight BA078" />
              </label>
              <Button variant="cta" full busy={busy} busyText="Saving…" onClick={onMove}>{next.label}</Button>
            </div>
          )}
          {s.status === 'Delivered' && <p className={styles.allClear}>✓ Delivered. Nothing more to do.</p>}
          {s.status === 'Cancelled' && (
            <p className={styles.noteStop}>Cancelled.{s.needsRefund && ' It was paid: the sender must be refunded.'}</p>
          )}
        </aside>
      </div>
    </>
  )
}
