/**
 * A rating like the app's: a gold ★ with the score (e.g. "★ 4.6 (23)"), or "New" when nobody has rated yet.
 */
export function Stars({ rating, count }: { rating: number; count: number }) {
  if (count === 0) {
    return <span className="muted" style={{ fontWeight: 600 }}>New</span>
  }

  return (
    <span aria-label={`Rated ${rating.toFixed(1)} out of 5 by ${count} ${count === 1 ? 'person' : 'people'}`}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 'var(--text-sm)', fontWeight: 700 }}>
      <span aria-hidden="true" style={{ color: 'var(--brand-star)' }}>★</span>
      <span aria-hidden="true">{rating.toFixed(1)}</span>
      <span aria-hidden="true" className="muted" style={{ fontWeight: 400 }}>({count})</span>
    </span>
  )
}
