import { Navigate, Outlet, useLocation } from 'react-router'
import { useSession } from '../../state/SessionContext'

/**
 * Pages that need a signed-in person (My orders, Checkout, Account…). Signed out → Log in, then straight back to
 * the page they wanted (?returnTo=…).
 *
 * Optionally limited further (anyone who doesn't qualify is sent Home):
 * - `role`: a role, or any of several roles;
 * - `permission`: a staff permission, or any of several (owners always pass);
 * - `staff`: anyone with at least one staff permission (the admin area; each page inside checks its own).
 *
 * This only decides what is SHOWN: the API checks every call itself.
 */
export function ProtectedRoute({ role, permission, staff }: {
  role?: string | string[]
  permission?: string | string[]
  staff?: boolean
}) {
  const { status, isInRole, hasPermission, isStaff } = useSession()
  const location = useLocation()

  // A kept sign-in is still being restored: wait, so the page doesn't flash "Log in"
  if (status === 'loading') {
    return <div className="container" style={{ padding: '48px 16px' }} aria-busy="true">Loading…</div>
  }

  if (status === 'signedOut') {
    const returnTo = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/login?returnTo=${returnTo}`} replace />
  }

  const allowed = role === undefined ? [] : Array.isArray(role) ? role : [role]
  if (allowed.length > 0 && !allowed.some(isInRole)) return <Navigate to="/" replace />
  if (permission !== undefined && !hasPermission(permission)) return <Navigate to="/" replace />
  if (staff && !isStaff) return <Navigate to="/" replace />

  return <Outlet />
}
