import { useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
import { ApiImage } from '../../components/ui/ApiImage'
import { ButtonLink } from '../../components/ui/Button'
import { CountryFlag } from '../../components/ui/CountryFlag'
import { StatusBanner } from '../../components/ui/StatusBanner'
import { useCountry } from '../../state/CountryContext'
import { useSession } from '../../state/SessionContext'
import styles from './AccountHome.module.css'

/** The tiles' pictures: green line icons like the app's (no emojis, so they look the same on every computer). */
const ICONS: Record<string, ReactNode> = {
  orders: <><path d="M6 3h12v18l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5L6 21z" /><path d="M9 8h6M9 12h6M9 16h3" /></>,
  parcel: <><path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z" /><path d="M3 7.5 12 12l9-4.5M12 12v9M7.5 5.2l9 4.6" /></>,
  send: <><path d="M3 12 21 4l-6 16-3-7z" /><path d="m12 13 9-9" /></>,
  pin: <><path d="M12 21s-7-6.5-7-12a7 7 0 0 1 14 0c0 5.5-7 12-7 12z" /><circle cx="12" cy="9" r="2.5" /></>,
  shop: <><path d="M3 9 5 4h14l2 5M3 9h18M4 9v11h16V9M10 20v-6h4v6" /></>,
  shield: <><path d="M12 3 20 6v6c0 4.5-3.5 8-8 9-4.5-1-8-4.5-8-9V6z" /><path d="m9 12 2 2 4-4" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></>,
  lock: <><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
  phone: <><rect x="7" y="2.5" width="10" height="19" rx="2" /><path d="M11 18h2" /></>,
  bell: <><path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z" /><path d="M10 20a2 2 0 0 0 4 0" /></>,
  help: <><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6M12 17.2v.1" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7.5v.1" /></>,
  doc: <><path d="M6 3h9l4 4v14H6z" /><path d="M15 3v4h4M9 11h7M9 14h7M9 17h4" /></>,
  privacy: <><path d="M12 3 20 6v6c0 4.5-3.5 8-8 9-4.5-1-8-4.5-8-9V6z" /><rect x="9" y="11" width="6" height="5" rx="1" /><path d="M10 11V9.5a2 2 0 0 1 4 0V11" /></>,
}

/** One tile: icon, title, a line about it; the whole tile is the link. */
function Tile({ to, icon, title, sub, tone }: { to: string; icon: keyof typeof ICONS; title: string; sub: string; tone?: 'orange' }) {
  return (
    <li>
      <Link to={to} className={styles.tile}>
        <span className={`${styles.icon} ${tone === 'orange' ? styles.iconOrange : ''}`} aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            {ICONS[icon]}
          </svg>
        </span>
        <span className={styles.tileText}>
          <strong>{title}</strong>
          <span>{sub}</span>
        </span>
      </Link>
    </li>
  )
}

/**
 * My account, laid out for a big screen (tiles in a grid rather than the app's one long list): a profile band
 * (photo, name, Admin / Seller, email, country, member since, Edit profile), then the tiles in three groups:
 * Shopping (orders, shipments, addresses, send a parcel), Selling & admin (Seller dashboard or Become a seller;
 * Admin dashboard for admins), Account & security (profile, password, two-step sign-in, notifications), Help & info
 * (Help & support, About, Terms, Privacy); then Log out and "Delete my account". On a phone the tiles stack one under the other.
 */
export default function AccountPage() {
  const { profile, logout, isAdmin } = useSession()
  const { countries } = useCountry()
  const navigate = useNavigate()
  const [deleteNote, setDeleteNote] = useState(false)

  if (!profile) return null   // ProtectedRoute only shows this page to signed-in people

  const country = countries.find((c) => c.country === profile.country)
  const since = new Date(profile.memberSince).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
  const addresses = profile.addresses.length

  // Leave this signed-in-only page first, then sign out (otherwise it would send the person to Log in)
  const onLogout = async () => {
    await navigate('/')
    await logout()
  }

  return (
    <div className={`container ${styles.page}`}>
      <h1 className={styles.title}>My account</h1>

      {/* ── Who you are ── */}
      <section className={styles.profile} aria-label="Your details">
        {profile.photoUrl
          ? <ApiImage src={profile.photoUrl} alt="Your profile photo" className={styles.avatar} />
          : <span className={styles.initial} aria-hidden="true">{profile.firstName.charAt(0).toUpperCase()}</span>}
        <div className={styles.who}>
          <h2>
            {profile.fullName}
            {(isAdmin || profile.hasShop) && <span className={styles.pill}>{isAdmin ? 'Admin' : 'Seller'}</span>}
          </h2>
          <p>{profile.email}</p>
          <p className={styles.meta}>
            {country && <span className={styles.place}><CountryFlag country={country} /> {country.name} ·</span>}
            <span>Member since {since}</span>
          </p>
        </div>
        <div className={styles.profileActions}>
          <ButtonLink to="/account/edit" variant="plain" small>Edit profile</ButtonLink>
        </div>
      </section>
      {!profile.emailConfirmed && (
        <p className={styles.note}>
          Your email isn't confirmed yet. Look for the "Confirm your Phloem email" message in your inbox.
        </p>
      )}
      {!profile.hasPersonalDetails && (
        <p className={styles.noteSoft}>
          Add your date of birth and home address in <Link to="/account/edit">Edit profile</Link> to send parcels or
          sell on Phloem.
        </p>
      )}

      {/* ── Shopping ── */}
      <section aria-labelledby="shopping-title" className={styles.group}>
        <h2 id="shopping-title" className={styles.groupTitle}>Shopping</h2>
        <ul className={styles.tiles}>
          <Tile to="/orders" icon="orders" title="My orders" sub="Track, pay or buy again" />
          <Tile to="/shipments" icon="parcel" title="My shipments" sub="Parcels you've sent: track, pay or cancel" />
          <Tile to="/account/addresses" icon="pin" title="Delivery addresses"
                sub={addresses === 0 ? 'Add where your food should go' : `${addresses} saved · add or change`} />
          <Tile to="/send-parcel" icon="send" title="Send a parcel" sub="Between Ghana, Nigeria and the UK" />
        </ul>
      </section>

      {/* ── Selling & admin ── */}
      <section aria-labelledby="selling-title" className={styles.group}>
        <h2 id="selling-title" className={styles.groupTitle}>{isAdmin ? 'Selling & admin' : 'Selling'}</h2>
        <ul className={styles.tiles}>
          {profile.hasShop
            ? <Tile to="/seller" icon="shop" title="Seller dashboard" sub="Your shop, orders and dishes" tone="orange" />
            : <Tile to="/sell" icon="shop" title="Become a seller" sub="Start selling your food on Phloem" tone="orange" />}
          {isAdmin && (
            <Tile to="/admin" icon="shield" title="Admin dashboard" sub="Approve sellers, users and shipments" tone="orange" />
          )}
        </ul>
      </section>

      {/* ── Account & security ── */}
      <section aria-labelledby="settings-title" className={styles.group}>
        <h2 id="settings-title" className={styles.groupTitle}>Account & security</h2>
        <ul className={styles.tiles}>
          <Tile to="/account/edit" icon="user" title="Edit profile" sub="Photo, name, phone, country, home address" />
          <Tile to="/account/password" icon="lock" title="Change password" sub="Keep your account safe" />
          <Tile to="/account/two-factor" icon="phone" title="Two-step sign-in" sub="A code from your phone when you log in" />
          <Tile to="/account/notifications" icon="bell" title="Notifications" sub="Choose what Phloem tells you about" />
        </ul>
      </section>

      {/* ── Help & info ── */}
      <section aria-labelledby="help-title" className={styles.group}>
        <h2 id="help-title" className={styles.groupTitle}>Help &amp; info</h2>
        <ul className={styles.tiles}>
          <Tile to="/help" icon="help" title="Help & support" sub="Common questions and how to contact us" />
          <Tile to="/about" icon="info" title="About Phloem" sub="Our story" />
          <Tile to="/terms" icon="doc" title="Terms & Conditions" sub="The rules for buying, selling and parcels" />
          <Tile to="/privacy" icon="privacy" title="Privacy Policy" sub="What we keep about you and why" />
        </ul>
      </section>

      {/* ── Leave ── */}
      <div className={styles.leave}>
        <button type="button" className={styles.logout} onClick={onLogout}>Log out</button>
        <button type="button" className={styles.delete} onClick={() => setDeleteNote(true)} aria-expanded={deleteNote}>
          Delete my account
        </button>
      </div>
      {/* Same as the app: the API can't delete accounts yet */}
      <StatusBanner message={deleteNote
        ? "Deleting your account here is coming soon. To delete it now, email support@phloem.app from your " +
          "account's email address and we'll do it for you."
        : null} />
    </div>
  )
}
