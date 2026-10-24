import { useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router'
import { useSession } from '../../state/SessionContext'
import { CountryPicker } from './CountryPicker'
import styles from './Header.module.css'

/** The main links. Same places as the app's tabs (Home, Explore, Orders, Account), plus parcel tracking. */
const links = [
  { to: '/', label: 'Home', end: true },
  { to: '/explore', label: 'Explore' },
  { to: '/shops', label: 'Shops' },
  { to: '/track', label: 'Track a parcel' },
  { to: '/orders', label: 'My orders' },
]

/**
 * The green bar at the top of every page, like the app's header: logo, links, the country (flag) picker, and
 * Log in / the person's name. On phones the links fold into a ☰ menu.
 */
export function Header() {
  const { status, profile } = useSession()
  const { pathname } = useLocation()

  // The phone menu belongs to the page it was opened on, so moving to another page closes it by itself
  const [menuOpenOn, setMenuOpenOn] = useState<string | null>(null)
  const menuOpen = menuOpenOn === pathname
  const setMenuOpen = (open: (current: boolean) => boolean) => setMenuOpenOn(open(menuOpen) ? pathname : null)

  return (
    <header className={styles.header}>
      <span className={styles.ring} aria-hidden="true" />
      <div className={`container ${styles.bar}`}>
        <button type="button" className={styles.menuButton} onClick={() => setMenuOpen((o) => !o)}
                aria-expanded={menuOpen} aria-controls="main-nav" aria-label="Menu">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"
               strokeLinecap="round" aria-hidden="true">
            {menuOpen ? <path d="M5 5l14 14M19 5L5 19" /> : <path d="M2 5h20M2 12h20M2 19h20" />}
          </svg>
        </button>

        <Link to="/" className={styles.brand} aria-label="Phloem home">
          <img src="/images/logo.webp" alt="" width="38" height="38" />
          <span>Phloem</span>
        </Link>

        <nav id="main-nav" className={`${styles.nav} ${menuOpen ? styles.navOpen : ''}`} aria-label="Main">
          {links.map((link) => (
            <NavLink key={link.to} to={link.to} end={link.end}
                     className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ''}`}>
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className={styles.actions}>
          <CountryPicker />

          {status === 'signedIn' && profile ? (
            <Link to="/account" className={styles.account}>{profile.firstName}</Link>
          ) : status === 'signedOut' ? (
            <Link to="/login" className={styles.signIn}>Log in</Link>
          ) : null}
        </div>
      </div>
    </header>
  )
}
