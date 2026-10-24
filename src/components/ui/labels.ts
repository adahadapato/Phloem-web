/** Names people see for the API's values. Kept in one place so every page says the same. */
import type { DeliveryWindow, DishCategory, DishSort, OrderStatus } from '../../api/contracts/enums'

/** The category tabs, in the app's order. */
export const dishCategories: { value: DishCategory; label: string }[] = [
  { value: 'LocalMeals', label: 'Local Meals' },
  { value: 'Snacks', label: 'Snacks' },
  { value: 'Drinks', label: 'Drinks' },
]

/** The sort choices for dish lists. */
export const dishSorts: { value: DishSort; label: string }[] = [
  { value: 'Rating', label: 'Best rated' },
  { value: 'PriceLow', label: 'Price: low to high' },
  { value: 'PriceHigh', label: 'Price: high to low' },
]

/** The delivery times, in the app's order and words. */
export const deliveryWindows: { value: DeliveryWindow; label: string }[] = [
  { value: 'Asap', label: 'As soon as possible' },
  { value: 'TodayEvening', label: 'This evening' },
  { value: 'Tomorrow', label: 'Tomorrow' },
]

/** A shop's cut-off ("21:00:00") the way the app says it: "9pm", "8:30pm". */
export function cutoffText(time: string): string {
  const [h = 0, m = 0] = time.split(':').map(Number)
  const hour = h % 12 === 0 ? 12 : h % 12
  return `${hour}${m ? `:${String(m).padStart(2, '0')}` : ''}${h < 12 ? 'am' : 'pm'}`
}

/** An order's status in the app's words. */
export const orderStatusText: Record<OrderStatus, string> = {
  AwaitingPayment: 'Awaiting payment',
  Paid: 'Order placed',
  Preparing: 'Being prepared',
  OutForDelivery: 'On its way',
  Delivered: 'Delivered',
  Cancelled: 'Cancelled',
}

/** "24 Oct 2026, 19:05" in the person's own time zone (the API sends UTC). */
export function dateTimeText(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}
