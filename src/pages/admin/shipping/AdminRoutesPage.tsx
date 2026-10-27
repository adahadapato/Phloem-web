import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { unwrap, type ApiResult } from '../../../api/apiError'
import type { AdminShipmentRouteDto, CountryDto } from '../../../api/contracts/dtos'
import type { Country, DeliverySpeed } from '../../../api/contracts/enums'
import {
  createRoute, getRoutes, removeRate, setDropOff, setRate, setRouteActive,
} from '../../../api/services/adminService'
import { Button } from '../../../components/ui/Button'
import { StatusBanner } from '../../../components/ui/StatusBanner'
import { useCountry } from '../../../state/CountryContext'
import { RouteText } from '../../shipping/ShipmentParts'
import styles from '../Admin.module.css'
import { AdminHead } from '../AdminParts'
import { ShippingTabs } from './ShippingTabs'

const SPEEDS: { speed: DeliverySpeed; label: string }[] = [
  { speed: 'Standard', label: 'Standard' },
  { speed: 'Express', label: 'Express' },
  { speed: 'Bulk', label: 'Bulk' },
]
const MAX_DAYS = 90   // ShipmentRate.MaxTransitDaysLimit

type Message = { text: string; isError: boolean } | null
type RateDraft = { speed: DeliverySpeed; base: string; perKg: string; minDays: string; maxDays: string }
type Editing = { kind: 'dropoff'; address: string; hours: string } | ({ kind: 'rate' } & RateDraft) | null

const num = (t: string) => Number(t.trim().replace(',', '.'))
const days = (a: number, b: number) => (a === b ? `${a} day${a === 1 ? '' : 's'}` : `${a}–${b} days`)

/**
 * One route on a card: on/off, the drop-off hub (address and opening hours), and a price per speed (base charge +
 * price per kg, in the sending country's currency, plus the days it takes). A route can only be switched on once it
 * has at least one price.
 */
function RouteCard({ r, from }: { r: AdminShipmentRouteDto; from: CountryDto | undefined }) {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState<Editing>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<Message>(null)
  const symbol = from?.currencySymbol ?? ''
  const money = (n: number) => `${symbol}${n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const run = async (action: () => Promise<ApiResult<unknown>>, done: string) => {
    setBusy(true); setMessage(null)
    const result = await action()
    setBusy(false)
    if (!result.ok) { setMessage({ text: result.error.displayMessage, isError: true }); return }
    await queryClient.invalidateQueries({ queryKey: ['admin', 'routes'] })
    setMessage({ text: done, isError: false })
    setEditing(null)
  }

  const saveDropOff = (e: FormEvent) => {
    e.preventDefault()
    if (editing?.kind !== 'dropoff') return
    if (!editing.address.trim() || !editing.hours.trim()) {
      setMessage({ text: 'Enter the hub address and its opening hours.', isError: true }); return
    }
    void run(() => setDropOff(r.fromCountry, r.toCountry, editing.address.trim(), editing.hours.trim()), 'Drop-off saved.')
  }

  const saveRate = (e: FormEvent) => {
    e.preventDefault()
    if (editing?.kind !== 'rate') return
    const base = num(editing.base), perKg = num(editing.perKg), min = num(editing.minDays), max = num(editing.maxDays)
    if (!(base >= 0) || !(perKg >= 0)) { setMessage({ text: 'Enter the base charge and the price per kg (0 or more).', isError: true }); return }
    if (!Number.isInteger(min) || !Number.isInteger(max) || min < 1 || max < min || max > MAX_DAYS) {
      setMessage({ text: `Enter the fewest and most days it takes (whole days, 1 to ${MAX_DAYS}).`, isError: true }); return
    }
    void run(() => setRate(r.fromCountry, r.toCountry, editing.speed, { baseCharge: base, pricePerKg: perKg, minTransitDays: min, maxTransitDays: max }),
      `${editing.speed} price saved. It applies to parcels weighed from now on.`)
  }

  const missing = SPEEDS.filter((s) => !r.rates.some((x) => x.speed === s.speed))

  return (
    <li className={`${styles.priceCard} ${r.isActive ? '' : styles.routeOff}`}>
      <div className={styles.priceCardHead}>
        <RouteText from={r.fromCountry} to={r.toCountry} />
        {r.isActive
          ? <span className={`${styles.chip} ${styles.chipGo}`}>On · bookable</span>
          : <span className={`${styles.chip} ${styles.chipOff}`}>Off</span>}
      </div>
      <StatusBanner message={message?.text} isError={message?.isError} />

      {/* Drop-off */}
      <div className={styles.priceBlock}>
        <div className={styles.priceLine}>
          <span>
            <strong>Drop-off hub</strong>
            {editing?.kind !== 'dropoff' && (
              <span className={styles.priceHint} style={{ whiteSpace: 'pre-line' }}>{r.dropOffAddress}{'\n'}{r.dropOffHours}</span>
            )}
          </span>
          {editing?.kind !== 'dropoff' && (
            <button type="button" className={styles.linkButton} disabled={busy}
                    onClick={() => { setEditing({ kind: 'dropoff', address: r.dropOffAddress, hours: r.dropOffHours }); setMessage(null) }}>
              Change
            </button>
          )}
        </div>
        {editing?.kind === 'dropoff' && (
          <form className={styles.stackForm} onSubmit={saveDropOff}>
            <label>
              <span>Address</span>
              <textarea value={editing.address} maxLength={300} autoFocus onChange={(e) => setEditing({ ...editing, address: e.target.value })} />
            </label>
            <label>
              <span>Opening hours</span>
              <input value={editing.hours} maxLength={200} placeholder="e.g. Mon–Sat, 9am–5pm"
                     onChange={(e) => setEditing({ ...editing, hours: e.target.value })} />
            </label>
            <div className={styles.row}>
              <Button type="submit" small variant="secondary" busy={busy} busyText="Saving…">Save</Button>
              <Button small variant="plain" onClick={() => setEditing(null)}>Cancel</Button>
            </div>
          </form>
        )}
      </div>

      {/* Prices per speed */}
      <div className={styles.priceBlock}>
        <strong>Prices ({r.currency})</strong>
        {r.rates.length === 0 && <p className={styles.setupNote}>No prices yet. Add at least one speed before switching the route on.</p>}
        <ul className={styles.windowList}>
          {r.rates.map((x) => {
            const isEditing = editing?.kind === 'rate' && editing.speed === x.speed
            return (
              <li key={x.speed}>
                <span><strong>{x.speed}</strong> <span className="muted">· {days(x.minTransitDays, x.maxTransitDays)}</span></span>
                {!isEditing && (
                  <span className={styles.priceValue}>
                    {money(x.baseCharge)} + {money(x.pricePerKg)}/kg
                    <button type="button" className={styles.linkButton} disabled={busy}
                            onClick={() => { setEditing({ kind: 'rate', speed: x.speed, base: String(x.baseCharge), perKg: String(x.pricePerKg), minDays: String(x.minTransitDays), maxDays: String(x.maxTransitDays) }); setMessage(null) }}>
                      Change
                    </button>
                    <button type="button" className={`${styles.linkButton} ${styles.linkDanger}`} disabled={busy}
                            onClick={() => run(() => removeRate(r.fromCountry, r.toCountry, x.speed), `${x.speed} is no longer offered on this route.`)}>
                      Remove
                    </button>
                  </span>
                )}
                {isEditing && rateForm()}
              </li>
            )
          })}
          {editing?.kind === 'rate' && !r.rates.some((x) => x.speed === editing.speed) && <li>{rateForm()}</li>}
        </ul>
        {missing.length > 0 && editing?.kind !== 'rate' && (
          <div className={styles.row}>
            {missing.map((s) => (
              <button key={s.speed} type="button" className={`${styles.rangeButton} ${styles.rangeMissing}`} disabled={busy}
                      onClick={() => { setEditing({ kind: 'rate', speed: s.speed, base: '', perKg: '', minDays: '', maxDays: '' }); setMessage(null) }}>
                + {s.label}
              </button>
            ))}
          </div>
        )}
        <p className={styles.priceHint}>Price = base charge + price per kg × weight (rounded up to the next 0.5 kg).</p>
      </div>

      {/* On / off */}
      <div className={styles.priceBlock}>
        {r.isActive ? (
          <Button small variant="outline" className={styles.danger} disabled={busy}
                  onClick={() => run(() => setRouteActive(r.fromCountry, r.toCountry, false), 'Switched off. Customers can\'t book it; parcels already booked carry on.')}>
            Switch off
          </Button>
        ) : (
          <Button small variant="cta" disabled={busy || r.rates.length === 0}
                  onClick={() => run(() => setRouteActive(r.fromCountry, r.toCountry, true), 'Switched on. Customers can book it now.')}>
            Switch on
          </Button>
        )}
      </div>
    </li>
  )

  function rateForm() {
    if (editing?.kind !== 'rate') return null
    const field = (key: 'base' | 'perKg' | 'minDays' | 'maxDays', label: string, unit: string, after = false) => (
      <label className={styles.unitInput}>
        {!after && <span>{unit}</span>}
        <input inputMode="decimal" aria-label={`${editing.speed} ${label}`} placeholder={label} value={editing[key]}
               onChange={(e) => setEditing({ ...editing, [key]: e.target.value })} />
        {after && <span>{unit}</span>}
      </label>
    )
    return (
      <form className={styles.stackForm} onSubmit={saveRate}>
        <strong>{editing.speed}</strong>
        <div className={styles.inlineForm}>{field('base', 'Base charge', symbol)} <span>+</span> {field('perKg', 'Price per kg', `${symbol}`)} <span className="muted">/kg</span></div>
        <div className={styles.inlineForm}>{field('minDays', 'Fewest days', 'days', true)} <span>to</span> {field('maxDays', 'Most days', 'days', true)}</div>
        <div className={styles.row}>
          <Button type="submit" small variant="secondary" busy={busy} busyText="Saving…">Save price</Button>
          <Button small variant="plain" onClick={() => setEditing(null)}>Cancel</Button>
        </div>
      </form>
    )
  }
}

/**
 * Admin → Shipping → Routes & prices: every route (e.g. Ghana → United Kingdom) as a card, switched-on ones first,
 * and "New route" to open another direction (it starts off until it has a price).
 */
export default function AdminRoutesPage() {
  const { countries } = useCountry()
  const queryClient = useQueryClient()
  const query = useQuery({ queryKey: ['admin', 'routes'], queryFn: async ({ signal }) => unwrap(await getRoutes(signal)) })
  const [adding, setAdding] = useState(false)
  const [from, setFrom] = useState<Country | ''>('')
  const [to, setTo] = useState<Country | ''>('')
  const [address, setAddress] = useState('')
  const [hours, setHours] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<Message>(null)

  const onCreate = async (e: FormEvent) => {
    e.preventDefault()
    if (!from || !to || from === to) { setMessage({ text: 'Choose two different countries.', isError: true }); return }
    if (!address.trim() || !hours.trim()) { setMessage({ text: 'Enter the drop-off address and its opening hours.', isError: true }); return }
    setBusy(true); setMessage(null)
    const result = await createRoute(from, to, address.trim(), hours.trim())
    setBusy(false)
    if (!result.ok) { setMessage({ text: result.error.displayMessage, isError: true }); return }
    await queryClient.invalidateQueries({ queryKey: ['admin', 'routes'] })
    setMessage({ text: 'Route created (switched off). Add a price for each speed, then switch it on.', isError: false })
    setAdding(false); setFrom(''); setTo(''); setAddress(''); setHours('')
  }

  const list = [...(query.data ?? [])].sort((a, b) => Number(b.isActive) - Number(a.isActive)
    || a.fromCountry.localeCompare(b.fromCountry) || a.toCountry.localeCompare(b.toCountry))

  return (
    <>
      <AdminHead title="Shipping" sub="Parcels between countries: routes and prices, parcels at the hub, and what can be sent.">
        {!adding && <Button small variant="cta" onClick={() => { setAdding(true); setMessage(null) }}>+ New route</Button>}
      </AdminHead>
      <ShippingTabs />
      <StatusBanner message={message?.text} isError={message?.isError} />

      {adding && (
        <form className={`${styles.panel} ${styles.stackForm}`} onSubmit={onCreate}>
          <strong>New route</strong>
          <div className={styles.inlineForm}>
            <label className={styles.select}><span className="muted">From</span>
              <select value={from} onChange={(e) => setFrom(e.target.value as Country)}>
                <option value="">Choose…</option>
                {countries.map((c) => <option key={c.country} value={c.country}>{c.name}</option>)}
              </select>
            </label>
            <label className={styles.select}><span className="muted">To</span>
              <select value={to} onChange={(e) => setTo(e.target.value as Country)}>
                <option value="">Choose…</option>
                {countries.filter((c) => c.country !== from).map((c) => <option key={c.country} value={c.country}>{c.name}</option>)}
              </select>
            </label>
          </div>
          <label><span>Drop-off hub address</span>
            <textarea value={address} maxLength={300} onChange={(e) => setAddress(e.target.value)} placeholder="e.g. Phloem Hub, 12 Ring Road, Accra" />
          </label>
          <label><span>Opening hours</span>
            <input value={hours} maxLength={200} onChange={(e) => setHours(e.target.value)} placeholder="e.g. Mon–Sat, 9am–5pm" />
          </label>
          <div className={styles.row}>
            <Button type="submit" small variant="cta" busy={busy} busyText="Creating…">Create route</Button>
            <Button small variant="outline" onClick={() => setAdding(false)}>Cancel</Button>
          </div>
        </form>
      )}

      {query.isPending && <p className="muted" aria-busy="true">Loading…</p>}
      {query.isError && (
        <div className={styles.error}>
          <StatusBanner isError message="We couldn't load the routes." />
          <Button small variant="outline" onClick={() => query.refetch()}>Try again</Button>
        </div>
      )}
      {query.isSuccess && list.length === 0 && <p className="muted">No routes yet. Use "New route" to open the first one.</p>}
      <ul className={styles.priceCards}>
        {list.map((r) => (
          <RouteCard key={`${r.fromCountry}-${r.toCountry}`} r={r} from={countries.find((c) => c.country === r.fromCountry)} />
        ))}
      </ul>
    </>
  )
}
