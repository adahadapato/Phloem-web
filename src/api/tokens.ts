/**
 * Keeps the sign-in tokens. Same job as the app's TokenStore.
 *
 * Where they live:
 * - "Remember me" ON  → localStorage: still signed in after the browser closes.
 * - "Remember me" OFF → sessionStorage: survives a page refresh, gone when the tab closes.
 *
 * Security note: anything in browser storage can be read by a script running on the page, so the site must never
 * load untrusted scripts. A safer later step is for the API to keep the refresh token in an http-only cookie.
 */
import type { AuthTokensDto } from './contracts/dtos'

/** Renew this long before the access token runs out. */
const RENEW_EARLY_MS = 60_000

const STORAGE_KEY = 'phloem.session'

/** What is kept between page loads. */
interface StoredTokens {
  accessToken: string
  accessTokenExpiresAt: number
  refreshToken: string
  roles: string[]
}

let current: StoredTokens | null = null
let remember = false
const expiredListeners = new Set<() => void>()

/** Reads the stored sign-in, if any (called once when the site starts). */
function load(): void {
  try {
    for (const [storage, isRemembered] of [[localStorage, true], [sessionStorage, false]] as const) {
      const json = storage.getItem(STORAGE_KEY)
      if (!json) continue
      try {
        current = JSON.parse(json) as StoredTokens
        remember = isRemembered
        return
      } catch {
        storage.removeItem(STORAGE_KEY)   // damaged: forget it
      }
    }
  } catch {
    // Storage blocked by the browser: start signed out
  }
}

function persist(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
    sessionStorage.removeItem(STORAGE_KEY)
    if (current) (remember ? localStorage : sessionStorage).setItem(STORAGE_KEY, JSON.stringify(current))
  } catch {
    // Storage blocked (private mode): the sign-in still works until the page closes
  }
}

load()

export const tokens = {
  /** The current access token, or null when signed out. */
  get accessToken(): string | null {
    return current?.accessToken ?? null
  },

  /** The current refresh token, or null when signed out. */
  get refreshToken(): string | null {
    return current?.refreshToken ?? null
  },

  /** The roles from the last sign-in or renewal. */
  get roles(): string[] {
    return current?.roles ?? []
  },

  /** True when a refresh token exists (the sign-in can be renewed). */
  get canRefresh(): boolean {
    return !!current?.refreshToken
  },

  /** True when the access token runs out within a minute (or already has). */
  get accessTokenExpiresSoon(): boolean {
    return !current || current.accessTokenExpiresAt - Date.now() < RENEW_EARLY_MS
  },

  /** True when the tokens are kept after the browser closes. */
  get remember(): boolean {
    return remember
  },

  /**
   * Keeps new tokens (after sign-in or renewal).
   * @param dto The API's answer (must contain tokens).
   * @param rememberMe Keep them after the browser closes.
   */
  save(dto: AuthTokensDto, rememberMe: boolean): void {
    if (!dto.accessToken || !dto.refreshToken) return
    current = {
      accessToken: dto.accessToken,
      accessTokenExpiresAt: dto.expiresAt ? Date.parse(dto.expiresAt) : Date.now(),
      refreshToken: dto.refreshToken,
      roles: dto.roles ?? [],
    }
    remember = rememberMe
    persist()
  },

  /** Forgets the tokens (sign-out). */
  clear(): void {
    current = null
    persist()
  },

  /** The sign-in ran out and couldn't be renewed: forget it and tell the site (it shows people as signed out). */
  expire(): void {
    tokens.clear()
    expiredListeners.forEach((listener) => listener())
  },

  /** Listens for {@link expire}. Returns a function that stops listening. */
  onExpired(listener: () => void): () => void {
    expiredListeners.add(listener)
    return () => expiredListeners.delete(listener)
  },
}
