import { Navigate, Outlet } from 'react-router'
import { useSession } from '../../state/SessionContext'

/**
 * The seller area: only for people who have a shop (also while it waits for approval, so they can upload documents
 * and get ready). Everyone else is sent to "Become a seller". Sits inside ProtectedRoute, so the person is signed in.
 */
export function SellerRoute() {
  const { profile } = useSession()
  if (!profile) return null
  if (!profile.hasShop) return <Navigate to="/sell" replace />
  return <Outlet />
}
