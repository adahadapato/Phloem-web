/**
 * Which staff permission opens which admin page. Shared by the admin menu and the admin layout's page check.
 *
 * The backend decides who holds which permission; this only decides what is SHOWN. The API checks every call.
 */
import { Permissions } from '../../api/contracts/permissions'

/** One item in the admin menu; `permission` = any of these opens it. */
export interface AdminMenuItem {
  to: string
  label: string
  icon: string
  end?: boolean
  permission: readonly string[]
}

/** The Overview shows shops, people, dish names and parcels: open to anyone who works on one of those. */
const OVERVIEW = [Permissions.ShopsManage, Permissions.UsersManage, Permissions.CatalogManage,
  Permissions.ParcelsManage] as const

/** Approvals: anyone who can propose or decide a change that needs a second person. */
export const APPROVALS = [Permissions.LegalPublish, Permissions.ShopsManage] as const

/** The admin menu, in order. */
export const ADMIN_MENU: AdminMenuItem[] = [
  { to: '/admin', label: 'Overview', icon: '◎', end: true, permission: OVERVIEW },
  { to: '/admin/shops', label: 'Shops', icon: '🏪', permission: [Permissions.ShopsManage] },
  { to: '/admin/orders', label: 'Orders', icon: '🧺', permission: [Permissions.OrdersView] },
  { to: '/admin/users', label: 'Users', icon: '👥', permission: [Permissions.UsersManage] },
  { to: '/admin/staff', label: 'Staff', icon: '🪪', permission: [Permissions.StaffManage] },
  { to: '/admin/dishes', label: 'Dish names', icon: '🍲', permission: [Permissions.CatalogManage] },
  { to: '/admin/shipping', label: 'Shipping', icon: '📦', permission: [Permissions.ParcelsManage, Permissions.ParcelsSettings] },
  { to: '/admin/pricing', label: 'Pricing', icon: '💷', permission: [Permissions.PricingManage, Permissions.Commission] },
  { to: '/admin/messages', label: 'Contact messages', icon: '✉', permission: [Permissions.ContactRead] },
  { to: '/admin/texts', label: 'Terms & Help', icon: '📄', permission: [Permissions.LegalPublish] },
  { to: '/admin/audit', label: 'Audit log', icon: '🧾', permission: [Permissions.AuditView] },
  // Two-person approval: whoever can publish Terms or block shops proposes; owners and Country managers decide
  { to: '/admin/approvals', label: 'Approvals', icon: '✅', permission: APPROVALS },
]

/** Pages inside an area that need something narrower than the area itself. */
const SUB_PAGES: { path: string; exact?: boolean; permission: readonly string[] }[] = [
  { path: '/admin/shipping', exact: true, permission: [Permissions.ParcelsSettings] },   // Routes & prices
  { path: '/admin/shipping/rules', permission: [Permissions.ParcelsSettings] },
  { path: '/admin/shipping/parcels', permission: [Permissions.ParcelsManage] },
]

/**
 * The permissions that open a page (any of them), or null for a page the admin area doesn't know.
 * @param pathname The address, e.g. "/admin/shipping/parcels/PHS-261102-000123".
 */
export function pagePermission(pathname: string): readonly string[] | null {
  const path = pathname.replace(/\/+$/, '') || '/'
  const sub = SUB_PAGES.find((p) => (p.exact ? path === p.path : path === p.path || path.startsWith(`${p.path}/`)))
  if (sub) return sub.permission

  // The longest menu address the page starts with
  const item = [...ADMIN_MENU]
    .sort((a, b) => b.to.length - a.to.length)
    .find((m) => (m.end ? path === m.to : path === m.to || path.startsWith(`${m.to}/`)))
  return item?.permission ?? null
}

/**
 * Where a menu item should lead for this person: Shipping opens on Parcels for someone who can't change routes.
 * @param item The menu item.
 * @param hasPermission The session's permission check.
 */
export function menuTarget(item: AdminMenuItem, hasPermission: (p: string | readonly string[]) => boolean): string {
  if (item.to === '/admin/shipping' && !hasPermission(Permissions.ParcelsSettings)) return '/admin/shipping/parcels'
  return item.to
}
