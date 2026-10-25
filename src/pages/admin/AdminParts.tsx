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
