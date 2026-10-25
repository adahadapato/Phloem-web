import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { unwrap } from '../../api/apiError'
import { fileUrl } from '../../api/config'
import { getTopShops } from '../../api/services/shopService'
import { ApiImage } from '../../components/ui/ApiImage'
import { useCountry } from '../../state/CountryContext'
import styles from './HomePage.module.css'

/**
 * "Meet the cooks": the four best-rated shops in the chosen country, like a restaurant's "our chefs": a tall cover
 * photo (the brand green when there's none), the round logo, name with ✓, rating and number of dishes.
 * Hidden when the country has no shops yet.
 */
export function HomeCooks() {
  const { selected } = useCountry()
  const shops = useQuery({
    queryKey: ['shops', 'top', selected?.country, 4],
    queryFn: async ({ signal }) => unwrap(await getTopShops(selected?.country, 4, signal)),
    enabled: !!selected,
  })
  const list = shops.data ?? []
  if (list.length === 0) return null

  return (
    <section className={styles.cooksBand} aria-labelledby="cooks-title">
      <div className={`container ${styles.section}`}>
        <div className={styles.sectionHead}>
          <div>
            <p className={styles.eyebrow}>The kitchens</p>
            <h2 id="cooks-title" className={styles.sectionTitle}>Meet the cooks</h2>
          </div>
          <Link to="/shops" className={styles.seeAll}>All shops ›</Link>
        </div>
        <ul className={styles.cooks}>
          {list.map((s) => {
            const cover = fileUrl(s.coverPhotoUrl)
            return (
              <li key={s.id}>
                <Link to={`/shops/${s.id}`} className={styles.cook}>
                  <span className={styles.cookCover}>
                    {cover && <img src={cover} alt="" loading="lazy" decoding="async" />}
                  </span>
                  <ApiImage src={s.logoUrl} alt={`${s.name} logo`} className={styles.cookLogo} />
                  <span className={styles.cookBody}>
                    <strong>{s.name} {s.isVerified && <span className={styles.tick} title="Checked by Phloem">✓</span>}</strong>
                    <span className={styles.cookMeta}>
                      {s.ratingCount > 0
                        ? <><span className={styles.star} aria-hidden="true">★</span> {s.rating.toFixed(1)} ({s.ratingCount})</>
                        : 'New on Phloem'}
                      {' · '}{s.dishCount} {s.dishCount === 1 ? 'dish' : 'dishes'}
                    </span>
                    <span className={styles.cookGo}>Visit the kitchen ›</span>
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
