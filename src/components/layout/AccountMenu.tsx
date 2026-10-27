import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Roles } from '../../api/contracts/roles'
import { ApiImage } from '../ui/ApiImage'
import { useSession } from '../../state/SessionContext'
import styles from './HeaderMenu.module.css'

/**
 * The signed-in person in the header: their photo (or initial) and first name; opens a menu with My account,
 * My orders, My shipments, Seller dashboard (people with a shop), Admin dashboard (admins) and Log out. Closes on a pick, on Escape, or on a click outside.
 */
export function AccountMenu() {
  const { profile, logout, isAdmin, isInRole } = useSession()
  const isSupport = !isAdmin && isInRole(Roles.SupportAgent)
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onClick = (event: MouseEvent) => {
      if (!box.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!profile) return null

  const onLogout = async () => {
    setOpen(false)
    // Leave any signed-in-only page first, then sign out (otherwise it would send the person to Log in)
    await navigate('/')
    await logout()
  }

  return (
    <div className={styles.picker} ref={box}>
      <button type="button" className={styles.pill} onClick={() => setOpen((o) => !o)}
              aria-haspopup="menu" aria-expanded={open} aria-label={`Account menu for ${profile.firstName}`}>
        {profile.photoUrl ? (
          <ApiImage src={profile.photoUrl} alt="" className={styles.avatar} />
        ) : (
          <span className={styles.initial} aria-hidden="true">{profile.firstName.charAt(0).toUpperCase()}</span>
        )}
        <span className={styles.name}>{profile.firstName}</span>
        <svg className={styles.chevron} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2"
             strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d={open ? 'M2 8l4-4 4 4' : 'M2 4l4 4 4-4'} />
        </svg>
      </button>

      {open && (
        <ul className={styles.list} role="menu">
          <li role="none">
            <Link role="menuitem" className={styles.option} to="/account" onClick={() => setOpen(false)}>
              My account
            </Link>
          </li>
          <li role="none">
            <Link role="menuitem" className={styles.option} to="/orders" onClick={() => setOpen(false)}>
              My orders
            </Link>
          </li>
          <li role="none">
            <Link role="menuitem" className={styles.option} to="/shipments" onClick={() => setOpen(false)}>
              My shipments
            </Link>
          </li>
          {profile.hasShop && (
            <li role="none">
              <Link role="menuitem" className={styles.option} to="/seller" onClick={() => setOpen(false)}>
                Seller dashboard
              </Link>
            </li>
          )}
          {isAdmin && (
            <li role="none">
              <Link role="menuitem" className={styles.option} to="/admin" onClick={() => setOpen(false)}>
                Admin dashboard
              </Link>
            </li>
          )}
          {isSupport && (
            <li role="none">
              <Link role="menuitem" className={styles.option} to="/admin/messages" onClick={() => setOpen(false)}>
                Contact messages
              </Link>
            </li>
          )}
          <li role="none">
            <Link role="menuitem" className={styles.option} to="/help" onClick={() => setOpen(false)}>
              Help &amp; support
            </Link>
          </li>
          <li role="none">
            <button type="button" role="menuitem" className={styles.option} onClick={onLogout}>Log out</button>
          </li>
        </ul>
      )}
    </div>
  )
}
