import { Link } from 'react-router'
import { useCart } from '../../state/CartContext'
import styles from './BasketBar.module.css'

/**
 * The app's checkout bar, floating at the bottom of Home, Explore and shop pages while the basket has something:
 * "Your basket · 3 items", "View", and the orange "Checkout ›".
 */
export function BasketBar() {
  const { count } = useCart()
  if (count === 0) return null

  return (
    <div className={`container ${styles.wrap}`}>
      <div className={styles.bar} role="region" aria-label="Your basket">
        <div>
          <div className={styles.label}>Your basket</div>
          <div className={styles.count}>{count} {count === 1 ? 'item' : 'items'}</div>
        </div>
        <div className={styles.actions}>
          <Link to="/cart" className={styles.view}>View</Link>
          <Link to="/checkout" className={styles.checkout}>Checkout ›</Link>
        </div>
      </div>
    </div>
  )
}
