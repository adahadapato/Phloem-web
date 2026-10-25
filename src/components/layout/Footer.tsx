import { Link } from 'react-router'
import styles from './Footer.module.css'

/** The dark green footer on every page. */
export function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={`container ${styles.inner}`}>
        <div>
          <div className={styles.brand}>
            <img src="/images/logo.webp" alt="" width="40" height="40" />
            Phloem
          </div>
          <p className={styles.about}>
            African food from home cooks and food businesses in Ghana, Nigeria and the UK, and parcels between them.
          </p>
        </div>

        <nav aria-label="Food">
          <p className={styles.heading}>Food</p>
          <ul className={styles.links}>
            <li><Link to="/explore">Explore dishes</Link></li>
            <li><Link to="/shops">Shops</Link></li>
            <li><Link to="/orders">My orders</Link></li>
          </ul>
        </nav>

        <nav aria-label="Phloem">
          <p className={styles.heading}>Phloem</p>
          <ul className={styles.links}>
            <li><Link to="/track">Track a parcel</Link></li>
            <li><Link to="/about">About Phloem</Link></li>
            <li><Link to="/register">Create an account</Link></li>
          </ul>
        </nav>
      </div>
      <div className={`container ${styles.bottom}`}>
        © {new Date().getFullYear()} Phloem · <Link to="/terms">Terms &amp; Conditions</Link> ·{' '}
        <Link to="/privacy">Privacy Policy</Link>
      </div>
    </footer>
  )
}
