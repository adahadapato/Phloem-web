import { useQuery } from '@tanstack/react-query'
import { unwrap } from '../../api/apiError'
import type { ReviewKind } from '../../api/contracts/enums'
import { getPublicReviews } from '../../api/services/reviewService'
import { StarText } from './StarText'
import styles from './Reviews.module.css'

const monthYear = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })

/**
 * "What our customers say": the newest public reviews with the average score. Hidden when there are none (for Home
 * and Send a parcel the API returns none until there are at least 3, so the section never looks empty).
 * @param kind Only order or only parcel reviews.
 * @param vendorId A shop's own reviews (shop page).
 * @param compact The smaller heading for inside a page (the shop page) rather than a Home band.
 */
export function CustomerReviews({ kind, vendorId, eyebrow = 'Reviews', title = 'What our customers say', compact = false }: {
  kind?: ReviewKind; vendorId?: string; eyebrow?: string; title?: string; compact?: boolean
}) {
  const reviews = useQuery({
    queryKey: ['reviews', 'public', kind ?? 'all', vendorId ?? 'all'],
    queryFn: async ({ signal }) => unwrap(await getPublicReviews({ kind, vendorId, take: 6 }, signal)),
    staleTime: 5 * 60_000,
  })
  const data = reviews.data
  if (!data || data.items.length === 0) return null

  const inner = (
    <>
      <div className={styles.head}>
        <div>
          {!compact && <p className={styles.eyebrow}>{eyebrow}</p>}
          <h2 id={`reviews-${vendorId ?? kind ?? 'all'}`} className={compact ? styles.titleSmall : styles.title}>{title}</h2>
        </div>
        <div className={styles.summary}>
          <span className={styles.summaryScore}>{data.averageStars.toFixed(1)}</span>
          <StarText stars={data.averageStars} />
          <span className="muted" style={{ fontWeight: 400 }}>
            from {data.count} {data.count === 1 ? 'review' : 'reviews'}
          </span>
        </div>
      </div>
      <ul className={styles.list}>
        {data.items.map((r, i) => (
          <li key={`${r.publishedAt}-${i}`}>
            <figure className={styles.review} style={{ margin: 0 }}>
              <StarText stars={r.stars} />
              <blockquote className={styles.quote}>"{r.comment}"</blockquote>
              <figcaption className={styles.who}>
                <span className={styles.avatar} aria-hidden="true">{r.displayName.charAt(0)}</span>
                <span className={styles.whoText}>
                  <strong>{r.displayName}</strong>
                  <span>{r.placeText} · {monthYear(r.publishedAt)}</span>
                </span>
              </figcaption>
            </figure>
          </li>
        ))}
      </ul>
    </>
  )

  return compact
    ? <section aria-labelledby={`reviews-${vendorId ?? kind ?? 'all'}`} style={{ marginTop: 32 }}>{inner}</section>
    : <section className={styles.band} aria-labelledby={`reviews-${vendorId ?? kind ?? 'all'}`}><div className="container">{inner}</div></section>
}
