/**
 * Buying: checking the basket, placing orders, paying, and My orders (list, details, cancel, buy again).
 * Same as the app's OrderService (buyer part).
 */
import type { ApiResult } from '../apiError'
import { withQuery } from '../apiQuery'
import { get, post } from '../client'
import type { CheckBasketQuery, PlaceOrderCommand } from '../contracts/commands'
import type {
  BasketCheckDto,
  BuyAgainDto,
  DishCardDto,
  DeliveryWindowOptionDto,
  OrderDetailsDto,
  OrderPaymentDto,
  OrderSummaryDto,
  PagedResult,
  PlacedOrderDto,
} from '../contracts/dtos'
import type { Country, OrderStatusGroup } from '../contracts/enums'

const order = (orderNumber: string) => `api/orders/${encodeURIComponent(orderNumber)}`

/** GET /api/delivery-windows: the delivery times a country offers and what each adds. */
export const getDeliveryWindows = (country: Country, signal?: AbortSignal):
  Promise<ApiResult<DeliveryWindowOptionDto[]>> =>
  get<DeliveryWindowOptionDto[]>(withQuery('api/delivery-windows', { country }), signal)

/** POST /api/orders/basket/check: today's prices, stock and delivery fees per shop. Nothing is saved. */
export const checkBasket = (query: CheckBasketQuery, signal?: AbortSignal): Promise<ApiResult<BasketCheckDto>> =>
  post<BasketCheckDto>('api/orders/basket/check', query, signal)

/** POST /api/orders: one UNPAID order per shop; returns their numbers. */
export const placeOrder = (command: PlaceOrderCommand): Promise<ApiResult<PlacedOrderDto[]>> =>
  post<PlacedOrderDto[]>('api/orders', command)

/** POST /api/orders/{n}/payment: today's prices, out-of-stock dishes dropped, the amount to pay. */
export const prepareOrderPayment = (orderNumber: string): Promise<ApiResult<OrderPaymentDto>> =>
  post<OrderPaymentDto>(`${order(orderNumber)}/payment`)

/**
 * TEMPORARY: POST /api/orders/{n}/test-payment marks the order paid without taking money, until a real payment
 * provider is connected. Only exists while the API's Payments:TestPaymentsEnabled is on (otherwise "not found":
 * the order stays in My orders, waiting for payment).
 */
export const payWithTestPayment = (orderNumber: string): Promise<ApiResult<OrderPaymentDto>> =>
  post<OrderPaymentDto>(`${order(orderNumber)}/test-payment`)

// ───────────────────────────── My orders ─────────────────────────────

/** What My orders can be narrowed down by. Everything is optional. */
export interface MyOrdersSearch {
  /** The tab (default: all). */
  show?: OrderStatusGroup
  /** Only orders placed on or after this day ("yyyy-MM-dd", UTC). */
  from?: string
  /** Order number, shop or dish name. */
  search?: string
  page?: number
  pageSize?: number
}

/** GET /api/orders: my orders, newest first, optionally one tab, since a day, matching a search. */
export const getMyOrders = (search: MyOrdersSearch, signal?: AbortSignal):
  Promise<ApiResult<PagedResult<OrderSummaryDto>>> =>
  get<PagedResult<OrderSummaryDto>>(withQuery('api/orders', { ...search }), signal)

/** GET /api/orders/recent-dishes: "Buy it again", dishes from my paid orders still on sale (dish cards). */
export const getRecentlyOrderedDishes = (take: number, signal?: AbortSignal): Promise<ApiResult<DishCardDto[]>> =>
  get<DishCardDto[]>(withQuery('api/orders/recent-dishes', { take }), signal)

/** GET /api/orders/{n}: one of my orders (unpaid ones at today's prices). */
export const getOrder = (orderNumber: string, signal?: AbortSignal): Promise<ApiResult<OrderDetailsDto>> =>
  get<OrderDetailsDto>(order(orderNumber), signal)

/** POST /api/orders/{n}/cancel: unpaid any time; paid within 30 minutes of payment, before the shop starts. */
export const cancelOrder = (orderNumber: string) => post<void>(`${order(orderNumber)}/cancel`)

/** GET /api/orders/{n}/buy-again: the order's dishes still on sale, ready for the basket. */
export const getBuyAgain = (orderNumber: string, signal?: AbortSignal): Promise<ApiResult<BuyAgainDto>> =>
  get<BuyAgainDto>(`${order(orderNumber)}/buy-again`, signal)
