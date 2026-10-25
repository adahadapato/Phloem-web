import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router'
import { unwrap } from '../../api/apiError'
import type { BasketItemDto } from '../../api/contracts/commands'
import type { BasketCheckDto, PlacedOrderDto } from '../../api/contracts/dtos'
import type { Country, DeliveryWindow } from '../../api/contracts/enums'
import { checkBasket, getDeliveryWindows, payWithTestPayment, placeOrder } from '../../api/services/orderService'
import { ApiImage } from '../../components/ui/ApiImage'
import { Button, ButtonLink } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { cutoffText, deliveryWindows } from '../../components/ui/labels'
import { Price } from '../../components/ui/Price'
import { QuantityStepper } from '../../components/ui/QuantityStepper'
import { StatusBanner } from '../../components/ui/StatusBanner'
import { useCart, type CartLine } from '../../state/CartContext'
import { useCountry } from '../../state/CountryContext'
import { useSession } from '../../state/SessionContext'
import styles from './Orders.module.css'

/** Same as the API: a paid order can be cancelled within 30 minutes. */
const CANCEL_MINUTES = 30

/** What Place order did, shown on the confirmation. */
interface Placed {
  orders: PlacedOrderDto[]
  /** Orders whose test payment didn't go through ("PHL-…: reason"). */
  unpaid: string[]
}

/** "1 item", "3 items". */
function itemsText(lines: CartLine[]): string {
  const n = lines.reduce((sum, l) => sum + l.quantity, 0)
  return `${n} ${n === 1 ? 'item' : 'items'}`
}

/** The note under the delivery times, like the app's: which shop closed for today, or the API's reason. */
function deliveryNote(check: BasketCheckDto | undefined): string {
  if (!check) return ''
  const closed = check.shops.filter((s) => !s.openWindows.includes('Asap') && s.openWindows.includes('Tomorrow'))
  if (closed.length === 1) {
    return `Orders for today closed at ${cutoffText(closed[0].orderCutoffTime)} at ${closed[0].shopName}. ` +
      'Choose Tomorrow.'
  }
  if (closed.length > 1) return 'Some shops in your basket have closed for today\'s orders. Choose Tomorrow.'
  return [...new Set(check.shops.map((s) => s.deliveryProblem).filter(Boolean))].join('\n')
}

/**
 * Checkout, like the app's: the basket at TODAY's prices (checked by the API), the delivery address, the delivery
 * time, the totals, then "Place order". Each shop becomes its own order; each is then paid with the TEMPORARY test
 * payment (no money moves) until a real payment provider is connected.
 *
 * An order's address must be in the shop's country, so a basket with shops in two countries is checked out one
 * country at a time (the other dishes stay in the basket).
 */
export default function CheckoutPage() {
  const cart = useCart()
  const { profile } = useSession()
  const { countries, selected } = useCountry()
  const queryClient = useQueryClient()

  const [pickedCountry, setPickedCountry] = useState<Country | null>(null)
  const [pickedWindow, setPickedWindow] = useState<DeliveryWindow>('Asap')
  const [pickedAddressId, setPickedAddressId] = useState<string | null>(null)
  const [placing, setPlacing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [placed, setPlaced] = useState<Placed | null>(null)

  // ── Which country's dishes are being checked out ──
  const basketCountries = [...new Set(cart.lines.map((l) => l.country))]
  const country: Country | undefined =
    (pickedCountry && basketCountries.includes(pickedCountry) && pickedCountry)
    || (selected && basketCountries.includes(selected.country) ? selected.country : basketCountries[0])
  const countryName = (c: Country) => countries.find((x) => x.country === c)?.name ?? c
  const lines: CartLine[] = cart.lines.filter((l) => l.country === country)
  const items: BasketItemDto[] = lines.map((l) => ({ dishId: l.dishId, quantity: l.quantity }))

  // ── Today's prices, stock and fees (re-checked whenever the basket or the time changes) ──
  const windowsQuery = useQuery({
    queryKey: ['delivery-windows', country],
    queryFn: async ({ signal }) => unwrap(await getDeliveryWindows(country!, signal)),
    enabled: !!country,
    staleTime: 10 * 60_000,
  })

  const openFor = (check: BasketCheckDto | undefined, w: DeliveryWindow) =>
    !check || check.shops.every((s) => s.openWindows.includes(w))
  const checkQuery = useQuery({
    queryKey: ['basket-check', country, items, pickedWindow],
    queryFn: async ({ signal }) => unwrap(await checkBasket({ items, deliveryWindow: pickedWindow }, signal)),
    enabled: items.length > 0 && !placed,
    staleTime: 0,
    placeholderData: (previous) => previous,
  })
  const check = checkQuery.data

  // The picked time closed meanwhile (a shop's cut-off passed)? Move to the first open one, like the app. Setting
  // state while rendering is React's way to adjust to new data; the check then runs again for the new time.
  const firstOpen = deliveryWindows.find((w) => openFor(check, w.value))?.value
  if (!openFor(check, pickedWindow) && firstOpen && !checkQuery.isFetching) setPickedWindow(firstOpen)
  const deliveryWindow = pickedWindow

  // ── Delivery address: one in this country (picked, else the default, else the first) ──
  const addresses = (profile?.addresses ?? []).filter((a) => a.country === country)
  const address = addresses.find((a) => a.id === pickedAddressId)
    ?? addresses.find((a) => a.isDefault) ?? addresses[0]

  // ── Confirmation ──
  if (placed) {
    const paid = placed.unpaid.length === 0
    const perShop = placed.orders.length > 1
      ? `Your basket became ${placed.orders.length} orders, one for each shop. `
      : ''
    return (
      <div className={`container ${styles.page}`}>
        <div className={`${styles.inner} ${styles.empty}`}>
          <span className={styles.tick} aria-hidden="true">{paid ? '✓' : '!'}</span>
          <h1>{paid ? 'Order confirmed!' : 'Order saved'}</h1>
          <p className={styles.orderNumbers}>{placed.orders.map((o) => o.orderNumber).join(', ')}</p>
          <p className="muted" style={{ whiteSpace: 'pre-line', maxWidth: 520 }}>
            {paid
              ? `${perShop}It's paid with a TEST payment (no money was taken). ` +
                `You can cancel it from My orders within ${CANCEL_MINUTES} minutes.`
              : `${perShop}It's saved in My orders, waiting for payment.\n${placed.unpaid.join('\n')}`}
          </p>
          <div className={styles.actions}>
            <ButtonLink to="/orders">My orders</ButtonLink>
            {cart.count > 0
              ? <Button variant="secondary" onClick={() => setPlaced(null)}>Checkout the rest of your basket</Button>
              : <ButtonLink to="/explore" variant="secondary">Continue shopping</ButtonLink>}
          </div>
        </div>
      </div>
    )
  }

  if (!country || !profile) {
    return (
      <div className={`container ${styles.page}`}>
        <div className={styles.inner}>
          <h1 className={styles.emptyHeading}>Checkout</h1>
          <EmptyState icon="cart" title="Your basket is empty"
                      text="Add some dishes first, then come back to check out."
                      action={<ButtonLink to="/explore">Browse dishes</ButtonLink>} />
        </div>
      </div>
    )
  }

  const extras = new Map((windowsQuery.data ?? []).map((w) => [w.window, w]))
  const offered = windowsQuery.data
    ? deliveryWindows.filter((w) => extras.has(w.value))
    : deliveryWindows
  const note = deliveryNote(check)
  const missing = lines.filter((l) => check?.missingDishIds.includes(l.dishId))
  const shops = check?.shops ?? []
  const currency = shops[0]?.currency ?? lines[0].currency
  const subtotal = shops.reduce((sum, s) => sum + s.subtotal, 0)
  const deliveryFee = shops.reduce((sum, s) => sum + (s.deliveryFee ?? 0), 0)
  const total = subtotal + deliveryFee
  const checking = checkQuery.isFetching
  const canPlace = !!check?.canPlaceOrder && !!address && !checking && !placing && !checkQuery.isError

  const onPlace = async () => {
    if (!address || !canPlace) return
    setPlacing(true)
    setError(null)

    // 1. One unpaid order per shop
    const result = await placeOrder({ items, deliveryAddressId: address.id, deliveryWindow })
    if (!result.ok) {
      setPlacing(false)
      setError(result.error.displayMessage)
      void checkQuery.refetch()   // show today's prices / what changed
      return
    }

    // 2. TEMPORARY: the test payment for each (no money moves)
    const unpaid: string[] = []
    for (const order of result.value) {
      const paid = await payWithTestPayment(order.orderNumber)
      if (!paid.ok) {
        const reason = paid.error.status === 404
          ? 'Payments aren\'t switched on yet. You can pay from My orders later.'
          : paid.error.displayMessage
        unpaid.push(result.value.length > 1 ? `${order.orderNumber}: ${reason}` : reason)
      }
    }

    // 3. These dishes are ordered: out of the basket (other countries' dishes stay)
    cart.clear(lines.map((l) => l.dishId))
    void queryClient.invalidateQueries({ queryKey: ['orders'] })
    setPlacing(false)
    setPlaced({ orders: result.value, unpaid })
    globalThis.scrollTo?.({ top: 0 })
  }

  return (
    <div className={`container ${styles.page}`}>
      <div className={styles.checkout}>
        <div className={styles.heading} style={{ gridColumn: '1 / -1' }}>
          <div>
            <h1>Checkout</h1>
            <p className="muted">Review and place your order</p>
          </div>
          <Link to="/cart">‹ Back to basket</Link>
        </div>

        <div className={styles.main}>
          {/* ── More than one country in the basket ── */}
          {basketCountries.length > 1 && (
            <section className={styles.card} aria-labelledby="country-title">
              <h2 id="country-title" className={styles.sectionTitle}>Which order?</h2>
              <p className="muted">
                Your basket has dishes from shops in {basketCountries.map(countryName).join(' and ')}. Each goes to
                an address in its own country, so check them out one at a time. The others stay in your basket.
              </p>
              <div className={styles.choices} role="radiogroup" aria-label="Country to check out">
                {basketCountries.map((c) => (
                  <button key={c} type="button" role="radio" aria-checked={c === country}
                          className={styles.choice} onClick={() => setPickedCountry(c)}>
                    <strong>{countryName(c)}</strong>
                    <span className="muted">{itemsText(cart.lines.filter((l) => l.country === c))}</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* ── The basket at today's prices, per shop ── */}
          <section aria-labelledby="basket-title">
            <h2 id="basket-title" className={styles.sectionTitle}>
              Your basket <span className="muted">· {itemsText(lines)}</span>
            </h2>

            {checkQuery.isError && !check && (
              <div className={styles.card}>
                <StatusBanner isError message={(checkQuery.error as { displayMessage?: string }).displayMessage
                  ?? "We couldn't check today's prices."} />
                <Button small variant="outline" onClick={() => checkQuery.refetch()}>Try again</Button>
              </div>
            )}
            {!check && !checkQuery.isError && (
              <div className={styles.card} aria-busy="true"><p className="muted">Checking today's prices…</p></div>
            )}

            {missing.length > 0 && (
              <div className={`${styles.card} ${styles.warning}`}>
                <strong>No longer on Phloem</strong>
                <p className="muted">{missing.map((l) => l.name).join(', ')}</p>
                <div>
                  <Button small variant="outline" onClick={() => cart.clear(missing.map((l) => l.dishId))}>
                    Remove {missing.length === 1 ? 'it' : 'them'}
                  </Button>
                </div>
              </div>
            )}

            {shops.map((shop) => (
              <div key={shop.vendorId} className={styles.card}>
                <div className={styles.shopHead}>
                  <Link to={`/shops/${shop.vendorId}`} className={styles.shopName}>🌿 {shop.shopName}</Link>
                </div>

                {shop.lines.map((line) => {
                  const inBasket = lines.find((l) => l.dishId === line.dishId)
                  const changed = inBasket && inBasket.price !== line.unitPrice
                  return (
                    <div key={line.dishId} className={`${styles.line} ${line.isAvailable ? '' : styles.unavailable}`}>
                      <ApiImage src={line.imageUrl} alt="" className={styles.thumb} />
                      <div className={styles.lineText}>
                        <div className={styles.lineName}>{line.dishName}</div>
                        {line.isAvailable ? (
                          <div className="muted">
                            <Price amount={line.unitPrice} currency={shop.currency} /> each
                            {changed && <span className={styles.changed}> · price updated</span>}
                          </div>
                        ) : (
                          <div className={styles.outOfStock}>Out of stock</div>
                        )}
                      </div>
                      <div className={styles.lineEnd}>
                        {line.isAvailable ? (
                          <>
                            <Price amount={line.lineTotal} currency={shop.currency} />
                            <QuantityStepper quantity={inBasket?.quantity ?? line.quantity} label={line.dishName}
                                             onAdd={() => cart.setQuantity(line.dishId, 1)}
                                             onChange={(q) => cart.setQuantity(line.dishId, q)} />
                          </>
                        ) : (
                          <button type="button" className={styles.remove} onClick={() => cart.remove(line.dishId)}>
                            Remove
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}

                <dl className={styles.sums}>
                  <dt>Subtotal</dt>
                  <dd><Price amount={shop.subtotal} currency={shop.currency} /></dd>
                  <dt>Delivery fee</dt>
                  <dd>
                    {shop.deliveryFee === null
                      ? <span className={styles.outOfStock}>Not available</span>
                      : <Price amount={shop.deliveryFee} currency={shop.currency} />}
                  </dd>
                </dl>
              </div>
            ))}
          </section>

          {/* ── Delivery address ── */}
          <section className={styles.card} aria-labelledby="address-title">
            <h2 id="address-title" className={styles.sectionTitle}>Delivery address</h2>
            {addresses.length === 0 ? (
              <>
                <p className="muted">
                  Add an address in {countryName(country)}: these shops deliver there only.
                </p>
                <div>
                  <ButtonLink to="/account/addresses?returnTo=/checkout" variant="secondary" small>
                    + Add an address
                  </ButtonLink>
                </div>
              </>
            ) : (
              <>
                <div className={styles.options} role="radiogroup" aria-label="Delivery address">
                  {addresses.map((a) => (
                    <label key={a.id} className={styles.option}>
                      <input type="radio" name="address" checked={a.id === address?.id}
                             onChange={() => setPickedAddressId(a.id)} />
                      <span>
                        <strong>📍 {a.label}</strong>{a.isDefault && <span className="muted"> · default</span>}
                        <span className={`muted ${styles.optionSub}`}>{a.fullAddress}</span>
                      </span>
                    </label>
                  ))}
                </div>
                <Link to="/account/addresses?returnTo=/checkout" className={styles.smallLink}>
                  Change delivery details
                </Link>
              </>
            )}
          </section>

          {/* ── Delivery time ── */}
          <section className={styles.card} aria-labelledby="time-title">
            <h2 id="time-title" className={styles.sectionTitle}>Delivery time</h2>
            <div className={styles.choices} role="radiogroup" aria-label="Delivery time">
              {offered.map((w) => {
                const open = openFor(check, w.value)
                const extra = extras.get(w.value)
                return (
                  <button key={w.value} type="button" role="radio" aria-checked={w.value === deliveryWindow}
                          disabled={!open} className={styles.choice} onClick={() => setPickedWindow(w.value)}>
                    <strong>{w.label}</strong>
                    <span className="muted">
                      {!open ? 'Closed for today'
                        : !extra ? ' '
                        : extra.extraCharge === 0 ? 'No extra charge'
                        : <>+<Price amount={extra.extraCharge} currency={extra.currency} className={styles.plain} /></>}
                    </span>
                  </button>
                )
              })}
            </div>
            {note && <p className={styles.note}>{note}</p>}
          </section>

          {/* ── Payment (TEMPORARY: test payments) ── */}
          <section className={styles.card} aria-labelledby="pay-title">
            <h2 id="pay-title" className={styles.sectionTitle}>Payment</h2>
            <div className={styles.payment}>
              <span aria-hidden="true">🧪</span>
              <p className="muted">
                Card and mobile money payments are on their way. Until then, orders are paid with a
                <strong> test payment</strong>: no money is taken.
              </p>
            </div>
          </section>
        </div>

        {/* ── Totals and Place order ── */}
        <aside className={styles.side} aria-label="Order total">
          <div className={styles.card}>
            <dl className={styles.sums}>
              <dt>Subtotal</dt>
              <dd><Price amount={subtotal} currency={currency} /></dd>
              <dt>Delivery fee{shops.length > 1 ? 's' : ''}</dt>
              <dd><Price amount={deliveryFee} currency={currency} /></dd>
            </dl>
            <div className={styles.grandTotal}>
              <span>Total</span>
              <Price amount={total} currency={currency} />
            </div>
            {shops.length > 1 && (
              <p className="muted" style={{ fontSize: 13 }}>
                {shops.length} orders, one for each shop, each delivered by the shop.
              </p>
            )}
            <StatusBanner isError message={error} />
            <Button variant="cta" full disabled={!canPlace} busy={placing} busyText="Placing your order…"
                    onClick={onPlace}>
              {checking && !placing ? 'Checking prices…' : <>Place order · <Price amount={total} currency={currency}
                                                                                 className={styles.plain} /></>}
            </Button>
            {!address && <p className="muted" style={{ fontSize: 13 }}>Add a delivery address to place your order.</p>}
            <p className="muted" style={{ fontSize: 12 }}>
              By placing your order you agree to the <a href="/terms#buyers" target="_blank" rel="noopener">Terms</a>.
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}
