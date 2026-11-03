import { useEffect, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import type { ApiResult } from '../../api/apiError'
import type { ChatMessageDto, OrderChatDto } from '../../api/contracts/dtos'
import { Button } from '../ui/Button'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { StatusBanner } from '../ui/StatusBanner'
import { hasContactDetails } from './offPlatform'
import styles from './OrderChat.module.css'
import { useOrderChat } from './useOrderChat'

const BODY_MAX = 1000          // ChatMessage.BodyMaxLength
const REASON_MAX = 500         // OrderChat.ReportReasonMaxLength
const PHOTO_MAX = 10 * 1024 * 1024
const PHOTO_TYPES = 'image/jpeg,image/png,image/webp,image/heic,image/heif'

/** "14:05" today, "Mon 14:05" this week, else "3 Nov, 14:05". */
function timeText(iso: string): string {
  const d = new Date(iso)
  const days = (Date.now() - d.getTime()) / 86_400_000
  const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  if (new Date().toDateString() === d.toDateString()) return time
  if (days < 6) return `${d.toLocaleDateString(undefined, { weekday: 'short' })} ${time}`
  return `${d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}, ${time}`
}

/** "Today", "Yesterday", "Monday 3 November". */
function dayText(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date(today.getTime() - 86_400_000)
  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })
}

/**
 * The chat for one order, between the customer and the shop: messages (newest at the bottom), "Seen", "… is
 * typing", photos, "Delete for me", "Report a problem", and a gentle warning when a message looks like it has
 * contact or payment details. Read-only 7 days after the order ends.
 * @param orderNumber The order.
 * @param title Heading (default "Chat with …").
 * @param compact Smaller list (inside a seller's order card).
 */
export function OrderChat({ orderNumber, title, compact }: { orderNumber: string; title?: string; compact?: boolean }) {
  const { query, chat, otherIsTyping, loadingOlder, send, hide, report, loadOlder, typing } = useOrderChat(orderNumber)

  if (!chat) {
    return (
      <section className={styles.chat} aria-label="Chat" aria-busy={query.isPending}>
        {query.isPending ? <p className="muted">Loading the chat…</p> : (
          <>
            <StatusBanner isError message={(query.error as { displayMessage?: string } | null)?.displayMessage
              ?? "We couldn't load the chat."} />
            <div><Button small variant="outline" onClick={() => void query.refetch()}>Try again</Button></div>
          </>
        )}
      </section>
    )
  }

  return (
    <section className={`${styles.chat} ${compact ? styles.compact : ''}`} aria-labelledby={`chat-${orderNumber}`}>
      <div className={styles.head}>
        <h2 id={`chat-${orderNumber}`}>💬 {title ?? `Chat with ${chat.otherPartyName}`}</h2>
        <ReportButton chat={chat} report={report} />
      </div>
      <p className={styles.notice}>🔒 {chat.notice}</p>

      <MessageList chat={chat} otherIsTyping={otherIsTyping} loadingOlder={loadingOlder} loadOlder={loadOlder}
                   hide={hide} />

      {chat.canWrite
        ? <Compose chat={chat} send={send} typing={typing} />
        : <p className={styles.closed}>{chat.closedReason ?? 'This chat is closed.'}</p>}
    </section>
  )
}

// ───────────────────────────── Messages ─────────────────────────────

function MessageList({ chat, otherIsTyping, loadingOlder, loadOlder, hide }: {
  chat: OrderChatDto
  otherIsTyping: boolean
  loadingOlder: boolean
  loadOlder: () => Promise<void>
  hide: (id: string) => Promise<ApiResult<void>>
}) {
  const box = useRef<HTMLDivElement>(null)
  const [hiding, setHiding] = useState<ChatMessageDto | null>(null)
  const newest = chat.messages.at(-1)?.id
  const nearBottom = useRef(true)

  // Stay at the newest message when one arrives (unless the person scrolled up to read)
  useLayoutEffect(() => {
    const el = box.current
    if (el && nearBottom.current) el.scrollTop = el.scrollHeight
  }, [newest, otherIsTyping])

  const mine = (m: ChatMessageDto) => m.senderRole === chat.myRole
  // "Seen" goes under my newest message the other side has seen
  const lastMine = chat.messages.findLast(mine)
  const seen = !!lastMine && !!chat.otherReadUpTo && chat.otherReadUpTo >= lastMine.sentAt
  const otherFirstName = chat.otherPartyName.split(' ')[0]

  return (
    <>
      <div ref={box} className={styles.list} role="log" aria-live="polite" aria-label="Messages"
           onScroll={(e) => {
             const el = e.currentTarget
             nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
           }}>
        {chat.hasOlder && (
          <div className={styles.older}>
            <Button small variant="plain" busy={loadingOlder} busyText="Loading…" onClick={() => void loadOlder()}>
              Show earlier messages
            </Button>
          </div>
        )}
        {chat.messages.length === 0 && (
          <div className={styles.empty}>
            <strong>No messages yet</strong>
            <span>
              {chat.myRole === 'Customer'
                ? `Ask ${chat.shopName} anything about this order: a delivery note, a question about a dish…`
                : 'Ask the customer anything about this order: directions, a missing ingredient…'}
            </span>
          </div>
        )}
        {chat.messages.map((m, i) => {
          const previous = chat.messages[i - 1]
          const newDay = !previous || new Date(previous.sentAt).toDateString() !== new Date(m.sentAt).toDateString()
          const isMine = mine(m)
          const flagged = m.hasContactDetails || hasContactDetails(m.body)
          return (
            <div key={m.id}>
              {newDay && <div className={styles.day}><span>{dayText(m.sentAt)}</span></div>}
              <div className={`${styles.row} ${isMine ? styles.mine : styles.theirs}`}>
                <div className={styles.bubble}>
                  {!isMine && <span className={styles.sender}>{m.senderName}</span>}
                  {m.photoUrl && (
                    <a href={m.photoUrl} target="_blank" rel="noreferrer" className={styles.photo}>
                      <img src={m.photoUrl} alt="Photo in the chat" loading="lazy" />
                    </a>
                  )}
                  {m.body && <p className={styles.body}>{m.body}</p>}
                  <span className={styles.meta}>
                    {timeText(m.sentAt)}
                    {isMine && m.id === lastMine?.id && <span className={styles.ticks}>{seen ? ' · ✓✓ Seen' : ' · ✓ Sent'}</span>}
                  </span>
                  {isMine && (
                    <button type="button" className={styles.hide} onClick={() => setHiding(m)}
                            aria-label="Delete this message for me">Delete</button>
                  )}
                </div>
                {flagged && <p className={styles.warning} role="note">⚠️ {chat.contactWarning}</p>}
              </div>
            </div>
          )
        })}
        {otherIsTyping && <p className={styles.typing} aria-live="polite">{otherFirstName} is typing…</p>}
      </div>

      <ConfirmDialog open={!!hiding} title="Delete this message for you?"
                     message={`It disappears from your chat. ${chat.otherPartyName} can still see it, and so can Phloem if there's a problem with the order.`}
                     confirmText="Delete for me" danger
                     onCancel={() => setHiding(null)}
                     onConfirm={() => { const m = hiding; setHiding(null); if (m) void hide(m.id) }} />
    </>
  )
}

// ───────────────────────────── Writing ─────────────────────────────

function Compose({ chat, send, typing }: {
  chat: OrderChatDto
  send: (body: string, photo: File | null) => Promise<ApiResult<ChatMessageDto>>
  typing: () => void
}) {
  const [body, setBody] = useState('')
  /** The chosen photo and its preview link (freed when it's removed, sent, or the chat closes). */
  const [chosen, setChosen] = useState<{ file: File; url: string } | null>(null)
  const photo = chosen?.file ?? null
  const preview = chosen?.url ?? null
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const warn = hasContactDetails(body)

  const setPhoto = (file: File | null) => setChosen(file ? { file, url: URL.createObjectURL(file) } : null)
  // The previous preview's link is freed when another is chosen, and the last one when the chat closes
  useEffect(() => () => { if (chosen) URL.revokeObjectURL(chosen.url) }, [chosen])

  const pick = (file: File | undefined) => {
    setError(null)
    if (!file) return
    if (file.size > PHOTO_MAX) { setError('Photos must be 10 MB or smaller.'); return }
    setPhoto(file)
  }

  const submit = async (e?: FormEvent) => {
    e?.preventDefault()
    const text = body.trim()
    if ((!text && !photo) || busy) return
    setBusy(true); setError(null)
    const result = await send(text, photo)
    setBusy(false)
    if (!result.ok) { setError(result.error.displayMessage); return }
    setBody(''); setPhoto(null)
    if (fileInput.current) fileInput.current.value = ''
  }

  // Enter sends; Shift+Enter is a new line
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void submit() }
  }

  return (
    <form className={styles.compose} onSubmit={submit}>
      {preview && (
        <div className={styles.preview}>
          <img src={preview} alt="The photo you're sending" />
          <button type="button" aria-label="Remove the photo"
                  onClick={() => { setPhoto(null); if (fileInput.current) fileInput.current.value = '' }}>×</button>
        </div>
      )}
      {warn && <p className={styles.warning} role="status">⚠️ {chat.contactWarning}</p>}
      {error && <p className={styles.error} role="alert">{error}</p>}
      <div className={styles.inputRow}>
        <label className={styles.photoButton} title="Add a photo">
          <span aria-hidden="true">📷</span>
          <span className="visually-hidden">Add a photo</span>
          <input ref={fileInput} type="file" accept={PHOTO_TYPES} onChange={(e) => pick(e.target.files?.[0])} />
        </label>
        <label htmlFor={`msg-${chat.orderNumber}`} className="visually-hidden">Message</label>
        <textarea id={`msg-${chat.orderNumber}`} rows={1} value={body} maxLength={BODY_MAX}
                  placeholder={`Message ${chat.otherPartyName.split(' (')[0]}…`}
                  onChange={(e) => { setBody(e.target.value); if (e.target.value) typing() }} onKeyDown={onKey} />
        <Button type="submit" variant="primary" small busy={busy} busyText="Sending…" disabled={!body.trim() && !photo}>
          Send
        </Button>
      </div>
      {body.length > BODY_MAX - 100 && <span className={styles.counter}>{body.length} / {BODY_MAX}</span>}
    </form>
  )
}

// ───────────────────────────── Report a problem ─────────────────────────────

function ReportButton({ chat, report }: {
  chat: OrderChatDto
  report: (reason: string) => Promise<ApiResult<void>>
}) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (chat.isReported) return <span className={styles.reported}>🚩 Sent to Phloem's team</span>
  if (!open) return <button type="button" className={styles.reportLink} onClick={() => setOpen(true)}>Report a problem</button>

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true); setError(null)
    const result = await report(reason.trim())
    setBusy(false)
    if (!result.ok) setError(result.error.displayMessage)
  }

  return (
    <form className={styles.report} onSubmit={submit}>
      <label htmlFor={`report-${chat.orderNumber}`}><strong>What's wrong?</strong></label>
      <textarea id={`report-${chat.orderNumber}`} rows={3} value={reason} maxLength={REASON_MAX}
                placeholder="e.g. They asked me to pay them directly." onChange={(e) => setReason(e.target.value)} />
      <span className="muted">Phloem's team will read this chat and get back to you by email.</span>
      {error && <p className={styles.error} role="alert">{error}</p>}
      <div className={styles.reportButtons}>
        <Button type="submit" small variant="cta" busy={busy} busyText="Sending…" disabled={!reason.trim()}>Send report</Button>
        <Button small variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </form>
  )
}
