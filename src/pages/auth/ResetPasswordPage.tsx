import { useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router'
import { ApiError } from '../../api/apiError'
import { resetPassword } from '../../api/services/authService'
import { Button, ButtonLink } from '../../components/ui/Button'
import { Field } from '../../components/ui/Field'
import { StatusBanner } from '../../components/ui/StatusBanner'
import styles from './Auth.module.css'

/**
 * The page the API's "Reset your Phloem password" email links to: /reset-password?email=…&token=….
 * The new password is typed twice. On success every other sign-in is ended (the API does that), so the person logs
 * in again with the new password.
 * (Works once the API's Email settings are filled in; until then no such emails are sent.)
 */
export default function ResetPasswordPage() {
  const [params] = useSearchParams()
  const email = params.get('email') ?? ''
  const token = params.get('token') ?? ''
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  if (!email || !token) {
    return (
      <div className={`container ${styles.page}`}>
        <div className={styles.inner}>
          <div className={styles.card} style={{ textAlign: 'center', alignItems: 'center' }}>
            <h1 className={styles.cardTitle}>This link is incomplete</h1>
            <p className="muted">
              Please open the link from your email again, or ask for a new one with "Forgot password?" on Log in.
            </p>
            <ButtonLink to="/login" variant="secondary">Go to Log in</ButtonLink>
          </div>
        </div>
      </div>
    )
  }

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    if (!password) {
      setMessage('Please choose a new password.')
      return
    }
    if (password !== confirm) {
      setMessage("The two passwords don't match.")
      return
    }
    setBusy(true)
    setMessage(null)
    const result = await resetPassword({ email, token, newPassword: password, confirmNewPassword: confirm })
    setBusy(false)
    if (result.ok) {
      setDone(true)
      return
    }
    setError(result.error)
    setMessage(result.error.displayMessage)
  }

  return (
    <div className={`container ${styles.page}`}>
      <div className={styles.inner}>
        <div className={styles.heading}>
          <h1>Choose a new password</h1>
          <p className="muted">For {email}</p>
        </div>

        {done ? (
          <div className={styles.card} style={{ textAlign: 'center', alignItems: 'center' }} role="status">
            <span className={styles.badge} aria-hidden="true">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6"
                   strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l5 5 9-10.5" /></svg>
            </span>
            <h2 className={styles.cardTitle}>Your password has been changed</h2>
            <p className="muted">You've been signed out everywhere else. Log in with your new password.</p>
            <ButtonLink to="/login">Log in</ButtonLink>
          </div>
        ) : (
          <form className={styles.card} onSubmit={onSubmit} noValidate>
            <Field label="New password" type="password" autoComplete="new-password"
                   hint="At least 8 characters, with upper and lower case letters and a number."
                   value={password} onChange={(e) => setPassword(e.target.value)}
                   error={error?.fieldError('NewPassword')} />
            <Field label="Type it again" type="password" autoComplete="new-password"
                   value={confirm} onChange={(e) => setConfirm(e.target.value)}
                   error={error?.fieldError('ConfirmNewPassword')} />
            <Button type="submit" full busy={busy} busyText="Saving…">Save new password</Button>
          </form>
        )}

        <div style={{ marginTop: 16 }}>
          <StatusBanner message={message} isError />
        </div>
      </div>
    </div>
  )
}
