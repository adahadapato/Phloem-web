/**
 * Shops: for buyers (GET /api/shops) and the seller's own shop (/api/shops/mine). Same as the app's ShopService.
 */
import type { ApiResult } from '../apiError'
import { withQuery } from '../apiQuery'
import { del, get, post, put, upload } from '../client'
import type { OpenShopCommand, UpdateShopDetailsCommand } from '../contracts/commands'
import type { MyDeliveryFeeDto, MyShopDto, PagedResult, ShopDetailsDto, ShopListItemDto } from '../contracts/dtos'
import type { Country, VendorDocumentType } from '../contracts/enums'

/** GET /api/shops: approved shops, verified first, then by rating. */
export const getShops = (params: { country?: Country; search?: string; page?: number; pageSize?: number },
                         signal?: AbortSignal): Promise<ApiResult<PagedResult<ShopListItemDto>>> =>
  get<PagedResult<ShopListItemDto>>(withQuery('api/shops', { ...params }), signal)

/** GET /api/shops/top: the best-rated shops for Home (count 1–20, API default 8). */
export const getTopShops = (country: Country | undefined, count = 8,
                            signal?: AbortSignal): Promise<ApiResult<ShopListItemDto[]>> =>
  get<ShopListItemDto[]>(withQuery('api/shops/top', { country, count }), signal)

/** GET /api/shops/{id}: a shop's page header. Its menu: searchDishes({ shopId }). */
export const getShop = (shopId: string, signal?: AbortSignal): Promise<ApiResult<ShopDetailsDto>> =>
  get<ShopDetailsDto>(`api/shops/${encodeURIComponent(shopId)}`, signal)

// ───────────────────────────── My shop (seller) ─────────────────────────────

/** POST /api/shops: open my shop; it waits for approval. Returns its Id. */
export const openShop = (command: OpenShopCommand): Promise<ApiResult<string>> => post<string>('api/shops', command)

/** GET /api/shops/mine: my shop, its status and what's still needed for the ✓ badge. */
export const getMyShop = (signal?: AbortSignal): Promise<ApiResult<MyShopDto>> => get<MyShopDto>('api/shops/mine', signal)

/** PUT /api/shops/mine/logo: JPEG, PNG, WebP or HEIC, up to 5 MB. Returns its URL. */
export const uploadMyShopLogo = (logo: File): Promise<ApiResult<string>> =>
  upload<string>('PUT', 'api/shops/mine/logo', 'logo', logo)

/** PUT /api/shops/mine: name, business email and phone (blank = my account's). A rejected shop goes back for review. */
export const updateMyShop = (command: UpdateShopDetailsCommand) => put<void>('api/shops/mine', command)

/** DELETE /api/shops/mine/logo */
export const removeMyShopLogo = () => del('api/shops/mine/logo')

/** PUT /api/shops/mine/cover-photo: the banner on my shop's page (JPEG, PNG, WebP or HEIC, up to 5 MB). */
export const uploadMyShopCover = (cover: File): Promise<ApiResult<string>> =>
  upload<string>('PUT', 'api/shops/mine/cover-photo', 'coverPhoto', cover)

/** DELETE /api/shops/mine/cover-photo */
export const removeMyShopCover = () => del('api/shops/mine/cover-photo')

/** POST /api/shops/mine/documents: PDF, JPEG or PNG up to 10 MB; replaces one of the same type. Returns its Id. */
export const uploadMyShopDocument = (type: VendorDocumentType, file: File, expiresOn: string | null):
  Promise<ApiResult<string>> =>
  upload<string>('POST', 'api/shops/mine/documents', 'file', file,
                            expiresOn ? { type, expiresOn } : { type })

/** GET /api/shops/mine/delivery-fee: my fee and the range allowed in my country. */
export const getMyDeliveryFee = (signal?: AbortSignal): Promise<ApiResult<MyDeliveryFeeDto>> =>
  get<MyDeliveryFeeDto>('api/shops/mine/delivery-fee', signal)

/** PUT /api/shops/mine/delivery-fee: inside my country's range. */
export const setMyDeliveryFee = (fee: number) => put<void>('api/shops/mine/delivery-fee', { fee })

/** PUT /api/shops/mine/order-cutoff: "HH:mm" (my shop's local time); after it, only Tomorrow. */
export const setMyOrderCutoff = (cutoff: string) =>
  put<void>('api/shops/mine/order-cutoff', { cutoff: `${cutoff.slice(0, 5)}:00` })
