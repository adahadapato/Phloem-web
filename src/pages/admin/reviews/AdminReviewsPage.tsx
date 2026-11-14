import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { unwrap } from '../../../api/apiError'
import type { AdminReviewDto } from '../../../api/contracts/dtos'
import type { ReviewStatus } from '../../../api/contracts/enums'
import { getAdminReviews, hideReview, showReview } from '../../../api/services/reviewService'
import { StarText } from '../../../components/reviews/StarText'
import { Button } from '../../../components/ui/Button'
import { dateTimeText } from '../../../components/ui/labels'
import { ListStatus } from '../../../components/ui/ListStatus'
import { Pager } from '../../../components/ui/Pager'
import { StatusBanner } from '../../../components/ui/StatusBanner'
import styles from '../Admin.module.css'
import { AdminHead } from '../AdminParts'

const PAGE_SIZE = 20
const NOTE_MAX = 300   // Review.StaffNoteMaxLength

/** The tabs (in the address as ?status=…). */
const TABS: { key: string; label: string; status?: ReviewStatus }[] = [
  { key: 'all', label: 'All' },
  { key: 'published', label: 'On the site', status: 'Published' },
  { key: 'waiting', label: 'Waiting for a person', status: 'WaitingForStaff' },
  { key: 'hidden', label: 'Hidden', status: 'Hidden' },
  { key: 'rejected', label: 'Rejected', status: 'Rejected' },
]

const STATUS: Record<ReviewStatus, { text: string; chip: string }> = {
  Checking: { text: 'AI checking', chip: styles.chipWait },
  Published: { text: 'Published', chip: styles.chipGo },
  WaitingForStaff: { text: 'Waiting for a person', chip: styles.chipWait },
  Rejected: { text: 'Rejected', chip: styles.chipStop },
  Hidden: { text: 'Hidden', chip: styles.chipOff },
}

/** One review: stars, comment, who and what, and Hide / Put back. */
function ReviewCard({ r, onChanged }: { r: AdminReviewDto; onChanged: (text: string) => void }) {
  const [hiding, setHiding] = useState(false)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const status = STATUS[r.status]
  const link = r.kind === 'Order' ? `/admin/orders/${encodeURIComponent(r.reference)}` : null

  const run = async (action: 'hide' | 'show') => {
    setBusy(true); setError(null)
    const result = action === 'hide' ? await hideReview(r.id, note.trim()) : await showReview(r.id)
    setBusy(false)
    if (!result.ok) { setError(result.error.displayMessage); return }
    onChanged(action === 'hide' ? `${r.displayName}'s review is hidden.` : `${r.displayName}'s review is back on the site.`)
  }

  return (
    <li className={styles.person}>
      <div className={styles.messageTop}>
        <div className={styles.personWho}>
          <h2 className={styles.personName}><StarText stars={r.stars} /> {r.authorName}</h2>
          <span className={styles.personContact}>Shows as {r.displayName} · {r.placeText}</span>
        </div>
        <span className={`${styles.chip} ${status.chip}`}>{status.text}</span>
      </div>
      <p className={styles.messageMeta}>
        <strong>{r.kind === 'Order' ? 'Food order' : 'Parcel'}</strong>
        {' · '}{link ? <Link to={link} className={styles.messageRef}>{r.reference}</Link> : <span className={styles.messageRef}>{r.reference}</span>}
        {' · '}{dateTimeText(r.writtenAt)}
        {!r.showPublicly && r.comment && ' · comment for Phloem only'}
      </p>
      {r.comment ? <p className={styles.messageText}>{r.comment}</p> : <p className="muted">Stars only, no comment.</p>}
      {r.staffNote && <p className={styles.messageNote}><strong>Note:</strong> {r.staffNote}</p>}

      {hiding && (
        <div className={styles.stackForm}>
          <label htmlFor={`note-${r.id}`}><strong>Why hide it? (staff only)</strong></label>
          <textarea id={`note-${r.id}`} className={styles.messageNoteInput} rows={2} maxLength={NOTE_MAX} value={note}
                    onChange={(e) => setNote(e.target.value)} placeholder="e.g. Mentions the rider by full name" />
          <div className={styles.inlineForm}>
            <Button small variant="cta" busy={busy} busyText="Hiding…" disabled={!note.trim()} onClick={() => void run('hide')}>
              Hide from the site
            </Button>
            <Button small variant="plain" onClick={() => { setHiding(false); setNote('') }}>Cancel</Button>
          </div>
        </div>
      )}
      <StatusBanner isError message={error} />

      <div className={`${styles.personActions} ${styles.messageActions}`}>
        {r.status === 'Published' && r.comment && !hiding && (
          <Button small variant="outline" onClick={() => setHiding(true)}>Hide…</Button>
        )}
        {(r.status === 'Hidden' || r.status === 'Rejected') && (
          <Button small variant="outline" busy={busy} busyText="Saving…" onClick={() => void run('show')}>Put back on the site</Button>
        )}
        {r.status === 'WaitingForStaff' && <Link to="/admin/moderation?show=reviews">Decide in Moderation ›</Link>}
      </div>
    </li>
  )
}

/**
 * Admin → Reviews (permission shops.manage, your countries): every review of a delivered order or parcel, newest
 * first. Stars always count; comments the AI rated clean go on the site at once, doubtful ones wait in Moderation.
 * Here you can hide a published comment (the stars still count) or put one back. Tab and page live in the address.
 */
export default function AdminReviewsPage() {
  const queryClient = useQueryClient()
  const [params, setParams] = useSearchParams()
  const tab = TABS.find((t) => t.key === params.get('status')) ?? TABS[0]
  const page = Math.max(1, Number(params.get('page')) || 1)
  const [message, setMessage] = useState<string | null>(null)

  const list = useQuery({
    queryKey: ['admin', 'reviews', tab.key, page],
    queryFn: async ({ signal }) => unwrap(await getAdminReviews(tab.status, page, PAGE_SIZE, signal)),
  })
  const items = list.data?.items ?? []

  const go = (next: { status?: string; page?: number }) => {
    const p = new URLSearchParams(params)
    if (next.status !== undefined) { p.set('status', next.status); p.delete('page') }
    if (next.page !== undefined) p.set('page', String(next.page))
    setParams(p)
    setMessage(null)
  }

  const changed = (text: string) => {
    setMessage(text)
    void queryClient.invalidateQueries({ queryKey: ['admin', 'reviews'] })
    void queryClient.invalidateQueries({ queryKey: ['reviews'] })
  }

  return (
    <>
      <AdminHead title="Reviews"
                 sub="What customers said after delivery. Stars always count; you can take a comment off the site." />

      <div className={styles.tabs} role="tablist" aria-label="Review status">
        {TABS.map((t) => (
          <button key={t.key} type="button" role="tab" aria-selected={t === tab} className={styles.tab}
                  onClick={() => go({ status: t.key })}>
            {t.label}
          </button>
        ))}
      </div>

      <StatusBanner message={message} />
      <ListStatus isLoading={list.isPending} error={list.error} onRetry={() => void list.refetch()}
                  isEmpty={items.length === 0} placeholders={2} emptyText="No reviews here yet." />

      {items.length > 0 && (
        <ul className={styles.people}>
          {items.map((r) => <ReviewCard key={`${r.id}-${r.status}`} r={r} onChanged={changed} />)}
        </ul>
      )}
      <Pager page={page} totalPages={list.data?.totalPages ?? 0} onChange={(p) => go({ page: p })} />
    </>
  )
}
