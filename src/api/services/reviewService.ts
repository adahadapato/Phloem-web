/**
 * Reviews after delivery: the API's /api/orders/{n}/review, /api/shipments/{t}/review, /api/reviews and
 * /api/admin/reviews. Stars count at once; a comment goes on the site when the AI rates it clean, otherwise after a
 * person has looked.
 */
import type { ApiResult } from '../apiError'
import { withQuery } from '../apiQuery'
import { get, post } from '../client'
import type { AdminReviewDto, MyReviewDto, PagedResult, PublicReviewsDto, ReviewStateDto } from '../contracts/dtos'
import type { ReviewKind, ReviewStatus } from '../contracts/enums'

/** What the Rate card is for: an order (by number) or a parcel (by tracking number). */
export interface ReviewTarget {
  kind: ReviewKind
  reference: string
}

/** What the customer writes. */
export interface ReviewInput {
  stars: number
  comment: string | null
  showPublicly: boolean
}

const reviewPath = ({ kind, reference }: ReviewTarget) =>
  kind === 'Order' ? `api/orders/${encodeURIComponent(reference)}/review`
                   : `api/shipments/${encodeURIComponent(reference)}/review`

/** Can I rate it, and my review if I have. */
export const getReviewState = (target: ReviewTarget, signal?: AbortSignal): Promise<ApiResult<ReviewStateDto>> =>
  get<ReviewStateDto>(reviewPath(target), signal)

/** Rate a delivered order or parcel (once, within 60 days). */
export const submitReview = (target: ReviewTarget, input: ReviewInput): Promise<ApiResult<MyReviewDto>> =>
  post<MyReviewDto>(reviewPath(target), input)

/** "What our customers say" (anyone). Home / parcels get an empty list until there are 3. */
export const getPublicReviews = (filter: { kind?: ReviewKind; vendorId?: string; take?: number },
                                 signal?: AbortSignal): Promise<ApiResult<PublicReviewsDto>> =>
  get<PublicReviewsDto>(withQuery('api/reviews', filter), signal)

// ───────────────────────────── Admin ─────────────────────────────

/** Every review in my countries, newest first. */
export const getAdminReviews = (status: ReviewStatus | undefined, page: number, pageSize: number,
                                signal?: AbortSignal): Promise<ApiResult<PagedResult<AdminReviewDto>>> =>
  get<PagedResult<AdminReviewDto>>(withQuery('api/admin/reviews', { status, page, pageSize }), signal)

/** Take a published review off the site (the stars still count). */
export const hideReview = (id: string, note: string) => post(`api/admin/reviews/${encodeURIComponent(id)}/hide`, { note })

/** Put a hidden or rejected review back on the site. */
export const showReview = (id: string) => post(`api/admin/reviews/${encodeURIComponent(id)}/show`)
