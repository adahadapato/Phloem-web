/**
 * Every address on the website, in one place.
 * Pages load only when opened (React Router's `lazy`), so the first visit stays small. Each page file has a
 * default export.
 * Routes marked TEMPORARY show "Coming soon" (with `handle.title`) until their real page is built. Phase 1 order:
 * Home, Explore and shops, Log in / Sign up / Confirm email / Reset password, Basket / Checkout / My orders, Track.
 */
import type { ComponentType } from 'react'
import { createBrowserRouter, type RouteObject } from 'react-router'
import { PageShell } from './components/layout/PageShell'
import { ProtectedRoute } from './components/layout/ProtectedRoute'
import { Roles } from './api/contracts/roles'

/** Loads a page file only when its address is opened. */
const page = (load: () => Promise<{ default: ComponentType }>): Pick<RouteObject, 'lazy'> => ({
  lazy: async () => ({ Component: (await load()).default }),
})

/** TEMPORARY: "Coming soon" with the page's title, until the real page is built. */
const comingSoon = (title: string): Partial<RouteObject> => ({
  handle: { title },
  ...page(() => import('./pages/about/ComingSoonPage')),
})

export const router = createBrowserRouter([
  {
    element: <PageShell />,
    children: [
      { index: true, ...page(() => import('./pages/home/HomePage')) },
      { path: 'about', ...page(() => import('./pages/about/AboutPage')) },
      { path: 'explore', ...page(() => import('./pages/explore/FoodListingPage')) },
      { path: 'shops', ...page(() => import('./pages/explore/ShopsPage')) },
      { path: 'shops/:shopId', ...page(() => import('./pages/explore/ShopPage')) },

      { path: 'login', ...page(() => import('./pages/auth/LoginPage')) },
      { path: 'register', ...page(() => import('./pages/auth/RegisterPage')) },
      { path: 'confirm-email', ...page(() => import('./pages/auth/ConfirmEmailPage')) },
      { path: 'reset-password', ...page(() => import('./pages/auth/ResetPasswordPage')) },

      { path: 'cart', ...page(() => import('./pages/orders/CartPage')) },

      // TEMPORARY: open to everyone
      { path: 'track', ...comingSoon('Track a parcel') },
      { path: 'send-parcel', ...comingSoon('Send a parcel') },
      { path: 'sell', ...comingSoon('Sell food on Phloem') },

      // Signed-in only
      {
        element: <ProtectedRoute />,
        children: [
          { path: 'checkout', ...page(() => import('./pages/orders/CheckoutPage')) },
          { path: 'orders', ...page(() => import('./pages/orders/OrdersPage')) },
          { path: 'orders/:orderNumber', ...page(() => import('./pages/orders/OrderDetailsPage')) },
          { path: 'account', ...page(() => import('./pages/account/AccountPage')) },
          { path: 'account/edit', ...page(() => import('./pages/account/EditProfilePage')) },
          { path: 'account/addresses', ...page(() => import('./pages/account/AddressesPage')) },
          { path: 'account/notifications', ...page(() => import('./pages/account/NotificationsPage')) },
          { path: 'account/password', ...page(() => import('./pages/account/ChangePasswordPage')) },
          { path: 'account/two-factor', ...page(() => import('./pages/account/TwoFactorPage')) },

          // TEMPORARY: the seller area (people with a shop; linked from My account and the account menu)
          { path: 'seller', ...comingSoon('Seller dashboard') },
        ],
      },

      // Admins only (others are sent Home)
      {
        element: <ProtectedRoute role={Roles.Admin} />,
        children: [
          // TEMPORARY
          { path: 'admin', ...comingSoon('Admin dashboard') },
        ],
      },

      { path: '*', ...page(() => import('./pages/about/NotFoundPage')) },
    ],
  },
])
