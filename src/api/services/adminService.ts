/**
 * Admin → the API's admin endpoints (Admin role only). Same calls as the app's AdminService.
 * Step A: shops (lists, one shop, documents, approve / reject, ✓ badge, block) and the Overview's counts.
 */
import type { ApiResult } from '../apiError'
import { withQuery } from '../apiQuery'
import { get, post, put } from '../client'
import type { AdminShopDetailsDto, AdminShopDto, AdminShopStatsDto, PagedResult } from '../contracts/dtos'
import type { Country, ShipmentStatus, VendorStatus } from '../contracts/enums'

const shops = 'api/admin/shops'
const shop = (id: string) => `${shops}/${encodeURIComponent(id)}`

// ───────────────────────────── Overview ─────────────────────────────

/** GET /api/admin/shops/stats: how many shops in each status. */
export const getShopStats = (signal?: AbortSignal): Promise<ApiResult<AdminShopStatsDto>> =>
  get<AdminShopStatsDto>(`${shops}/stats`, signal)

/** How many people have signed up (one tiny page of Admin → Users, for its total). */
export const getUserCount = (signal?: AbortSignal): Promise<ApiResult<PagedResult<unknown>>> =>
  get<PagedResult<unknown>>(withQuery('api/admin/users', { page: 1, pageSize: 1 }), signal)

/** Dish names sellers suggested that wait for a decision. */
export const getDishSuggestions = (signal?: AbortSignal): Promise<ApiResult<unknown[]>> =>
  get<unknown[]>('api/admin/dish-catalog/suggestions', signal)

/** How many parcels are in one status (e.g. Booked = still to be received at the hub). */
export const getShipmentCount = (status: ShipmentStatus, signal?: AbortSignal):
  Promise<ApiResult<PagedResult<unknown>>> =>
  get<PagedResult<unknown>>(withQuery('api/staff/shipments', { status, page: 1, pageSize: 1 }), signal)

// ───────────────────────────── Shops ─────────────────────────────

/** GET /api/admin/shops/pending: waiting for approval, oldest first. */
export const getPendingShops = (signal?: AbortSignal): Promise<ApiResult<AdminShopDto[]>> =>
  get<AdminShopDto[]>(`${shops}/pending`, signal)

/** GET /api/admin/shops: every shop, filtered by status / country / name; one page. */
export const getShops = (filter: { status?: VendorStatus; country?: Country; search?: string; page: number; pageSize: number },
                         signal?: AbortSignal): Promise<ApiResult<PagedResult<AdminShopDto>>> =>
  get<PagedResult<AdminShopDto>>(withQuery(shops, { ...filter, search: filter.search?.trim() }), signal)

/** GET /api/admin/shops/{id}: one shop with its documents. */
export const getShop = (id: string, signal?: AbortSignal): Promise<ApiResult<AdminShopDetailsDto>> =>
  get<AdminShopDetailsDto>(shop(id), signal)

/** A 10-minute link to open a private document. */
export const getDocumentLink = (shopId: string, documentId: string): Promise<ApiResult<string>> =>
  get<string>(`${shop(shopId)}/documents/${encodeURIComponent(documentId)}/link`)

/** Approve: the shop goes live and its owner becomes a Seller. */
export const approveShop = (id: string) => post(`${shop(id)}/approve`)

/** Reject with a reason the seller sees (only while waiting for approval). */
export const rejectShop = (id: string, reason: string) => post(`${shop(id)}/reject`, { reason })

/** Accept or reject one document (a reason is needed to reject). */
export const reviewDocument = (shopId: string, documentId: string, accept: boolean, reason?: string) =>
  post(`${shop(shopId)}/documents/${encodeURIComponent(documentId)}/review`, { accept, reason: reason ?? null })

/** Give or take the ✓ badge (giving it needs the required documents accepted). */
export const setShopVerified = (id: string, verified: boolean) => put(`${shop(id)}/verified`, { verified })

/** Block (hidden; the owner loses the Seller role) or unblock. */
export const setShopBlocked = (id: string, blocked: boolean) => put(`${shop(id)}/blocked`, { blocked })
