import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router'
import { unwrap } from '../../../api/apiError'
import { Permissions } from '../../../api/contracts/permissions'
import { getAdminOrder } from '../../../api/services/adminService'
import { DeliveryProofCard } from '../../../components/deliveries/DeliveryProofCard'
import { OrderTimeline } from '../../../components/orders/OrderTimeline'
import { Button } from '../../../components/ui/Button'
import { CountryFlag } from '../../../components/ui/CountryFlag'
import { dateTimeText, deliveryWindows } from '../../../components/ui/labels'
import { Price } from '../../../components/ui/Price'
import { StatusBanner } from '../../../components/ui/StatusBanner'
import { useCountry } from '../../../state/CountryContext'
import { useSession } from '../../../state/SessionContext'
import { StatusChip } from '../../orders/OrderParts'
import styles from '../Admin.module.css'

/**
 * Admin → one order (/admin/orders/:orderNumber), read-only: the customer and where it goes, the dishes at the
 * prices frozen when it was ordered, Phloem's commission, the courier and proof of delivery, and the full history
 * with names. Opening it is written to the audit log, so it isn't refetched when the window regains focus.
 */
export default function AdminOrderPage() {
  const { orderNumber = '' } = useParams()
  const { countries } = useCountry()
  const { hasPermission } = useSession()
  const query = useQuery({
    queryKey: ['admin', 'order', orderNumber],
    queryFn: async ({ signal }) => unwrap(await getAdminOrder(orderNumber, signal)),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  })

  if (query.isPending) return <p className="muted" aria-busy="true">Loading…</p>
  if (query.isError) {
    return (
      <div className={styles.error}>
        <Link to="/admin/orders" className={styles.back}>‹ Orders</Link>
        <StatusBanner isError message={(query.error as { status?: number }).status === 404 ? "This order doesn't exist, or it's outside your countries." : "We couldn't load this order."} />
        <Button small variant="outline" onClick={() => query.refetch()}>Try again</Button>
      </div>
    )
  }

  const o = query.data
  const c = countries.find((x) => x.country === o.country)
  const items = o.lines.reduce((n, l) => n + l.quantity, 0)
  const windowText = deliveryWindows.find((w) => w.value === o.deliveryWindow)?.label ?? o.deliveryWindow

  return (
    <>
      <Link to="/admin/orders" className={styles.back}>‹ Orders</Link>

      <div className={styles.shopLayout}>
        <div>
          <section className={styles.panel} aria-label="Order">
            <div className={styles.shopTop}>
              <div>
                <h1 className={styles.title}>{o.orderNumber}</h1>
                <p className={styles.metaRow}>
                  <StatusChip status={o.status} />
                  {c ? <span className={styles.place}><CountryFlag country={c} /> {c.name}</span> : o.country}
                  <span className="muted">Placed {dateTimeText(o.placedAt)}</span>
                </p>
              </div>
            </div>
            <div className={styles.twoCols}>
              <div>
                <p className={styles.colTitle}>Customer</p>
                <p className={styles.colText}>
                  {o.customerName}
                  {o.customerEmail && <><br /><a href={`mailto:${o.customerEmail}`}>{o.customerEmail}</a></>}
                  {o.customerPhone && <><br /><a href={`tel:${o.customerPhone}`}>{o.customerPhone}</a></>}
                </p>
              </div>
              <div>
                <p className={styles.colTitle}>Deliver to</p>
                <p className={styles.colText} style={{ whiteSpace: 'pre-line' }}>
                  <strong>{o.deliveryRecipientName}</strong>{o.deliveryLabel && ` · ${o.deliveryLabel}`}{'\n'}
                  {o.deliveryAddress}
                  {o.deliveryPhone && <>{'\n'}<a href={`tel:${o.deliveryPhone}`}>{o.deliveryPhone}</a></>}
                  {'\n'}<span className="muted">{windowText}</span>
                </p>
              </div>
            </div>
          </section>

          <section className={styles.panel} aria-labelledby="dishes-title">
            <h2 id="dishes-title" className={styles.sectionTitle} style={{ margin: 0 }}>
              {o.shopName} <span className="muted">· {items} {items === 1 ? 'item' : 'items'}</span>
            </h2>
            <ul className={styles.itemList}>
              {o.lines.map((l) => (
                <li key={l.dishId}>
                  <span className={styles.rowText}>
                    <strong>{l.quantity} × {l.dishName}</strong>
                    <span className="muted"><Price amount={l.unitPrice} currency={o.currency} /> each</span>
                  </span>
                  <Price amount={l.lineTotal} currency={o.currency} />
                </li>
              ))}
            </ul>
            <dl className={styles.facts} style={{ gridTemplateColumns: '1fr auto' }}>
              <dt>Subtotal</dt><dd><Price amount={o.subtotal} currency={o.currency} /></dd>
              <dt>Delivery fee</dt><dd><Price amount={o.deliveryFee} currency={o.currency} /></dd>
              <dt><strong>Total</strong></dt><dd><strong><Price amount={o.total} currency={o.currency} /></strong></dd>
              {o.commissionAmount !== null && (
                <><dt>Phloem's commission</dt><dd><Price amount={o.commissionAmount} currency={o.currency} /></dd></>
              )}
              {o.sellerEarnings !== null && (
                <><dt>Shop earned</dt><dd><Price amount={o.sellerEarnings} currency={o.currency} /></dd></>
              )}
            </dl>
          </section>

          <section className={styles.panel} aria-labelledby="history-title">
            <h2 id="history-title" className={styles.sectionTitle} style={{ margin: 0 }}>History</h2>
            <OrderTimeline timeline={o.timeline} showRole />
          </section>

          <DeliveryProofCard proof={o.deliveryProof} />
        </div>

        <aside className={styles.actionsPanel} aria-label="Payment and delivery">
          <dl className={styles.facts} style={{ gridTemplateColumns: 'auto 1fr' }}>
            <dt>Paid</dt><dd>{o.paidAt ? dateTimeText(o.paidAt) : 'Not paid'}</dd>
            {o.paymentReference && <><dt>Payment ref.</dt><dd style={{ overflowWrap: 'anywhere' }}>{o.paymentReference}</dd></>}
            <dt>Courier</dt><dd>{o.courierName ?? '—'}</dd>
            {o.deliveredAt && <><dt>Delivered</dt><dd>{dateTimeText(o.deliveredAt)}</dd></>}
            {o.cancelledAt && <><dt>Cancelled</dt><dd>{dateTimeText(o.cancelledAt)}</dd></>}
          </dl>

          {o.declinedByShop && (
            <p className={styles.noteStop}>The shop declined it{o.declineReason ? `: "${o.declineReason}"` : '.'}</p>
          )}
          {o.needsRefund && <p className={styles.noteStop}>Paid, then cancelled: the customer must be refunded.</p>}
          {o.status === 'Delivered' && <p className={styles.allClear}>✓ Delivered{o.courierName ? ` by ${o.courierName}` : ''}.</p>}

          <div className={styles.stackForm}>
            <Link to={`/admin/orders?shop=${encodeURIComponent(o.shopId)}`}>All orders from {o.shopName} ›</Link>
            {hasPermission(Permissions.ShopsManage) && <Link to={`/admin/shops/${o.shopId}`}>Open the shop ›</Link>}
            {hasPermission(Permissions.ChatsRead) && o.status !== 'AwaitingPayment' && (
              <Link to={`/admin/chats/${encodeURIComponent(o.orderNumber)}`}>Read the order chat ›</Link>
            )}
          </div>
          <p className={styles.priceHint}>Your view of this order is recorded in the audit log.</p>
        </aside>
      </div>
    </>
  )
}
