/**
 * Admin → Moderation: the API's /api/admin/moderation (permission shops.manage, your countries): dishes and shop
 * names the AI flagged or couldn't check. Approve (a dish becomes visible) or reject with a reason.
 */
import type { ApiResult } from '../apiError'
import { withQuery } from '../apiQuery'
import { get, post } from '../client'
import type { ModerationItemDto, PagedResult } from '../contracts/dtos'
import type { ModerationKind } from '../contracts/enums'

const base = 'api/admin/moderation'

/** What needs a person, oldest first. */
export const getModerationQueue = (kind: ModerationKind | undefined, page: number, pageSize: number,
                                   signal?: AbortSignal): Promise<ApiResult<PagedResult<ModerationItemDto>>> =>
  get<PagedResult<ModerationItemDto>>(withQuery(base, { kind, page, pageSize }), signal)

/** How many wait (the number in the menu). */
export const getModerationCount = (signal?: AbortSignal): Promise<ApiResult<number>> => get<number>(`${base}/count`, signal)

/** Fine: a dish becomes visible to buyers. */
export const approveModeration = (id: string) => post(`${base}/${encodeURIComponent(id)}/approve`)

/** Not allowed: a dish stays hidden and the seller sees the reason. */
export const rejectModeration = (id: string, reason: string) => post(`${base}/${encodeURIComponent(id)}/reject`, { reason })
