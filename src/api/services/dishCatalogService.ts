/**
 * Phloem's list of dish names (sellers pick from it, so the same dish has one name everywhere) with the price
 * range allowed in each country. Same as the app's DishCatalogService (seller part).
 */
import type { ApiResult } from '../apiError'
import { withQuery } from '../apiQuery'
import { get, post } from '../client'
import type { SuggestDishNameCommand } from '../contracts/commands'
import type { DishCatalogItemDto } from '../contracts/dtos'
import type { Country } from '../contracts/enums'

/** GET /api/dish-catalog: every name with its price range in the country (the shop's country). */
export const getDishCatalog = (country: Country, signal?: AbortSignal): Promise<ApiResult<DishCatalogItemDto[]>> =>
  get<DishCatalogItemDto[]>(withQuery('api/dish-catalog', { country }), signal)

/** POST /api/dish-catalog/suggestions: suggest a missing name for an admin to approve. */
export const suggestDishName = (command: SuggestDishNameCommand): Promise<ApiResult<string>> =>
  post<string>('api/dish-catalog/suggestions', command)
