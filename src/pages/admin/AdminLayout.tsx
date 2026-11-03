import { useQuery } from '@tanstack/react-query'
import { Navigate, NavLink, Outlet, useLocation } from 'react-router'
import { unwrap } from '../../api/apiError'
import { Permissions } from '../../api/contracts/permissions'
import { getContactMessages, getDishSuggestions, getShopStats } from '../../api/services/adminService'
import { getApprovalCount } from '../../api/services/approvalService'
import { getModerationCount } from '../../api/services/moderationService'
import { useSession } from '../../state/SessionContext'
import styles from './Admin.module.css'
import { ADMIN_MENU, APPROVALS, menuTarget, pagePermission } from './adminAccess'

/**
 * The admin area: a menu on the left on a big screen (a row of chips that scrolls sideways on a phone), and the page
 * on the right.
 *
 * Everyone sees only the pages their permissions open (owners see everything): the backend sends the permissions
 * with the sign-in, and the API still checks every call. Opening a page you can't use takes you to your first page.
 * Shops, Dish names, Contact messages and Approvals show how many wait.
 */
export default function AdminLayout() {
  const { isAdmin, hasPermission } = useSession()
  const location = useLocation()
  const stats = useQuery({
    queryKey: ['admin', 'shop-stats'],
    queryFn: async ({ signal }) => unwrap(await getShopStats(signal)),
    staleTime: 30_000,
    enabled: hasPermission(Permissions.ShopsManage),
  })
  const suggestions = useQuery({
    queryKey: ['admin', 'dish-suggestions'],
    queryFn: async ({ signal }) => unwrap(await getDishSuggestions(signal)),
    staleTime: 30_000,
    enabled: hasPermission(Permissions.CatalogManage),
  })
  const inbox = useQuery({
    queryKey: ['admin', 'contact-messages', 'count'],
    queryFn: async ({ signal }) => unwrap(await getContactMessages({ status: 'New', pageSize: 1 }, signal)),
    staleTime: 30_000,
    enabled: hasPermission(Permissions.ContactRead),
  })
  const approvals = useQuery({
    queryKey: ['admin', 'approvals', 'count'],
    queryFn: async ({ signal }) => unwrap(await getApprovalCount(signal)),
    staleTime: 30_000,
    enabled: hasPermission(APPROVALS),
  })
  const moderation = useQuery({
    queryKey: ['admin', 'moderation', 'count'],
    queryFn: async ({ signal }) => unwrap(await getModerationCount(signal)),
    staleTime: 30_000,
    enabled: hasPermission(Permissions.ShopsManage),
  })
  const counts: Record<string, number> = {
    '/admin/moderation': moderation.data ?? 0,
    '/admin/approvals': approvals.data ?? 0,
    '/admin/shops': stats.data?.pendingApproval ?? 0,
    '/admin/dishes': suggestions.data?.length ?? 0,
    '/admin/messages': inbox.data?.newCount ?? 0,
  }
  const menu = ADMIN_MENU.filter((m) => hasPermission(m.permission))
  const link = ({ isActive }: { isActive: boolean }) => (isActive ? `${styles.navLink} ${styles.navOn}` : styles.navLink)

  // A page this person can't use: go to their first page instead
  const needed = pagePermission(location.pathname)
  if (menu.length > 0 && (needed === null || !hasPermission(needed))) {
    const first = menuTarget(menu[0], hasPermission)
    if (first !== location.pathname) return <Navigate to={first} replace />
  }

  return (
    <div className={`container ${styles.layout}`}>
      <aside className={styles.side}>
        <p className={styles.sideTitle}>{isAdmin ? 'Admin' : 'Staff'}</p>
        <nav aria-label="Admin" className={styles.nav}>
          {menu.map((m) => (
            <NavLink key={m.to} to={menuTarget(m, hasPermission)} end={m.end} className={link}>
              <span aria-hidden="true">{m.icon}</span> {m.label}
              {!!counts[m.to] && (
                <span className={styles.navCount} aria-label={`${counts[m.to]} waiting`}>{counts[m.to]}</span>
              )}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className={styles.main}>
        {menu.length === 0 ? (
          <p className="muted">
            Your job role doesn't have any pages here yet. They arrive as each part of Phloem is built.
          </p>
        ) : <Outlet />}
      </div>
    </div>
  )
}
