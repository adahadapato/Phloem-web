import { Button } from './Button'

/**
 * "‹ Previous · Page 2 of 5 · Next ›" under a long list, like the app's PagerView. Hidden when there's one page.
 */
export function Pager({ page, totalPages, onChange }: {
  page: number
  totalPages: number
  onChange: (page: number) => void
}) {
  if (totalPages <= 1) return null

  return (
    <nav aria-label="Pages"
         style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 24 }}>
      <Button variant="outline" small disabled={page <= 1} onClick={() => onChange(page - 1)}>‹ Previous</Button>
      <span className="muted" aria-live="polite">Page {page} of {totalPages}</span>
      <Button variant="outline" small disabled={page >= totalPages} onClick={() => onChange(page + 1)}>Next ›</Button>
    </nav>
  )
}
