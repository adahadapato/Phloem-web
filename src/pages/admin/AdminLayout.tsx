import { useQuery } from '@tanstack/react-query'
import { NavLink, Outlet } from 'react-router'
import { unwrap } from '../../api/apiError'
import { getDishSuggestions, getShopStats } from '../../api/services/adminService'
import styles from './Admin.module.css'

/** The admin menu. `soon` items come in the next steps (shown so the admin sees what's coming). */
const MENU: { to: string; label: string; icon: string; end?: boolean; soon?: boolean }[] = [
  { to: '/admin', label: 'Overview', icon: '◎', end: true },
  { to: '/admin/shops', label: 'Shops', icon: '🏪' },
  { to: '/admin/users', label: 'Users', icon: '👥' },
  { to: '/admin/dishes', label: 'Dish names', icon: '🍲' },
  { to: '/admin/shipping', label: 'Shipping', icon: '📦' },
  { to: '/admin/pricing', label: 'Pricing', icon: '💷' },
  { to: '/admin/texts', label: 'Terms & Help', icon: '📄', soon: true },
]

/**
 * The admin area (admins only: the route is guarded by ProtectedRoute role="Admin"): a menu on the left on a big
 * screen (a row of chips that scrolls sideways on a phone), and the page on the right. Shops and Dish names show how
 * many wait for a decision.
 */
export default function AdminLayout() {
  const stats = useQuery({
    queryKey: ['admin', 'shop-stats'],
    queryFn: async ({ signal }) => unwrap(await getShopStats(signal)),
    staleTime: 30_000,
  })
  const suggestions = useQuery({
    queryKey: ['admin', 'dish-suggestions'],
    queryFn: async ({ signal }) => unwrap(await getDishSuggestions(signal)),
    staleTime: 30_000,
  })
  const counts: Record<string, number> = {
    '/admin/shops': stats.data?.pendingApproval ?? 0,
    '/admin/dishes': suggestions.data?.length ?? 0,
  }
  const link = ({ isActive }: { isActive: boolean }) => (isActive ? `${styles.navLink} ${styles.navOn}` : styles.navLink)

  return (
    <div className={`container ${styles.layout}`}>
      <aside className={styles.side}>
        <p className={styles.sideTitle}>Admin</p>
        <nav aria-label="Admin" className={styles.nav}>
          {MENU.map((m) => m.soon ? (
            <span key={m.to} className={`${styles.navLink} ${styles.navSoon}`} aria-disabled="true">
              <span aria-hidden="true">{m.icon}</span> {m.label} <small>Soon</small>
            </span>
          ) : (
            <NavLink key={m.to} to={m.to} end={m.end} className={link}>
              <span aria-hidden="true">{m.icon}</span> {m.label}
              {!!counts[m.to] && (
                <span className={styles.navCount} aria-label={`${counts[m.to]} waiting`}>{counts[m.to]}</span>
              )}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className={styles.main}>
        <Outlet />
      </div>
    </div>
  )
}
