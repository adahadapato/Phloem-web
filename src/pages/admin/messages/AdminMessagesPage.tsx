import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { unwrap } from '../../../api/apiError'
import type { ContactMessageDto } from '../../../api/contracts/dtos'
import type { ContactMessageStatus } from '../../../api/contracts/enums'
import { getContactMessages, setContactMessageStatus } from '../../../api/services/adminService'
import { Button } from '../../../components/ui/Button'
import { dateTimeText, contactTopicText } from '../../../components/ui/labels'
import { ListStatus } from '../../../components/ui/ListStatus'
import { Pager } from '../../../components/ui/Pager'
import { StatusBanner } from '../../../components/ui/StatusBanner'
import styles from '../Admin.module.css'
import { AdminHead } from '../AdminParts'

const PAGE_SIZE = 20

/** The tabs (in the address as ?status=…, so a tab can be linked to and survives a refresh). */
const TABS: { key: string; label: string; status?: ContactMessageStatus }[] = [
  { key: 'new', label: 'New', status: 'New' },
  { key: 'replied', label: 'Replied', status: 'Replied' },
  { key: 'closed', label: 'Closed', status: 'Closed' },
  { key: 'all', label: 'All' },
]

const chipFor: Record<ContactMessageStatus, string> = {
  New: styles.chipWait,
  Replied: styles.chipGo,
  Closed: styles.chipOff,
}

/** One message as a card: who, topic, reference, the message, a note, and what to do next. */
function MessageCard({ m, onChanged }: { m: ContactMessageDto; onChanged: (text: string) => void }) {
  const [note, setNote] = useState(m.staffNote ?? '')
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState<ContactMessageStatus | 'note' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const subject = encodeURIComponent(`Re: your message to Phloem${m.reference ? ` (${m.reference})` : ''}`)

  const save = async (status: ContactMessageStatus, why: ContactMessageStatus | 'note') => {
    setBusy(why)
    setError(null)
    const result = await setContactMessageStatus(m.id, status, note.trim() || null)
    setBusy(null)
    if (!result.ok) { setError(result.error.displayMessage); return }
    setEditing(false)
    onChanged(why === 'note' ? `Note saved for ${m.name}.` : `${m.name}'s message is now ${status.toLowerCase()}.`)
  }

  return (
    <li className={styles.person}>
      <div className={styles.messageTop}>
        <div className={styles.personWho}>
          <h2 className={styles.personName}>{m.name}</h2>
          <a href={`mailto:${m.email}?subject=${subject}`} className={styles.personContact}>{m.email}</a>
        </div>
        <span className={`${styles.chip} ${chipFor[m.status]}`}>{m.status}</span>
      </div>
      <p className={styles.messageMeta}>
        <strong>{contactTopicText(m.topic)}</strong>
        {m.reference && <> · <span className={styles.messageRef}>{m.reference}</span></>}
        {' · '}{dateTimeText(m.sentAt)}
        {m.fromSignedInUser && <> · <span title="They were signed in, so this is their account's email">signed in</span></>}
      </p>
      <p className={styles.messageText}>{m.message}</p>

      {m.staffNote && !editing && <p className={styles.messageNote}><strong>Note:</strong> {m.staffNote}</p>}
      {editing && (
        <div className={styles.stackForm}>
          <label htmlFor={`note-${m.id}`}><strong>Note for colleagues</strong></label>
          <textarea id={`note-${m.id}`} className={styles.messageNoteInput} rows={3} maxLength={500} value={note}
                    onChange={(e) => setNote(e.target.value)} placeholder="e.g. Refund sent, waiting for the bank" />
          <div className={styles.inlineForm}>
            <Button small variant="secondary" busy={busy === 'note'} busyText="Saving…" onClick={() => save(m.status, 'note')}>
              Save note
            </Button>
            <Button small variant="plain" onClick={() => { setEditing(false); setNote(m.staffNote ?? '') }}>Cancel</Button>
          </div>
        </div>
      )}
      <StatusBanner isError message={error} />

      <div className={`${styles.personActions} ${styles.messageActions}`}>
        <a className={styles.messageReply} href={`mailto:${m.email}?subject=${subject}`}>Reply by email ›</a>
        {m.status !== 'Replied' && (
          <Button small variant="outline" busy={busy === 'Replied'} busyText="Saving…" disabled={!!busy}
                  onClick={() => save('Replied', 'Replied')}>Mark replied</Button>
        )}
        {m.status !== 'Closed' && (
          <Button small variant="outline" busy={busy === 'Closed'} busyText="Saving…" disabled={!!busy}
                  onClick={() => save('Closed', 'Closed')}>Close</Button>
        )}
        {m.status !== 'New' && (
          <Button small variant="plain" busy={busy === 'New'} busyText="Saving…" disabled={!!busy}
                  onClick={() => save('New', 'New')}>Back to new</Button>
        )}
        {!editing && (
          <button type="button" className={styles.linkButton} onClick={() => setEditing(true)}>
            {m.staffNote ? 'Edit note' : 'Add a note'}
          </button>
        )}
      </div>
    </li>
  )
}

/**
 * Admin → Contact messages (admins and support agents): what people sent with Contact us, newest first, by status.
 * The team answers by email ("Reply by email" opens their mail app), then marks the message Replied or Closed here,
 * with an optional note for colleagues. Tab and page live in the address.
 */
export default function AdminMessagesPage() {
  const queryClient = useQueryClient()
  const [params, setParams] = useSearchParams()
  const tab = TABS.find((t) => t.key === params.get('status')) ?? TABS[0]
  const page = Math.max(1, Number(params.get('page')) || 1)
  const [message, setMessage] = useState<string | null>(null)

  const inbox = useQuery({
    queryKey: ['admin', 'contact-messages', tab.key, page],
    queryFn: async ({ signal }) => unwrap(await getContactMessages({ status: tab.status, page, pageSize: PAGE_SIZE }, signal)),
  })
  const data = inbox.data
  const items = data?.messages.items ?? []
  const countFor = (key: string) => key === 'new' ? data?.newCount : key === 'replied' ? data?.repliedCount
    : key === 'closed' ? data?.closedCount : data && data.newCount + data.repliedCount + data.closedCount

  const go = (next: { status?: string; page?: number }) => {
    const p = new URLSearchParams(params)
    if (next.status !== undefined) { p.set('status', next.status); p.delete('page') }
    if (next.page !== undefined) p.set('page', String(next.page))
    setParams(p)
    setMessage(null)
  }

  const changed = (text: string) => {
    setMessage(text)
    void queryClient.invalidateQueries({ queryKey: ['admin', 'contact-messages'] })
  }

  return (
    <>
      <AdminHead title="Contact messages"
                 sub="What people sent with Contact us. Reply by email, then mark it replied or closed." />

      <div className={styles.tabs} role="tablist" aria-label="Message status">
        {TABS.map((t) => (
          <button key={t.key} type="button" role="tab" aria-selected={t === tab} className={styles.tab}
                  onClick={() => go({ status: t.key })}>
            {t.label}{countFor(t.key) !== undefined && ` (${countFor(t.key)})`}
          </button>
        ))}
      </div>

      <StatusBanner message={message} />
      <ListStatus isLoading={inbox.isPending} error={inbox.error} onRetry={() => void inbox.refetch()}
                  isEmpty={items.length === 0} placeholders={2}
                  emptyText={tab.key === 'new' ? 'No new messages. All caught up!' : 'No messages here.'} />

      {items.length > 0 && (
        <ul className={styles.people}>
          {items.map((m) => <MessageCard key={`${m.id}-${m.status}-${m.staffNote}`} m={m} onChanged={changed} />)}
        </ul>
      )}
      {data && data.messages.totalCount > PAGE_SIZE && (
        <Pager page={data.messages.page} totalPages={Math.ceil(data.messages.totalCount / PAGE_SIZE)}
               onChange={(p) => go({ page: p })} />
      )}
    </>
  )
}
