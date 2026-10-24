import { useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router'
import { unwrap } from '../../api/apiError'
import { getMyOrders } from '../../api/services/orderService'
import { ApiImage } from '../../components/ui/ApiImage'
import { Button, ButtonLink } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { dateTimeText } from '../../components/ui/labels'
import { Pager } from '../../components/ui/Pager'
import { Price } from '../../components/ui/Price'
import { StatusBanner } from '../../components/ui/StatusBanner'
import { ActionBanner, OrderButtons, StatusChip } from './OrderParts'
import styles from './Orders.module.css'
import { useOrderActions } from './useOrderActions'

const PAGE_SIZE = 10

/**
 * My orders, like the app's: newest first, each with the shop, dishes, total and status, and Pay now (unpaid),
 * Buy again and Cancel. Unpaid orders show today's total and warn about changed prices or dishes that ran out.
 * Clicking an order opens its details. The page number is in the address (?page=2).
 */
export default function OrdersPage() {
  const [params, setParams] = useSearchParams()
  const page = Math.max(1, Number(params.get('page')) || 1)
  const actions = useOrderActions()

  const query = useQuery({
    queryKey: ['orders', 'list', page],
    queryFn: async ({ signal }) => unwrap(await getMyOrders(page, PAGE_SIZE, signal)),
    placeholderData: (previous) => previous,
    staleTime: 0,
  })
  const orders = query.data?.items ?? []

  return (
    <div className={`container ${styles.page}`}>
      <div className={styles.inner}>
        <div className={styles.heading}>
          <div>
            <h1>My orders</h1>
            <p className="muted">Track, pay or buy again</p>
          </div>
          <Link to="/explore">+ Order food</Link>
        </div>

        <ActionBanner actions={actions} />

        {query.isPending && <div className={styles.card} aria-busy="true"><p className="muted">Loading your orders…</p></div>}
        {query.isError && (
          <div className={styles.card}>
            <StatusBanner isError message={(query.error as { displayMessage?: string }).displayMessage
              ?? "We couldn't load your orders."} />
            <div><Button small variant="outline" onClick={() => query.refetch()}>Try again</Button></div>
          </div>
        )}

        {query.isSuccess && orders.length === 0 && (
          <EmptyState icon="receipt" title="No orders yet" text="Orders you place will appear here."
                      action={<ButtonLink to="/explore">Browse food</ButtonLink>} />
        )}

        {orders.map((o) => (
          <article key={o.orderNumber} className={`${styles.card} ${styles.orderCard}`}>
            <div className={styles.orderTop}>
              <ApiImage src={o.imageUrl} alt="" className={styles.thumb} />
              <div className={styles.lineText}>
                <Link to={`/orders/${encodeURIComponent(o.orderNumber)}`} className={`${styles.shopName} ${styles.stretched}`}>
                  {o.shopName}
                </Link>
                <div className="muted" style={{ fontSize: 13 }}>{o.orderNumber} · {dateTimeText(o.placedAt)}</div>
                <div className={styles.summaryText}>{o.itemsSummary}</div>
              </div>
              <div className={styles.lineEnd}>
                <StatusChip status={o.status} />
                <Price amount={o.total} currency={o.currency} />
              </div>
            </div>

            {o.status === 'AwaitingPayment' && (o.hasPriceChanges || o.outOfStockCount > 0) && (
              <p className={styles.note}>
                {[o.hasPriceChanges && 'Some prices have changed since you ordered: the total is at today\'s prices.',
                  o.outOfStockCount > 0 && `${o.outOfStockCount} ${o.outOfStockCount === 1 ? 'dish has' : 'dishes have'} ` +
                    'run out and will be left out when you pay.']
                  .filter(Boolean).join(' ')}
              </p>
            )}

            <div className={styles.aboveLink}>
              <OrderButtons orderNumber={o.orderNumber} status={o.status} canCancel={o.canCancel} actions={actions} />
            </div>
          </article>
        ))}

        <Pager page={page} totalPages={query.data?.totalPages ?? 1}
               onChange={(p) => { setParams(p > 1 ? { page: String(p) } : {}); globalThis.scrollTo?.({ top: 0 }) }} />
      </div>
    </div>
  )
}
