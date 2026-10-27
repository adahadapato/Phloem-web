/**
 * Admin → the API's admin endpoints (Admin role only). Same calls as the app's AdminService.
 * Shops (lists, one shop, documents, approve / reject, ✓ badge, block), users (suspend, roles), dish names (suggestions,
 * price ranges) and the Overview's counts.
 */
import type { ApiResult } from '../apiError'
import { withQuery } from '../apiQuery'
import { del, get, post, put } from '../client'
import type {
  AdminDishCatalogDto, AdminDishSuggestionDto, AdminShopDetailsDto, AdminShopDto, AdminShopStatsDto, AdminUserDto,
  CommissionDto, DeliveryPricingDto, PagedResult, UserSuspendedDto,
} from '../contracts/dtos'
import type { Country, DeliveryWindow, ShipmentStatus, VendorStatus } from '../contracts/enums'

const shops = 'api/admin/shops'
const shop = (id: string) => `${shops}/${encodeURIComponent(id)}`

// ───────────────────────────── Overview ─────────────────────────────

/** GET /api/admin/shops/stats: how many shops in each status. */
export const getShopStats = (signal?: AbortSignal): Promise<ApiResult<AdminShopStatsDto>> =>
  get<AdminShopStatsDto>(`${shops}/stats`, signal)

/** How many people have signed up (one tiny page of Admin → Users, for its total). */
export const getUserCount = (signal?: AbortSignal): Promise<ApiResult<PagedResult<unknown>>> =>
  get<PagedResult<unknown>>(withQuery('api/admin/users', { page: 1, pageSize: 1 }), signal)

/** Dish names sellers suggested that wait for a decision, oldest first. */
export const getDishSuggestions = (signal?: AbortSignal): Promise<ApiResult<AdminDishSuggestionDto[]>> =>
  get<AdminDishSuggestionDto[]>('api/admin/dish-catalog/suggestions', signal)

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

// ───────────────────────────── Users ─────────────────────────────

const users = 'api/admin/users'
const user = (id: string) => `${users}/${encodeURIComponent(id)}`

/** GET /api/admin/users: everyone, newest first; a name search, or only suspended people; one page. */
export const getUsers = (filter: { search?: string; suspendedOnly: boolean; page: number; pageSize: number },
                         signal?: AbortSignal): Promise<ApiResult<PagedResult<AdminUserDto>>> =>
  get<PagedResult<AdminUserDto>>(withQuery(users, { ...filter, search: filter.search?.trim() }), signal)

/** Suspend until a date (UTC) or until further notice (null): signed out, shop hidden, emailed the reason. */
export const suspendUser = (id: string, reason: string, untilUtc: string | null): Promise<ApiResult<UserSuspendedDto>> =>
  post<UserSuspendedDto>(`${user(id)}/suspend`, { reason, untilUtc })

/** Lift a suspension. */
export const reinstateUser = (id: string) => post(`${user(id)}/reinstate`)

/** Give a role (Admin, CatalogManager, ShipmentManager, SupportAgent). */
export const grantRole = (id: string, role: string) => put(`${user(id)}/roles/${encodeURIComponent(role)}`)

/** Take a role away (they're signed out everywhere). Your own Admin role and the last admin's are refused. */
export const removeRole = (id: string, role: string) => del(`${user(id)}/roles/${encodeURIComponent(role)}`)

// ───────────────────────────── Dish names ─────────────────────────────

const dishNames = 'api/admin/dish-catalog'

/** Every approved dish name with its price range in each country. */
export const getDishNames = (signal?: AbortSignal): Promise<ApiResult<AdminDishCatalogDto[]>> =>
  get<AdminDishCatalogDto[]>(dishNames, signal)

/** Approve a suggested name (sellers can use it once it has a price range in their country). */
export const approveDishName = (id: string) => post(`${dishNames}/${encodeURIComponent(id)}/approve`)

/** Reject a suggested name. */
export const rejectDishName = (id: string) => post(`${dishNames}/${encodeURIComponent(id)}/reject`)

/** Set a name's price range in one country; returns how many dishes now need a new price (their sellers are emailed). */
export const setPriceRange = (id: string, country: Country, minPrice: number, maxPrice: number): Promise<ApiResult<number>> =>
  put<number>(`${dishNames}/${encodeURIComponent(id)}/price-ranges/${country}`, { minPrice, maxPrice })

// ───────────────────────────── Pricing ─────────────────────────────

/** Phloem's commission in every country. */
export const getCommissions = (signal?: AbortSignal): Promise<ApiResult<CommissionDto[]>> =>
  get<CommissionDto[]>('api/admin/commissions', signal)

/** Set a country's commission (0–50 %); only orders delivered from now on use it. */
export const setCommission = (country: Country, ratePercent: number) =>
  put(`api/admin/commissions/${country}`, { ratePercent })

/** Every country's shop delivery-fee range and delivery times (countries not set up yet aren't listed). */
export const getDeliveryPricing = (signal?: AbortSignal): Promise<ApiResult<DeliveryPricingDto[]>> =>
  get<DeliveryPricingDto[]>('api/admin/delivery-pricing', signal)

/** Set a country's shop fee range; returns how many shops had their fee moved into it (they're emailed). */
export const setShopFeeRange = (country: Country, minShopFee: number, maxShopFee: number): Promise<ApiResult<number>> =>
  put<number>(`api/admin/delivery-pricing/${country}`, { minShopFee, maxShopFee })

/** Offer a delivery time in a country, or change what it adds (0 = free). */
export const setWindowCharge = (country: Country, window: DeliveryWindow, extraCharge: number) =>
  put(`api/admin/delivery-pricing/${country}/windows/${window}`, { extraCharge })

/** Stop offering a delivery time in a country. */
export const removeWindow = (country: Country, window: DeliveryWindow) =>
  del(`api/admin/delivery-pricing/${country}/windows/${window}`)

