/**
 * The API's enums. The API sends and accepts them as NAMES ("Ghana", not 1), so they are string unions here
 * (TypeScript `enum`s aren't used: the project builds with `erasableSyntaxOnly`).
 * Keep in step with the API (Phloem.Domain/Enums) and the app (Services/Api/Contracts/Enums).
 */

/** A country Phloem works in. Names, flags and currencies come from GET /api/countries. */
export type Country = 'Ghana' | 'Nigeria' | 'UnitedKingdom'

/** A currency (each country has one). */
export type Currency = 'GHS' | 'NGN' | 'GBP'

/** A dish's category (the tabs on Home and Explore). */
export type DishCategory = 'LocalMeals' | 'Snacks' | 'Drinks'

/** How a dish list is ordered. */
export type DishSort = 'Rating' | 'PriceLow' | 'PriceHigh'

/** When an order should arrive. Shops stop taking same-day orders at their cut-off time (then only Tomorrow). */
export type DeliveryWindow = 'Asap' | 'TodayEvening' | 'Tomorrow'

/** Where an order is: AwaitingPayment → Paid → Preparing → OutForDelivery → Delivered (or Cancelled). */
export type OrderStatus = 'AwaitingPayment' | 'Paid' | 'Preparing' | 'OutForDelivery' | 'Delivered' | 'Cancelled'

/** The tabs on My orders (GET /api/orders?show=…): orders grouped the way buyers think about them. */
export type OrderStatusGroup = 'All' | 'WaitingForPayment' | 'InProgress' | 'Completed' | 'Cancelled'
