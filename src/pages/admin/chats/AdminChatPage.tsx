import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { unwrap } from '../../../api/apiError'
import { Permissions } from '../../../api/contracts/permissions'
import { closeChatReport, getAdminChat } from '../../../api/services/chatService'
import chatStyles from '../../../components/chat/OrderChat.module.css'
import { Button } from '../../../components/ui/Button'
import { CountryFlag } from '../../../components/ui/CountryFlag'
import { dateTimeText } from '../../../components/ui/labels'
import { StatusBanner } from '../../../components/ui/StatusBanner'
import { useCountry } from '../../../state/CountryContext'
import { useSession } from '../../../state/SessionContext'
import adminStyles from '../Admin.module.css'
import styles from './Chats.module.css'

/**
 * Admin → one order chat (/admin/chats/:orderNumber), read-only, with full names: the customer on the left, the shop
 * on the right. Messages someone deleted for themselves are shown (marked), and so are ones with contact or
 * payment details. A waiting report shows its reason and "Mark as dealt with". Opening it is written to the audit
 * log, so it isn't refetched when the window regains focus.
 */
export default function AdminChatPage() {
  const { orderNumber = '' } = useParams()
  const { countries } = useCountry()
  const { hasPermission } = useSession()
  const queryClient = useQueryClient()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const query = useQuery({
    queryKey: ['admin', 'chat', orderNumber],
    queryFn: async ({ signal }) => unwrap(await getAdminChat(orderNumber, signal)),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  })

  if (query.isPending) return <p className="muted" aria-busy="true">Loading…</p>
  if (query.isError) {
    return (
      <div className={adminStyles.error}>
        <Link to="/admin/chats" className={adminStyles.back}>‹ Order chats</Link>
        <StatusBanner isError message={(query.error as { status?: number }).status === 404
          ? "There's no chat for this order yet, or it's outside your countries." : "We couldn't load this chat."} />
        <Button small variant="outline" onClick={() => query.refetch()}>Try again</Button>
      </div>
    )
  }

  const { chat, shopOwnerName, messages } = query.data
  const country = countries.find((x) => x.country === chat.country)

  const close = async () => {
    setBusy(true); setError(null)
    const result = await closeChatReport(chat.orderNumber)
    setBusy(false)
    if (!result.ok) { setError(result.error.displayMessage); return }
    await queryClient.invalidateQueries({ queryKey: ['admin', 'chats'] })
    await queryClient.invalidateQueries({ queryKey: ['admin', 'chat', orderNumber] })
  }

  return (
    <>
      <Link to="/admin/chats" className={adminStyles.back}>‹ Order chats</Link>

      <section className={adminStyles.panel} aria-label="Chat">
        <h1 className={adminStyles.title}>{chat.customerName} ⇄ {chat.shopName}</h1>
        <p className={styles.rowMeta}>
          <span>Order {chat.orderNumber}</span>
          {country && <span><CountryFlag country={country} /> {country.name}</span>}
          <span>Shop owner: {shopOwnerName}</span>
          {hasPermission(Permissions.OrdersView) && (
            <Link to={`/admin/orders/${encodeURIComponent(chat.orderNumber)}`}>Open the order ›</Link>
          )}
        </p>

        {chat.isReported && (
          <div className={`${styles.report} ${chat.reportWaiting ? styles.waiting : ''}`}>
            <strong>{chat.reportWaiting ? '🚩 Reported' : '✓ Report dealt with'}</strong>
            <span>
              By {chat.reportedBy}{chat.reportedAt && `, ${dateTimeText(chat.reportedAt)}`}
            </span>
            {chat.reportReason && <p>"{chat.reportReason}"</p>}
            {error && <p className={chatStyles.error} role="alert">{error}</p>}
            {chat.reportWaiting && (
              <div>
                <Button small variant="primary" busy={busy} busyText="Saving…" onClick={() => void close()}>
                  ✓ Mark as dealt with
                </Button>
              </div>
            )}
          </div>
        )}

        <div className={`${chatStyles.list} ${styles.transcript}`} aria-label="Messages">
          {messages.length === 0 && <p className={chatStyles.empty}>No messages in this chat.</p>}
          {messages.map((m) => (
            <div key={m.id} className={`${chatStyles.row} ${m.senderRole === 'Seller' ? chatStyles.mine : chatStyles.theirs}`}>
              <div className={`${chatStyles.bubble} ${styles.staffBubble}`}>
                <span className={chatStyles.sender}>{m.senderName}</span>
                {m.photoUrl && (
                  <a href={m.photoUrl} target="_blank" rel="noreferrer" className={chatStyles.photo}>
                    <img src={m.photoUrl} alt="Photo in the chat" loading="lazy" />
                  </a>
                )}
                {m.body && <p className={chatStyles.body}>{m.body}</p>}
                <span className={chatStyles.meta}>{dateTimeText(m.sentAt)}</span>
              </div>
              {(m.hiddenBySender || m.hasContactDetails) && (
                <span className={styles.marks}>
                  {m.hiddenBySender && <span>🗑 Deleted by the sender (for themselves)</span>}
                  {m.hasContactDetails && <span>⚠️ Contact or payment details</span>}
                </span>
              )}
            </div>
          ))}
        </div>
      </section>
    </>
  )
}
