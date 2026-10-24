import { Link } from 'react-router'
import type { DishCardDto } from '../../api/contracts/dtos'
import { useCart } from '../../state/CartContext'
import { ApiImage } from './ApiImage'
import styles from './Cards.module.css'
import { Price } from './Price'
import { QuantityStepper } from './QuantityStepper'

/**
 * A dish tile, like the app's Popular Dishes cards: photo (from the API) with the rating as a dark "★ 4.7" badge,
 * then name, shop, price and the round green "+" (then "− 2 +") to put it in the basket.
 * In lists the whole card opens the dish's shop (an invisible link over the card, with the basket buttons above
 * it); on the shop's own page (`onShopPage`) only the basket buttons do something.
 */
export function DishCard({ dish, onShopPage = false }: { dish: DishCardDto; onShopPage?: boolean }) {
  const cart = useCart()

  return (
    <article className={`${styles.card} ${onShopPage ? styles.static : ''}`}>
      <div className={styles.photoBox}>
        <ApiImage src={dish.imageUrl} alt={`${dish.name} from ${dish.vendorName}`} className={styles.photo} />
        <span className={styles.ratingBadge}
              aria-label={dish.ratingCount > 0
                ? `Rated ${dish.rating.toFixed(1)} out of 5 by ${dish.ratingCount} ${dish.ratingCount === 1 ? 'person' : 'people'}`
                : 'Not rated yet'}>
          {dish.ratingCount > 0
            ? <><span className={styles.star} aria-hidden="true">★</span> {dish.rating.toFixed(1)}</>
            : 'New'}
        </span>
      </div>
      <div className={styles.body}>
        {onShopPage ? (
          <span className={styles.name}>{dish.name}</span>
        ) : (
          <Link to={`/shops/${dish.vendorId}`} className={`${styles.name} ${styles.stretched}`}>{dish.name}</Link>
        )}
        {onShopPage ? (
          dish.description && <span className="muted">{dish.description}</span>
        ) : (
          <span className={styles.shop}>
            <span aria-hidden="true">🌿</span>
            <span className={styles.shopName}>{dish.vendorName}</span>
            {dish.isVerifiedShop && <span className={styles.verified} title="Verified shop">✓</span>}
          </span>
        )}
        <div className={styles.footer}>
          <Price amount={dish.price} currency={dish.currency} />
          <span className={styles.aboveLink}>
            <QuantityStepper quantity={cart.quantityOf(dish.id)} label={dish.name}
                             onAdd={() => cart.add(dish)} onChange={(q) => cart.setQuantity(dish.id, q)} />
          </span>
        </div>
      </div>
    </article>
  )
}
