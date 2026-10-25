import { useQuery } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { unwrap } from '../../../api/apiError'
import type { Country, VendorStatus } from '../../../api/contracts/enums'
import { getShops } from '../../../api/services/adminService'
import { ApiImage } from '../../../components/ui/ApiImage'
import { Button } from '../../../components/ui/Button'
import { CountryFlag } from '../../../components/ui/CountryFlag'
import { Pager } from '../../../components/ui/Pager'
import { StatusBanner } from '../../../components/ui/StatusBanner'
import { useCountry } from '../../../state/CountryContext'
import styles from '../Admin.module.css'
import { AdminHead, ShopStatusChip } from '../AdminParts'

const PAGE_SIZE = 20

/** The tabs (in the address as ?status=…, so a tab can be linked to and survives a refresh). */
const TABS: { key: string; label: string; status?: VendorStatus }[] = [
  { key: 'pending', label: 'Waiting for approval', status: 'PendingApproval' },
  { key: 'live', label: 'Live', status: 'Approved' },
  { key: 'rejected', label: 'Rejected', status: 'Rejected' },
  { key: 'blocked', label: 'Blocked', status: 'Blocked' },
  { key: 'all', label: 'All' },
]

/**
 * Admin → Shops: every shop in a table (logo and name with the owner, country, status, ✓ badge, rating, opened),
 * by status tab, country and name search. A row opens the shop's review page. Filters and page live in the address.
 */
export default function AdminShopsPage() {
  const { countries } = useCountry()
  const [params, setParams] = useSearchParams()
  const tab = TABS.find((t) => t.key === params.get('status')) ?? TABS[0]
  const country = (params.get('country') as Country | null) ?? undefined
  const search = params.get('q') ?? ''
  const page = Math.max(1, Number(params.get('page')) || 1)
  const [typed, setTyped] = useState(search)

  const query = useQuery({
    queryKey: ['admin', 'shops', tab.key, country, search, page],
    queryFn: async ({ signal }) =>
      unwrap(await getShops({ status: tab.status, country, search, page, pageSize: PAGE_SIZE }, signal)),
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

  return (
    <>
      <AdminHead title="Shops" sub="Approve new shops, check their documents, give the ✓ badge or block a shop." />

      <div className={styles.tabs} role="tablist" aria-label="Shop status">
        {TABS.map((t) => (
          <button key={t.key} type="button" role="tab" aria-selected={t === tab} className={styles.tab}
                  onClick={() => change({ status: t.key })}>
            {t.label}
          </button>
        ))}
      </div>

      <div className={styles.filters}>
        <form className={styles.search} onSubmit={onSearch} role="search">
          <input type="search" value={typed} onChange={(e) => setTyped(e.target.value)}
                 placeholder="Search by shop name" aria-label="Search by shop name" />
          <Button type="submit" small variant="secondary">Search</Button>
        </form>
        <label className={styles.select}>
          <span className="muted">Country</span>
          <select value={country ?? ''} onChange={(e) => change({ country: e.target.value || null })}>
            <option value="">All countries</option>
            {countries.map((c) => <option key={c.country} value={c.country}>{c.name}</option>)}
          </select>
        </label>
      </div>

      {query.isError && (
        <div className={styles.error}>
          <StatusBanner isError message="We couldn't load the shops." />
          <Button small variant="outline" onClick={() => query.refetch()}>Try again</Button>
        </div>
      )}

      {list && (
        <>
          <p className={styles.count}>
            {list.totalCount === 0 ? 'No shops here.' : `${list.totalCount} ${list.totalCount === 1 ? 'shop' : 'shops'}`}
            {search && <> matching "{search}" <button type="button" className={styles.clear} onClick={() => { setTyped(''); change({ q: null }) }}>Clear</button></>}
          </p>
          {list.items.length > 0 && (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr><th>Shop</th><th>Country</th><th>Status</th><th>Rating</th><th>Opened</th><th aria-label="Open" /></tr>
                </thead>
                <tbody>
                  {list.items.map((s) => {
                    const c = countryOf(s.country)
                    return (
                      <tr key={s.id}>
                        <td>
                          <Link to={`/admin/shops/${s.id}`} className={styles.shopCell}>
                            <ApiImage src={s.logoUrl} alt="" className={styles.rowLogo} />
                            <span className={styles.rowText}>
                              <strong>{s.name} {s.isVerified && <span className={styles.tick} title="Verified">✓</span>}</strong>
                              <span className="muted">{s.ownerName}{s.isOwnerSuspended && ' · owner suspended'}</span>
                            </span>
                          </Link>
                        </td>
                        <td>{c ? <span className={styles.place}><CountryFlag country={c} /> {c.name}</span> : s.country}</td>
                        <td><ShopStatusChip status={s.status} /></td>
                        <td>{s.ratingCount > 0 ? `★ ${s.rating.toFixed(1)} (${s.ratingCount})` : <span className="muted">—</span>}</td>
                        <td>{new Date(s.openedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                        <td><Link to={`/admin/shops/${s.id}`} className={styles.rowGo}>{s.status === 'PendingApproval' ? 'Review ›' : 'Open ›'}</Link></td>
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
      {!list && query.isPending && <p className="muted" aria-busy="true">Loading…</p>}
    </>
  )
}
