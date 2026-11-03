/**
 * How many of my conversations have messages I haven't seen (the number on the header's 💬), kept up to date live.
 * Only while signed in.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { unwrap } from '../../api/apiError'
import { onChatEvent } from '../../api/chatHub'
import { getMyUnreadChatCount } from '../../api/services/chatService'

export function useChatUnread(signedIn: boolean): number {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: ['chat', 'mine', 'unread'],
    queryFn: async ({ signal }) => unwrap(await getMyUnreadChatCount(signal)),
    enabled: signedIn,
    staleTime: 30_000,
    refetchInterval: 5 * 60_000,   // a safety net; normally updated live
  })

  useEffect(() => {
    if (!signedIn) return
    return onChatEvent((event) => {
      if (event.type === 'message' || event.type === 'reconnected') {
        void queryClient.invalidateQueries({ queryKey: ['chat', 'mine'] })
      }
    })
  }, [signedIn, queryClient])

  return signedIn ? query.data ?? 0 : 0
}
