/**
 * "We've updated our Terms": the website's side of Terms acceptance (the API decides; see its TermsGate).
 *
 * - After sign-in, when the profile says `terms.needsToAcceptTerms`, the box opens once per visit ("Not now" lets
 *   people keep browsing; it opens again next visit).
 * - A page whose action the API refused with `Terms.NotAccepted` (checkout, adding a dish) calls `askToAccept()`,
 *   which opens the box and resolves true once they accept, so the page can try again.
 * - A newer Privacy Policy shows a one-time notice at the bottom ("Got it": informed, not consent).
 */
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router'
import { TermsDialog, PrivacyNotice } from '../components/layout/TermsUpdate'
import { useSession } from './SessionContext'

const DISMISSED_KEY = 'phloem.termsNotNow'

interface TermsState {
  /** Opens "We've updated our Terms"; true once they accept, false on "Not now". */
  askToAccept: () => Promise<boolean>
}

const TermsContext = createContext<TermsState | null>(null)

const readDismissed = (): number => {
  try { return Number(sessionStorage.getItem(DISMISSED_KEY)) || 0 } catch { return 0 }
}
const writeDismissed = (version: number) => {
  try { sessionStorage.setItem(DISMISSED_KEY, String(version)) } catch { /* private mode: ask again next page */ }
}

export function TermsProvider({ children }: { children: ReactNode }) {
  const { status, profile } = useSession()
  const { pathname } = useLocation()
  const terms = status === 'signedIn' ? profile?.terms ?? null : null
  const [asked, setAsked] = useState(false)                  // a page asked (askToAccept)
  const [dismissed, setDismissed] = useState(readDismissed)   // "Not now" for this version, this visit
  const waiting = useRef<((accepted: boolean) => void) | null>(null)

  // Open when a page asks, or once per visit after sign-in (not while reading the Terms page itself)
  const open = asked || (!!terms?.needsToAcceptTerms && pathname !== '/terms' && dismissed < terms.currentTermsVersion)

  const close = useCallback((accepted: boolean) => {
    setAsked(false)
    if (!accepted && terms) {
      writeDismissed(terms.currentTermsVersion)
      setDismissed(terms.currentTermsVersion)
    }
    waiting.current?.(accepted)
    waiting.current = null
  }, [terms])

  const value = useMemo<TermsState>(() => ({
    askToAccept: () => new Promise<boolean>((resolve) => {
      waiting.current?.(false)
      waiting.current = resolve
      setAsked(true)
    }),
  }), [])

  return (
    <TermsContext.Provider value={value}>
      {children}
      {open && <TermsDialog onClose={close} />}
      {terms?.needsToSeePrivacy && !open && <PrivacyNotice version={terms.currentPrivacyVersion} />}
    </TermsContext.Provider>
  )
}

/** Opens "We've updated our Terms" from a page. Use inside {@link TermsProvider}. */
// eslint-disable-next-line react-refresh/only-export-components
export function useTermsPrompt(): TermsState {
  const state = useContext(TermsContext)
  if (!state) throw new Error('useTermsPrompt must be used inside <TermsProvider>.')
  return state
}
