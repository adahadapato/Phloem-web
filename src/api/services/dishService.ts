/**
 * Dishes for buyers: GET /api/dishes. Same as the app's DishService (buyer part).
 * The seller's own dishes: /api/shops/mine/dishes.
 */
import type { ApiResult } from '../apiError'
import { withQuery } from '../apiQuery'
import { get, put } from '../client'
import type { DishCardDto, DishDetailsDto, MyDishesDto, PagedResult } from '../contracts/dtos'
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

// ───────────────────────────── My dishes (seller) ─────────────────────────────

/** GET /api/shops/mine/dishes: my dishes (those needing a new price first) and how many need one. */
export const getMyDishes = (signal?: AbortSignal): Promise<ApiResult<MyDishesDto>> =>
  get<MyDishesDto>('api/shops/mine/dishes', signal)

/** PUT /api/shops/mine/dishes/{id}/price: a new price, inside my country's range. */
export const setMyDishPrice = (dishId: string, price: number) =>
  put<void>(`api/shops/mine/dishes/${encodeURIComponent(dishId)}/price`, { price })
