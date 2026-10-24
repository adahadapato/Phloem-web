/** Names people see for the API's values. Kept in one place so every page says the same. */
import type {
  DeliveryWindow, DishCategory, DishSort, OrderStatus, ShipmentItemCategory, ShipmentStatus,
} from '../../api/contracts/enums'

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

/** A parcel's status in the app's words (My shipments). */
export const shipmentStatusText: Record<ShipmentStatus, string> = {
  Booked: 'Booked · drop it at the hub',
  ReceivedAtHub: 'At the hub · ready to pay',
  Paid: 'Paid · waiting to leave',
  InTransit: 'In transit',
  ArrivedInDestination: 'Arrived in destination',
  OutForDelivery: 'Out for delivery',
  Delivered: 'Delivered',
  Cancelled: 'Cancelled',
}

/** A step on a parcel's timeline (short). */
export const shipmentStepText: Record<ShipmentStatus, string> = {
  Booked: 'Booked',
  ReceivedAtHub: 'Received and weighed at the hub',
  Paid: 'Paid',
  InTransit: 'In transit',
  ArrivedInDestination: 'Arrived in the destination country',
  OutForDelivery: 'Out for delivery',
  Delivered: 'Delivered',
  Cancelled: 'Cancelled',
}

/** The journey in order (Cancelled is not a step). */
export const shipmentJourney: ShipmentStatus[] =
  ['Booked', 'ReceivedAtHub', 'Paid', 'InTransit', 'ArrivedInDestination', 'OutForDelivery', 'Delivered']

/** What each item category is called. */
export const shipmentCategories: { value: ShipmentItemCategory; label: string }[] = [
  { value: 'PackagedFood', label: 'Packaged food' },
  { value: 'Clothing', label: 'Clothing' },
  { value: 'Documents', label: 'Documents' },
  { value: 'Electronics', label: 'Electronics' },
  { value: 'Other', label: 'Other' },
]

/** "24 Oct" from "2026-10-24" (a date without a time). */
export function dayMonthText(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
}

/** "Expected 3 Nov – 7 Nov", "Expected 3 Nov", or null before it leaves. */
export function arrivalText(from: string | null, to: string | null): string | null {
  if (!from || !to) return null
  return from === to ? `Expected ${dayMonthText(from)}` : `Expected ${dayMonthText(from)} – ${dayMonthText(to)}`
}
