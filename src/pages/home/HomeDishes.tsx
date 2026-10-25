import { useQuery } from '@tanstack/react-query'
import { useRef } from 'react'
import { Link } from 'react-router'
import { unwrap } from '../../api/apiError'
import { searchDishes } from '../../api/services/dishService'
import { DishCard } from '../../components/ui/DishCard'
import { ListStatus } from '../../components/ui/ListStatus'
import { useCountry } from '../../state/CountryContext'
import styles from './HomePage.module.css'

const COUNT = 12

/**
 * "Top rated near you": the best-rated dishes in the chosen country in a row that slides sideways (arrows on a big
 * screen, swipe on a phone), each with the usual green "+" to put it in the basket.
 */
export function HomeDishes() {
  const country = useCountry()
  const { selected } = country
  const row = useRef<HTMLDivElement>(null)
  const dishes = useQuery({
    queryKey: ['dishes', 'home', selected?.country, undefined],
    queryFn: async ({ signal }) => unwrap(await searchDishes({ country: selected?.country, sort: 'Rating', pageSize: COUNT }, signal)),
    enabled: !!selected,
  })
  const slide = (direction: 1 | -1) =>
    row.current?.scrollBy({ left: direction * row.current.clientWidth * 0.8, behavior: 'smooth' })
  const items = dishes.data?.items ?? []

  return (
    <section className={`container ${styles.section}`} aria-labelledby="dishes-title">
      <div className={styles.sectionHead}>
        <div>
          <p className={styles.eyebrow}>Chef’s picks</p>
          <h2 id="dishes-title" className={styles.sectionTitle}>Top rated {selected ? `in ${selected.name}` : 'near you'}</h2>
        </div>
        <div className={styles.headActions}>
          <Link to="/explore" className={styles.seeAll}>See the full menu ›</Link>
          {items.length > 3 && (
            <span className={styles.arrows}>
              <button type="button" onClick={() => slide(-1)} aria-label="Previous dishes">‹</button>
              <button type="button" onClick={() => slide(1)} aria-label="More dishes">›</button>
            </span>
          )}
        </div>
      </div>
      <ListStatus isLoading={!selected ? country.isLoading : dishes.isPending}
                  error={!selected ? country.error : dishes.error}
                  onRetry={!selected ? country.reload : () => void dishes.refetch()}
                  isEmpty={items.length === 0} placeholders={4}
                  emptyText="No dishes here yet. Check back soon, or pick another country at the top." />
      {items.length > 0 && (
        <div ref={row} className={styles.slider}>
          {items.map((d) => <div key={d.id} className={styles.slide}><DishCard dish={d} /></div>)}
        </div>
      )}
    </section>
  )
}
