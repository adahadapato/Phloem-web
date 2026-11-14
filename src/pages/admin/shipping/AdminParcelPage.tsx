import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router'
import { unwrap } from '../../../api/apiError'
import type { ShipmentStatus } from '../../../api/contracts/enums'
import { changeParcelCourier, getCouriers, getParcel, moveParcel, receiveParcel, sendOutParcel } from '../../../api/services/adminService'
import type { CourierOptionDto, ShipmentBoxDto, ShipmentDetailsDto } from '../../../api/contracts/dtos'
import { CourierPicker } from '../../../components/deliveries/CourierPicker'
import { DeliveryProofCard } from '../../../components/deliveries/DeliveryProofCard'
import { Button } from '../../../components/ui/Button'
import { shipmentCategories } from '../../../components/ui/labels'
import { Price } from '../../../components/ui/Price'
import { StatusBanner } from '../../../components/ui/StatusBanner'
import { useCountry } from '../../../state/CountryContext'
import { RouteText, ShipmentChip, ShipmentTimeline } from '../../shipping/ShipmentParts'
import styles from '../Admin.module.css'
import { figures, kg, newBox, toNumber, type BoxDraft } from '../../shipping/parcel/parcelMath'

const NOTE_MAX = 200   // ShipmentEvent.NoteMaxLength

/** The declared boxes as a starting point for weighing (staff overwrite them with what they measure). */
const startBoxes = (declared: ShipmentBoxDto[] | undefined): BoxDraft[] =>
  declared && declared.length > 0
    ? declared.map((b, i) => ({
        key: i + 1, weight: '', quantity: String(b.quantity),
        length: b.lengthCm?.toString() ?? '', width: b.widthCm?.toString() ?? '', height: b.heightCm?.toString() ?? '',
      }))
    : [newBox(1)]

/** "2 × 8 kg, 60 × 40 × 40 cm (counts as 39 kg)". */
function BoxTable({ title, boxes }: { title: string; boxes: ShipmentBoxDto[] }) {
  if (boxes.length === 0) return null
  return (
    <>
      <p className={styles.colTitle}>{title}</p>
      <table className={styles.boxTable}>
        <thead><tr><th>Boxes</th><th>Weight each</th><th>Size (L × W × H)</th><th>Counts as</th></tr></thead>
        <tbody>
          {boxes.map((b, i) => (
            <tr key={i}>
              <td>{b.quantity}</td>
              <td>{kg(b.weightKg)}</td>
              <td>{b.lengthCm !== null ? `${b.lengthCm} × ${b.widthCm} × ${b.heightCm} cm` : <span className="muted">not given</span>}</td>
              <td><strong>{kg(b.chargeableWeightKg)}</strong></td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}

/** Fragile / home pickup / hub collection, as tags. */
function Tags({ s }: { s: ShipmentDetailsDto }) {
  const tags = [
    s.isFragile && 'Fragile',
    s.handOver === 'HomePickup' && 'Home pickup',
    s.delivery === 'CollectFromHub' && 'Recipient collects from hub',
  ].filter(Boolean) as string[]
  return tags.length > 0 ? <p className={styles.tags}>{tags.map((t) => <span key={t} className={styles.tag}>{t}</span>)}</p> : null
}

type Message = { text: string; isError: boolean } | null

/**
 * The step after each status, as a button ("Mark in transit"), for the hub. "Out for delivery" needs a courier (its
 * own form), and only the courier can mark it delivered, with a photo.
 */
function nextStep(status: ShipmentStatus, to: string): { status: ShipmentStatus; label: string } | null {
  switch (status) {
    case 'Paid': return { status: 'InTransit', label: 'Mark in transit (it has left)' }
    case 'InTransit': return { status: 'ArrivedInDestination', label: `Mark arrived in ${to}` }
    default: return null
  }
}

/**
 * Admin → one parcel (/admin/shipping/parcels/:trackingNumber): who sends it to whom (with the pickup address for home
 * pickups), the boxes as declared and as measured, the items and declared values, the price part by part, the full
 * timeline with staff notes, and on the right what the hub does next: <b>Receive, weigh and measure</b> each box
 * (sets the final price; the sender is emailed to pay), wait for payment, then move it
 * along: in transit → arrived (each with an optional note) → out for delivery with a courier, who marks it delivered
 * with a photo (shown here).
 */
export default function AdminParcelPage() {
  const { trackingNumber = '' } = useParams()
  const { countries } = useCountry()
  const queryClient = useQueryClient()
  const query = useQuery({ queryKey: ['admin', 'parcel', trackingNumber], queryFn: async ({ signal }) => unwrap(await getParcel(trackingNumber, signal)) })
  const [hubBoxes, setHubBoxes] = useState<BoxDraft[] | null>(null)   // null = start from the declared boxes
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<Message>(null)
  const [changing, setChanging] = useState(false)
  const toCountry = query.data?.toCountry
  const needsCourier = query.data?.status === 'ArrivedInDestination' || changing
  const couriers = useQuery({
    queryKey: ['admin', 'couriers', toCountry],
    queryFn: async ({ signal }) => unwrap(await getCouriers(toCountry!, signal)),
    enabled: needsCourier && !!toCountry,
    staleTime: 60_000,
  })

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
    setNote(''); setHubBoxes(null)
  }

  const divisor = s.volumeDivisor ?? 5000
  const measuring = hubBoxes ?? startBoxes(s.declaredBoxes)
  const setBox = (key: number, change: Partial<BoxDraft>) =>
    setHubBoxes(measuring.map((b) => (b.key === key ? { ...b, ...change } : b)))

  const onReceive = async (e: FormEvent) => {
    e.preventDefault()
    const checked = measuring.map((b) => ({ b, f: figures(b, divisor) }))
    if (checked.some(({ f }) => !f.valid || !f.hasSize)) {
      setMessage({ text: 'Weigh and measure every box: weight (kg) and length, width and height (cm).', isError: true })
      return
    }
    setBusy(true); setMessage(null)
    const result = await receiveParcel(s.trackingNumber, checked.map(({ b, f }) => ({
      weightKg: f.weightKg, lengthCm: toNumber(b.length), widthCm: toNumber(b.width), heightCm: toNumber(b.height), quantity: f.quantity,
    })))
    setBusy(false)
    if (!result.ok) { setMessage({ text: result.error.displayMessage, isError: true }); return }
    const total = checked.reduce((sum, { f }) => sum + f.weightKg * f.quantity, 0)
    await done(`Received, weighed and measured: ${kg(total)}. Final price ${symbol}${result.value.toFixed(2)}. ${s.senderName} has been emailed to pay.`)
  }

  const onMove = async () => {
    if (!next) return
    setBusy(true); setMessage(null)
    const result = await moveParcel(s.trackingNumber, next.status, note.trim() || null)
    setBusy(false)
    if (!result.ok) { setMessage({ text: result.error.displayMessage, isError: true }); return }
    await done(`${s.trackingNumber}: ${next.label.replace('Mark ', '').replace(' (it has left)', '')}.`)
  }

  const onCourier = async (c: CourierOptionDto) => {
    setBusy(true); setMessage(null)
    const result = s.status === 'OutForDelivery'
      ? await changeParcelCourier(s.trackingNumber, c.id)
      : await sendOutParcel(s.trackingNumber, c.id, note.trim() || null)
    setBusy(false)
    if (!result.ok) { setMessage({ text: result.error.displayMessage, isError: true }); return }
    setChanging(false)
    await done(`${s.trackingNumber} is out for delivery with ${c.name}. They've been emailed.`)
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
                {s.handOver === 'HomePickup' && (
                  <>
                    <p className={styles.colTitle} style={{ marginTop: 10 }}>Collect from</p>
                    <p className={styles.colText}>
                      {s.pickupAddressLine}<br />{s.pickupCity}, {s.pickupRegionOrPostcode}
                      {s.pickupNotes && <><br /><span className="muted">“{s.pickupNotes}”</span></>}
                    </p>
                  </>
                )}
              </div>
              <div>
                <p className={styles.colTitle}>Recipient</p>
                <p className={styles.colText}>
                  {s.recipientName}<br /><a href={`tel:${s.recipientPhone}`}>{s.recipientPhone}</a><br />
                  {s.recipientAddressLine && <>{s.recipientAddressLine}<br /></>}
                  {s.recipientCity}{s.recipientDistrictName ? `, ${s.recipientDistrictName} LGA` : ''}, {s.recipientRegionOrPostcode}<br />{toName}
                </p>
                {s.delivery === 'CollectFromHub' && (
                  <p className={styles.colText}><strong>Collects from:</strong> {s.collectionHubAddress ?? 'our hub'}</p>
                )}
              </div>
            </div>
          </section>

          <section className={styles.panel} aria-labelledby="boxes-title">
            <h2 id="boxes-title" className={styles.sectionTitle} style={{ margin: 0 }}>Boxes</h2>
            <Tags s={s} />
            {(s.declaredBoxes?.length ?? 0) === 0 && (s.measuredBoxes?.length ?? 0) === 0 &&
              <p className="muted">Booked before box sizes: one parcel of {kg(s.estimatedWeightKg)}.</p>}
            <BoxTable title="Measured at the hub" boxes={s.measuredBoxes ?? []} />
            <BoxTable title="As the sender described them" boxes={s.declaredBoxes ?? []} />
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

          <DeliveryProofCard proof={s.deliveryProof} />
        </div>

        <aside className={styles.actionsPanel} aria-label="What the hub does next">
          <dl className={styles.facts} style={{ gridTemplateColumns: '1fr auto' }}>
            <dt>Declared weight</dt><dd>{kg(s.estimatedWeightKg)}</dd>
            <dt>Weighed</dt><dd>{s.weighedWeightKg !== null ? kg(s.weighedWeightKg) : '—'}</dd>
            <dt>Charged as</dt><dd>{kg(s.chargeableWeightKg ?? s.estimatedChargeableWeightKg ?? s.estimatedWeightKg)}</dd>
            {(s.fragileCharge ?? 0) > 0 && <><dt>Fragile</dt><dd><Price amount={s.fragileCharge!} currency={s.currency} /></dd></>}
            {(s.homePickupCharge ?? 0) > 0 && <><dt>Home pickup</dt><dd><Price amount={s.homePickupCharge!} currency={s.currency} /></dd></>}
            {(s.doorDeliveryCharge ?? 0) > 0 && <><dt>Door delivery</dt><dd><Price amount={s.doorDeliveryCharge!} currency={s.currency} /></dd></>}
            <dt>{s.finalPrice !== null ? 'Final price' : 'Estimated price'}</dt>
            <dd><Price amount={s.finalPrice ?? s.estimatedPrice} currency={s.currency} /></dd>
          </dl>

          {s.status === 'Booked' && (
            <form className={styles.stackForm} onSubmit={onReceive}>
              <p className={styles.waitNote}>
                {s.handOver === 'HomePickup' ? `Waiting to be collected from ${s.pickupCity ?? 'the sender'}.` : 'Waiting to be dropped off at the hub.'}
              </p>
              <span className={styles.priceHint}>Weigh and measure every box (outside, in cm). Same boxes: one line with a number.</span>
              {measuring.map((b, i) => {
                const f = figures(b, divisor)
                return (
                  <div key={b.key} className={styles.hubBox}>
                    <span className={styles.hubBoxTitle}>
                      Box {i + 1}
                      {measuring.length > 1 && <button type="button" onClick={() => setHubBoxes(measuring.filter((x) => x.key !== b.key))}>Remove</button>}
                    </span>
                    <label><span>kg each</span><input inputMode="decimal" value={b.weight} onChange={(e) => setBox(b.key, { weight: e.target.value })} /></label>
                    <label><span>L cm</span><input inputMode="decimal" value={b.length} onChange={(e) => setBox(b.key, { length: e.target.value })} /></label>
                    <label><span>W cm</span><input inputMode="decimal" value={b.width} onChange={(e) => setBox(b.key, { width: e.target.value })} /></label>
                    <label><span>H cm</span><input inputMode="decimal" value={b.height} onChange={(e) => setBox(b.key, { height: e.target.value })} /></label>
                    <label><span>Boxes</span><input inputMode="numeric" value={b.quantity} onChange={(e) => setBox(b.key, { quantity: e.target.value })} /></label>
                    {f.chargeableEach !== null && (
                      <p className={styles.hubCounts}>
                        Counts as {kg(f.chargeableEach)}{f.quantity > 1 ? ` × ${f.quantity} = ${kg(f.chargeableEach * f.quantity)}` : ''}
                        {f.bySize ? ' (by size)' : ''}
                      </p>
                    )}
                  </div>
                )
              })}
              <Button small variant="secondary" onClick={() => setHubBoxes([...measuring, newBox(Math.max(0, ...measuring.map((x) => x.key)) + 1)])}>
                + Another box
              </Button>
              <Button type="submit" variant="cta" full busy={busy} busyText="Saving…">Receive, weigh and measure</Button>
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
          {s.status === 'ArrivedInDestination' && (
            <div className={styles.stackForm}>
              <label>
                <span>Note for the timeline (optional)</span>
                <input value={note} maxLength={NOTE_MAX} onChange={(e) => setNote(e.target.value)}
                       placeholder="Blank = &quot;With our courier, …&quot;" />
              </label>
              <span className={styles.priceHint}>
                {s.delivery === 'CollectFromHub'
                  ? "The recipient collects it from our hub: who's handing it over? (They'll record the handover with a photo.)"
                  : "Out for delivery: who's taking it?"}
              </span>
              <CourierPicker couriers={couriers.data} loading={couriers.isPending} busy={busy}
                             label="Out for delivery" onPick={(c) => void onCourier(c)} />
            </div>
          )}
          {s.status === 'OutForDelivery' && (
            <div className={styles.stackForm}>
              <p className={styles.waitNote}>
                {s.isReadyToCollect
                  ? <>📦 Ready to collect at our hub. {s.courierName ?? 'Our staff member'} hands it over and records it with a photo.</>
                  : <>🛵 {s.courierName ?? 'A courier'} is delivering it. They'll mark it delivered with a photo.</>}
              </p>
              {changing
                ? <CourierPicker couriers={couriers.data} loading={couriers.isPending} busy={busy} label="Change"
                                 onPick={(c) => void onCourier(c)} onCancel={() => setChanging(false)} />
                : <Button variant="outline" full onClick={() => setChanging(true)}>Change courier</Button>}
            </div>
          )}
          {s.status === 'Delivered' && (
            <p className={styles.allClear}>✓ Delivered{s.courierName ? ` by ${s.courierName}` : ''}. Nothing more to do.</p>
          )}
          {s.status === 'Cancelled' && (
            <p className={styles.noteStop}>Cancelled.{s.needsRefund && ' It was paid: the sender must be refunded.'}</p>
          )}
        </aside>
      </div>
    </>
  )
}
