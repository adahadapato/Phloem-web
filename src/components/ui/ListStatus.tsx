import { ApiError } from '../../api/apiError'
import { Button } from './Button'
import styles from './Cards.module.css'
import { StatusBanner } from './StatusBanner'

/**
 * What a list shows when it has no items to show: grey placeholder tiles while loading, the API's message with
 * "Try again" when loading failed, or a friendly "nothing here" note. Renders nothing when there ARE items.
 */
export function ListStatus({ isLoading, error, isEmpty, emptyText, onRetry, placeholders = 8 }: {
  isLoading: boolean
  error: Error | null
  isEmpty: boolean
  emptyText: string
  onRetry: () => void
  /** How many grey tiles to show while loading. */
  placeholders?: number
}) {
  if (isLoading) {
    return (
      <div className={styles.grid} aria-busy="true" aria-label="Loading">
        {Array.from({ length: placeholders }, (_, i) => (
          <div key={i} className={styles.card} style={{ minHeight: 260, background: 'var(--brand-mint-pale)' }} />
        ))}
      </div>
    )
  }

  if (error) {
    const message = error instanceof ApiError ? error.displayMessage : 'Something went wrong. Please try again.'
    return (
      <div className="stack" style={{ alignItems: 'flex-start' }}>
        <StatusBanner message={message} isError />
        <Button variant="outline" small onClick={onRetry}>Try again</Button>
      </div>
    )
  }

  if (isEmpty) {
    return <p className="muted" style={{ padding: '24px 0', textAlign: 'center' }}>{emptyText}</p>
  }

  return null
}
