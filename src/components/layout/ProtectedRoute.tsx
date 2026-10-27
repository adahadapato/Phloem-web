import { Navigate, Outlet, useLocation } from 'react-router'
import { useSession } from '../../state/SessionContext'

/**
 * Pages that need a signed-in person (My orders, Checkout, Account…). Signed out → Log in, then straight back to
 * the page they wanted (?returnTo=…). Optionally limited to a role (e.g. Admin), or to any of several roles.
 */
export function ProtectedRoute({ role }: { role?: string | string[] }) {
  const { status, isInRole } = useSession()
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

  return <Outlet />
}
