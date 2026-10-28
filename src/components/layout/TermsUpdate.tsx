import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { acceptTerms, acknowledgePrivacy } from '../../api/services/accountService'
import { useSession } from '../../state/SessionContext'
import { Button } from '../ui/Button'
import { StatusBanner } from '../ui/StatusBanner'
import styles from './TermsUpdate.module.css'

/**
 * "We've updated our Terms & Conditions": read them (new tab), then Accept, or "Not now" to keep browsing
 * (ordering, sending parcels and selling wait). A real modal dialog (focus kept inside, Esc = Not now).
 */
export function TermsDialog({ onClose }: { onClose: (accepted: boolean) => void }) {
  const { profile, refreshProfile } = useSession()
  const dialog = useRef<HTMLDialogElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const version = profile?.terms?.currentTermsVersion ?? 0
  const firstTime = !profile?.terms?.acceptedTermsVersion

  useEffect(() => {
    const d = dialog.current
    if (d && !d.open) d.showModal()
    return () => d?.close()
  }, [])

  const accept = async () => {
    setBusy(true)
    setError(null)
    const result = await acceptTerms(version)
    if (!result.ok) {
      setBusy(false)
      setError(result.error.displayMessage)
      if (result.error.code === 'Terms.Outdated') await refreshProfile()   // shows the newer version number
      return
    }
    await refreshProfile()
    setBusy(false)
    onClose(true)
  }

  return (
    <dialog ref={dialog} className={styles.dialog} aria-labelledby="terms-title" aria-describedby="terms-text"
            onCancel={(e) => { e.preventDefault(); onClose(false) }}>
      <span className={styles.icon} aria-hidden="true">📄</span>
      <h2 id="terms-title" className={styles.title}>
        {firstTime ? 'Please accept our Terms & Conditions' : 'We’ve updated our Terms & Conditions'}
      </h2>
      <div id="terms-text" className={styles.text}>
        <p>
          {firstTime
            ? 'Before you order, send a parcel or sell on Phloem, please read and accept our Terms & Conditions.'
            : `Version ${version} is now in effect. Please read it and accept it to keep ordering, sending parcels and selling.`}
        </p>
        <p className="muted">You can still look around without accepting.</p>
      </div>
      <a href="/terms" target="_blank" rel="noopener" className={styles.read}>Read the Terms &amp; Conditions ↗</a>
      <StatusBanner isError message={error} />
      <div className={styles.actions}>
        <Button variant="cta" busy={busy} busyText="Saving…" onClick={accept} disabled={version === 0}>
          I accept
        </Button>
        <Button variant="plain" onClick={() => onClose(false)} disabled={busy}>Not now</Button>
      </div>
    </dialog>
  )
}

/** "We've updated our Privacy Policy" at the bottom of the screen, once: read it, then "Got it". */
export function PrivacyNotice({ version }: { version: number }) {
  const { refreshProfile } = useSession()
  const [busy, setBusy] = useState(false)
  const [hidden, setHidden] = useState(false)
  if (hidden) return null

  const gotIt = async () => {
    setBusy(true)
    await acknowledgePrivacy(version)   // if it fails, the notice simply shows again next time
    setHidden(true)
    void refreshProfile()
  }

  return (
    <aside className={styles.notice} aria-label="Privacy Policy updated" role="status">
      <span aria-hidden="true">🔒</span>
      <p>
        We’ve updated our <Link to="/privacy">Privacy Policy</Link>: how we keep and use your details.
      </p>
      <Button small variant="secondary" busy={busy} busyText="…" onClick={gotIt}>Got it</Button>
    </aside>
  )
}
