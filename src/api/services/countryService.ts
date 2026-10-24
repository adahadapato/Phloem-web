/**
 * The countries Phloem works in, from the API (GET /api/countries). The website keeps no list of its own, so a new
 * country, flag or currency needs no website change. Same as the app's CountryService.
 */
import type { ApiResult } from '../apiError'
import { get } from '../client'
import type { CountryDto } from '../contracts/dtos'

/** GET /api/countries */
export const getCountries = (signal?: AbortSignal): Promise<ApiResult<CountryDto[]>> =>
  get<CountryDto[]>('api/countries', signal)
