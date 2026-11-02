import type { OrderEventDto } from '../../api/contracts/dtos'
import type { OrderEventKind } from '../../api/contracts/enums'
import { dateTimeText } from '../ui/labels'
import styles from './OrderTimeline.module.css'

/** What each step is called on the timeline. */
const STEP_TEXT: Record<OrderEventKind, string> = {
  Placed: 'Order placed',
  ItemsRemoved: 'Unavailable dishes left out',
  Paid: 'Paid',
  Accepted: 'Accepted by the shop',
  Declined: 'Declined by the shop',
  Cancelled: 'Cancelled',
  CancelledShopSuspended: 'Cancelled: shop closed by Phloem',
  SentOut: 'Sent out for delivery',
  CourierChanged: 'Courier changed',
  Delivered: 'Delivered',
}

const STOPS: OrderEventKind[] = ['Declined', 'Cancelled', 'CancelledShopSuspended']

/**
 * An order's history: every step, oldest first, with when and who did it (customers and sellers see "Kofi
 * (courier)"; staff see full names and roles). Older orders, rebuilt from their saved dates, say so underneath.
 * @param timeline The steps from the API.
 * @param showRole Staff view: adds the role after the full name ("Kofi Asante · Courier").
 */
export function OrderTimeline({ timeline, showRole }: { timeline: OrderEventDto[]; showRole?: boolean }) {
  if (timeline.length === 0) return <p className="muted" style={{ margin: 0 }}>No history yet.</p>
  const rebuilt = timeline.some((e) => e.isRebuilt)

  return (
    <>
      <ol className={styles.steps}>
        {timeline.map((e, i) => {
          const stop = STOPS.includes(e.kind)
          return (
            <li key={`${e.kind}-${e.at}-${i}`} className={stop ? styles.stop : undefined}>
              <span className={styles.dot} aria-hidden="true">{stop ? '×' : '✓'}</span>
              <span className={styles.text}>
                <strong>{STEP_TEXT[e.kind] ?? e.kind}</strong>
                <span className="muted">
                  {dateTimeText(e.at)} · <span className={styles.who}>
                    {e.actorName}{showRole && e.actorKind !== 'System' ? ` · ${e.actorRole}` : ''}
                  </span>
                </span>
                {e.note && <span className={styles.note}>{e.note}</span>}
              </span>
            </li>
          )
        })}
      </ol>
      {rebuilt && (
        <p className={styles.rebuilt}>
          This order is older than the history feature: its steps were rebuilt from saved dates.
        </p>
      )}
    </>
  )
}
