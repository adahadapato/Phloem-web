import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { ApiError } from '../../api/apiError'
import { completeTwoFactor, forgotPassword, login, type SignInOutcome } from '../../api/services/authService'
import { Button } from '../../components/ui/Button'
import { Field } from '../../components/ui/Field'
import { StatusBanner } from '../../components/ui/StatusBanner'
import { useSession } from '../../state/SessionContext'
import styles from './Auth.module.css'
import { safeReturnTo } from './returnTo'

/** The message under the form: info (green) or a problem (red). */
type Status = { text: string; isError: boolean } | null

/**
 * Log in, like the app's: email, password (with the eye), "Remember me", "Forgot password?". When the account has
 * two-step sign-in on, the same card then asks for the 6-digit code or a recovery code. Afterwards: back to the page
 * the person wanted (?returnTo=…), otherwise Home.
 */
export default function LoginPage() {
  const { signedIn, status: sessionStatus } = useSession()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const returnTo = safeReturnTo(params.get('returnTo'))

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)
  const [code, setCode] = useState('')
  const [challengeToken, setChallengeToken] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  // After "Change password" every device is signed out; say why
  const [status, setStatus] = useState<Status>(params.get('changed') === '1'
    ? { text: 'Your password has been changed. Please log in with your new password.', isError: false }
    : null)
  const [error, setError] = useState<ApiError | null>(null)

  /** Signed in: show the person, then go on. 2FA needed: switch the card to the code. */
  const handleOutcome = (outcome: SignInOutcome) => {
    if (outcome.kind === 'twoFactorRequired') {
      setChallengeToken(outcome.challengeToken)
      setStatus(null)
      return
    }
    signedIn(outcome.profile)
    navigate(returnTo, { replace: true })
  }

  const fail = (apiError: ApiError) => {
    setError(apiError)
    setStatus({ text: apiError.displayMessage, isError: true })
  }

  const onLogin = async (event: FormEvent) => {
    event.preventDefault()
    if (!email.trim() || !password) {
      setStatus({ text: 'Please enter your email and password.', isError: true })
      return
    }
    setBusy(true)
    setError(null)
    setStatus(null)
    const result = await login({ email, password }, remember)
    setBusy(false)
    if (result.ok) handleOutcome(result.value)
    else fail(result.error)
  }

  const onCode = async (event: FormEvent) => {
    event.preventDefault()
    const trimmed = code.trim()
    if (!trimmed || !challengeToken) return
    // A 6-digit number is an authenticator code; anything else is a recovery code (same rule as the app)
    const isRecoveryCode = !/^\d{6}$/.test(trimmed.replace(/\s/g, ''))
    setBusy(true)
    setStatus(null)
    const result = await completeTwoFactor({ challengeToken, code: trimmed, isRecoveryCode }, remember)
    setBusy(false)
    if (result.ok) handleOutcome(result.value)
    else fail(result.error)
  }

  const onForgot = async () => {
    if (!email.trim()) {
      setStatus({ text: 'Type your email address above first, then tap "Forgot password?".', isError: true })
      return
    }
    const result = await forgotPassword(email)
    // Same answer whether or not the account exists, so nobody can use this to find accounts
    setStatus(result.ok
      ? { text: 'If an account exists for that email, a reset link has been sent.', isError: false }
      : { text: result.error.displayMessage, isError: true })
  }

  if (sessionStatus === 'signedIn' && !challengeToken) {
    return (
      <div className={`container ${styles.page}`}>
        <div className={`${styles.inner} stack`}>
          <h1>You're signed in</h1>
          <p className="muted"><Link to="/">Go to Home</Link> or <Link to="/account">your account</Link>.</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`container ${styles.page}`}>
      <div className={styles.inner}>
        <div className={styles.heading}>
          <h1>Welcome back</h1>
          <p className="muted">Sign in to continue to Phloem</p>
        </div>

        {!challengeToken ? (
          <form className={styles.card} onSubmit={onLogin} noValidate>
            <span className={styles.badge} aria-hidden="true">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6"
                   strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l5 5 9-10.5" /></svg>
            </span>
            <h2 className={styles.cardTitle}>Log in to your account</h2>

            <Field label="Email address" type="email" autoComplete="email" placeholder="you@example.com"
                   value={email} onChange={(e) => setEmail(e.target.value)} error={error?.fieldError('Email')} />
            <Field label="Password" type="password" autoComplete="current-password" placeholder="Your password"
                   value={password} onChange={(e) => setPassword(e.target.value)}
                   error={error?.fieldError('Password')} />

            <div className={styles.row}>
              <label className={styles.check}>
                <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                Remember me
              </label>
              <button type="button" className={styles.linkButton} onClick={onForgot}>Forgot password?</button>
            </div>

            <Button type="submit" full busy={busy} busyText="Signing in…">Log in</Button>
          </form>
        ) : (
          <form className={styles.card} onSubmit={onCode} noValidate>
            <h2 className={styles.cardTitle}>Two-step verification</h2>
            <p className="muted" style={{ textAlign: 'center' }}>
              Enter the 6-digit code from your authenticator app, or one of your recovery codes.
            </p>
            <Field label="Code" className={styles.code} inputMode="text" autoComplete="one-time-code" placeholder="123456"
                   maxLength={20} autoFocus value={code} onChange={(e) => setCode(e.target.value)} />
            <Button type="submit" full busy={busy} busyText="Checking…">Verify</Button>
            <button type="button" className={styles.linkButton}
                    onClick={() => { setChallengeToken(null); setCode(''); setStatus(null) }}>
              ‹ Back to log in
            </button>
          </form>
        )}

        <div style={{ marginTop: 16 }}>
          <StatusBanner message={status?.text} isError={status?.isError} />
        </div>

        <div className={styles.footer}>
          <p className="muted">New to Phloem?</p>
          <Link to={`/register${returnTo !== '/' ? `?returnTo=${encodeURIComponent(returnTo)}` : ''}`}
                className={styles.cta}>
            Create an account →
          </Link>
        </div>
      </div>
    </div>
  )
}
