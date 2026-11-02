/**
 * Who is signed in, for every page: the profile from the API, and the roles, staff permissions and countries the
 * backend sent with the sign-in. Same job as the app's SessionService.
 *
 * Permissions only decide which menus and pages are SHOWN; the API checks every call itself.
 *
 * - On start, a kept sign-in is restored (status "loading" until then, so protected pages don't flash "Log in").
 * - When the sign-in runs out and can't be renewed, the person is shown as signed out.
 */
import { useQueryClient } from '@tanstack/react-query'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { ProfileDto } from '../api/contracts/dtos'
import type { Country } from '../api/contracts/enums'
import { Permissions } from '../api/contracts/permissions'
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
  /** True when the person holds this permission, or ANY of these (always true for owners). */
  hasPermission: (permission: string | readonly string[]) => boolean
  /** True for owners and anyone with at least one staff permission (opens the admin area). */
  isStaff: boolean
  /** True for owners and staff given every country. */
  coversAllCountries: boolean
  /** The countries the person covers as staff (empty when `coversAllCountries`). */
  staffCountries: Country[]
  /** True when the person covers this country as staff. */
  coversCountry: (country: Country) => boolean
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
  const [permissions, setPermissions] = useState<string[]>(tokens.permissions)
  const [countries, setCountries] = useState<string[]>(tokens.countries)

  /** Reads what the latest sign-in or renewal said. */
  const readAccess = useCallback(() => {
    setRoles(tokens.roles)
    setPermissions(tokens.permissions)
    setCountries(tokens.countries)
  }, [])

  const showSignedOut = useCallback(() => {
    setProfile(null)
    setRoles([])
    setPermissions([])
    setCountries([])
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
        readAccess()
        setStatus('signedIn')
      } else {
        setStatus('signedOut')
      }
    })
    return () => {
      active = false
    }
  }, [readAccess])

  // The sign-in ran out and couldn't be renewed
  useEffect(() => tokens.onExpired(showSignedOut), [showSignedOut])

  const value = useMemo<SessionState>(() => {
    const isInRole = (role: string) =>
      status === 'signedIn' && roles.some((r) => r.toLowerCase() === role.toLowerCase())
    const isAdmin = isInRole(Roles.Admin)

    // Owners hold everything (also when an older kept sign-in has no permission list yet)
    const all = isAdmin || permissions.includes(Permissions.Everything)
    const hasPermission = (wanted: string | readonly string[]) =>
      status === 'signedIn' && (all || (typeof wanted === 'string' ? [wanted] : wanted).some((p) => permissions.includes(p)))
    const coversAllCountries = isAdmin || countries.includes('*')
    const staffCountries = coversAllCountries ? [] : (countries as Country[])

    return {
      status,
      profile,
      isAdmin,
      isSeller: isInRole(Roles.Seller),
      isInRole,
      hasPermission,
      isStaff: status === 'signedIn' && (all || permissions.length > 0),
      coversAllCountries,
      staffCountries,
      coversCountry: (country) => coversAllCountries || staffCountries.includes(country),
      signedIn: (signedInProfile) => {
        setProfile(signedInProfile)
        readAccess()
        setStatus('signedIn')
      },
      refreshProfile: async () => {
        const result = await getProfile()
        if (result.ok) {
          setProfile(result.value)
          readAccess()
        }
      },
      logout: async () => {
        await apiLogout()
        showSignedOut()
      },
    }
  }, [status, profile, roles, permissions, countries, readAccess, showSignedOut])

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

/** The signed-in person. Use inside {@link SessionProvider}. */
// eslint-disable-next-line react-refresh/only-export-components
export function useSession(): SessionState {
  const state = useContext(SessionContext)
  if (!state) throw new Error('useSession must be used inside <SessionProvider>.')
  return state
}
