import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { unwrap } from '../../api/apiError'
import type { OrderDetailsDto } from '../../api/contracts/dtos'
import { getOrder } from '../../api/services/orderService'
import { ApiImage } from '../../components/ui/ApiImage'
import { Button } from '../../components/ui/Button'
import { dateTimeText } from '../../components/ui/labels'
import { Price } from '../../components/ui/Price'
import { StatusBanner } from '../../components/ui/StatusBanner'
import { ActionBanner, OrderButtons, StatusChip } from './OrderParts'
import styles from './Orders.module.css'
import { useOrderActions } from './useOrderActions'

/** The journey of an order, like the app's tracker (with Paid added: the website can pay unpaid orders). */
const STEPS = [
  { title: 'Order placed', sub: (o: OrderDetailsDto) => dateTimeText(o.placedAt) },
  { title: 'Paid', sub: (o: OrderDetailsDto) => (o.paidAt ? dateTimeText(o.paidAt) : 'Waiting for payment') },
  { title: 'Being prepared', sub: () => 'The shop is cooking your order' },
  { title: 'On its way', sub: () => "We'll let you know when it's on the move" },
  { title: 'Delivered', sub: (o: OrderDetailsDto) => (o.deliveredAt ? dateTimeText(o.deliveredAt) : 'Enjoy your meal!') },
]
const STEP_REACHED = { AwaitingPayment: 0, Paid: 1, Preparing: 2, OutForDelivery: 3, Delivered: 4, Cancelled: -1 }

/** "1 item", "3 items". */
const itemsText = (n: number) => `${n} ${n === 1 ? 'item' : 'items'}`

/** Whole minutes left to cancel a paid order, ticking down while the page is open (null: no time limit). */
function useMinutesLeft(order: OrderDetailsDto | undefined, loadedAt: number): number | null {
  const [now, setNow] = useState(() => Date.now())
  const seconds = order?.cancelSecondsLeft ?? null
  useEffect(() => {
    if (seconds === null) return
    const timer = setInterval(() => setNow(Date.now()), 15_000)
    return () => clearInterval(timer)
  }, [seconds])
  if (seconds === null) return null
  // `now` is never earlier than the load (the clock state can be older than the data)
  return Math.max(0, Math.ceil((loadedAt + seconds * 1000 - Math.max(now, loadedAt)) / 60_000))
}

/**
 * One order, like the app's Order details: number, date and status; the journey so far (or why it was
 * cancelled); the dishes (unpaid: at today's prices, with what changed or ran out); delivery time and address;
 * the totals; then Pay now / Buy again / Cancel order.
 */
export default function OrderDetailsPage() {
  const { orderNumber = '' } = useParams()
  const actions = useOrderActions()

  const query = useQuery({
    queryKey: ['orders', 'detail', orderNumber],
    queryFn: async ({ signal }) => unwrap(await getOrder(orderNumber, signal)),
    staleTime: 0,
  })
  const order = query.data
  const minutesLeft = useMinutesLeft(order, query.dataUpdatedAt)

  if (!order) {
    return (
      <div className={`container ${styles.page}`}>
        <div className={styles.inner}>
          <Link to="/orders" className={styles.smallLink}>‹ My orders</Link>
          <div className={styles.card} style={{ marginTop: 12 }} aria-busy={query.isPending}>
            {query.isPending
              ? <p className="muted">Loading the order…</p>
              : (
                <>
                  <StatusBanner isError message={(query.error as { displayMessage?: string } | null)?.displayMessage
                    ?? "We couldn't load this order."} />
                  <div><Button small variant="outline" onClick={() => query.refetch()}>Try again</Button></div>
                </>
              )}
          </div>
        </div>
      </div>
    )
  }

  const reached = STEP_REACHED[order.status]
  const unpaid = order.status === 'AwaitingPayment'
  const canCancel = order.canCancel && minutesLeft !== 0

  return (
    <div className={`container ${styles.page}`}>
      <div className={styles.inner}>
        <Link to="/orders" className={styles.smallLink}>‹ My orders</Link>
        <div className={styles.heading} style={{ marginTop: 8 }}>
          <div>
            <h1>Order details</h1>
            <p className="muted"><strong>{order.orderNumber}</strong> · {dateTimeText(order.placedAt)}</p>
          </div>
          <StatusChip status={order.status} />
        </div>

        <ActionBanner actions={actions} />

        {/* ── Cancelled, or the journey so far ── */}
        {order.status === 'Cancelled' ? (
          <section className={`${styles.card} ${styles.warning}`} aria-label="Cancelled">
            <strong>This order was cancelled</strong>
            {order.declinedByShop && order.declineReason && (
              <p>{order.shopName} couldn't make this order: "{order.declineReason}"</p>
            )}
            <p className="muted">
              {order.cancelledAt && `Cancelled ${dateTimeText(order.cancelledAt)}`}
              {order.needsRefund && ' · your payment will be refunded.'}
            </p>
          </section>
        ) : (
          <section className={styles.card} aria-label="Order progress">
            <ol className={styles.steps}>
              {STEPS.map((step, i) => (
                <li key={step.title} className={i <= reached ? styles.stepDone : i === reached + 1 ? styles.stepNext : ''}
                    aria-current={i === reached ? 'step' : undefined}>
                  <span className={styles.stepDot} aria-hidden="true">{i <= reached ? '✓' : ''}</span>
                  <span>
                    <strong>{step.title}</strong>
                    <span className="muted">{step.sub(order)}</span>
                  </span>
                </li>
              ))}
            </ol>
          </section>
        )}

        {/* ── Dishes ── */}
        <section className={styles.card} aria-labelledby="items-title">
          <div className={styles.shopHead}>
            <h2 id="items-title" className={styles.sectionTitle} style={{ margin: 0 }}>🌿 {order.shopName}</h2>
            <span className="muted">
              {itemsText(order.lines.reduce((n, l) => n + l.quantity, 0))}
            </span>
          </div>
          {unpaid && <p className="muted" style={{ fontSize: 13 }}>Not paid yet: shown at today's prices.</p>}

          {order.lines.map((line) => (
            <div key={line.dishId} className={`${styles.line} ${line.isOutOfStock ? styles.unavailable : ''}`}>
              <ApiImage src={line.imageUrl} alt="" className={styles.thumb} />
              <div className={styles.lineText}>
                <div className={styles.lineName}>{line.dishName}</div>
                <div className="muted">
                  {line.quantity} × <Price amount={line.unitPrice} currency={order.currency} />
                  {line.priceChanged && line.priceWhenAdded !== null && (
                    <span className={styles.changed}>
                      {' '}· was <Price amount={line.priceWhenAdded} currency={order.currency} className={styles.plain} />
                    </span>
                  )}
                </div>
                {line.isOutOfStock && <div className={styles.outOfStock}>Out of stock: left out when you pay</div>}
              </div>
              <div className={styles.lineEnd}>
                <Price amount={line.lineTotal} currency={order.currency} />
              </div>
            </div>
          ))}

          <dl className={styles.sums}>
            <dt>Subtotal</dt>
            <dd><Price amount={order.subtotal} currency={order.currency} /></dd>
            <dt>Delivery fee</dt>
            <dd><Price amount={order.deliveryFee} currency={order.currency} /></dd>
          </dl>
          <div className={styles.grandTotal}>
            <span>Total</span>
            <Price amount={order.total} currency={order.currency} />
          </div>
        </section>

        {/* ── Delivery and payment ── */}
        <section className={styles.card} aria-label="Delivery and payment">
          <dl className={styles.facts}>
            <dt>Delivery time</dt>
            <dd>{order.deliveryLabel}</dd>
            <dt>Delivery address</dt>
            <dd style={{ whiteSpace: 'pre-line' }}>{order.deliveryAddress}</dd>
            <dt>Payment</dt>
            <dd>{unpaid ? 'Not paid yet' : order.paidAt ? `Paid ${dateTimeText(order.paidAt)}` : 'Not paid'}</dd>
          </dl>
        </section>

        {/* ── Pay now / Buy again / Cancel ── */}
        <div className={styles.detailButtons}>
          <OrderButtons orderNumber={order.orderNumber} status={order.status} canCancel={canCancel}
                        actions={actions} full />
          {canCancel && (
            <p className="muted" style={{ fontSize: 13 }}>
              {unpaid
                ? 'You can cancel any time before paying.'
                : `You can cancel for another ${minutesLeft} ${minutesLeft === 1 ? 'minute' : 'minutes'}, ` +
                  'until the shop starts cooking.'}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
