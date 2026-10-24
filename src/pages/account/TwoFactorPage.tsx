import { useQuery, useQueryClient } from '@tanstack/react-query'
import { QRCodeSVG } from 'qrcode.react'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { unwrap } from '../../api/apiError'
import type { TwoFactorSetupDto } from '../../api/contracts/dtos'
import {
  disableTwoFactor,
  enableTwoFactor,
  getTwoFactorSetup,
  getTwoFactorStatus,
  regenerateRecoveryCodes,
} from '../../api/services/accountService'
import { Button } from '../../components/ui/Button'
import { Field } from '../../components/ui/Field'
import { StatusBanner } from '../../components/ui/StatusBanner'
import styles from './Account.module.css'

type Message = { text: string; isError: boolean } | null

/** Recovery codes, shown ONCE, with Copy and Download (the API never shows them again). */
function RecoveryCodes({ codes, onDone }: { codes: string[]; onDone: () => void }) {
  const [copied, setCopied] = useState(false)
  const text = codes.join('\n')
  const download = () => {
    const url = URL.createObjectURL(new Blob([`Phloem recovery codes\n\n${text}\n`], { type: 'text/plain' }))
    const a = Object.assign(document.createElement('a'), { href: url, download: 'phloem-recovery-codes.txt' })
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <section className={styles.card} aria-labelledby="codes-title">
      <h2 id="codes-title" className={styles.cardTitle}>Your recovery codes</h2>
      <p className="muted">
        Keep these somewhere safe. If you lose your phone, each code lets you log in once. You won't see them again.
      </p>
      <ul className={styles.codes}>{codes.map((c) => <li key={c}>{c}</li>)}</ul>
      <div className={styles.actions}>
        <Button variant="secondary" small
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(text)
                    setCopied(true)
                  } catch {
                    // Clipboard blocked by the browser: Download still works
                  }
                }}>
          {copied ? 'Copied ✓' : 'Copy'}
        </Button>
        <Button variant="outline" small onClick={download}>Download</Button>
        <Button small onClick={onDone}>I've saved them</Button>
      </div>
    </section>
  )
}

/**
 * Two-step sign-in (the API's /api/me/two-factor): when on, logging in also needs a 6-digit code from an
 * authenticator app (Google Authenticator, Microsoft Authenticator, …), or a recovery code.
 * Off → "Turn on": scan the QR code, type the code it shows, save the recovery codes.
 * On → codes left, "New recovery codes", "Turn off" (both need the password; admins can't turn it off).
 */
export default function TwoFactorPage() {
  const queryClient = useQueryClient()
  const status = useQuery({
    queryKey: ['me', 'two-factor'],
    queryFn: ({ signal }) => getTwoFactorStatus(signal).then(unwrap),
  })

  const [setup, setSetup] = useState<TwoFactorSetupDto | null>(null)
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [codes, setCodes] = useState<string[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<Message>(null)

  const reload = () => queryClient.invalidateQueries({ queryKey: ['me', 'two-factor'] })

  const startSetup = async () => {
    setBusy(true)
    setMessage(null)
    const result = await getTwoFactorSetup()
    setBusy(false)
    if (result.ok) setSetup(result.value)
    else setMessage({ text: result.error.displayMessage, isError: true })
  }

  const onEnable = async (event: FormEvent) => {
    event.preventDefault()
    const clean = code.replace(/\s/g, '')
    if (!/^\d{6}$/.test(clean)) {
      setMessage({ text: 'Please type the 6-digit code your app shows.', isError: true })
      return
    }
    setBusy(true)
    const result = await enableTwoFactor(clean)
    setBusy(false)
    if (!result.ok) {
      setMessage({ text: result.error.displayMessage, isError: true })
      return
    }
    setSetup(null)
    setCode('')
    setCodes(result.value)
    setMessage({ text: 'Two-step sign-in is on.', isError: false })
    void reload()
  }

  const withPassword = async (action: 'disable' | 'codes') => {
    if (!password) {
      setMessage({ text: 'Please type your password first.', isError: true })
      return
    }
    setBusy(true)
    setMessage(null)
    if (action === 'disable') {
      const result = await disableTwoFactor(password)
      setBusy(false)
      setMessage(result.ok ? { text: 'Two-step sign-in is off.', isError: false }
                           : { text: result.error.displayMessage, isError: true })
    } else {
      const result = await regenerateRecoveryCodes(password)
      setBusy(false)
      if (result.ok) setCodes(result.value)
      setMessage(result.ok ? { text: 'New recovery codes made. The old ones no longer work.', isError: false }
                           : { text: result.error.displayMessage, isError: true })
    }
    setPassword('')
    void reload()
  }

  return (
    <div className={`container ${styles.page}`}>
      <div className={styles.inner}>
        <Link to="/account" className={styles.back}>‹ My account</Link>
        <div className={styles.heading}>
          <h1>Two-step sign-in</h1>
          <p className="muted">A code from your phone each time you log in, so a stolen password isn't enough.</p>
        </div>

        {codes && <RecoveryCodes codes={codes} onDone={() => setCodes(null)} />}

        {status.isPending && <p className="muted" aria-busy="true">Loading…</p>}
        {status.error && <StatusBanner message="Couldn't load your two-step sign-in settings. Please try again." isError />}

        {status.data && !status.data.isEnabled && !setup && !codes && (
          <section className={styles.card}>
            <p><strong>Off.</strong> Turn it on with an authenticator app such as Google Authenticator or Microsoft
              Authenticator.</p>
            <Button onClick={startSetup} busy={busy} busyText="Please wait…">Turn on</Button>
          </section>
        )}

        {setup && (
          <form className={styles.card} onSubmit={onEnable} noValidate>
            <h2 className={styles.cardTitle}>1. Scan this with your authenticator app</h2>
            <div className={styles.qr}>
              <QRCodeSVG value={setup.authenticatorUri} size={180} title="QR code for your authenticator app" />
            </div>
            <p className="muted">Can't scan it? Type this key into the app instead:</p>
            <p className={styles.key}>{setup.manualEntryKey}</p>
            <h2 className={styles.cardTitle}>2. Type the 6-digit code it shows</h2>
            <Field label="Code" inputMode="numeric" autoComplete="one-time-code" placeholder="123456" maxLength={7}
                   value={code} onChange={(e) => setCode(e.target.value)} />
            <div className={styles.actions}>
              <Button type="submit" busy={busy} busyText="Checking…">Turn on</Button>
              <Button variant="outline" onClick={() => { setSetup(null); setCode('') }}>Cancel</Button>
            </div>
          </form>
        )}

        {status.data?.isEnabled && (
          <section className={styles.card}>
            <p>
              <strong>On.</strong> {status.data.recoveryCodesLeft}{' '}
              recovery {status.data.recoveryCodesLeft === 1 ? 'code' : 'codes'} left.
            </p>
            {status.data.isRequired && (
              <p className="muted">Admin accounts must keep two-step sign-in on.</p>
            )}
            <Field label="Your password" type="password" autoComplete="current-password"
                   hint="Needed to make new recovery codes or turn this off." value={password}
                   onChange={(e) => setPassword(e.target.value)} />
            <div className={styles.actions}>
              <Button variant="secondary" disabled={busy} onClick={() => withPassword('codes')}>
                New recovery codes
              </Button>
              {!status.data.isRequired && (
                <Button variant="outline" disabled={busy} onClick={() => withPassword('disable')}>Turn off</Button>
              )}
            </div>
          </section>
        )}

        <StatusBanner message={message?.text} isError={message?.isError} />
      </div>
    </div>
  )
}
