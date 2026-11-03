import { useQuery } from '@tanstack/react-query'
import { unwrap } from '../../../api/apiError'
import { getAiStatus } from '../../../api/services/aiService'
import adminStyles from '../Admin.module.css'
import styles from './Ai.module.css'

const usd = (n: number) => `$${n.toFixed(n < 1 ? 4 : 2)}`

/** On or off, which model, and this month's spend against the cap (shown on every AI page). */
export function AiStatusBar() {
  const status = useQuery({ queryKey: ['admin', 'ai', 'status'], queryFn: async ({ signal }) => unwrap(await getAiStatus(signal)) })
  const s = status.data
  if (!s) return null

  const used = s.monthlyCapUsd > 0 ? Math.min(100, (s.monthCostUsd / s.monthlyCapUsd) * 100) : 100
  return (
    <section className={adminStyles.panel} aria-label="AI status">
      <div className={styles.status}>
        <span className={`${styles.state} ${s.isEnabled && !s.capReached ? styles.on : ''}`}>
          <span className={styles.dot} aria-hidden="true" />
          {!s.isEnabled ? 'AI is off' : s.capReached ? 'Paused: monthly limit reached' : `On · ${s.model}`}
        </span>
        <div className={styles.spend}>
          <span>
            This month: <strong>{usd(s.monthCostUsd)}</strong> of {usd(s.monthlyCapUsd)}
            <span className="muted"> · {s.monthCalls} {s.monthCalls === 1 ? 'call' : 'calls'}
              {s.monthFailedCalls > 0 && `, ${s.monthFailedCalls} failed`}</span>
          </span>
          <span className={`${styles.meter} ${s.capReached ? styles.full : ''}`} role="meter" aria-valuemin={0}
                aria-valuemax={100} aria-valuenow={Math.round(used)} aria-label="Spend this month">
            <span style={{ width: `${used}%` }} />
          </span>
        </div>
      </div>
      {!s.isEnabled && s.notReadyReason && (
        <p className={styles.reason}>{s.notReadyReason} Until then, every AI job uses its safe fallback.</p>
      )}
      {s.provider === 'Fake' && (
        <p className={styles.reason}>Test mode: answers are fixed samples and cost nothing.</p>
      )}
    </section>
  )
}
