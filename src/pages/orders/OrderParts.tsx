import { Link } from 'react-router'
import type { OrderStatus } from '../../api/contracts/enums'
import { Button } from '../../components/ui/Button'
import { orderStatusText } from '../../components/ui/labels'
import { StatusBanner } from '../../components/ui/StatusBanner'
import styles from './Orders.module.css'
import type { useOrderActions } from './useOrderActions'

type Actions = ReturnType<typeof useOrderActions>

/** The coloured status label, like the app's: orange while unpaid, green while on its way, grey when cancelled. */
export function StatusChip({ status }: { status: OrderStatus }) {
  const tone = status === 'AwaitingPayment' ? styles.chipWaiting
    : status === 'Cancelled' ? styles.chipCancelled
    : status === 'Delivered' ? styles.chipDone
    : styles.chipActive
  return <span className={`${styles.chip} ${tone}`}>{orderStatusText[status]}</span>
}

/** What the last Pay / Cancel / Buy again said, with "Checkout ›" after Buy again. */
export function ActionBanner({ actions }: { actions: Actions }) {
  const m = actions.message
  if (!m) return null
  return (
    <div className={styles.banner}>
      <StatusBanner message={m.text} isError={m.isError} />
      {m.toCheckout && <Link to="/checkout" className={styles.smallLink}>Checkout ›</Link>}
    </div>
  )
}

/**
 * The buttons for one order: Pay now (unpaid), Buy again, Cancel (asks "Cancel this order?" first, saying whether
 * a refund follows). `stacked` (My orders) puts them in a column, the main one first in orange: Pay now while
 * unpaid, otherwise Track order (opens the order).
 */
export function OrderButtons({ orderNumber, status, canCancel, actions, full, stacked, compact }: {
  orderNumber: string
  status: OrderStatus
  canCancel: boolean
  actions: Actions
  /** Big buttons (Order details) instead of small ones (list). */
  full?: boolean
  /** One full-width button per line, main one first (My orders). */
  stacked?: boolean
  /** Smaller buttons (the My orders list, so each order takes less room). */
  compact?: boolean
}) {
  const { busy } = actions
  const small = (!full && !stacked) || !!compact
  const column = stacked ? `${styles.buttons} ${styles.stacked}` : styles.buttons

  if (actions.confirmCancel === orderNumber) {
    return (
      <div className={styles.confirm} role="group" aria-label="Cancel this order?">
        <strong>Cancel this order?</strong>
        <span className="muted">
          {status === 'AwaitingPayment' ? 'Nothing has been paid for it yet.' : 'Your payment will be refunded.'}
        </span>
        <div className={column}>
          <Button small={small} variant="cta" busy={busy === `cancel:${orderNumber}`} busyText="Cancelling…"
                  onClick={() => actions.cancel(orderNumber)}>
            Cancel order
          </Button>
          <Button small={small} variant="outline" onClick={() => actions.setConfirmCancel(null)}>Keep order</Button>
        </div>
      </div>
    )
  }

  return (
    <div className={column}>
      {stacked && status !== 'AwaitingPayment' && (
        <Link to={`/orders/${encodeURIComponent(orderNumber)}`}
              className={[styles.trackLink, (status === 'Cancelled' || status === 'Delivered') && styles.trackPlain,
                           compact && styles.trackSmall].filter(Boolean).join(' ')}>
          {status === 'Cancelled' || status === 'Delivered' ? 'View order' : 'Track order'}
        </Link>
      )}
      {status === 'AwaitingPayment' && (
        <Button small={small} variant="cta" busy={busy === `pay:${orderNumber}`} busyText="Paying…"
                disabled={!!busy} onClick={() => actions.pay(orderNumber)}>
          Pay now
        </Button>
      )}
      <Button small={small} variant="secondary" busy={busy === `again:${orderNumber}`} busyText="Adding…"
              disabled={!!busy} onClick={() => actions.buyAgain(orderNumber)}>
        ↻ Buy again
      </Button>
      {canCancel && (
        <Button small={small} variant="outline" disabled={!!busy} onClick={() => actions.setConfirmCancel(orderNumber)}>
          Cancel order
        </Button>
      )}
    </div>
  )
}
