import { useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router'
import { unwrap } from '../../api/apiError'
import type { MyChatDto } from '../../api/contracts/dtos'
import { getMyChats } from '../../api/services/chatService'
import { OrderChat } from '../../components/chat/OrderChat'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { dateTimeText } from '../../components/ui/labels'
import { Pager } from '../../components/ui/Pager'
import { StatusBanner } from '../../components/ui/StatusBanner'
import styles from './Messages.module.css'

const PAGE_SIZE = 20

/** Where the order itself is: my order page, or the order in my shop's orders. */
const orderLink = (c: MyChatDto) =>
  c.myRole === 'Customer' ? `/orders/${encodeURIComponent(c.orderNumber)}`
    : `/seller/orders?status=all&open=${encodeURIComponent(c.orderNumber)}`

/**
 * Messages (/messages): every order chat I'm in, as a customer and as a shop, latest first, with the open one beside
 * the list (?chat=order number; on phones the chat replaces the list). Chats start from an order page.
 */
export default function MessagesPage() {
  const [params, setParams] = useSearchParams()
  const open = params.get('chat')
  const page = Math.max(1, Number(params.get('page')) || 1)

  const list = useQuery({
    queryKey: ['chat', 'mine', 'list', page],
    queryFn: async ({ signal }) => unwrap(await getMyChats(page, PAGE_SIZE, signal)),
    placeholderData: (previous) => previous,
    staleTime: 15_000,
  })
  const chats = list.data?.items ?? []
  const openChat = chats.find((c) => c.orderNumber === open)

  const choose = (orderNumber: string | null) => {
    const next = new URLSearchParams(params)
    if (orderNumber) next.set('chat', orderNumber); else next.delete('chat')
    setParams(next, { preventScrollReset: true })
  }

  return (
    <div className={`container ${styles.page}`}>
      <div className={styles.heading}>
        <h1>Messages</h1>
        <p className="muted">Chats about your orders, with shops and with your customers.</p>
      </div>

      <div className={`${styles.layout} ${open ? styles.chatOpen : ''}`}>
        {/* ── The list ── */}
        <nav className={styles.list} aria-label="Conversations">
          {list.isError && <StatusBanner isError message="We couldn't load your messages." />}
          {!list.data && list.isPending && <p className="muted" aria-busy="true">Loading…</p>}
          {list.data && chats.length === 0 && (
            <EmptyState icon="receipt" title="No messages yet"
                        text="Once an order is paid, you can chat with the shop from the order's page." />
          )}
          {chats.map((c) => (
            <button key={c.orderNumber} type="button" onClick={() => choose(c.orderNumber)}
                    className={`${styles.item} ${c.orderNumber === open ? styles.itemOn : ''} ${c.unread ? styles.unread : ''}`}
                    aria-current={c.orderNumber === open ? 'true' : undefined}>
              <span className={styles.itemTop}>
                <strong>{c.myRole === 'Customer' ? c.shopName : c.otherPartyName}</strong>
                {c.lastMessageAt && <span className={styles.when}>{dateTimeText(c.lastMessageAt)}</span>}
              </span>
              <span className={styles.itemSub}>
                {c.myRole === 'Seller' ? '🏪 Your shop · ' : ''}Order {c.orderNumber}
              </span>
              <span className={styles.preview}>
                {c.unread && <span className={styles.dot} aria-label="Unread" />}
                {c.lastMessage ? `${c.lastMessageIsMine ? 'You: ' : ''}${c.lastMessage}` : 'No messages yet'}
              </span>
            </button>
          ))}
          {list.data && list.data.totalPages > 1 && (
            <Pager page={list.data.page} totalPages={list.data.totalPages}
                   onChange={(p) => setParams({ page: String(p) })} />
          )}
        </nav>

        {/* ── The open chat ── */}
        <div className={styles.chat}>
          {open ? (
            <>
              <div className={styles.chatBar}>
                <Button small variant="plain" className={styles.back} onClick={() => choose(null)}>‹ All messages</Button>
                {openChat && <Link to={orderLink(openChat)} className={styles.orderLink}>View order {open} ›</Link>}
              </div>
              <OrderChat key={open} orderNumber={open}
                         title={openChat ? `${openChat.myRole === 'Customer' ? openChat.shopName : openChat.otherPartyName} · ${open}` : `Order ${open}`} />
            </>
          ) : (
            <div className={styles.pick}>
              <span aria-hidden="true">💬</span>
              <p>Pick a conversation to read it.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
