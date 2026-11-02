import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { unwrap, type ApiResult } from '../../../api/apiError'
import type { PendingChangeDto } from '../../../api/contracts/dtos'
import type { PendingChangeStatus } from '../../../api/contracts/enums'
import { approveChange, getApprovals, rejectChange, withdrawChange, type ApprovalsView } from '../../../api/services/approvalService'
import { Button } from '../../../components/ui/Button'
import { Markdown } from '../../../components/ui/Markdown'
import { Pager } from '../../../components/ui/Pager'
import { StatusBanner } from '../../../components/ui/StatusBanner'
import { useCountry } from '../../../state/CountryContext'
import styles from '../Admin.module.css'
import { AdminHead } from '../AdminParts'

const PAGE_SIZE = 20
const REASON_MAX = 500   // PendingChange.DecisionNoteMaxLength

type Message = { text: string; isError: boolean } | null

const VIEWS: { value: ApprovalsView; label: string }[] = [
  { value: 'Waiting', label: 'Waiting for you' },
  { value: 'Mine', label: 'Your proposals' },
  { value: 'History', label: 'History' },
]

const when = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

/** "in 5 hours", "in 3 days", "now". */
function timeLeft(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now()
  if (ms <= 0) return 'now'
  const hours = Math.round(ms / 3_600_000)
  if (hours < 1) return 'in less than an hour'
  if (hours < 48) return `in ${hours} hour${hours === 1 ? '' : 's'}`
  return `in ${Math.round(hours / 24)} days`
}

/** A status as a coloured label. */
function StatusChip({ status }: { status: PendingChangeStatus }) {
  const tone = status === 'Waiting' ? styles.chipWait
    : status === 'Approved' ? styles.chipGo
    : status === 'Rejected' || status === 'Failed' ? styles.chipStop
    : styles.chipOff
  const text: Record<PendingChangeStatus, string> = {
    Waiting: 'Waiting', Approved: 'Approved', Rejected: 'Rejected', Withdrawn: 'Withdrawn', Expired: 'Expired',
    Failed: "Couldn't be applied",
  }
  return <span className={`${styles.chip} ${tone}`}>{text[status]}</span>
}

/**
 * One change on a card: what it is, who asked and when, when it stops waiting; for Terms / Privacy the exact wording
 * to approve (open it to read); then Approve / Reject (with a reason) for the second person, or Take back for the
 * person who proposed it. Decided ones show who decided, the reason and what happened.
 */
function ChangeCard({ change, onDone }: { change: PendingChangeDto; onDone: (m: Message) => void }) {
  const queryClient = useQueryClient()
  const { countries } = useCountry()
  const [showText, setShowText] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const isBlock = change.kind === 'ConfirmShopBlock'
  const countryName = change.country ? countries.find((c) => c.country === change.country)?.name ?? change.country : null

  const run = async (action: () => Promise<ApiResult<unknown>>, done: (value: unknown) => string) => {
    setBusy(true)
    onDone(null)
    const result = await action()
    setBusy(false)
    if (!result.ok) { onDone({ text: result.error.displayMessage, isError: true }); return }
    await queryClient.invalidateQueries({ queryKey: ['admin'] })
    if (change.kind === 'PublishLegalDocument') await queryClient.invalidateQueries({ queryKey: ['legal'] })
    onDone({ text: done(result.value), isError: false })
  }

  return (
    <li className={styles.person}>
      <div className={styles.personTop}>
        <span className={styles.personInitial} aria-hidden="true">{isBlock ? '⛔' : '📄'}</span>
        <div className={styles.personWho}>
          <h2 className={styles.personName}>{change.summary}</h2>
          <span className="muted">
            Asked by {change.isYours ? 'you' : change.proposedByName} · {when(change.proposedAt)}
            {countryName && <> · {countryName}</>}
          </span>
        </div>
        <StatusChip status={change.status} />
      </div>

      <div className={styles.personFacts}>
        {change.status === 'Waiting' && (
          <span className={styles.fact}>
            {isBlock
              ? <>The shop is blocked now. If nobody confirms, it's unblocked automatically {timeLeft(change.expiresAt)}.</>
              : <>Goes live only when approved. Expires {timeLeft(change.expiresAt)}.</>}
          </span>
        )}
        {isBlock && change.targetId && <Link to={`/admin/shops/${change.targetId}`}>See the shop ›</Link>}
        {change.decidedAt && change.status !== 'Waiting' && (
          <span className={styles.fact}>
            {change.status === 'Expired' ? 'Expired' : change.decidedByName ? `By ${change.decidedByName}` : ''} · {when(change.decidedAt)}
          </span>
        )}
      </div>
      {change.decisionNote && <p className={styles.personNote}>Reason: "{change.decisionNote}"</p>}
      {change.outcome && <p className={styles.panelHint}>{change.outcome}</p>}

      {/* Terms / Privacy: exactly what will be published */}
      {change.legal && (
        <div className={styles.inlinePanel}>
          <button type="button" className={styles.linkButton} aria-expanded={showText} onClick={() => setShowText((s) => !s)}>
            {showText ? 'Hide the wording' : `Read the wording${change.legal.isDraft ? ' (marked as draft)' : ''} ›`}
          </button>
          {showText && (
            <div className={styles.editorPreview}>
              <h1 className={styles.previewTitle}>{change.legal.title}</h1>
              <Markdown text={change.legal.content} />
            </div>
          )}
        </div>
      )}

      {/* Decide (second person) */}
      {change.canDecide && !rejecting && (
        <div className={styles.personActions}>
          <Button small variant="cta" busy={busy} busyText="Approving…"
                  onClick={() => run(() => approveChange(change.id),
                    (outcome) => `Approved: ${change.summary}. ${typeof outcome === 'string' ? outcome : ''}`)}>
            {isBlock ? 'Confirm the block' : 'Approve and publish'}
          </Button>
          <Button small variant="outline" className={styles.danger} disabled={busy}
                  onClick={() => { setRejecting(true); setReason('') }}>
            {isBlock ? 'Reject (unblock the shop)' : 'Reject'}
          </Button>
        </div>
      )}
      {change.canDecide && rejecting && (
        <form className={styles.inlinePanel}
              onSubmit={(e) => { e.preventDefault(); void run(() => rejectChange(change.id, reason.trim()), () => `Rejected: ${change.summary}.${isBlock ? ' The shop is unblocked.' : ''}`) }}>
          <label className={styles.reasonLabel}>
            <span>Why? {change.isYours ? '' : `${change.proposedByName} will see this.`}</span>
            <textarea value={reason} maxLength={REASON_MAX} onChange={(e) => setReason(e.target.value)} autoFocus
                      placeholder={isBlock ? 'e.g. The orders were genuine; spoke to the seller' : 'e.g. Section 4 still needs the lawyer\'s wording'} />
          </label>
          <div className={styles.row}>
            <Button type="submit" small variant="cta" busy={busy} busyText="Rejecting…" disabled={!reason.trim()}>Reject</Button>
            <Button small variant="outline" onClick={() => setRejecting(false)}>Cancel</Button>
          </div>
        </form>
      )}

      {/* Take back (proposer) */}
      {change.canWithdraw && (
        <div className={styles.personActions}>
          <Button small variant="outline" busy={busy} busyText="Taking back…"
                  onClick={() => run(() => withdrawChange(change.id), () => `You took back: ${change.summary}.`)}>
            Take it back
          </Button>
        </div>
      )}
    </li>
  )
}

/**
 * Admin → Approvals: changes that need a second person. Three lists: <b>Waiting for you</b> (approve or reject),
 * <b>Your proposals</b> (see where they stand, take one back), <b>History</b>.
 *
 * Needing approval so far: publishing the Terms or Privacy Policy (another owner), and confirming a shop block
 * (another owner, or that country's Country manager; unblocked automatically if nobody confirms within 24 hours).
 * Nobody can decide their own. The API checks every decision again.
 */
export default function AdminApprovalsPage() {
  const [params, setParams] = useSearchParams()
  const view = (VIEWS.find((v) => v.value === params.get('view'))?.value ?? 'Waiting') as ApprovalsView
  const page = Math.max(1, Number(params.get('page')) || 1)
  const [message, setMessage] = useState<Message>(null)

  const query = useQuery({
    queryKey: ['admin', 'approvals', view, page],
    queryFn: async ({ signal }) => unwrap(await getApprovals(view, page, PAGE_SIZE, signal)),
    placeholderData: (previous) => previous,
  })
  const list = query.data

  const go = (next: { view?: ApprovalsView; page?: number }) => {
    const p = new URLSearchParams(params)
    if (next.view) { p.set('view', next.view); p.delete('page') }
    if (next.page) p.set('page', String(next.page))
    setParams(p)
    setMessage(null)
  }

  return (
    <>
      <AdminHead title="Approvals"
                 sub="Changes that need a second person: new Terms or Privacy Policy, and shop blocks to confirm." />
      <StatusBanner message={message?.text} isError={message?.isError} />

      <div className={styles.tabs} role="tablist" aria-label="Which changes">
        {VIEWS.map((v) => (
          <button key={v.value} type="button" role="tab" aria-selected={v.value === view} className={styles.tab}
                  onClick={() => go({ view: v.value })}>
            {v.label}
          </button>
        ))}
      </div>

      {query.isError && (
        <div className={styles.error}>
          <StatusBanner isError message="We couldn't load the approvals." />
          <Button small variant="outline" onClick={() => query.refetch()}>Try again</Button>
        </div>
      )}
      {!list && query.isPending && <p className="muted" aria-busy="true">Loading…</p>}

      {list && (
        <>
          <p className={styles.count}>
            {list.totalCount === 0
              ? view === 'Waiting' ? '✓ Nothing is waiting for you.' : 'Nothing here yet.'
              : `${list.totalCount} ${list.totalCount === 1 ? 'change' : 'changes'}`}
          </p>
          {list.items.length > 0 && (
            <ul className={styles.people}>
              {list.items.map((c) => <ChangeCard key={c.id} change={c} onDone={setMessage} />)}
            </ul>
          )}
          <Pager page={list.page} totalPages={list.totalPages} onChange={(p) => go({ page: p })} />
        </>
      )}
    </>
  )
}
