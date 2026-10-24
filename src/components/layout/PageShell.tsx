import { Suspense } from 'react'
import { Outlet, ScrollRestoration } from 'react-router'
import { Footer } from './Footer'
import { Header } from './Header'

/**
 * Every page's frame: green header, the page itself, footer. Pages scroll to the top when opened.
 * A page that is still loading (pages load on demand) shows a short "Loading…" in its place.
 */
export function PageShell() {
  return (
    <>
      <a href="#main" className="skip-link">Skip to content</a>
      <Header />
      <main id="main">
        <Suspense fallback={<div className="container" style={{ padding: '48px 16px' }} aria-busy="true">Loading…</div>}>
          <Outlet />
        </Suspense>
      </main>
      <Footer />
      <ScrollRestoration />
    </>
  )
}
