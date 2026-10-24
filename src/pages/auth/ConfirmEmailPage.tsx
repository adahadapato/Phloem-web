import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import { confirmEmail } from '../../api/services/authService'
import { ButtonLink } from '../../components/ui/Button'
import { useSession } from '../../state/SessionContext'
import styles from './Auth.module.css'

type State = 'checking' | 'confirmed' | 'failed'

/**
 * The page the API's "Confirm your Phloem email" email links to: /confirm-email?userId=…&token=….
 * Confirms straight away (no button), then says whether it worked.
 * (Works once the API's Email settings are filled in; until then no such emails are sent.)
 */
export default function ConfirmEmailPage() {
  const [params] = useSearchParams()
  const userId = params.get('userId') ?? ''
  const token = params.get('token') ?? ''
  const { status: sessionStatus, refreshProfile } = useSession()
  const [state, setState] = useState<State>(userId && token ? 'checking' : 'failed')
  const [message, setMessage] = useState<string | null>(null)
  const started = useRef(false)

  useEffect(() => {
    // Once only (React runs effects twice in development)
    if (started.current || !userId || !token) return
    started.current = true
    confirmEmail({ userId, token }).then((result) => {
      setState(result.ok ? 'confirmed' : 'failed')
      if (!result.ok) setMessage(result.error.displayMessage)
    })
  }, [userId, token])

  // Signed in on this browser: refresh the profile so "email not confirmed" notes disappear
  useEffect(() => {
    if (state === 'confirmed' && sessionStatus === 'signedIn') void refreshProfile()
  }, [state, sessionStatus, refreshProfile])

  return (
    <div className={`container ${styles.page}`}>
      <div className={styles.inner}>
        <div className={styles.card} style={{ textAlign: 'center', alignItems: 'center' }} aria-live="polite">
          {state === 'checking' && (
            <>
              <h1 className={styles.cardTitle}>Confirming your email…</h1>
              <p className="muted">This only takes a moment.</p>
            </>
          )}
          {state === 'confirmed' && (
            <>
              <span className={styles.badge} aria-hidden="true">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6"
                     strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l5 5 9-10.5" /></svg>
              </span>
              <h1 className={styles.cardTitle}>Your email is confirmed</h1>
              <p className="muted">Thank you. You're all set.</p>
              <ButtonLink to={sessionStatus === 'signedIn' ? '/' : '/login'}>
                {sessionStatus === 'signedIn' ? 'Go to Home' : 'Log in'}
              </ButtonLink>
            </>
          )}
          {state === 'failed' && (
            <>
              <h1 className={styles.cardTitle}>This link didn't work</h1>
              <p className="muted">
                {message ?? 'The link is incomplete.'} Please open the link from your email again; links expire
                after a while.
              </p>
              <ButtonLink to="/" variant="secondary">Go to Home</ButtonLink>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
