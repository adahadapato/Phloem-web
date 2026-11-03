/**
 * One order's chat, kept up to date live: loads it, adds messages as they arrive, keeps "Seen" and "typing", marks
 * it as seen while the page is visible, and sends, deletes (for me) and reports.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'
import { unwrap } from '../../api/apiError'
import { onChatEvent, sendTyping } from '../../api/chatHub'
import type { ChatMessageDto, OrderChatDto } from '../../api/contracts/dtos'
import {
  getOlderChatMessages, getOrderChat, hideChatMessage, markChatRead, reportChat, sendChatMessage,
} from '../../api/services/chatService'

/** How long "typing…" shows after the last hint. */
const TYPING_SHOWS_MS = 5_000

export const chatKey = (orderNumber: string) => ['chat', 'order', orderNumber] as const

/** Adds messages, without duplicates, oldest first. */
function merge(current: ChatMessageDto[], added: ChatMessageDto[]): ChatMessageDto[] {
  const known = new Set(current.map((m) => m.id))
  const fresh = added.filter((m) => !known.has(m.id))
  if (fresh.length === 0) return current
  return [...current, ...fresh].sort((a, b) => a.sentAt.localeCompare(b.sentAt))
}

export function useOrderChat(orderNumber: string, enabled = true) {
  const queryClient = useQueryClient()
  const key = chatKey(orderNumber)
  const [typingUntil, setTypingUntil] = useState(0)
  const [now, setNow] = useState(() => Date.now())
  const [loadingOlder, setLoadingOlder] = useState(false)
  const lastMarked = useRef<string | null>(null)

  const query = useQuery({
    queryKey: key,
    queryFn: async ({ signal }) => unwrap(await getOrderChat(orderNumber, signal)),
    enabled: enabled && !!orderNumber,
    staleTime: 60_000,
  })
  const chat = query.data

  const update = useCallback((change: (chat: OrderChatDto) => OrderChatDto) => {
    queryClient.setQueryData<OrderChatDto>(chatKey(orderNumber), (old) => (old ? change(old) : old))
  }, [queryClient, orderNumber])

  // 1. Seen: when the newest message is theirs and the page is visible
  const newestTheirs = chat?.messages.findLast((m) => m.senderRole !== chat.myRole)?.sentAt ?? null
  useEffect(() => {
    if (!newestTheirs || lastMarked.current === newestTheirs) return
    const mark = () => {
      if (document.visibilityState !== 'visible' || lastMarked.current === newestTheirs) return
      lastMarked.current = newestTheirs
      void markChatRead(orderNumber).then(() => queryClient.invalidateQueries({ queryKey: ['chat', 'mine'] }))
    }
    mark()
    document.addEventListener('visibilitychange', mark)
    return () => document.removeEventListener('visibilitychange', mark)
  }, [newestTheirs, orderNumber, queryClient])

  // 2. Live: messages, "Seen", "typing"; reload after a dropped connection
  useEffect(() => {
    if (!enabled || !orderNumber) return
    return onChatEvent((event) => {
      if (event.type === 'reconnected') { void queryClient.invalidateQueries({ queryKey: chatKey(orderNumber) }); return }
      if (event.data.orderNumber.toUpperCase() !== orderNumber.toUpperCase()) return
      const current = queryClient.getQueryData<OrderChatDto>(chatKey(orderNumber))
      if (event.type === 'message') {
        if (!current) { void queryClient.invalidateQueries({ queryKey: chatKey(orderNumber) }); return }
        update((c) => ({ ...c, messages: merge(c.messages, [event.data.message]) }))
        if (event.data.message.senderRole !== current.myRole) setTypingUntil(0)
      } else if (event.type === 'read') {
        if (current && event.data.role !== current.myRole) update((c) => ({ ...c, otherReadUpTo: event.data.readUpTo }))
      } else if (current && event.data.role !== current.myRole) {
        const at = Date.now()
        setNow(at)
        setTypingUntil(at + TYPING_SHOWS_MS)
      }
    })
  }, [enabled, orderNumber, queryClient, update])

  // "typing…" disappears by itself
  useEffect(() => {
    if (typingUntil <= Date.now()) return
    const timer = setTimeout(() => setNow(Date.now()), typingUntil - Date.now() + 50)
    return () => clearTimeout(timer)
  }, [typingUntil])

  // 3. Actions
  const send = async (body: string, photo: File | null) => {
    const result = await sendChatMessage(orderNumber, body, photo)
    if (result.ok) {
      if (queryClient.getQueryData(key)) update((c) => ({ ...c, messages: merge(c.messages, [result.value]) }))
      else await query.refetch()
      void queryClient.invalidateQueries({ queryKey: ['chat', 'mine'] })
    }
    return result
  }

  const hide = async (messageId: string) => {
    const result = await hideChatMessage(messageId)
    if (result.ok) update((c) => ({ ...c, messages: c.messages.filter((m) => m.id !== messageId) }))
    return result
  }

  const report = async (reason: string) => {
    const result = await reportChat(orderNumber, reason)
    if (result.ok) update((c) => ({ ...c, isReported: true }))
    return result
  }

  const loadOlder = async () => {
    const oldest = chat?.messages[0]
    if (!oldest) return
    setLoadingOlder(true)
    const result = await getOlderChatMessages(orderNumber, oldest.sentAt)
    setLoadingOlder(false)
    if (result.ok) {
      update((c) => ({ ...c, messages: merge(c.messages, result.value), hasOlder: result.value.length >= 50 }))
    }
  }

  return {
    query,
    chat,
    otherIsTyping: typingUntil > now,
    loadingOlder,
    send,
    hide,
    report,
    loadOlder,
    typing: () => sendTyping(orderNumber),
  }
}
