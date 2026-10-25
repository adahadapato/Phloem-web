import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { Link, useLocation } from 'react-router'
import { unwrap } from '../../api/apiError'
import { getParcelItemRules } from '../../api/services/shipmentService'
import { Button } from '../../components/ui/Button'
import styles from './Shipping.module.css'

/**
 * "What we can't carry": the list from the API (an admin keeps it up to date), in two groups: never carried, and
 * carried only with a condition. Shown on Send a parcel above the "none of these items" tick box. A link to
 * /send-parcel#rules (from the Help page) scrolls here once the list has loaded.
 */
export function ParcelRules() {
  const { hash } = useLocation()
  const query = useQuery({
    queryKey: ['parcel-rules'],
    queryFn: async ({ signal }) => unwrap(await getParcelItemRules(signal)),
    staleTime: 10 * 60_000,
  })
  const rules = query.data ?? []
  const never = rules.filter((r) => r.kind === 'NotAllowed')
  const withCondition = rules.filter((r) => r.kind === 'Restricted')

  useEffect(() => {
    if (query.isSuccess && hash === '#rules') document.getElementById('rules')?.scrollIntoView({ block: 'start' })
  }, [query.isSuccess, hash])

  return (
    <div id="rules" className={styles.rules} aria-labelledby="rules-title">
      <h3 id="rules-title" className={styles.rulesTitle}>What we can't carry</h3>
      {query.isPending && <p className="muted" aria-busy="true">Loading the list…</p>}
      {query.isError && (
        <p className={styles.rulesError}>
          We couldn't load the list right now.{' '}
          <Button small variant="plain" onClick={() => query.refetch()}>Try again</Button>
        </p>
      )}
      {query.isSuccess && (
        <div className={styles.rulesGroups}>
          {never.length > 0 && (
            <div>
              <p className={`${styles.rulesHead} ${styles.rulesNo}`}>Not allowed</p>
              <ul className={styles.rulesList}>
                {never.map((r) => (
                  <li key={r.id}>
                    <span className={`${styles.ruleMark} ${styles.ruleMarkNo}`} aria-hidden="true">✕</span>
                    <span><strong>{r.name}</strong>{r.detail && <span className="muted"> · {r.detail}</span>}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {withCondition.length > 0 && (
            <div>
              <p className={`${styles.rulesHead} ${styles.rulesMaybe}`}>Only if</p>
              <ul className={styles.rulesList}>
                {withCondition.map((r) => (
                  <li key={r.id}>
                    <span className={`${styles.ruleMark} ${styles.ruleMarkMaybe}`} aria-hidden="true">!</span>
                    <span><strong>{r.name}</strong>{r.detail && <span className="muted"> · {r.detail}</span>}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
      <p className={styles.rulesNote}>
        This list can change, so please check it each time. See <Link to="/terms#parcels">Sending parcels</Link> in our
        Terms.
      </p>
    </div>
  )
}
