/**
 * My shop's orders (/api/shops/mine/orders): the list, the dashboard numbers, and moving an order along:
 * Paid → Accept → Preparing → Send out (with a courier) → Out for delivery → Delivered by the courier, with a photo
 * (or Decline a new one, with a reason).
 * Same as the app's SellerService (orders part). Sellers never see unpaid orders.
 */
import type { ApiResult } from '../apiError'
import { withQuery } from '../apiQuery'
import { get, post, put } from '../client'
import type { CourierOptionDto, PagedResult, ShopOrderStatsDto, ShopOrderSummaryDto } from '../contracts/dtos'
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

/**
 * POST …/send-out: it has left the kitchen with a courier (`null` = I'll deliver it myself). The courier marks it
 * delivered with a photo (deliveryService), and then the earnings go to my balance.
 */
export const sendOutShopOrder = (orderNumber: string, courierId: string | null) =>
  post<void>(`${order(orderNumber)}/send-out`, { courierId })

/** PUT …/courier: give an order that's out for delivery to another courier (`null` = I'll deliver it myself). */
export const changeShopOrderCourier = (orderNumber: string, courierId: string | null) =>
  put<void>(`${order(orderNumber)}/courier`, { courierId })

/** GET /api/shops/mine/couriers: me first ("I'll deliver it myself"), then the couriers in my country. */
export const getShopCouriers = (signal?: AbortSignal): Promise<ApiResult<CourierOptionDto[]>> =>
  get<CourierOptionDto[]>('api/shops/mine/couriers', signal)
