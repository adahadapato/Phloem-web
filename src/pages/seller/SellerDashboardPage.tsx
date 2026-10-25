import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useLocation } from 'react-router'
import { unwrap } from '../../api/apiError'
import type { MyDishDto, ShopOrderStatsDto } from '../../api/contracts/dtos'
import { getMyDishes, setMyDishPrice } from '../../api/services/dishService'
import { getShopOrders, getShopOrderStats } from '../../api/services/sellerOrderService'
import { ApiImage } from '../../components/ui/ApiImage'
import { Button, ButtonLink } from '../../components/ui/Button'
import { deliveryWindows } from '../../components/ui/labels'
import { Price } from '../../components/ui/Price'
import { StatusBanner } from '../../components/ui/StatusBanner'
import { SellerHeader, ShopStatusBanner } from './SellerParts'
import styles from './Seller.module.css'
import { useMyShop } from './useMyShop'

/** The app's − / + step: 1, 5 or 100 depending on the price. */
const priceStep = (price: number) => (price >= 1000 ? 100 : price >= 100 ? 5 : 1)

/** "M", "T", "W"… for the chart, from a "yyyy-MM-dd" day. */
const dayLetter = (isoDate: string) =>
  new Date(`${isoDate}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' })

/** The last 7 days as bars (CSS, no chart library): the tallest day fills the height. */
function SalesChart({ stats }: { stats: ShopOrderStatsDto }) {
  const most = Math.max(1, ...stats.weeklySales.map((d) => d.orders))
  const week = stats.weeklySales.reduce((n, d) => n + d.orders, 0)
  return (
    <figure className={styles.chart} aria-label={`Orders in the last 7 days: ${week}`}>
      <div className={styles.bars}>
        {stats.weeklySales.map((d) => (
          <div key={d.date} className={styles.barCol} title={`${d.date}: ${d.orders} ${d.orders === 1 ? 'order' : 'orders'}`}>
            <span className={styles.barValue}>{d.orders || ''}</span>
            <span className={styles.bar} style={{ height: `${Math.max(4, (d.orders / most) * 100)}%` }} />
            <span className={styles.barDay}>{dayLetter(d.date)}</span>
          </div>
        ))}
      </div>
      <figcaption className="muted">{week} {week === 1 ? 'order' : 'orders'} in the last 7 days</figcaption>
    </figure>
  )
}

/** One of my dishes with the app's − price + buttons (kept inside the allowed range; put back if the API says no). */
function DishRow({ dish, onPrice, busy }: { dish: MyDishDto; onPrice: (d: MyDishDto, price: number) => void; busy: boolean }) {
  const step = priceStep(dish.price)
  const clamp = (p: number) => Math.min(dish.allowedMaxPrice ?? Infinity, Math.max(dish.allowedMinPrice ?? 0.01, p))
  const down = clamp(dish.price - step)
  const up = clamp(dish.price + step)
  return (
    <li className={styles.dishRow}>
      <ApiImage src={dish.photos.find((p) => p.isPrimary)?.thumbnailUrl ?? dish.photos[0]?.thumbnailUrl ?? null}
                alt="" className={styles.dishThumb} />
      <div className={styles.dishText}>
        <strong>{dish.name}</strong>
        <span className="muted">{dish.isAvailable ? 'On sale' : 'Hidden'}</span>
        {dish.allowedMinPrice !== null && dish.allowedMaxPrice !== null && (
          <span className={`muted ${styles.range}`}>
            Allowed <Price amount={dish.allowedMinPrice} currency={dish.currency} className={styles.plain} />
            {' – '}<Price amount={dish.allowedMaxPrice} currency={dish.currency} className={styles.plain} />
          </span>
        )}
        {dish.needsPriceUpdate && <span className={styles.warn}>Needs a new price</span>}
      </div>
      <div className={styles.priceStepper} role="group" aria-label={`${dish.name} price`}>
        <button type="button" onClick={() => onPrice(dish, down)} disabled={busy || down === dish.price}
                aria-label={`Lower ${dish.name} price`}>−</button>
        <Price amount={dish.price} currency={dish.currency} />
        <button type="button" onClick={() => onPrice(dish, up)} disabled={busy || up === dish.price}
                aria-label={`Raise ${dish.name} price`}>+</button>
      </div>
    </li>
  )
}

/**
 * Seller dashboard (/seller), like the app's: the shop's state (waiting for approval, rejected, ✓ badge to-do),
 * tiles (balance, rating, total orders, new orders), this week's sales, the orders waiting to be accepted, and
 * "My dishes" with quick − / + price changes. On a big screen: orders and chart on the left, dishes on the right.
 */
export default function SellerDashboardPage() {
  const location = useLocation()
  const notice = (location.state as { notice?: string } | null)?.notice
  const queryClient = useQueryClient()
  const shopQuery = useMyShop()
  const shop = shopQuery.data

  const stats = useQuery({
    queryKey: ['seller', 'stats'],
    queryFn: async ({ signal }) => unwrap(await getShopOrderStats(signal)),
    staleTime: 15_000,
  })
  const waiting = useQuery({
    queryKey: ['seller', 'orders', 'Paid', 1],
    queryFn: async ({ signal }) => unwrap(await getShopOrders('Paid', 1, 5, signal)),
    staleTime: 15_000,
  })
  const dishes = useQuery({
    queryKey: ['seller', 'dishes'],
    queryFn: async ({ signal }) => unwrap(await getMyDishes(signal)),
    staleTime: 30_000,
  })

  const [priceBusy, setPriceBusy] = useState<string | null>(null)
  const [priceError, setPriceError] = useState<string | null>(null)
  const onPrice = async (dish: MyDishDto, price: number) => {
    setPriceBusy(dish.id)
    setPriceError(null)
    const result = await setMyDishPrice(dish.id, price)
    if (!result.ok) setPriceError(`${dish.name}: ${result.error.displayMessage}`)
    await queryClient.invalidateQueries({ queryKey: ['seller', 'dishes'] })
    setPriceBusy(null)
  }

  if (shopQuery.isError) {
    return (
      <div className={`container ${styles.page}`}>
        <StatusBanner isError message="We couldn't load your shop." />
        <Button small variant="outline" onClick={() => shopQuery.refetch()}>Try again</Button>
      </div>
    )
  }

  const s = stats.data
  const myDishes = dishes.data?.dishes ?? []
  const needPrice = dishes.data?.needsPriceUpdateCount ?? 0

  return (
    <div className={`container ${styles.page}`}>
      <SellerHeader shop={shop} newOrders={s?.newOrders} />
      {notice && <StatusBanner message={notice} />}
      {shop && <ShopStatusBanner shop={shop} />}

      {/* ── Tiles ── */}
      <div className={styles.tiles}>
        <div className={`${styles.tile} ${styles.tileMoney}`}>
          <span>Available balance</span>
          <strong>{shop ? <Price amount={shop.balance} currency={shop.currency} className={styles.plain} /> : '…'}</strong>
          <small>From delivered orders, after Phloem's commission</small>
        </div>
        <Link to="/seller/orders" className={`${styles.tile} ${s?.newOrders ? styles.tileAlert : ''}`}>
          <span>Orders waiting</span>
          <strong>{s ? s.newOrders : '…'}</strong>
          <small>{s?.newOrders ? 'Accept or decline ›' : 'No new orders'}</small>
        </Link>
        <div className={styles.tile}>
          <span>Store rating</span>
          <strong>{shop ? (shop.ratingCount ? `★ ${shop.rating.toFixed(1)}` : '—') : '…'}</strong>
          <small>{shop?.ratingCount ? `${shop.ratingCount} ratings` : 'No ratings yet'}</small>
        </div>
        <div className={styles.tile}>
          <span>Total orders</span>
          <strong>{s ? s.totalOrders : '…'}</strong>
          <small>{s ? `${s.preparing} preparing · ${s.outForDelivery} on the way` : ''}</small>
        </div>
      </div>

      <div className={styles.dashGrid}>
        <div className={styles.dashMain}>
          {/* ── Orders waiting ── */}
          <section className={styles.card} aria-labelledby="waiting-title">
            <div className={styles.cardHead}>
              <h2 id="waiting-title" className={styles.cardTitle}>Orders waiting</h2>
              <Link to="/seller/orders" className={styles.strongLink}>All orders ›</Link>
            </div>
            {waiting.isPending && <p className="muted">Loading…</p>}
            {waiting.isSuccess && waiting.data.items.length === 0 && (
              <p className="muted">No orders waiting right now. New paid orders appear here for you to accept.</p>
            )}
            <ul className={styles.waitList}>
              {waiting.data?.items.map((o) => (
                <li key={o.orderNumber}>
                  <div>
                    <strong>{o.customerName}</strong> <span className="muted">· {o.orderNumber}</span>
                    <span className={styles.block}>{o.itemsSummary}</span>
                    <span className="muted">
                      {deliveryWindows.find((w) => w.value === o.deliveryWindow)?.label} · {o.deliveryLabel}
                    </span>
                  </div>
                  <div className={styles.waitEnd}>
                    <Price amount={o.total} currency={o.currency} />
                    <Link to={`/seller/orders?open=${encodeURIComponent(o.orderNumber)}`} className={styles.openLink}>Open ›</Link>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          {/* ── Sales ── */}
          <section className={styles.card} aria-labelledby="sales-title">
            <h2 id="sales-title" className={styles.cardTitle}>Sales overview</h2>
            {s ? <SalesChart stats={s} /> : <p className="muted">Loading…</p>}
          </section>
        </div>

        {/* ── My dishes ── */}
        <section className={`${styles.card} ${styles.dashSide}`} aria-labelledby="dishes-title">
          <div className={styles.cardHead}>
            <h2 id="dishes-title" className={styles.cardTitle}>My dishes</h2>
            <ButtonLink to="/seller/dishes/new" small variant="secondary">+ Add dish</ButtonLink>
          </div>
          {needPrice > 0 && (
            <p className={styles.warnBox}>
              {needPrice} {needPrice === 1 ? 'dish needs' : 'dishes need'} a new price: Phloem changed the allowed range,
              so {needPrice === 1 ? "it's" : "they're"} hidden from buyers until you update {needPrice === 1 ? 'it' : 'them'}.
            </p>
          )}
          <StatusBanner isError message={priceError} />
          {dishes.isPending && <p className="muted">Loading…</p>}
          {dishes.isSuccess && myDishes.length === 0 && (
            <div className={styles.emptyDishes}>
              <strong>Add your first dish</strong>
              <span className="muted">Pick the dish, add a photo and set your price.</span>
              <ButtonLink to="/seller/dishes/new" small>+ Add dish</ButtonLink>
            </div>
          )}
          <ul className={styles.dishList}>
            {myDishes.slice(0, 8).map((d) => (
              <DishRow key={d.id} dish={d} onPrice={onPrice} busy={priceBusy === d.id} />
            ))}
          </ul>
          {myDishes.length > 0 && <Link to="/seller/dishes" className={styles.strongLink}>Manage all dishes ›</Link>}
        </section>
      </div>
    </div>
  )
}
