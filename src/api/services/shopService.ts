/**
 * Shops for buyers: GET /api/shops. Same as the app's ShopService (buyer part).
 * The seller's own shop (/api/shops/mine) comes with the seller pages (phase 3).
 */
import type { ApiResult } from '../apiError'
import { withQuery } from '../apiQuery'
import { get } from '../client'
import type { PagedResult, ShopDetailsDto, ShopListItemDto } from '../contracts/dtos'
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
