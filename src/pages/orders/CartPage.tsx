import { Link } from 'react-router'
import { ApiImage } from '../../components/ui/ApiImage'
import { ButtonLink } from '../../components/ui/Button'
import { Price } from '../../components/ui/Price'
import { QuantityStepper } from '../../components/ui/QuantityStepper'
import { useCart } from '../../state/CartContext'
import styles from './Orders.module.css'

/**
 * The basket: dishes grouped by shop (each shop becomes its own order at checkout), with − / + and Remove, and a
 * subtotal per shop at the prices when added. Delivery fees and today's prices are worked out at Checkout.
 */
export default function CartPage() {
  const cart = useCart()

  if (cart.count === 0) {
    return (
      <div className={`container ${styles.page}`}>
        <div className={`${styles.inner} ${styles.empty}`}>
          <img src="/images/buy-food.webp" alt="" width="640" height="536" />
          <h1>Your basket is empty</h1>
          <p className="muted">Tap the green + on any dish to add it.</p>
          <ButtonLink to="/explore">Browse dishes</ButtonLink>
        </div>
      </div>
    )
  }

  const shopCount = cart.shops.length

  return (
    <div className={`container ${styles.page}`}>
      <div className={styles.inner}>
        <div className={styles.heading}>
          <div>
            <h1>Your basket</h1>
            <p className="muted">
              {cart.count} {cart.count === 1 ? 'item' : 'items'}
              {shopCount > 1 && ` from ${shopCount} shops: each shop is a separate order with its own delivery`}
            </p>
          </div>
          <Link to="/explore">+ Add more</Link>
        </div>

        {cart.shops.map((shop) => (
          <section key={shop.shopId} className={styles.card} aria-label={shop.shopName}>
            <div className={styles.shopHead}>
              <Link to={`/shops/${shop.shopId}`} className={styles.shopName}>🌿 {shop.shopName}</Link>
            </div>

            {shop.lines.map((line) => (
              <div key={line.dishId} className={styles.line}>
                <ApiImage src={line.imageUrl} alt="" className={styles.thumb} />
                <div className={styles.lineText}>
                  <div className={styles.lineName}>{line.name}</div>
                  <div className="muted"><Price amount={line.price} currency={line.currency} /> each</div>
                </div>
                <div className={styles.lineEnd}>
                  <QuantityStepper quantity={line.quantity} label={line.name}
                                   onAdd={() => cart.setQuantity(line.dishId, 1)}
                                   onChange={(q) => cart.setQuantity(line.dishId, q)} />
                  <button type="button" className={styles.remove} onClick={() => cart.remove(line.dishId)}>
                    Remove
                  </button>
                </div>
              </div>
            ))}

            <div className={styles.totalRow}>
              <span>Subtotal</span>
              <Price amount={shop.subtotal} currency={shop.currency} />
            </div>
          </section>
        ))}

        <div className={styles.summary}>
          <p className="muted">Delivery fees and today's prices are worked out at checkout.</p>
          <ButtonLink to="/checkout" variant="cta">Checkout ›</ButtonLink>
        </div>
      </div>
    </div>
  )
}
