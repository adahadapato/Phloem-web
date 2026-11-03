import type { ModerationAdviceDto } from '../../api/contracts/dtos'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import type { DocumentStatus, VendorStatus } from '../../api/contracts/enums'
import { documentStatusText, vendorStatusText } from '../../components/ui/labels'
import styles from './Admin.module.css'

/** The top of every admin page: title, a line about it, and optional buttons on the right. */
export function AdminHead({ title, sub, children }: { title: string; sub?: string; children?: ReactNode }) {
  return (
    <div className={styles.head}>
      <div>
        <h1 className={styles.title}>{title}</h1>
        {sub && <p className="muted">{sub}</p>}
      </div>
      {children && <div className={styles.headActions}>{children}</div>}
    </div>
  )
}

/** A shop's status as a coloured label: orange waiting, green live, grey rejected / closed, red blocked. */
export function ShopStatusChip({ status }: { status: VendorStatus }) {
  const tone = status === 'PendingApproval' ? styles.chipWait
    : status === 'Approved' ? styles.chipGo
    : status === 'Blocked' ? styles.chipStop
    : styles.chipOff
  return <span className={`${styles.chip} ${tone}`}>{vendorStatusText[status]}</span>
}

/** A document's review state as a coloured label. */
export function DocumentStatusChip({ status, expired }: { status: DocumentStatus; expired?: boolean }) {
  if (expired) return <span className={`${styles.chip} ${styles.chipStop}`}>Expired</span>
  const tone = status === 'Pending' ? styles.chipWait : status === 'Accepted' ? styles.chipGo : styles.chipStop
  return <span className={`${styles.chip} ${tone}`}>{documentStatusText[status]}</span>
}

/** A number on the Overview, linking to where it's dealt with (no link: a plain tile). */
export function StatTile({ label, value, to, tone, note }: {
  label: string
  value: number | string | undefined
  to?: string
  tone?: 'orange' | 'green'
  note?: string
}) {
  const body = (
    <>
      <span className={styles.statLabel}>{label}</span>
      <strong className={`${styles.statValue} ${tone === 'orange' ? styles.statOrange : ''}`}>{value ?? '…'}</strong>
      {note && <span className={styles.statNote}>{note}</span>}
    </>
  )
  return to
    ? <Link to={to} className={`${styles.stat} ${styles.statLink}`}>{body}</Link>
    : <div className={styles.stat}>{body}</div>
}

/**
 * What the AI thought of some text (a shop name, a suggested dish name), in one line with a coloured label.
 * @param advice The check; nothing is shown when there's none yet.
 * @param kind "name" for dish name suggestions (approve / reject wording, close match); "check" otherwise.
 */
export function AiAdviceNote({ advice, kind = 'check' }: { advice?: ModerationAdviceDto | null; kind?: 'check' | 'name' }) {
  if (!advice) return null
  if (advice.state === 'WaitingForAi') return <span className={styles.aiNote}><span className={styles.aiPill}>AI: checking…</span></span>
  const label = advice.verdict === null ? 'AI: not checked'
    : kind === 'name'
      ? { Ok: 'AI suggests: approve', NeedsLook: 'AI: not sure', NotAllowed: 'AI suggests: reject' }[advice.verdict]
      : { Ok: 'AI: looks fine', NeedsLook: 'AI: needs a look', NotAllowed: 'AI: not allowed' }[advice.verdict]
  const tone = advice.verdict === 'Ok' ? styles.aiOk : advice.verdict === 'NotAllowed' ? styles.aiNo
    : advice.verdict === 'NeedsLook' ? styles.aiLook : ''
  return (
    <span className={styles.aiNote}>
      <span className={`${styles.aiPill} ${tone}`}>{advice.decidedByStaff ? (advice.verdict === 'Ok' ? 'Approved by staff' : 'Rejected by staff') : label}</span>
      {advice.reason && <span>{advice.reason}</span>}
      {kind === 'name' && advice.label && <span className="muted">Same as: <strong>{advice.label}</strong></span>}
    </span>
  )
}
