/**
 * Parcels: routes and prices, booking, My shipments, and public tracking. Same as the app's ShipmentService
 * (customer part). Staff pages (weighing, moving parcels along) come with the admin pages.
 */
import type { ApiResult } from '../apiError'
import { withQuery } from '../apiQuery'
import { get, post } from '../client'
import type { BookShipmentCommand, GetShipmentQuoteQuery } from '../contracts/commands'
import type {
  BookedShipmentDto,
  PagedResult,
  ParcelItemRuleDto,
  PublicTrackingDto,
  ShipmentDetailsDto,
  ShipmentQuoteDto,
  ShipmentRouteOptionDto,
  ShipmentSummaryDto,
} from '../contracts/dtos'

const mine = (trackingNumber: string) => `api/shipments/${encodeURIComponent(trackingNumber)}`

// ───────────────────────────── Open to everyone ─────────────────────────────

/** GET /api/shipments/routes: routes switched on, with drop-off hub, opening hours and speeds. */
export const getShipmentRoutes = (signal?: AbortSignal): Promise<ApiResult<ShipmentRouteOptionDto[]>> =>
  get<ShipmentRouteOptionDto[]>('api/shipments/routes', signal)

/** GET /api/parcel-rules: what parcels may not contain, or only with a condition (kept in the database). */
export const getParcelItemRules = (signal?: AbortSignal): Promise<ApiResult<ParcelItemRuleDto[]>> =>
  get<ParcelItemRuleDto[]>('api/parcel-rules', signal)

/** POST /api/shipments/quote: estimated price and transit time for a weight. */
export const getShipmentQuote = (query: GetShipmentQuoteQuery, signal?: AbortSignal):
  Promise<ApiResult<ShipmentQuoteDto>> =>
  post<ShipmentQuoteDto>('api/shipments/quote', query, signal)

/** GET /api/track/{n}: public tracking (status and timeline only). */
export const trackShipment = (trackingNumber: string, signal?: AbortSignal): Promise<ApiResult<PublicTrackingDto>> =>
  get<PublicTrackingDto>(`api/track/${encodeURIComponent(trackingNumber)}`, signal)

// ───────────────────────────── Signed in ─────────────────────────────

/** POST /api/shipments: book a parcel; returns its tracking number and where to drop it off. */
export const bookShipment = (command: BookShipmentCommand): Promise<ApiResult<BookedShipmentDto>> =>
  post<BookedShipmentDto>('api/shipments', command)

/** GET /api/shipments: my parcels, newest first. */
export const getMyShipments = (page: number, pageSize: number, signal?: AbortSignal):
  Promise<ApiResult<PagedResult<ShipmentSummaryDto>>> =>
  get<PagedResult<ShipmentSummaryDto>>(withQuery('api/shipments', { page, pageSize }), signal)

/** GET /api/shipments/{n}: one of my parcels, in full. */
export const getMyShipment = (trackingNumber: string, signal?: AbortSignal): Promise<ApiResult<ShipmentDetailsDto>> =>
  get<ShipmentDetailsDto>(mine(trackingNumber), signal)

/** POST /api/shipments/{n}/cancel: before it leaves (a paid one is refunded). */
export const cancelShipment = (trackingNumber: string) => post<void>(`${mine(trackingNumber)}/cancel`)

/**
 * TEMPORARY: POST /api/shipments/{n}/test-payment pays a weighed parcel without taking money, until a real payment
 * provider is connected. Only exists while the API's Payments:TestPaymentsEnabled is on (otherwise "not found").
 */
export const payShipmentWithTestPayment = (trackingNumber: string): Promise<ApiResult<ShipmentDetailsDto>> =>
  post<ShipmentDetailsDto>(`${mine(trackingNumber)}/test-payment`)
