import { Link } from 'react-router'
import styles from './HomePage.module.css'
import { WaxPattern } from './WaxPattern'

/** "Send food home": the parcel service between Ghana / Nigeria and the UK, on a dark green band. */
export function HomeSendHome() {
  return (
    <section className={styles.sendBand} aria-labelledby="send-title">
      <WaxPattern className={styles.bandPattern} />
      <div className={`container ${styles.sendInner}`}>
        <div className={styles.sendText}>
          <p className={styles.eyebrow}>Phloem parcels</p>
          <h2 id="send-title" className={styles.sendTitle}>Send a taste of home</h2>
          <p>
            Gari, shito, spices, clothes and more between Ghana, Nigeria and the United Kingdom. Book online, drop it
            at our hub, and follow it all the way.
          </p>
          <div className={styles.sendButtons}>
            <Link to="/send-parcel" className={styles.orangeButton}>Send a parcel</Link>
            <Link to="/track" className={styles.ghostButton}>Track a parcel</Link>
          </div>
        </div>
        <img className={styles.sendImage} src="/images/global-shipping.webp" alt="" width="1600" height="538" loading="lazy" />
      </div>
    </section>
  )
}
