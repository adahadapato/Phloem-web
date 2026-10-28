import { Suspense } from 'react'
import { Outlet, ScrollRestoration, useLocation } from 'react-router'
import { BasketBar } from './BasketBar'
import { Footer } from './Footer'
import { Header } from './Header'
import { TermsProvider } from '../../state/TermsContext'

/**
 * Every page's frame: green header, the page itself, footer. Pages scroll to the top when opened.
 * A page that is still loading (pages load on demand) shows a short "Loading…" in its place.
 * While browsing food (Home, Explore, Shops and a shop's page) the app's basket bar floats at the bottom.
 * TermsProvider shows "We've updated our Terms" / the Privacy notice when the signed-in person needs them.
 */
export function PageShell() {
  const { pathname } = useLocation()
  const browsing = pathname === '/' || pathname.startsWith('/explore') || pathname.startsWith('/shops')

  return (
    <TermsProvider>
      <a href="#main" className="skip-link">Skip to content</a>
      <Header />
      <main id="main">
        <Suspense fallback={<div className="container" style={{ padding: '48px 16px' }} aria-busy="true">Loading…</div>}>
          <Outlet />
        </Suspense>
        {browsing && <BasketBar />}
      </main>
      <Footer />
      <ScrollRestoration />
    </TermsProvider>
  )
}
