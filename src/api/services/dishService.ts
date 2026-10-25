/**
 * Dishes for buyers: GET /api/dishes. Same as the app's DishService (buyer part).
 * The seller's own dishes: /api/shops/mine/dishes.
 */
import type { ApiResult } from '../apiError'
import { withQuery } from '../apiQuery'
import { del, get, post, put, upload } from '../client'
import type { DishCommand } from '../contracts/commands'
import type { DishCardDto, DishDetailsDto, DishPhotoDto, MyDishesDto, PagedResult } from '../contracts/dtos'
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

const myDish = (dishId: string) => `api/shops/mine/dishes/${encodeURIComponent(dishId)}`

/** POST /api/shops/mine/dishes: add a dish; returns its Id (photos are added next). */
export const createMyDish = (command: DishCommand): Promise<ApiResult<string>> =>
  post<string>('api/shops/mine/dishes', command)

/** PUT /api/shops/mine/dishes/{id}: change name, detail, price, description, available. */
export const updateMyDish = (dishId: string, command: DishCommand) => put<void>(myDish(dishId), command)

/** DELETE /api/shops/mine/dishes/{id}: past orders still show it. */
export const deleteMyDish = (dishId: string) => del(myDish(dishId))

/** POST /api/shops/mine/dishes/{id}/photos: JPEG, PNG, WebP or HEIC, up to 10 MB, at most 5 per dish. */
export const addMyDishPhoto = (dishId: string, photo: File): Promise<ApiResult<DishPhotoDto>> =>
  upload<DishPhotoDto>('POST', `${myDish(dishId)}/photos`, 'photo', photo)

/** DELETE /api/shops/mine/dishes/{id}/photos/{photoId} */
export const removeMyDishPhoto = (dishId: string, photoId: string) =>
  del(`${myDish(dishId)}/photos/${encodeURIComponent(photoId)}`)
