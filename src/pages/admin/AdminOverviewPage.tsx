import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { unwrap } from '../../api/apiError'
import {
  getDishSuggestions, getPendingShops, getShipmentCount, getShopStats, getUserCount,
} from '../../api/services/adminService'
import { ApiImage } from '../../components/ui/ApiImage'
import { useCountry } from '../../state/CountryContext'
import { useSession } from '../../state/SessionContext'
import styles from './Admin.module.css'
import { AdminHead, StatTile } from './AdminParts'

/** How long ago, in words: "today", "yesterday", "5 days ago". */
function ago(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  return days <= 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`
}

/**
 * Admin → Overview: the numbers that matter (shops waiting, live shops, people, dish names suggested, parcels to
 * receive), then "Needs your attention": dish names suggested by sellers, and the shops waiting for approval,
 * oldest first, each opening its review page. Each number loads on its own, so one slow count doesn't hold the page.
 */
export default function AdminOverviewPage() {
  const { profile } = useSession()
  const { countries } = useCountry()
  const opts = { staleTime: 30_000 }
  const stats = useQuery({ queryKey: ['admin', 'shop-stats'], queryFn: async ({ signal }) => unwrap(await getShopStats(signal)), ...opts })
  const users = useQuery({ queryKey: ['admin', 'user-count'], queryFn: async ({ signal }) => unwrap(await getUserCount(signal)), ...opts })
  const suggestions = useQuery({ queryKey: ['admin', 'dish-suggestions'], queryFn: async ({ signal }) => unwrap(await getDishSuggestions(signal)), ...opts })
  const toReceive = useQuery({ queryKey: ['admin', 'shipments', 'Booked'], queryFn: async ({ signal }) => unwrap(await getShipmentCount('Booked', signal)), ...opts })
  const pending = useQuery({ queryKey: ['admin', 'pending-shops'], queryFn: async ({ signal }) => unwrap(await getPendingShops(signal)), ...opts })

  const countryName = (c: string) => countries.find((x) => x.country === c)?.name ?? c
  const waiting = pending.data ?? []
  const firstName = profile?.firstName ?? ''

  return (
    <>
      <AdminHead title={`Hello${firstName ? `, ${firstName}` : ''}`} sub="Here's what's happening on Phloem." />

      <div className={styles.stats}>
        <StatTile label="Shops waiting for approval" value={stats.data?.pendingApproval} tone="orange"
                  to="/admin/shops?status=pending" />
        <StatTile label="Live shops" value={stats.data?.approved} to="/admin/shops?status=live"
                  note={stats.data ? `${stats.data.blocked} blocked · ${stats.data.rejected} rejected` : undefined} />
        <StatTile label="People signed up" value={users.data?.totalCount} to="/admin/users" />
        <StatTile label="Dish names suggested" value={suggestions.data?.length} tone="orange" to="/admin/dishes" />
        <StatTile label="Parcels to receive at the hub" value={toReceive.data?.totalCount}
                  note="Booked, not weighed yet" />
      </div>

      <section className={styles.panel} aria-labelledby="attention-title">
        <div className={styles.panelHead}>
          <h2 id="attention-title">Needs your attention</h2>
          {waiting.length > 0 && <Link to="/admin/shops?status=pending">See all {waiting.length} ›</Link>}
        </div>
        {pending.isPending && <p className="muted" aria-busy="true">Loading…</p>}
        {pending.isError && <p className="muted">We couldn't load the shops waiting for approval.</p>}
        {pending.isSuccess && waiting.length === 0 && (suggestions.data?.length ?? 0) === 0 && (
          <p className={styles.allClear}>✓ No shops or dish names waiting. All caught up.</p>
        )}
        {(suggestions.data?.length ?? 0) > 0 && (
          <Link to="/admin/dishes" className={`${styles.attentionRow} ${styles.attentionDishes}`}>
            <span className={styles.initial} aria-hidden="true">🍲</span>
            <span className={styles.rowText}>
              <strong>{suggestions.data!.length} dish {suggestions.data!.length === 1 ? 'name' : 'names'} suggested by sellers</strong>
              <span className="muted">{suggestions.data!.slice(0, 3).map((s) => s.name).join(', ')}{suggestions.data!.length > 3 ? '…' : ''}</span>
            </span>
            <span className={styles.rowGo}>Review ›</span>
          </Link>
        )}
        <ul className={styles.attention}>
          {waiting.slice(0, 6).map((s) => (
            <li key={s.id}>
              <Link to={`/admin/shops/${s.id}`} className={styles.attentionRow}>
                <ApiImage src={s.logoUrl} alt="" className={styles.rowLogo} />
                <span className={styles.rowText}>
                  <strong>{s.name}</strong>
                  <span className="muted">{s.ownerName} · {countryName(s.country)} · opened {ago(s.openedAt)}</span>
                </span>
                <span className={styles.rowGo}>Review ›</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </>
  )
}
