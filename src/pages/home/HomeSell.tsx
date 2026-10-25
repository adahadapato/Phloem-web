import { Link } from 'react-router'
import styles from './HomePage.module.css'

/** "Cook for Phloem": the invitation to sell, beside a picture. Every promise here is how Phloem really works. */
export function HomeSell() {
  return (
    <section className={`container ${styles.section}`} aria-labelledby="sell-title">
      <div className={styles.sell}>
        <div className={styles.sellPicture}>
          <img src="/images/sell-food.webp" alt="" width="640" height="499" loading="lazy" />
        </div>
        <div className={styles.sellText}>
          <p className={styles.eyebrow}>For home cooks & kitchens</p>
          <h2 id="sell-title" className={styles.sectionTitle}>Cook for Phloem</h2>
          <p>Turn your kitchen into a business. Open your shop for free and reach hungry customers near you.</p>
          <ul className={styles.ticks}>
            <li>Set your own prices, within fair ranges for each dish</li>
            <li>Your delivery fee is yours, in full</li>
            <li>Earn the ✓ badge that buyers trust</li>
          </ul>
          <Link to="/sell" className={styles.orangeButton}>Become a seller</Link>
        </div>
      </div>
    </section>
  )
}
