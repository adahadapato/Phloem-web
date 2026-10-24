import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { getDish } from '../../api/services/dishService'
import { cancelOrder, getBuyAgain, payWithTestPayment } from '../../api/services/orderService'
import { useCart } from '../../state/CartContext'

/** What the last action said, shown at the top of the page. */
export interface ActionMessage {
  text: string
  isError: boolean
  /** Buy again put dishes in the basket: offer "Checkout ›". */
  toCheckout?: boolean
}

/**
 * The buttons on My orders and Order details, like the app's OrderHistoryService:
 * - **Pay now** (unpaid orders): TEMPORARY test payment, no money moves, until a real payment provider is connected.
 *   The API brings prices to today's and drops dishes that ran out.
 * - **Cancel** (asks first): unpaid any time; paid within 30 minutes of payment and before the shop starts.
 * - **Buy again**: the dishes still on sale go back in the basket (looked up one by one for their shop and photo).
 * Each reloads the orders afterwards, so the page shows the API's view.
 */
export function useOrderActions() {
  const cart = useCart()
  const queryClient = useQueryClient()
  /** "pay:PHL-…", "cancel:PHL-…" or "again:PHL-…" while that runs. */
  const [busy, setBusy] = useState<string | null>(null)
  /** The order whose "Cancel this order?" question is open. */
  const [confirmCancel, setConfirmCancel] = useState<string | null>(null)
  const [message, setMessage] = useState<ActionMessage | null>(null)

  const reload = () => queryClient.invalidateQueries({ queryKey: ['orders'] })

  const run = async (key: string, action: () => Promise<ActionMessage>) => {
    setBusy(key)
    setMessage(null)
    try {
      setMessage(await action())
    } finally {
      setBusy(null)
    }
  }

  const pay = (orderNumber: string) => run(`pay:${orderNumber}`, async () => {
    const result = await payWithTestPayment(orderNumber)
    await reload()
    if (!result.ok) {
      return {
        isError: true,
        text: result.error.status === 404
          ? "Payments aren't switched on yet. Your order stays here, waiting for payment."
          : result.error.displayMessage,
      }
    }
    const removed = result.value.removedDishes
    return {
      isError: false,
      text: `${orderNumber} is paid with a TEST payment (no money was taken). The shop can now start on it.` +
        (removed.length ? `\nLeft out because they ran out: ${removed.join(', ')}.` : ''),
    }
  })

  const cancel = (orderNumber: string) => run(`cancel:${orderNumber}`, async () => {
    setConfirmCancel(null)
    const result = await cancelOrder(orderNumber)
    await reload()   // the order's real status either way
    return result.ok
      ? { isError: false, text: `${orderNumber} is cancelled.` }
      : { isError: true, text: result.error.displayMessage }
  })

  const buyAgain = (orderNumber: string) => run(`again:${orderNumber}`, async () => {
    const again = await getBuyAgain(orderNumber)
    if (!again.ok) return { isError: true, text: again.error.displayMessage }

    // Each dish's shop, country and photo for the basket
    const found = await Promise.all(again.value.items.map(async (item) => ({ item, dish: await getDish(item.dishId) })))
    const unavailable = [...again.value.unavailableDishes]
    let count = 0
    for (const { item, dish } of found) {
      if (!dish.ok || !dish.value.canBeOrdered) {
        if (dish.ok) unavailable.push(dish.value.name)
        continue
      }
      const d = dish.value
      const photo = d.photos.find((p) => p.isPrimary) ?? d.photos[0]
      cart.addLine({
        dishId: d.id, name: d.name, imageUrl: photo ? photo.thumbnailUrl ?? photo.url : null, price: d.price,
        currency: d.currency, country: d.country, shopId: d.shopId, shopName: d.shopName,
      }, item.quantity)
      count += item.quantity
    }

    const missing = unavailable.length ? `\nNo longer available: ${unavailable.join(', ')}.` : ''
    return count === 0
      ? { isError: true, text: `None of these dishes are on sale right now.${missing}` }
      : {
          isError: false,
          toCheckout: true,
          text: `${count} ${count === 1 ? 'item' : 'items'} from ${orderNumber} ${count === 1 ? 'is' : 'are'} ` +
            `back in your basket.${missing}`,
        }
  })

  return { busy, message, confirmCancel, setConfirmCancel, pay, cancel, buyAgain }
}
