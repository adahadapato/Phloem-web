import { useRef, type ReactNode } from 'react'
import { Link } from 'react-router'
import type { DishCardDto } from '../../api/contracts/dtos'
import { DishCard } from '../../components/ui/DishCard'
import styles from './HomePage.module.css'

/** One dish in a row, with the reason it was suggested (if any). */
export interface RowDish {
  dish: DishCardDto
  reason?: string
}

/**
 * A titled row of dish cards that slides sideways (arrows on a big screen, swipe on a phone): used by
 * "Top rated", "Order again", "You might like" and "Popular in …".
 * `status` is shown instead of the cards while there are none (placeholders, an error, "nothing here").
 */
export function HomeDishRow({ id, eyebrow, title, items, link, status }: {
  id: string
  eyebrow: string
  title: string
  items: RowDish[]
  link?: { to: string; label: string }
  status?: ReactNode
}) {
  const row = useRef<HTMLDivElement>(null)
  const slide = (direction: 1 | -1) =>
    row.current?.scrollBy({ left: direction * row.current.clientWidth * 0.8, behavior: 'smooth' })

  return (
    <section className={`container ${styles.section}`} aria-labelledby={id}>
      <div className={styles.sectionHead}>
        <div>
          <p className={styles.eyebrow}>{eyebrow}</p>
          <h2 id={id} className={styles.sectionTitle}>{title}</h2>
        </div>
        <div className={styles.headActions}>
          {link && <Link to={link.to} className={styles.seeAll}>{link.label}</Link>}
          {items.length > 3 && (
            <span className={styles.arrows}>
              <button type="button" onClick={() => slide(-1)} aria-label={`Previous: ${title}`}>‹</button>
              <button type="button" onClick={() => slide(1)} aria-label={`More: ${title}`}>›</button>
            </span>
          )}
        </div>
      </div>
      {items.length === 0 && status}
      {items.length > 0 && (
        <div ref={row} className={styles.slider}>
          {items.map((d) => <div key={d.dish.id} className={styles.slide}><DishCard dish={d.dish} reason={d.reason} /></div>)}
        </div>
      )}
    </section>
  )
}
