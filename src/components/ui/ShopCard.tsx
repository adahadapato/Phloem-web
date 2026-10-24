import { Link } from 'react-router'
import type { ShopListItemDto } from '../../api/contracts/dtos'
import { fileUrl } from '../../api/config'
import { ApiImage } from './ApiImage'
import styles from './Cards.module.css'
import { Stars } from './Stars'

/**
 * A shop tile, like the app's Top Sellers cards: cover photo (or the brand green), round logo, name, ✓ Verified,
 * rating, number of dishes, "View shop". Pictures come from the API.
 */
export function ShopCard({ shop }: { shop: ShopListItemDto }) {
  const cover = fileUrl(shop.coverPhotoUrl)

  return (
    <Link to={`/shops/${shop.id}`} className={styles.card}>
      <div className={styles.cover}>
        {cover && <img className={styles.coverPhoto} src={cover} alt="" loading="lazy" decoding="async" />}
        <ApiImage src={shop.logoUrl} alt={`${shop.name} logo`} className={styles.logo} />
      </div>
      <div className={`${styles.body} ${styles.shopBody}`}>
        <span className={styles.name}>{shop.name}</span>
        {shop.isVerified && <span className={styles.verified} style={{ alignSelf: 'flex-start' }}>✓ Verified</span>}
        <div className={styles.footer}>
          <Stars rating={shop.rating} count={shop.ratingCount} />
          <span className="muted">{shop.dishCount} {shop.dishCount === 1 ? 'dish' : 'dishes'}</span>
        </div>
        <span className={styles.viewShop}>View shop ›</span>
      </div>
    </Link>
  )
}
