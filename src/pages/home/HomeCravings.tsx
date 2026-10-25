import { useQueries } from '@tanstack/react-query'
import { Link } from 'react-router'
import { unwrap } from '../../api/apiError'
import { searchDishes } from '../../api/services/dishService'
import { ApiImage } from '../../components/ui/ApiImage'
import { dishCategories } from '../../components/ui/labels'
import { useCountry } from '../../state/CountryContext'
import styles from './HomePage.module.css'

/** A line under each category, in a restaurant-menu voice. */
const BLURB: Record<string, string> = {
  LocalMeals: 'Rice, soups & swallows',
  Snacks: 'Puff-puff, suya, kelewele',
  Drinks: 'Sobolo, zobo, chapman',
}

/**
 * "What are you craving?": a round photo per category (the best-rated dish of that category in the chosen country,
 * from the API), plus "Everything". Each opens Explore with that category.
 */
export function HomeCravings() {
  const { selected } = useCountry()
  const photos = useQueries({
    queries: dishCategories.map((c) => ({
      queryKey: ['dishes', 'home-craving', selected?.country, c.value],
      queryFn: async ({ signal }: { signal: AbortSignal }) =>
        unwrap(await searchDishes({ country: selected?.country, category: c.value, sort: 'Rating', pageSize: 1 }, signal)),
      enabled: !!selected,
      staleTime: 5 * 60_000,
    })),
  })

  return (
    <section className={`container ${styles.section}`} aria-labelledby="cravings-title">
      <p className={styles.eyebrow}>Our menu</p>
      <h2 id="cravings-title" className={styles.sectionTitle}>What are you craving?</h2>
      <ul className={styles.cravings}>
        {dishCategories.map((c, i) => (
          <li key={c.value}>
            <Link to={`/explore?category=${c.value}`} className={styles.craving}>
              <span className={styles.cravingRing}>
                <ApiImage src={photos[i]?.data?.items[0]?.imageUrl} alt="" className={styles.cravingPhoto} />
              </span>
              <strong>{c.label}</strong>
              <span>{BLURB[c.value] ?? 'See what’s cooking'}</span>
            </Link>
          </li>
        ))}
        <li>
          <Link to="/explore" className={styles.craving}>
            <span className={`${styles.cravingRing} ${styles.cravingAll}`} aria-hidden="true">
              <span>All</span>
            </span>
            <strong>Everything</strong>
            <span>Browse every dish</span>
          </Link>
        </li>
      </ul>
    </section>
  )
}
