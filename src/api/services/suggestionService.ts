/**
 * Home's suggestions. Same as the app's SuggestionService.
 * - Signed in: GET /api/me/suggestions ("Order again" + "For you", personal, never cached).
 * - Signed out: GET /api/dishes/popular ("Popular in Ghana", the same for everyone).
 * Both only return dishes that can be ordered now in the country, each "For you" dish with the reason it was picked.
 */
import type { ApiResult } from '../apiError'
import { withQuery } from '../apiQuery'
import { get } from '../client'
import type { SuggestedDishDto, SuggestionsDto } from '../contracts/dtos'
import type { Country } from '../contracts/enums'

/** GET /api/me/suggestions: my "Order again" and "For you" rows (1–20 dishes each). */
export const getMySuggestions = (country: Country, take = 8, signal?: AbortSignal): Promise<ApiResult<SuggestionsDto>> =>
  get<SuggestionsDto>(withQuery('api/me/suggestions', { country, take }), signal)

/** GET /api/dishes/popular: "Popular in …" for people who aren't signed in (1–20 dishes). */
export const getPopularDishes = (country: Country, take = 8, signal?: AbortSignal): Promise<ApiResult<SuggestedDishDto[]>> =>
  get<SuggestedDishDto[]>(withQuery('api/dishes/popular', { country, take }), signal)
