/**
 * What the website sends to the API (request bodies). Same shapes as the API's commands (JSON, camelCase).
 * Grows feature by feature; keep in step with the app's Services/Api/Contracts/Commands.
 */
import type { Country } from './enums'

/** POST /api/auth/login */
export interface LoginCommand {
  email: string
  password: string
}

/** POST /api/auth/login/two-factor */
export interface CompleteTwoFactorLoginCommand {
  challengeToken: string
  code: string
  isRecoveryCode: boolean
}

/** Optional home address at sign-up (all or nothing). */
export interface HomeAddressInput {
  line1: string
  line2: string | null
  city: string
  regionOrPostcode: string
  country: Country
}

/** POST /api/auth/register */
export interface RegisterCommand {
  firstName: string
  lastName: string
  email: string
  phoneNumber: string | null
  country: Country
  /** "yyyy-MM-dd", or null. */
  dateOfBirth: string | null
  homeAddress: HomeAddressInput | null
  password: string
  agreedToTerms: boolean
}

/** POST /api/auth/refresh */
export interface RefreshTokenCommand {
  refreshToken: string
}

/** POST /api/auth/logout */
export interface RevokeTokenCommand {
  refreshToken: string
}

/** POST /api/auth/forgot-password */
export interface ForgotPasswordCommand {
  email: string
}

/** POST /api/auth/reset-password (values from the emailed link + the new password, typed twice). */
export interface ResetPasswordCommand {
  email: string
  token: string
  newPassword: string
  confirmNewPassword: string
}

/** POST /api/auth/confirm-email (values from the emailed link). */
export interface ConfirmEmailCommand {
  userId: string
  token: string
}
