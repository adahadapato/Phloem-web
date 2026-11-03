/**
 * The order chat: the API's /api/orders/{orderNumber}/chat, /api/me/chats and /api/admin/chats.
 * New messages, "Seen" and "typing" arrive live through {@link ../chatHub}.
 */
import type { ApiResult } from '../apiError'
import { withQuery } from '../apiQuery'
import { del, get, post } from '../client'
import type { AdminChatDto, AdminChatSummaryDto, ChatMessageDto, MyChatDto, OrderChatDto, PagedResult } from '../contracts/dtos'

const chatPath = (orderNumber: string) => `api/orders/${encodeURIComponent(orderNumber)}/chat`

// ───────────────────────────── 1. In an order ─────────────────────────────

/** The chat with its 50 newest messages (empty until someone writes). */
export const getOrderChat = (orderNumber: string, signal?: AbortSignal): Promise<ApiResult<OrderChatDto>> =>
  get<OrderChatDto>(chatPath(orderNumber), signal)

/** "Show earlier messages": the 50 before a time, oldest first. */
export const getOlderChatMessages = (orderNumber: string, before: string,
                                     signal?: AbortSignal): Promise<ApiResult<ChatMessageDto[]>> =>
  get<ChatMessageDto[]>(withQuery(`${chatPath(orderNumber)}/messages`, { before }), signal)

/**
 * Sends a message: text, a photo, or both.
 * @param photo A JPEG, PNG, WebP or HEIC photo (≤ 10 MB), or null.
 */
export function sendChatMessage(orderNumber: string, body: string, photo: File | null): Promise<ApiResult<ChatMessageDto>> {
  const form = new FormData()
  if (body) form.append('body', body)
  if (photo) form.append('photo', photo, photo.name)
  return post<ChatMessageDto>(chatPath(orderNumber), form)
}

/** I've seen the chat (the other side sees "Seen"). */
export const markChatRead = (orderNumber: string) => post(`${chatPath(orderNumber)}/read`)

/** Report a problem: Phloem's team reads the chat. */
export const reportChat = (orderNumber: string, reason: string) => post(`${chatPath(orderNumber)}/report`, { reason })

/** Delete one of my messages for me (the other side still sees it). */
export const hideChatMessage = (messageId: string) => del(`api/chat/messages/${encodeURIComponent(messageId)}`)

// ───────────────────────────── 2. Mine ─────────────────────────────

/** My conversations, latest first. */
export const getMyChats = (page: number, pageSize: number,
                           signal?: AbortSignal): Promise<ApiResult<PagedResult<MyChatDto>>> =>
  get<PagedResult<MyChatDto>>(withQuery('api/me/chats', { page, pageSize }), signal)

/** How many conversations have messages I haven't seen. */
export const getMyUnreadChatCount = (signal?: AbortSignal): Promise<ApiResult<number>> =>
  get<number>('api/me/chats/unread', signal)

// ───────────────────────────── 3. Admin ─────────────────────────────

const admin = 'api/admin/chats'

/** Chats in my countries, latest first (reportedOnly: waiting reports). */
export const getAdminChats = (reportedOnly: boolean, page: number, pageSize: number,
                              signal?: AbortSignal): Promise<ApiResult<PagedResult<AdminChatSummaryDto>>> =>
  get<PagedResult<AdminChatSummaryDto>>(withQuery(admin, { reportedOnly: reportedOnly || undefined, page, pageSize }), signal)

/** The whole chat with full names (the view is recorded in the audit log). */
export const getAdminChat = (orderNumber: string, signal?: AbortSignal): Promise<ApiResult<AdminChatDto>> =>
  get<AdminChatDto>(`${admin}/${encodeURIComponent(orderNumber)}`, signal)

/** The report has been dealt with. */
export const closeChatReport = (orderNumber: string) => post(`${admin}/${encodeURIComponent(orderNumber)}/close-report`)
