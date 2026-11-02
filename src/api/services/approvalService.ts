/**
 * Admin → Approvals: the API's /api/admin/approvals (changes that need a second person).
 *
 * The API decides who may see and decide what: owners decide everything, Country managers confirm shop blocks in
 * their countries, and nobody decides their own change.
 */
import type { ApiResult } from '../apiError'
import { withQuery } from '../apiQuery'
import { get, post } from '../client'
import type { PagedResult, PendingChangeDto } from '../contracts/dtos'

/** Which list: waiting for you, your proposals, or history. */
export type ApprovalsView = 'Waiting' | 'Mine' | 'History'

const approvals = 'api/admin/approvals'
const one = (id: string) => `${approvals}/${encodeURIComponent(id)}`

/** GET /api/admin/approvals: one page of a list. */
export const getApprovals = (view: ApprovalsView, page: number, pageSize: number, signal?: AbortSignal):
  Promise<ApiResult<PagedResult<PendingChangeDto>>> =>
  get<PagedResult<PendingChangeDto>>(withQuery(approvals, { view, page, pageSize }), signal)

/** GET /api/admin/approvals/count: how many are waiting for you (the number in the menu). */
export const getApprovalCount = (signal?: AbortSignal): Promise<ApiResult<number>> =>
  get<number>(`${approvals}/count`, signal)

/** Approve someone else's change: it's applied now. Returns what happened, e.g. "Published as version 6." */
export const approveChange = (id: string): Promise<ApiResult<string>> => post<string>(`${one(id)}/approve`)

/** Reject someone else's change, with a reason they'll see (a rejected block unblocks the shop). */
export const rejectChange = (id: string, reason: string) => post(`${one(id)}/reject`, { reason })

/** Take back your own waiting Terms / Privacy proposal. */
export const withdrawChange = (id: string) => post(`${one(id)}/withdraw`)
