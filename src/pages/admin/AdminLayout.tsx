import { useQuery } from '@tanstack/react-query'
import { Navigate, NavLink, Outlet, useLocation } from 'react-router'
import { unwrap } from '../../api/apiError'
import { getContactMessages, getDishSuggestions, getShopStats } from '../../api/services/adminService'
import { useSession } from '../../state/SessionContext'
import styles from './Admin.module.css'

/**
 * The admin menu. `staff` items are also open to support agents (everything else is admins only).
 * `soon` items come in the next steps (shown so the admin sees what's coming).
 */
const MENU: { to: string; label: string; icon: string; end?: boolean; soon?: boolean; staff?: boolean }[] = [
  { to: '/admin', label: 'Overview', icon: '◎', end: true },
  { to: '/admin/shops', label: 'Shops', icon: '🏪' },
  { to: '/admin/users', label: 'Users', icon: '👥' },
  { to: '/admin/dishes', label: 'Dish names', icon: '🍲' },
  { to: '/admin/shipping', label: 'Shipping', icon: '📦' },
  { to: '/admin/pricing', label: 'Pricing', icon: '💷' },
  { to: '/admin/messages', label: 'Contact messages', icon: '✉', staff: true },
  { to: '/admin/texts', label: 'Terms & Help', icon: '📄' },
]

/**
 * The admin area: a menu on the left on a big screen (a row of chips that scrolls sideways on a phone), and the page
 * on the right. Admins see everything; support agents only Contact messages (the route lets both in, see routes.tsx;
 * a support agent opening another admin page is taken to the messages). Shops, Dish names and Contact messages show
 * how many wait.
 */
export default function AdminLayout() {
  const { isAdmin } = useSession()
  const location = useLocation()
  const stats = useQuery({
    queryKey: ['admin', 'shop-stats'],
    queryFn: async ({ signal }) => unwrap(await getShopStats(signal)),
    staleTime: 30_000,
    enabled: isAdmin,
  })
  const suggestions = useQuery({
    queryKey: ['admin', 'dish-suggestions'],
    queryFn: async ({ signal }) => unwrap(await getDishSuggestions(signal)),
    staleTime: 30_000,
    enabled: isAdmin,
  })
  const inbox = useQuery({
    queryKey: ['admin', 'contact-messages', 'count'],
    queryFn: async ({ signal }) => unwrap(await getContactMessages({ status: 'New', pageSize: 1 }, signal)),
    staleTime: 30_000,
  })
  const counts: Record<string, number> = {
    '/admin/shops': stats.data?.pendingApproval ?? 0,
    '/admin/dishes': suggestions.data?.length ?? 0,
    '/admin/messages': inbox.data?.newCount ?? 0,
  }
  const menu = MENU.filter((m) => isAdmin || m.staff)
  const link = ({ isActive }: { isActive: boolean }) => (isActive ? `${styles.navLink} ${styles.navOn}` : styles.navLink)

  if (!isAdmin && !location.pathname.startsWith('/admin/messages')) return <Navigate to="/admin/messages" replace />

  return (
    <div className={`container ${styles.layout}`}>
      <aside className={styles.side}>
        <p className={styles.sideTitle}>{isAdmin ? 'Admin' : 'Support'}</p>
        <nav aria-label="Admin" className={styles.nav}>
          {menu.map((m) => m.soon ? (
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
