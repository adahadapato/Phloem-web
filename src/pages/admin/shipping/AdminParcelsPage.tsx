import { useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router'
import { unwrap } from '../../../api/apiError'
import type { Country, ShipmentStatus } from '../../../api/contracts/enums'
import { getParcels } from '../../../api/services/adminService'
import { Button } from '../../../components/ui/Button'
import { Pager } from '../../../components/ui/Pager'
import { Price } from '../../../components/ui/Price'
import { StatusBanner } from '../../../components/ui/StatusBanner'
import { useCountry } from '../../../state/CountryContext'
import { RouteText, ShipmentChip } from '../../shipping/ShipmentParts'
import styles from '../Admin.module.css'
import { AdminHead } from '../AdminParts'
import { ShippingTabs } from './ShippingTabs'

const PAGE_SIZE = 20

/** The tabs, in the order the hub works through them (in the address as ?status=…). */
const TABS: { status?: ShipmentStatus; label: string }[] = [
  { status: 'Booked', label: 'To receive' },
  { status: 'ReceivedAtHub', label: 'Waiting for payment' },
  { status: 'Paid', label: 'Ready to send' },
  { status: 'InTransit', label: 'In transit' },
  { status: 'ArrivedInDestination', label: 'Arrived' },
  { status: 'OutForDelivery', label: 'Out for delivery' },
  { status: 'Delivered', label: 'Delivered' },
  { status: 'Cancelled', label: 'Cancelled' },
  { label: 'All' },
]

const day = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

/**
 * Admin → Shipping → Parcels: every parcel, newest first, by step of the journey (To receive · Waiting for payment ·
 * Ready to send · In transit · Arrived · Out for delivery · Delivered · Cancelled · All) and by from / to country.
 * A row opens the parcel, where it's received and weighed or moved to its next step.
 */
export default function AdminParcelsPage() {
  const { countries } = useCountry()
  const [params, setParams] = useSearchParams()
  const status = (params.get('status') ?? 'Booked') as ShipmentStatus | 'all'
  const tab = TABS.find((t) => (t.status ?? 'all') === status) ?? TABS[0]
  const fromCountry = (params.get('from') as Country | null) ?? undefined
  const toCountry = (params.get('to') as Country | null) ?? undefined
  const page = Math.max(1, Number(params.get('page')) || 1)

  const query = useQuery({
    queryKey: ['admin', 'parcels', tab.status, fromCountry, toCountry, page],
    queryFn: async ({ signal }) => unwrap(await getParcels({ status: tab.status, fromCountry, toCountry, page, pageSize: PAGE_SIZE }, signal)),
    placeholderData: (previous) => previous,
  })
  const list = query.data

  const change = (next: Record<string, string | null>) => {
    const p = new URLSearchParams(params)
    for (const [k, v] of Object.entries(next)) { if (v) p.set(k, v); else p.delete(k) }
    if (!('page' in next)) p.delete('page')
    setParams(p)
  }

  return (
    <>
      <AdminHead title="Shipping" sub="Parcels between countries: routes and prices, parcels at the hub, and what can be sent." />
      <ShippingTabs />

      <div className={styles.tabs} role="tablist" aria-label="Step">
        {TABS.map((t) => (
          <button key={t.label} type="button" role="tab" aria-selected={t === tab} className={styles.tab}
                  onClick={() => change({ status: t.status ?? 'all' })}>
            {t.label}
          </button>
        ))}
      </div>
      <div className={styles.filters}>
        <label className={styles.select}><span className="muted">From</span>
          <select value={fromCountry ?? ''} onChange={(e) => change({ from: e.target.value || null })}>
            <option value="">Any country</option>
            {countries.map((c) => <option key={c.country} value={c.country}>{c.name}</option>)}
          </select>
        </label>
        <label className={styles.select}><span className="muted">To</span>
          <select value={toCountry ?? ''} onChange={(e) => change({ to: e.target.value || null })}>
            <option value="">Any country</option>
            {countries.map((c) => <option key={c.country} value={c.country}>{c.name}</option>)}
          </select>
        </label>
      </div>

      {query.isError && (
        <div className={styles.error}>
          <StatusBanner isError message="We couldn't load the parcels." />
          <Button small variant="outline" onClick={() => query.refetch()}>Try again</Button>
        </div>
      )}
      {!list && query.isPending && <p className="muted" aria-busy="true">Loading…</p>}
      {list && (
        <>
          <p className={styles.count}>{list.totalCount === 0 ? 'No parcels here.' : `${list.totalCount} ${list.totalCount === 1 ? 'parcel' : 'parcels'}`}</p>
          {list.items.length > 0 && (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr><th>Parcel</th><th>Route</th><th>From → to</th><th>Weight</th><th>Price</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {list.items.map((s) => (
                    <tr key={s.trackingNumber}>
                      <td>
                        <Link to={`/admin/shipping/parcels/${encodeURIComponent(s.trackingNumber)}`} className={styles.rowText}>
                          <strong>{s.trackingNumber}</strong>
                          <span className="muted">{s.speed} · {s.itemCount} {s.itemCount === 1 ? 'item' : 'items'} · booked {day(s.bookedAt)}</span>
                        </Link>
                      </td>
                      <td><RouteText from={s.fromCountry} to={s.toCountry} /></td>
                      <td><span className={styles.rowText}><span>{s.senderName}</span><span className="muted">→ {s.recipientName}</span></span></td>
                      <td>{s.weighedWeightKg !== null ? `${s.weighedWeightKg} kg` : <span className="muted">~{s.estimatedWeightKg} kg</span>}</td>
                      <td><Price amount={s.price} currency={s.currency} />{s.weighedWeightKg === null && <span className="muted"> est.</span>}</td>
                      <td><ShipmentChip status={s.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Pager page={list.page} totalPages={list.totalPages} onChange={(p) => change({ page: String(p) })} />
        </>
      )}
    </>
  )
}
