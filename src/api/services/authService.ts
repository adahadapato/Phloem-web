/**
 * Signing in and out: /api/auth. Same job as the app's AuthService.
 * After a successful sign-in it keeps the tokens and loads the profile, so the caller (SessionContext) gets the
 * person in one step. The site shows people only what SessionContext holds.
 */
import { ApiError, failure, success, type ApiResult } from '../apiError'
import { get, post } from '../client'
import type {
  CompleteTwoFactorLoginCommand,
  ConfirmEmailCommand,
  LoginCommand,
  RegisterCommand,
  ResetPasswordCommand,
} from '../contracts/commands'
import type { AuthTokensDto, ExternalProvidersDto, ProfileDto } from '../contracts/dtos'
import { tokens } from '../tokens'
import { getProfile } from './accountService'

/** A sign-in either finishes (the profile) or needs the 2FA code first (the challenge token). */
export type SignInOutcome =
  | { kind: 'signedIn'; profile: ProfileDto }
  | { kind: 'twoFactorRequired'; challengeToken: string }

// ───────────────────────────── 1. Sign in ─────────────────────────────

/** Email + password. `remember` keeps the person signed in after the browser closes. */
export async function login(command: LoginCommand, remember: boolean): Promise<ApiResult<SignInOutcome>> {
  const answer = await post<AuthTokensDto>('api/auth/login', { ...command, email: command.email.trim() })
  return answer.ok ? finishSignIn(answer.value, remember) : answer
}

/** Second step of a two-factor sign-in (a 6-digit code, or a recovery code). */
export async function completeTwoFactor(command: CompleteTwoFactorLoginCommand,
                                        remember: boolean): Promise<ApiResult<SignInOutcome>> {
  const answer = await post<AuthTokensDto>('api/auth/login/two-factor', command)
  return answer.ok ? finishSignIn(answer.value, remember) : answer
}

/** Creates the account and signs straight in. */
export async function register(command: RegisterCommand): Promise<ApiResult<SignInOutcome>> {
  const answer = await post<AuthTokensDto>('api/auth/register', command)
  return answer.ok ? finishSignIn(answer.value, true) : answer
}

// ───────────────────────────── 2. Session ─────────────────────────────

/** Site start: if tokens were kept, loads the profile (the client renews the tokens on the way if needed). */
export async function restoreSession(): Promise<ProfileDto | null> {
  if (!tokens.canRefresh) return null
  const profile = await getProfile()
  if (profile.ok) return profile.value
  if (profile.error.isUnauthorized) tokens.clear()   // no connection: keep the tokens, try again next visit
  return null
}

/** Signs out here and cancels the refresh token on the API (best effort: signed out here either way). */
export async function logout(): Promise<void> {
  const refreshToken = tokens.refreshToken
  tokens.clear()
  if (refreshToken) await post<void>('api/auth/logout', { refreshToken })
}

// ───────────────────────────── 3. Email and password ─────────────────────────────

/** Emails a reset link. The API answers the same whether or not the account exists. */
export const forgotPassword = (email: string) => post<void>('api/auth/forgot-password', { email: email.trim() })

/** Chooses a new password with the values from the emailed link. */
export const resetPassword = (command: ResetPasswordCommand) => post<void>('api/auth/reset-password', command)

/** Confirms the email address with the values from the emailed link. */
export const confirmEmail = (command: ConfirmEmailCommand) => post<void>('api/auth/confirm-email', command)

// ───────────────────────────── 4. Outside sign-in ─────────────────────────────

/** True when the API has "Continue with Google" switched on. False when off or unreachable. */
export async function isGoogleAvailable(signal?: AbortSignal): Promise<boolean> {
  const providers = await get<ExternalProvidersDto>('api/auth/external/providers', signal)
  return providers.ok && providers.value.google
}

// ───────────────────────────── Helpers ─────────────────────────────

/** Keeps the tokens, then loads the profile. */
async function finishSignIn(answer: AuthTokensDto, remember: boolean): Promise<ApiResult<SignInOutcome>> {
  if (answer.requiresTwoFactor) {
    return answer.twoFactorChallengeToken
      ? success({ kind: 'twoFactorRequired', challengeToken: answer.twoFactorChallengeToken })
      : failure(ApiError.unexpected(200))
  }

  tokens.save(answer, remember)
  const profile = await getProfile()
  if (!profile.ok) {
    tokens.clear()
    return profile
  }

  return success({ kind: 'signedIn', profile: profile.value })
}
