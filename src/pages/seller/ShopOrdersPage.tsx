import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import { unwrap, type ApiResult } from '../../api/apiError'
import type { ShopOrderSummaryDto } from '../../api/contracts/dtos'
import type { OrderStatus } from '../../api/contracts/enums'
import {
  acceptShopOrder, declineShopOrder, getShopOrders, markShopOrderDelivered, sendOutShopOrder,
} from '../../api/services/sellerOrderService'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { dateTimeText, deliveryWindows } from '../../components/ui/labels'
import { Pager } from '../../components/ui/Pager'
import { Price } from '../../components/ui/Price'
import { StatusBanner } from '../../components/ui/StatusBanner'
import { SellerHeader } from './SellerParts'
import styles from './Seller.module.css'
import { useMyShop } from './useMyShop'

const PAGE_SIZE = 10
const DECLINE_MAX = 500   // Order.DeclineReasonMaxLength

/** The tabs: the first is where the work is. `undefined` = every status (the API never sends unpaid orders). */
const TABS: { value: OrderStatus | undefined; key: string; label: string }[] = [
  { value: 'Paid', key: 'new', label: 'New' },
  { value: 'Preparing', key: 'preparing', label: 'Preparing' },
  { value: 'OutForDelivery', key: 'out', label: 'Out for delivery' },
  { value: 'Delivered', key: 'delivered', label: 'Delivered' },
  { value: 'Cancelled', key: 'cancelled', label: 'Cancelled' },
  { value: undefined, key: 'all', label: 'All' },
]

/** What each status means for the seller. */
const STATUS_TEXT: Partial<Record<OrderStatus, string>> = {
  Paid: 'New · waiting for you',
  Preparing: 'Preparing',
  OutForDelivery: 'Out for delivery',
  Delivered: 'Delivered',
  Cancelled: 'Cancelled',
}

type Message = { text: string; isError: boolean } | null

/** One order, with the buttons for its next step (and the decline form, which asks for a reason). */
function ShopOrderCard({ o, highlighted, busy, onAction }: {
  o: ShopOrderSummaryDto
  highlighted: boolean
  busy: string | null
  onAction: (o: ShopOrderSummaryDto, action: 'accept' | 'send-out' | 'delivered' | 'decline', reason?: string) => void
}) {
  const ref = useRef<HTMLElement>(null)
  const [declining, setDeclining] = useState(false)
  const [reason, setReason] = useState('')
  const when = deliveryWindows.find((w) => w.value === o.deliveryWindow)?.label
  const isBusy = busy?.endsWith(`:${o.orderNumber}`) ?? false

  // Opened from the dashboard (?open=…): bring it into view
  useEffect(() => {
    if (highlighted) ref.current?.scrollIntoView({ block: 'center' })
  }, [highlighted])

  return (
    <article ref={ref} className={`${styles.orderCard} ${highlighted ? styles.highlighted : ''}`}
             aria-label={`Order ${o.orderNumber}`}>
      <header className={styles.strip}>
        <dl className={styles.facts}>
          <div><dt>Paid</dt><dd>{o.paidAt ? dateTimeText(o.paidAt) : '—'}</dd></div>
          <div><dt>Total paid</dt><dd><Price amount={o.total} currency={o.currency} className={styles.plain} /></dd></div>
          <div><dt>When</dt><dd>{when}</dd></div>
        </dl>
        <span className={styles.orderNo}>Order # {o.orderNumber}</span>
      </header>
      <div className={styles.orderBody}>
        <div>
          <span className={`${styles.chip} ${o.status === 'Paid' ? styles.chipNew : o.status === 'Cancelled' ? styles.chipOff : styles.chipOn}`}>
            {STATUS_TEXT[o.status] ?? o.status}
          </span>
          <h2 className={styles.customer}>{o.customerName}</h2>
          <p className={styles.ordered}><span className="muted">What they ordered:</span> {o.itemsSummary}
            <span className="muted"> · {o.itemCount} {o.itemCount === 1 ? 'item' : 'items'}</span></p>
          <p className={styles.deliverTo}>
            <span className="muted">Deliver to</span> <strong>{o.deliveryLabel}</strong>
            <span className={styles.block} style={{ whiteSpace: 'pre-line' }}>{o.deliveryAddress}</span>
          </p>
        </div>

        <div className={styles.orderButtons}>
          {o.status === 'Paid' && !declining && (
            <>
              <Button variant="cta" busy={busy === `accept:${o.orderNumber}`} busyText="Accepting…" disabled={isBusy}
                      onClick={() => onAction(o, 'accept')}>✓ Accept order</Button>
              <Button variant="outline" disabled={isBusy} onClick={() => setDeclining(true)}>Decline</Button>
            </>
          )}
          {o.status === 'Paid' && declining && (
            <form className={styles.decline} onSubmit={(e) => { e.preventDefault(); onAction(o, 'decline', reason.trim()) }}>
              <label htmlFor={`reason-${o.orderNumber}`}><strong>Why can't you make it?</strong></label>
              <textarea id={`reason-${o.orderNumber}`} value={reason} maxLength={DECLINE_MAX} rows={3}
                        placeholder="e.g. We've run out of tilapia today." onChange={(e) => setReason(e.target.value)} />
              <span className="muted">If you decline, the customer gets a full refund and your reason by email.</span>
              <Button type="submit" variant="cta" busy={busy === `decline:${o.orderNumber}`} busyText="Declining…"
                      disabled={!reason.trim()}>Decline order</Button>
              <Button variant="outline" onClick={() => { setDeclining(false); setReason('') }}>Keep it</Button>
            </form>
          )}
          {o.status === 'Preparing' && (
            <Button variant="cta" busy={busy === `send-out:${o.orderNumber}`} busyText="Updating…" disabled={isBusy}
                    onClick={() => onAction(o, 'send-out')}>🛵 Send out for delivery</Button>
          )}
          {o.status === 'OutForDelivery' && (
            <Button variant="cta" busy={busy === `delivered:${o.orderNumber}`} busyText="Updating…" disabled={isBusy}
                    onClick={() => onAction(o, 'delivered')}>✓ Mark delivered</Button>
          )}
          {o.status === 'Delivered' && <p className="muted">Delivered. Your earnings were added to your balance.</p>}
          {o.status === 'Cancelled' && <p className="muted">Cancelled and refunded to the customer.</p>}
        </div>
      </div>
    </article>
  )
}

/**
 * Shop orders (/seller/orders), like the app's: tabs New / Preparing / Out for delivery / Delivered / Cancelled /
 * All; each order shows who ordered, what, when and where; its button moves it on (Accept → Send out for delivery →
 * Mark delivered), and Decline asks for the reason the customer will read. Tab, page and the opened order are in
 * the address (?status=…&open=…), so the dashboard can link straight to an order.
 */
export default function ShopOrdersPage() {
  const [params, setParams] = useSearchParams()
  const queryClient = useQueryClient()
  const shop = useMyShop().data
  const tab = TABS.find((t) => t.key === params.get('status')) ?? TABS[0]
  const page = Math.max(1, Number(params.get('page')) || 1)
  const open = params.get('open')
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<Message>(null)

  const query = useQuery({
    queryKey: ['seller', 'orders', tab.value ?? 'all', page],
    queryFn: async ({ signal }) => unwrap(await getShopOrders(tab.value, page, PAGE_SIZE, signal)),
    placeholderData: (previous) => previous,
    staleTime: 0,
  })
  const newCount = useQuery({
    queryKey: ['seller', 'orders', 'Paid', 'count'],
    queryFn: async ({ signal }) => unwrap(await getShopOrders('Paid', 1, 1, signal)).totalCount,
    staleTime: 15_000,
  })
  const orders = query.data?.items ?? []

  const onAction = async (o: ShopOrderSummaryDto, action: 'accept' | 'send-out' | 'delivered' | 'decline', reason?: string) => {
    setBusy(`${action}:${o.orderNumber}`)
    setMessage(null)
    const calls: Record<typeof action, () => Promise<ApiResult<void>>> = {
      accept: () => acceptShopOrder(o.orderNumber),
      'send-out': () => sendOutShopOrder(o.orderNumber),
      delivered: () => markShopOrderDelivered(o.orderNumber),
      decline: () => declineShopOrder(o.orderNumber, reason ?? ''),
    }
    const done: Record<typeof action, string> = {
      accept: `${o.orderNumber} accepted. Start cooking! It's now under Preparing.`,
      'send-out': `${o.orderNumber} is out for delivery.`,
      delivered: `${o.orderNumber} delivered. Your earnings were added to your balance.`,
      decline: `${o.orderNumber} declined. ${o.customerName} gets a full refund and your reason by email.`,
    }
    const result = await calls[action]()
    await queryClient.invalidateQueries({ queryKey: ['seller'] })
    setBusy(null)
    setMessage(result.ok ? { text: done[action], isError: false } : { text: result.error.displayMessage, isError: true })
  }

  const show = (key: string) => setParams(key === 'new' ? {} : { status: key })

  return (
    <div className={`container ${styles.page}`}>
      <SellerHeader shop={shop} newOrders={newCount.data} />

      <div className={styles.subTabs} role="tablist" aria-label="Which orders">
        {TABS.map((t) => (
          <button key={t.key} type="button" role="tab" aria-selected={t.key === tab.key} className={styles.subTab}
                  onClick={() => show(t.key)}>
            {t.label}{t.key === 'new' && newCount.data ? ` (${newCount.data})` : ''}
          </button>
        ))}
      </div>

      {message && <StatusBanner message={message.text} isError={message.isError} />}
      {tab.key === 'new' && orders.length > 0 && (
        <p className="muted">Open an order to see what the customer ordered, then accept or decline it.</p>
      )}

      {query.isPending && <div className={styles.card} aria-busy="true"><p className="muted">Loading orders…</p></div>}
      {query.isError && (
        <div className={styles.card}>
          <StatusBanner isError message={(query.error as { displayMessage?: string }).displayMessage
            ?? "We couldn't load your orders."} />
          <div><Button small variant="outline" onClick={() => query.refetch()}>Try again</Button></div>
        </div>
      )}
      {query.isSuccess && orders.length === 0 && (
        <EmptyState icon="receipt"
                    title={tab.key === 'new' ? 'No orders waiting right now' : `No ${tab.label.toLowerCase()} orders`}
                    text={tab.key === 'new' ? 'New paid orders appear here for you to accept.' : 'Orders move here as they go along.'} />
      )}

      {orders.map((o) => (
        <ShopOrderCard key={o.orderNumber} o={o} highlighted={o.orderNumber === open} busy={busy} onAction={onAction} />
      ))}

      <Pager page={page} totalPages={query.data?.totalPages ?? 1}
             onChange={(p) => {
               const next: Record<string, string> = {}
               if (tab.key !== 'new') next.status = tab.key
               if (p > 1) next.page = String(p)
               setParams(next)
               globalThis.scrollTo?.({ top: 0 })
             }} />
    </div>
  )
}
