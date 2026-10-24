import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { ApiImage } from '../../components/ui/ApiImage'
import { StatusBanner } from '../../components/ui/StatusBanner'
import { useCountry } from '../../state/CountryContext'
import { useSession } from '../../state/SessionContext'
import styles from './Account.module.css'

/** One tappable settings row, like the app's: icon, title, small line, ›. */
function Row({ to, icon, title, sub }: { to: string; icon: string; title: string; sub?: string }) {
  return (
    <li>
      <Link to={to} className={styles.rowLink}>
        <span className={styles.rowIcon} aria-hidden="true">{icon}</span>
        <span className={styles.rowText}>
          <span className={styles.rowTitle}>{title}</span>
          {sub && <span className="muted">{sub}</span>}
        </span>
        <span className={styles.chevron} aria-hidden="true">›</span>
      </Link>
    </li>
  )
}

/**
 * My account, like the app's: who you are (photo, name, email, country, member since, Admin / Seller), then
 * My orders, Delivery addresses, Seller dashboard (or "Become a seller" without a shop), Admin dashboard (admins
 * only), the settings (Edit profile, Change password, Two-step sign-in, Notifications), Log out and
 * "Delete my account".
 */
export default function AccountPage() {
  const { profile, logout, isAdmin } = useSession()
  const { countries } = useCountry()
  const navigate = useNavigate()
  const [deleteNote, setDeleteNote] = useState(false)

  if (!profile) return null   // ProtectedRoute only shows this page to signed-in people

  const country = countries.find((c) => c.country === profile.country)
  const since = new Date(profile.memberSince).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })

  // Leave this signed-in-only page first, then sign out (otherwise it would send the person to Log in)
  const onLogout = async () => {
    await navigate('/')
    await logout()
  }

  return (
    <div className={`container ${styles.page}`}>
      <div className={styles.inner}>
        <h1 className={styles.heading}>My account</h1>

        <section className={styles.card} aria-label="Your details">
          <div className={styles.who}>
            {profile.photoUrl
              ? <ApiImage src={profile.photoUrl} alt="Your profile photo" className={styles.avatar} />
              : <span className={styles.initial} aria-hidden="true">{profile.firstName.charAt(0).toUpperCase()}</span>}
            <div>
              <h2>
                {profile.fullName}
                {(isAdmin || profile.hasShop) && (
                  <span className={styles.pill}>{isAdmin ? 'Admin' : 'Seller'}</span>
                )}
              </h2>
              <p className="muted">{profile.email}</p>
              <p className="muted">
                {country ? `${country.name} · ` : ''}Member since {since}
              </p>
            </div>
          </div>
          {!profile.emailConfirmed && (
            <p className={styles.note}>
              Your email isn't confirmed yet. Look for the "Confirm your Phloem email" message in your inbox.
            </p>
          )}
        </section>

        <section className={styles.card} aria-label="Shopping">
          <ul className={styles.list}>
            <Row to="/orders" icon="🧾" title="My orders" sub="Track, pay or buy again" />
            <Row to="/account/addresses" icon="📍" title="Delivery addresses"
                 sub={profile.addresses.length === 0 ? 'Add where your food should go'
                   : `${profile.addresses.length} saved`} />
            {/* Like the app: the seller area once the person has a shop, otherwise the way to open one */}
            {profile.hasShop
              ? <Row to="/seller" icon="🏪" title="Seller dashboard" sub="Your shop, orders and dishes" />
              : <Row to="/sell" icon="🏪" title="Become a seller" sub="Start selling your food on Phloem" />}
            {isAdmin && (
              <Row to="/admin" icon="🛡️" title="Admin dashboard" sub="Approve sellers, users and shipments" />
            )}
          </ul>
        </section>

        <section className={styles.card} aria-labelledby="settings-title">
          <h2 id="settings-title" className={styles.cardTitle}>Settings</h2>
          <ul className={styles.list}>
            <Row to="/account/edit" icon="👤" title="Edit profile" sub="Photo, name, phone, country" />
            <Row to="/account/password" icon="🔒" title="Change password" sub="Keep your account safe" />
            <Row to="/account/two-factor" icon="🛡️" title="Two-step sign-in" sub="A code from your phone when you log in" />
            <Row to="/account/notifications" icon="🔔" title="Notifications" sub="Choose what Phloem tells you about" />
          </ul>
        </section>

        <section className={styles.card} aria-label="Leave">
          <ul className={styles.list}>
            <li>
              <button type="button" className={styles.rowLink} onClick={onLogout}>
                <span className={styles.rowIcon} aria-hidden="true">↩</span>
                <span className={styles.rowText}><span className={styles.rowTitle}>Log out</span></span>
              </button>
            </li>
            <li>
              <button type="button" className={`${styles.rowLink} ${styles.danger}`}
                      onClick={() => setDeleteNote(true)} aria-expanded={deleteNote}>
                <span className={styles.rowIcon} aria-hidden="true">🗑</span>
                <span className={styles.rowText}><span className={styles.rowTitle}>Delete my account</span></span>
              </button>
            </li>
          </ul>
          {/* Same as the app: the API can't delete accounts yet */}
          <StatusBanner message={deleteNote
            ? "Deleting your account here is coming soon. To delete it now, email support@phloem.app from your " +
              "account's email address and we'll do it for you."
            : null} />
        </section>
      </div>
    </div>
  )
}
