/**
 * Locations: the State / LGA pickers and town suggestions on Send a parcel (anyone), and Admin → Zones (delivery
 * zones, towns customers added). Same calls as the API's /api/locations and /api/admin/locations.
 */
import type { ApiResult } from '../apiError'
import { withQuery } from '../apiQuery'
import { del, get, post, put } from '../client'
import type {
  AdminTownDto, AdminZonesDto, CountryLocationsDto, DistrictDto, PagedResult, TownDto, TownSuggestionDto,
} from '../contracts/dtos'
import type { Country } from '../contracts/enums'

// ───────────────────────────── Anyone ─────────────────────────────

/** GET /api/locations/{country}/regions: the states / regions (empty when the country has no list). */
export const getRegions = (country: Country, signal?: AbortSignal): Promise<ApiResult<CountryLocationsDto>> =>
  get<CountryLocationsDto>(`api/locations/${country}/regions`, signal)

/** GET /api/locations/regions/{id}/districts: a state's LGAs, A–Z. */
export const getDistricts = (regionId: string, signal?: AbortSignal): Promise<ApiResult<DistrictDto[]>> =>
  get<DistrictDto[]>(`api/locations/regions/${encodeURIComponent(regionId)}/districts`, signal)

/** GET /api/locations/{country}/towns: suggestions as the customer types (small typos forgiven). */
export const searchTowns = (country: Country, text: string, regionId: string | null, signal?: AbortSignal):
  Promise<ApiResult<TownDto[]>> =>
  get<TownDto[]>(withQuery(`api/locations/${country}/towns`, { text, regionId: regionId ?? undefined, take: 8 }), signal)

/** POST /api/locations/towns/suggest: which LGA of the state a typed town is in (our list, then the AI). */
export const suggestTownDistrict = (regionId: string, townName: string, signal?: AbortSignal):
  Promise<ApiResult<TownSuggestionDto>> =>
  post<TownSuggestionDto>('api/locations/towns/suggest', { regionId, townName }, signal)

// ───────────────────────────── Admin → Zones ─────────────────────────────

const admin = 'api/admin/locations'

/** A country's zones with their states, and the states in no zone. */
export const getAdminZones = (country: Country, signal?: AbortSignal): Promise<ApiResult<AdminZonesDto>> =>
  get<AdminZonesDto>(`${admin}/${country}/zones`, signal)

/** Add a zone (returns its Id). */
export const createZone = (country: Country, name: string): Promise<ApiResult<string>> =>
  post<string>(`${admin}/${country}/zones`, { name })

/** Rename a zone. */
export const renameZone = (zoneId: string, name: string) => put(`${admin}/zones/${encodeURIComponent(zoneId)}`, { name })

/** Delete an EMPTY zone. */
export const deleteZone = (zoneId: string) => del(`${admin}/zones/${encodeURIComponent(zoneId)}`)

/** Put a state in a zone (null = none). */
export const moveRegionToZone = (regionId: string, zoneId: string | null) =>
  put(`${admin}/regions/${encodeURIComponent(regionId)}/zone`, { zoneId })

/** Towns customers added (AI-suggested LGA), newest first. */
export const getTownsToCheck = (page: number, pageSize: number, signal?: AbortSignal):
  Promise<ApiResult<PagedResult<AdminTownDto>>> =>
  get<PagedResult<AdminTownDto>>(withQuery(`${admin}/towns-to-check`, { page, pageSize }), signal)

/** Mark a town checked, optionally moving it to another LGA of the same state or fixing the spelling. */
export const checkTown = (townId: string, districtId: string | null, name: string | null) =>
  put(`${admin}/towns/${encodeURIComponent(townId)}/check`, { districtId, name })

/** Delete a wrong town. */
export const deleteTown = (townId: string) => del(`${admin}/towns/${encodeURIComponent(townId)}`)
