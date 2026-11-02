import { useQuery } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { unwrap } from '../../../api/apiError'
import type { Country, OrderStatus } from '../../../api/contracts/enums'
import { getAdminOrders } from '../../../api/services/adminService'
import { Button } from '../../../components/ui/Button'
import { CountryFlag } from '../../../components/ui/CountryFlag'
import { dateTimeText } from '../../../components/ui/labels'
import { Pager } from '../../../components/ui/Pager'
import { Price } from '../../../components/ui/Price'
import { StatusBanner } from '../../../components/ui/StatusBanner'
import { useCountry } from '../../../state/CountryContext'
import { useSession } from '../../../state/SessionContext'
import { StatusChip } from '../../orders/OrderParts'
import styles from '../Admin.module.css'
import { AdminHead } from '../AdminParts'

const PAGE_SIZE = 20

/** The tabs (in the address as ?status=…). */
const TABS: { status?: OrderStatus; key: string; label: string }[] = [
  { key: 'all', label: 'All' },
  { status: 'Paid', key: 'new', label: 'New' },
  { status: 'Preparing', key: 'preparing', label: 'Preparing' },
  { status: 'OutForDelivery', key: 'out', label: 'Out for delivery' },
  { status: 'Delivered', key: 'delivered', label: 'Delivered' },
  { status: 'Cancelled', key: 'cancelled', label: 'Cancelled' },
  { status: 'AwaitingPayment', key: 'unpaid', label: 'Not paid' },
]

const DAY = /^\d{4}-\d{2}-\d{2}$/
const dayParam = (value: string | null) => (value && DAY.test(value) ? value : undefined)

/**
 * Admin → Orders (/admin/orders, permission orders.view): every order delivered to the person's countries, newest
 * first, by status tab, country, dates and a search (order number, shop or customer). Read-only; a row opens the
 * order with its history. Filters and page live in the address, so a link can be shared with a colleague.
 */
export default function AdminOrdersPage() {
  const { countries } = useCountry()
  const { coversCountry } = useSession()
  const [params, setParams] = useSearchParams()
  const tab = TABS.find((t) => t.key === params.get('status')) ?? TABS[0]
  const country = (params.get('country') as Country | null) ?? undefined
  const from = dayParam(params.get('from'))
  const to = dayParam(params.get('to'))
  const search = params.get('q') ?? ''
  const shopId = params.get('shop') ?? undefined
  const page = Math.max(1, Number(params.get('page')) || 1)
  const [typed, setTyped] = useState(search)

  const myCountries = countries.filter((c) => coversCountry(c.country))

  const query = useQuery({
    queryKey: ['admin', 'orders', tab.key, country, from, to, search, shopId, page],
    queryFn: async ({ signal }) => unwrap(await getAdminOrders({
      status: tab.status, country, from, to, search: search || undefined, shopId, page, pageSize: PAGE_SIZE,
    }, signal)),
    placeholderData: (previous) => previous,
  })
  const list = query.data

  const change = (next: Record<string, string | null>) => {
    const p = new URLSearchParams(params)
    for (const [k, v] of Object.entries(next)) { if (v) p.set(k, v); else p.delete(k) }
    if (!('page' in next)) p.delete('page')
    setParams(p)
  }
  const onSearch = (e: FormEvent) => { e.preventDefault(); change({ q: typed.trim() || null }) }
  const countryOf = (c: Country) => countries.find((x) => x.country === c)
  const filtered = !!(search || from || to || shopId)

  return (
    <>
      <AdminHead title="Orders" sub="Every food order in your countries, with who did each step. Read-only." />

      <div className={styles.tabs} role="tablist" aria-label="Order status">
        {TABS.map((t) => (
          <button key={t.key} type="button" role="tab" aria-selected={t === tab} className={styles.tab}
                  onClick={() => change({ status: t.key === 'all' ? null : t.key })}>
            {t.label}
          </button>
        ))}
      </div>

      <div className={styles.filters}>
        <form className={styles.search} onSubmit={onSearch} role="search">
          <input type="search" value={typed} maxLength={100} onChange={(e) => setTyped(e.target.value)}
                 placeholder="Order number, shop or customer" aria-label="Search orders" />
          <Button type="submit" small variant="secondary">Search</Button>
        </form>
        {myCountries.length > 1 && (
          <label className={styles.select}>
            <span className="muted">Country</span>
            <select value={country ?? ''} onChange={(e) => change({ country: e.target.value || null })}>
              <option value="">All my countries</option>
              {myCountries.map((c) => <option key={c.country} value={c.country}>{c.name}</option>)}
            </select>
          </label>
        )}
        <label className={styles.select}>
          <span className="muted">From</span>
          <input type="date" value={from ?? ''} max={to} onChange={(e) => change({ from: e.target.value || null })} />
        </label>
        <label className={styles.select}>
          <span className="muted">To</span>
          <input type="date" value={to ?? ''} min={from} onChange={(e) => change({ to: e.target.value || null })} />
        </label>
      </div>

      {query.isError && (
        <div className={styles.error}>
          <StatusBanner isError message="We couldn't load the orders." />
          <Button small variant="outline" onClick={() => query.refetch()}>Try again</Button>
        </div>
      )}
      {!list && query.isPending && <p className="muted" aria-busy="true">Loading…</p>}
      {list && (
        <>
          <p className={styles.count}>
            {list.totalCount === 0 ? 'No orders here.' : `${list.totalCount} ${list.totalCount === 1 ? 'order' : 'orders'}`}
            {search && <> matching "{search}"</>}
            {filtered && (
              <> <button type="button" className={styles.clear}
                         onClick={() => { setTyped(''); change({ q: null, from: null, to: null, shop: null }) }}>
                Clear filters
              </button></>
            )}
          </p>
          {list.items.length > 0 && (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr><th>Order</th><th>Shop</th><th>Customer</th><th>Country</th><th>Total</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {list.items.map((o) => {
                    const c = countryOf(o.country)
                    return (
                      <tr key={o.orderNumber}>
                        <td>
                          <Link to={`/admin/orders/${encodeURIComponent(o.orderNumber)}`} className={styles.rowText}>
                            <strong>{o.orderNumber}</strong>
                            <span className="muted">{dateTimeText(o.placedAt)} · {o.itemCount} {o.itemCount === 1 ? 'item' : 'items'}</span>
                          </Link>
                        </td>
                        <td>
                          <span className={styles.rowText}>
                            <span>{o.shopName}</span>
                            {o.courierName && <span className="muted">🛵 {o.courierName}</span>}
                          </span>
                        </td>
                        <td>{o.customerName}</td>
                        <td>{c ? <span className={styles.place}><CountryFlag country={c} /> {c.name}</span> : o.country}</td>
                        <td><Price amount={o.total} currency={o.currency} /></td>
                        <td>
                          <span className={styles.rowText}>
                            <StatusChip status={o.status} />
                            {o.needsRefund && <span className="muted">Needs refund</span>}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
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
