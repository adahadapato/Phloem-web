/**
 * Who is signed in, for every page: the profile from the API and the roles from the sign-in token.
 * Same job as the app's SessionService.
 *
 * - On start, a kept sign-in is restored (status "loading" until then, so protected pages don't flash "Log in").
 * - When the sign-in runs out and can't be renewed, the person is shown as signed out.
 */
import { useQueryClient } from '@tanstack/react-query'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { ProfileDto } from '../api/contracts/dtos'
import { Roles } from '../api/contracts/roles'
import { getProfile } from '../api/services/accountService'
import { logout as apiLogout, restoreSession } from '../api/services/authService'
import { tokens } from '../api/tokens'

type Status = 'loading' | 'signedOut' | 'signedIn'

interface SessionState {
  status: Status
  /** The signed-in person, or null. */
  profile: ProfileDto | null
  /** True for admins. */
  isAdmin: boolean
  /** True once an admin has approved the person's shop. */
  isSeller: boolean
  /** Checks a role from the sign-in token. */
  isInRole: (role: string) => boolean
  /** After a successful sign-in (Log in, Sign up, 2FA): shows the person as signed in. */
  signedIn: (profile: ProfileDto) => void
  /** Reloads the profile (after changing details, opening a shop…). */
  refreshProfile: () => Promise<void>
  /** Signs out here and on the API. */
  logout: () => Promise<void>
}

const SessionContext = createContext<SessionState | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<Status>(tokens.canRefresh ? 'loading' : 'signedOut')
  const [profile, setProfile] = useState<ProfileDto | null>(null)
  const [roles, setRoles] = useState<string[]>(tokens.roles)

  const showSignedOut = useCallback(() => {
    setProfile(null)
    setRoles([])
    setStatus('signedOut')
    queryClient.clear()   // nobody's private data stays in the cache
  }, [queryClient])

  // Start: restore a kept sign-in
  useEffect(() => {
    if (!tokens.canRefresh) return
    let active = true
    restoreSession().then((restored) => {
      if (!active) return
      if (restored) {
        setProfile(restored)
        setRoles(tokens.roles)
        setStatus('signedIn')
      } else {
        setStatus('signedOut')
      }
    })
    return () => {
      active = false
    }
  }, [])

  // The sign-in ran out and couldn't be renewed
  useEffect(() => tokens.onExpired(showSignedOut), [showSignedOut])

  const value = useMemo<SessionState>(() => {
    const isInRole = (role: string) =>
      status === 'signedIn' && roles.some((r) => r.toLowerCase() === role.toLowerCase())

    return {
      status,
      profile,
      isAdmin: isInRole(Roles.Admin),
      isSeller: isInRole(Roles.Seller),
      isInRole,
      signedIn: (signedInProfile) => {
        setProfile(signedInProfile)
        setRoles(tokens.roles)
        setStatus('signedIn')
      },
      refreshProfile: async () => {
        const result = await getProfile()
        if (result.ok) {
          setProfile(result.value)
          setRoles(tokens.roles)
        }
      },
      logout: async () => {
        await apiLogout()
        showSignedOut()
      },
    }
  }, [status, profile, roles, showSignedOut])

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

/** The signed-in person. Use inside {@link SessionProvider}. */
// eslint-disable-next-line react-refresh/only-export-components
export function useSession(): SessionState {
  const state = useContext(SessionContext)
  if (!state) throw new Error('useSession must be used inside <SessionProvider>.')
  return state
}
