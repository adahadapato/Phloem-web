/**
 * Dishes for buyers: GET /api/dishes. Same as the app's DishService (buyer part).
 * The seller's own dishes (/api/shops/mine/dishes) come with the seller pages (phase 3).
 */
import type { ApiResult } from '../apiError'
import { withQuery } from '../apiQuery'
import { get } from '../client'
import type { DishCardDto, DishDetailsDto, PagedResult } from '../contracts/dtos'
import type { Country, DishCategory, DishSort } from '../contracts/enums'

/** What a dish list can be narrowed down by. Everything is optional. */
export interface DishSearch {
  country?: Country
  category?: DishCategory
  /** Text to look for in dish names. */
  search?: string
  /** One shop's menu. */
  shopId?: string
  /** Best rated first (default), cheapest first, or most expensive first. */
  sort?: DishSort
  /** 1-based. */
  page?: number
  /** Items per page (API default 20, at most 100). */
  pageSize?: number
}

/** GET /api/dishes: one page of dishes. */
export const searchDishes = (search: DishSearch, signal?: AbortSignal): Promise<ApiResult<PagedResult<DishCardDto>>> =>
  get<PagedResult<DishCardDto>>(withQuery('api/dishes', { ...search }), signal)

/** GET /api/dishes/{dishId}: one dish with its photos and shop (used by Buy again). */
export const getDish = (dishId: string, signal?: AbortSignal): Promise<ApiResult<DishDetailsDto>> =>
  get<DishDetailsDto>(`api/dishes/${encodeURIComponent(dishId)}`, signal)
