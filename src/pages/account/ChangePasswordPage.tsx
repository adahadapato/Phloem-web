import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { ApiError } from '../../api/apiError'
import { changePassword } from '../../api/services/accountService'
import { Button } from '../../components/ui/Button'
import { Field } from '../../components/ui/Field'
import { StatusBanner } from '../../components/ui/StatusBanner'
import { useSession } from '../../state/SessionContext'
import styles from './Account.module.css'

/**
 * Change password, like the app's: current password, new password (with the app's live checks: at least 8
 * characters, a letter, a number), and the new one again. The API then signs out every device, this one too, so the
 * person goes to Log in with a note.
 */
export default function ChangePasswordPage() {
  const { logout } = useSession()
  const navigate = useNavigate()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<ApiError | null>(null)

  const checks = [
    { ok: next.length >= 8, text: 'At least 8 characters' },
    { ok: /[a-z]/i.test(next), text: 'Contains a letter' },
    { ok: /\d/.test(next), text: 'Contains a number' },
  ]

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    if (!current || !next) {
      setMessage('Please fill in your current and new password.')
      return
    }
    if (next !== confirm) {
      setMessage("The two new passwords don't match.")
      return
    }
    setBusy(true)
    setMessage(null)
    const result = await changePassword({ currentPassword: current, newPassword: next, confirmNewPassword: confirm })
    setBusy(false)
    if (!result.ok) {
      setError(result.error)
      setMessage(result.error.displayMessage)
      return
    }
    // The API has signed out every device. Finish moving to Log in FIRST (it loads on demand), so this signed-in-only
    // page can't redirect on its own, then sign out here too
    await navigate('/login?changed=1', { replace: true })
    await logout()
  }

  return (
    <div className={`container ${styles.page}`}>
      <div className={styles.inner}>
        <Link to="/account" className={styles.back}>‹ My account</Link>
        <div className={styles.heading}>
          <h1>Change password</h1>
          <p className="muted">Keep your account safe</p>
        </div>

        <form className={styles.card} onSubmit={onSubmit} noValidate>
          <Field label="Current password" type="password" autoComplete="current-password"
                 placeholder="Your current password" value={current} onChange={(e) => setCurrent(e.target.value)}
                 error={error?.fieldError('CurrentPassword')} />
          <Field label="New password" type="password" autoComplete="new-password" placeholder="At least 8 characters"
                 value={next} onChange={(e) => setNext(e.target.value)} error={error?.fieldError('NewPassword')} />
          <ul className="muted" style={{ margin: 0, paddingLeft: 4, listStyle: 'none', fontSize: 14 }}
              aria-label="Password checks">
            {checks.map((c) => (
              <li key={c.text} style={{ color: c.ok ? 'var(--brand-green)' : undefined }}>
                {c.ok ? '✓' : '○'} {c.text}
              </li>
            ))}
          </ul>
          <Field label="Confirm new password" type="password" autoComplete="new-password" placeholder="Type it again"
                 value={confirm} onChange={(e) => setConfirm(e.target.value)}
                 error={error?.fieldError('ConfirmNewPassword')} />
          <p className="muted">You'll be signed out on every device, and can then log in with the new password.</p>
          <StatusBanner message={message} isError />
          <Button type="submit" full busy={busy} busyText="Updating…">Update password</Button>
        </form>
      </div>
    </div>
  )
}
