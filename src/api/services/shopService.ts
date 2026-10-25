/**
 * Shops: for buyers (GET /api/shops) and the seller's own shop (/api/shops/mine). Same as the app's ShopService.
 */
import type { ApiResult } from '../apiError'
import { withQuery } from '../apiQuery'
import { get, post, upload } from '../client'
import type { OpenShopCommand } from '../contracts/commands'
import type { MyShopDto, PagedResult, ShopDetailsDto, ShopListItemDto } from '../contracts/dtos'
import type { Country } from '../contracts/enums'

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
