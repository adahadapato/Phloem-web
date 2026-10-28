import { useState } from 'react'
import type { CourierOptionDto } from '../../api/contracts/dtos'
import { Button } from '../ui/Button'
import styles from './Deliveries.module.css'

/**
 * "Who's delivering it?": a list of couriers (for sellers, "I'll deliver it myself" first) and a button. Used for
 * "Send out", "Out for delivery" and "Change courier".
 */
export function CourierPicker({ couriers, loading, label, busy, onPick, onCancel }: {
  couriers: CourierOptionDto[] | undefined
  loading: boolean
  label: string
  busy: boolean
  onPick: (courier: CourierOptionDto) => void
  onCancel?: () => void
}) {
  const [chosen, setChosen] = useState('')
  const list = couriers ?? []
  const picked = list.find((c) => c.id === chosen)

  if (loading) return <p className="muted" aria-busy="true">Loading couriers…</p>
  if (list.length === 0) {
    return (
      <p className="muted">
        Nobody has the Courier role in this country yet. An admin can give it on Admin → Users.
      </p>
    )
  }

  return (
    <div className={styles.courier}>
      <select aria-label="Who's delivering it?" value={chosen} onChange={(e) => setChosen(e.target.value)}>
        <option value="">Who's delivering it?</option>
        {list.map((c) => (
          <option key={c.id} value={c.id}>{c.isMe ? "🙋 I'll deliver it myself" : `🛵 ${c.name}`}</option>
        ))}
      </select>
      <Button variant="cta" small disabled={!picked} busy={busy} busyText="Saving…"
              onClick={() => picked && onPick(picked)}>{label}</Button>
      {onCancel && <Button variant="outline" small disabled={busy} onClick={onCancel}>Cancel</Button>}
    </div>
  )
}
