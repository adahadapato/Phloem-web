/**
 * My shop's orders (/api/shops/mine/orders): the list, the dashboard numbers, and moving an order along:
 * Paid → Accept → Preparing → Send out → Out for delivery → Delivered (or Decline a new one, with a reason).
 * Same as the app's SellerService (orders part). Sellers never see unpaid orders.
 */
import type { ApiResult } from '../apiError'
import { withQuery } from '../apiQuery'
import { get, post } from '../client'
import type { PagedResult, ShopOrderStatsDto, ShopOrderSummaryDto } from '../contracts/dtos'
import type { OrderStatus } from '../contracts/enums'

const order = (orderNumber: string) => `api/shops/mine/orders/${encodeURIComponent(orderNumber)}`

/** GET /api/shops/mine/orders: newest first; status = only that one (Paid = new orders). */
export const getShopOrders = (status: OrderStatus | undefined, page: number, pageSize: number, signal?: AbortSignal):
  Promise<ApiResult<PagedResult<ShopOrderSummaryDto>>> =>
  get<PagedResult<ShopOrderSummaryDto>>(withQuery('api/shops/mine/orders', { status, page, pageSize }), signal)

/** GET /api/shops/mine/orders/stats: orders per status and the last 7 days' sales. */
export const getShopOrderStats = (signal?: AbortSignal): Promise<ApiResult<ShopOrderStatsDto>> =>
  get<ShopOrderStatsDto>('api/shops/mine/orders/stats', signal)

/** POST …/accept: start preparing a new paid order. */
export const acceptShopOrder = (orderNumber: string) => post<void>(`${order(orderNumber)}/accept`)

/** POST …/decline: can't make it; cancelled and refunded, the buyer gets the reason by email. */
export const declineShopOrder = (orderNumber: string, reason: string) =>
  post<void>(`${order(orderNumber)}/decline`, { reason })

/** POST …/send-out: it has left the kitchen. */
export const sendOutShopOrder = (orderNumber: string) => post<void>(`${order(orderNumber)}/send-out`)

/** POST …/delivered: delivered; commission taken, earnings added to my balance. */
export const markShopOrderDelivered = (orderNumber: string) => post<void>(`${order(orderNumber)}/delivered`)
