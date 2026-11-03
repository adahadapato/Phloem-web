import { useQuery } from '@tanstack/react-query'
import { unwrap } from '../../../api/apiError'
import { getAiStatus } from '../../../api/services/aiService'
import styles from './Ai.module.css'

const usd = (n: number) => `$${n.toFixed(n < 1 ? 4 : 2)}`

/** One line: is the AI on, which model, and how much of this month's limit is used. */
export function AiStatusBar() {
  const status = useQuery({ queryKey: ['admin', 'ai', 'status'], queryFn: async ({ signal }) => unwrap(await getAiStatus(signal)) })
  const s = status.data
  if (!s) return null

  const used = s.monthlyCapUsd > 0 ? Math.min(100, (s.monthCostUsd / s.monthlyCapUsd) * 100) : 100
  return (
    <section className={styles.status} aria-label="AI status">
      <span className={`${styles.state} ${s.isEnabled && !s.capReached ? styles.on : ''}`}>
        <span className={styles.dot} aria-hidden="true" />
        {!s.isEnabled ? 'AI is off' : s.capReached ? 'AI paused: monthly limit reached' : `AI is on · ${s.model}`}
      </span>
      <div className={styles.spend}>
        <span>
          Spent this month: <strong>{usd(s.monthCostUsd)}</strong> of {usd(s.monthlyCapUsd)}
          <span className="muted"> · {s.monthCalls} {s.monthCalls === 1 ? 'request' : 'requests'}
            {s.monthFailedCalls > 0 && `, ${s.monthFailedCalls} failed`}</span>
        </span>
        <span className={`${styles.meter} ${s.capReached ? styles.full : ''}`} role="meter" aria-valuemin={0}
              aria-valuemax={100} aria-valuenow={Math.round(used)} aria-label="Spent this month">
          <span style={{ width: `${used}%` }} />
        </span>
      </div>
      {!s.isEnabled && s.notReadyReason && (
        <p className={styles.reason}>{s.notReadyReason} Until then, nothing is sent to the AI.</p>
      )}
      {s.provider === 'Fake' && (
        <p className={styles.reason}>Test mode: the AI's answers are fixed samples and cost nothing.</p>
      )}
    </section>
  )
}
