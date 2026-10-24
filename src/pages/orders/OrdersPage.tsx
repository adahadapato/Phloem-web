import { useQuery } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { unwrap } from '../../api/apiError'
import type { OrderSummaryDto } from '../../api/contracts/dtos'
import type { OrderStatusGroup } from '../../api/contracts/enums'
import { getMyOrders } from '../../api/services/orderService'
import { ApiImage } from '../../components/ui/ApiImage'
import { Button, ButtonLink } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { deliveryWindows } from '../../components/ui/labels'
import { Pager } from '../../components/ui/Pager'
import { Price } from '../../components/ui/Price'
import { StatusBanner } from '../../components/ui/StatusBanner'
import { BuyItAgainPanel } from './BuyItAgainPanel'
import styles from './MyOrders.module.css'
import { ActionBanner, OrderButtons } from './OrderParts'
import { useOrderActions } from './useOrderActions'

const PAGE_SIZE = 10

/** The tabs, in order. */
const TABS: { value: OrderStatusGroup; label: string }[] = [
  { value: 'All', label: 'All orders' },
  { value: 'WaitingForPayment', label: 'Waiting for payment' },
  { value: 'InProgress', label: 'In progress' },
  { value: 'Completed', label: 'Completed' },
  { value: 'Cancelled', label: 'Cancelled' },
]

/** The time choices: how far back, in days (0 = all time). */
const PERIODS = [
  { value: '30d', label: 'the past 30 days', days: 30 },
  { value: '3m', label: 'the past 3 months', days: 92 },
  { value: '6m', label: 'the past 6 months', days: 183 },
  { value: '1y', label: 'the past year', days: 365 },
  { value: 'all', label: 'all time', days: 0 },
] as const
type Period = (typeof PERIODS)[number]['value']
const DEFAULT_PERIOD: Period = '3m'

/** "yyyy-MM-dd" (UTC) for `days` ago, or undefined for all time. */
function fromDate(days: number): string | undefined {
  if (!days) return undefined
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10)
}

/** "24 Oct 2026" */
const dayText = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

/** "24 October" (year added when it isn't this year) */
function longDay(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', ...(d.getFullYear() === new Date().getFullYear() ? {} : { year: 'numeric' }),
  })
}

/** The heading for an order, as a sentence (like "Delivered 24 October"), and a line under it. */
function headline(o: OrderSummaryDto): { title: string; sub: string; tone: string } {
  const when = (deliveryWindows.find((w) => w.value === o.deliveryWindow)?.label ?? '').toLowerCase()
  const to = o.deliveryLabel ? ` to ${o.deliveryLabel}` : ''
  switch (o.status) {
    case 'AwaitingPayment':
      return { title: 'Waiting for payment', sub: `Pay to send it to ${o.shopName}.`, tone: styles.toneWaiting }
    case 'Paid':
      return { title: 'Order placed', sub: `${o.shopName} will start on it soon · delivery ${when}${to}`, tone: styles.toneActive }
    case 'Preparing':
      return { title: `Being prepared by ${o.shopName}`, sub: `Delivery ${when}${to}`, tone: styles.toneActive }
    case 'OutForDelivery':
      return { title: 'On its way', sub: `From ${o.shopName}${to}`, tone: styles.toneActive }
    case 'Delivered':
      return {
        title: o.deliveredAt ? `Delivered ${longDay(o.deliveredAt)}` : 'Delivered',
        sub: `From ${o.shopName}${to}`, tone: styles.toneDone,
      }
    case 'Cancelled':
      return {
        title: o.declinedByShop ? `Cancelled by ${o.shopName}` : 'Cancelled',
        sub: [o.cancelledAt && `Cancelled ${longDay(o.cancelledAt)}`, o.needsRefund && 'your payment is being refunded']
          .filter(Boolean).join(' · ') || `From ${o.shopName}`,
        tone: styles.toneCancelled,
      }
  }
}

/** One order: the summary strip (placed, total, deliver to, number), then the heading, the dishes and the buttons. */
function OrderCard({ order: o, actions }: { order: OrderSummaryDto; actions: ReturnType<typeof useOrderActions> }) {
  const head = headline(o)
  const unpaid = o.status === 'AwaitingPayment'
  const link = `/orders/${encodeURIComponent(o.orderNumber)}`

  return (
    <article className={styles.order} aria-label={`Order ${o.orderNumber}`}>
      <header className={styles.strip}>
        <dl className={styles.facts}>
          <div><dt>Order placed</dt><dd>{dayText(o.placedAt)}</dd></div>
          <div><dt>{unpaid ? "Today's total" : 'Total'}</dt><dd><Price amount={o.total} currency={o.currency} className={styles.plain} /></dd></div>
          <div className={styles.deliverTo}>
            <dt>Deliver to</dt>
            <dd>
              <details>
                <summary>{o.deliveryLabel || 'Address'}</summary>
                <div className={styles.addressPop}>{o.deliveryAddress}</div>
              </details>
            </dd>
          </div>
        </dl>
        <div className={styles.number}>
          <span>Order # {o.orderNumber}</span>
          <Link to={link}>View order details</Link>
        </div>
      </header>

      <div className={styles.body}>
        <div className={styles.main}>
          <h2 className={`${styles.headline} ${head.tone}`}>{head.title}</h2>
          <p className={styles.sub}>{head.sub}</p>

          {unpaid && (o.hasPriceChanges || o.outOfStockCount > 0) && (
            <p className={styles.note}>
              {[o.hasPriceChanges && 'Some prices have changed since you ordered: the total is at today\'s prices.',
                o.outOfStockCount > 0 && `${o.outOfStockCount} ${o.outOfStockCount === 1 ? 'dish has' : 'dishes have'} ` +
                  'run out and will be left out when you pay.']
                .filter(Boolean).join(' ')}
            </p>
          )}

          <ul className={styles.dishes}>
            {o.lines.map((line) => (
              <li key={line.dishId} className={`${styles.dish} ${line.isOutOfStock ? styles.dishOut : ''}`}>
                <ApiImage src={line.imageUrl} alt="" className={styles.dishThumb} />
                <div className={styles.dishText}>
                  <Link to={link} className={styles.dishName}>{line.dishName}</Link>
                  <span className="muted">
                    {line.quantity} × <Price amount={line.unitPrice} currency={o.currency} className={styles.plain} />
                    {line.priceChanged && line.priceWhenAdded !== null && (
                      <> · <span className={styles.changed}>was <Price amount={line.priceWhenAdded} currency={o.currency} className={styles.plain} /></span></>
                    )}
                    {line.isOutOfStock && <> · <span className={styles.out}>Out of stock</span></>}
                  </span>
                  <Button small variant="secondary" className={styles.dishAgain}
                          busy={actions.busy === `dish:${o.orderNumber}:${line.dishId}`} busyText="Adding…"
                          disabled={!!actions.busy || line.isOutOfStock}
                          onClick={() => actions.buyDishAgain(o.orderNumber, line.dishId, line.quantity)}>
                    ↻ Buy it again
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className={styles.side}>
          <OrderButtons orderNumber={o.orderNumber} status={o.status} canCancel={o.canCancel} actions={actions} stacked />
        </div>
      </div>
    </article>
  )
}

/**
 * My orders, laid out for a big screen (ideas from big shops' order pages, in Phloem's colours):
 * - tabs (All, Waiting for payment, In progress, Completed, Cancelled), how far back ("in the past 3 months"),
 *   and a search box (order number, shop or dish); all kept in the address, so Back and refresh keep them;
 * - each order: a mint summary strip (placed, total, deliver to, order number + details), the status as a heading
 *   ("Delivered 24 October"), each dish with its own "Buy it again", and the buttons in a column on the right
 *   (Pay now / Track order in orange, then Buy again and Cancel);
 * - "Buy it again" beside the list: favourites still on sale, with the green +.
 * On a phone everything stacks: buttons under the order, the panel under the list.
 */
export default function OrdersPage() {
  const [params, setParams] = useSearchParams()
  const actions = useOrderActions()

  const show = (TABS.find((t) => t.value === params.get('show'))?.value ?? 'All') as OrderStatusGroup
  const period = (PERIODS.find((p) => p.value === params.get('period'))?.value ?? DEFAULT_PERIOD) as Period
  const periodInfo = PERIODS.find((p) => p.value === period)!
  const search = params.get('q') ?? ''
  const page = Math.max(1, Number(params.get('page')) || 1)
  const [searchText, setSearchText] = useState(search)

  /** Changes some of the filters; any change goes back to page 1. Default values stay out of the address. */
  const update = (changes: { show?: OrderStatusGroup; period?: Period; q?: string; page?: number }) => {
    const next = { show, period, q: search, page: 1, ...changes }
    const out: Record<string, string> = {}
    if (next.show !== 'All') out.show = next.show
    if (next.period !== DEFAULT_PERIOD) out.period = next.period
    if (next.q) out.q = next.q
    if (next.page > 1) out.page = String(next.page)
    setParams(out)
  }

  const from = fromDate(periodInfo.days)
  const query = useQuery({
    queryKey: ['orders', 'list', { show, from, search, page }],
    queryFn: async ({ signal }) => unwrap(await getMyOrders({
      show: show === 'All' ? undefined : show, from, search: search || undefined, page, pageSize: PAGE_SIZE,
    }, signal)),
    placeholderData: (previous) => previous,
    staleTime: 0,
  })
  const orders = query.data?.items ?? []
  const total = query.data?.totalCount ?? 0
  const filtered = show !== 'All' || !!search || period !== 'all'

  const onSearch = (event: FormEvent) => {
    event.preventDefault()
    update({ q: searchText.trim() })
  }

  return (
    <div className={`container ${styles.page}`}>
      <nav className={styles.crumbs} aria-label="Breadcrumb">
        <Link to="/account">My account</Link> <span aria-hidden="true">›</span> <span>My orders</span>
      </nav>

      <div className={styles.top}>
        <h1>My orders</h1>
        <form className={styles.search} role="search" onSubmit={onSearch}>
          <input type="search" value={searchText} onChange={(e) => setSearchText(e.target.value)} maxLength={100}
                 placeholder="Search your orders" aria-label="Search orders by number, shop or dish" title="Order number, shop or dish" />
          <Button type="submit" small>Search</Button>
        </form>
      </div>

      <div className={styles.tabs} role="tablist" aria-label="Which orders">
        {TABS.map((t) => (
          <button key={t.value} type="button" role="tab" aria-selected={t.value === show}
                  className={styles.tab} onClick={() => update({ show: t.value })}>
            {t.label}
          </button>
        ))}
      </div>

      <div className={styles.layout}>
        <div className={styles.list}>
          <div className={styles.countRow}>
            <label className={styles.count}>
              <strong>{query.isPending ? '…' : total} {total === 1 ? 'order' : 'orders'}</strong>
              {search && <> matching "{search}"</>} placed in{' '}
              <select value={period} onChange={(e) => update({ period: e.target.value as Period })}>
                {PERIODS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </label>
            {search && (
              <button type="button" className={styles.clear} onClick={() => { setSearchText(''); update({ q: '' }) }}>
                Clear search
              </button>
            )}
          </div>

          <ActionBanner actions={actions} />

          {query.isPending && <div className={styles.loading} aria-busy="true">Loading your orders…</div>}
          {query.isError && (
            <div className={styles.loading}>
              <StatusBanner isError message={(query.error as { displayMessage?: string }).displayMessage
                ?? "We couldn't load your orders."} />
              <Button small variant="outline" onClick={() => query.refetch()}>Try again</Button>
            </div>
          )}

          {query.isSuccess && orders.length === 0 && (filtered ? (
            <EmptyState icon="receipt" title="No orders here"
                        text={search ? `Nothing matches "${search}" in ${periodInfo.label}.`
                          : `No ${show === 'All' ? '' : TABS.find((t) => t.value === show)!.label.toLowerCase() + ' '}orders in ${periodInfo.label}.`}
                        action={<Button variant="secondary" onClick={() => { setSearchText(''); setParams({ period: 'all' }) }}>
                          Show all my orders
                        </Button>} />
          ) : (
            <EmptyState icon="receipt" title="No orders yet" text="Orders you place will appear here."
                        action={<ButtonLink to="/explore">Browse food</ButtonLink>} />
          ))}

          {orders.map((o) => <OrderCard key={o.orderNumber} order={o} actions={actions} />)}

          <Pager page={page} totalPages={query.data?.totalPages ?? 1}
                 onChange={(p) => { update({ page: p }); globalThis.scrollTo?.({ top: 0 }) }} />
        </div>

        <BuyItAgainPanel />
      </div>
    </div>
  )
}
