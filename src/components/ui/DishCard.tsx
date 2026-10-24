import { Link } from 'react-router'
import type { DishCardDto } from '../../api/contracts/dtos'
import { ApiImage } from './ApiImage'
import styles from './Cards.module.css'
import { Price } from './Price'

/**
 * A dish tile, like the app's Popular Dishes cards: photo (from the API) with the rating as a dark "★ 4.7" badge on
 * it, then name, shop and price.
 * In lists it opens the dish's shop, where it can be ordered; on the shop's own page (`onShopPage`) it isn't a link.
 * ("Add to basket" arrives with the basket.)
 */
export function DishCard({ dish, onShopPage = false }: { dish: DishCardDto; onShopPage?: boolean }) {
  const content = (
    <>
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
        <span className={styles.name}>{dish.name}</span>
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
        </div>
      </div>
    </>
  )

  return onShopPage
    ? <article className={styles.card} style={{ transform: 'none' }}>{content}</article>
    : <Link to={`/shops/${dish.vendorId}`} className={styles.card}>{content}</Link>
}
