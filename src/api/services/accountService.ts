/**
 * The signed-in person's own account: /api/me. Same as the app's AccountService.
 * Every call needs a sign-in (the client adds the token).
 */
import type { ApiResult } from '../apiError'
import { del, get, post, put, upload } from '../client'
import type {
  AddAddressCommand,
  AddressRequest,
  ChangePasswordCommand,
  UpdateNotificationsCommand,
  UpdatePersonalDetailsCommand,
  UpdateProfileCommand,
} from '../contracts/commands'
import type { ProfileDto, TwoFactorSetupDto, TwoFactorStatusDto } from '../contracts/dtos'

// ───────────────────────────── Profile ─────────────────────────────

/** GET /api/me: the full profile (name, photo, country, addresses, notification switches). */
export const getProfile = (signal?: AbortSignal): Promise<ApiResult<ProfileDto>> =>
  get<ProfileDto>('api/me', signal)

/** PUT /api/me: name, country and phone. */
export const updateProfile = (command: UpdateProfileCommand) => put<void>('api/me', command)

/** PUT /api/me/personal-details: date of birth and home address. */
export const updatePersonalDetails = (command: UpdatePersonalDetailsCommand) =>
  put<void>('api/me/personal-details', command)

/** PUT /api/me/photo: a new profile photo (JPEG, PNG, WebP or HEIC, up to 5 MB). Returns its URL. */
export const uploadPhoto = (photo: File): Promise<ApiResult<string>> =>
  upload<string>('PUT', 'api/me/photo', 'photo', photo)

/** DELETE /api/me/photo */
export const removePhoto = () => del('api/me/photo')

/** PUT /api/me/notifications */
export const updateNotifications = (command: UpdateNotificationsCommand) => put<void>('api/me/notifications', command)

// ───────────────────────────── Delivery addresses ─────────────────────────────

/** POST /api/me/addresses: returns the new address's Id. */
export const addAddress = (command: AddAddressCommand): Promise<ApiResult<string>> =>
  post<string>('api/me/addresses', command)

/** PUT /api/me/addresses/{id} */
export const updateAddress = (addressId: string, body: AddressRequest) =>
  put<void>(`api/me/addresses/${encodeURIComponent(addressId)}`, body)

/** DELETE /api/me/addresses/{id} */
export const deleteAddress = (addressId: string) => del(`api/me/addresses/${encodeURIComponent(addressId)}`)

/** PUT /api/me/addresses/{id}/default */
export const makeDefaultAddress = (addressId: string) =>
  put<void>(`api/me/addresses/${encodeURIComponent(addressId)}/default`)

// ───────────────────────────── Security ─────────────────────────────

/** PUT /api/me/password: every device is signed out afterwards (this one too). */
export const changePassword = (command: ChangePasswordCommand) => put<void>('api/me/password', command)

/** GET /api/me/two-factor */
export const getTwoFactorStatus = (signal?: AbortSignal): Promise<ApiResult<TwoFactorStatusDto>> =>
  get<TwoFactorStatusDto>('api/me/two-factor', signal)

/** GET /api/me/two-factor/setup: the key and QR link for the authenticator app. */
export const getTwoFactorSetup = (signal?: AbortSignal): Promise<ApiResult<TwoFactorSetupDto>> =>
  get<TwoFactorSetupDto>('api/me/two-factor/setup', signal)

/** POST /api/me/two-factor/enable: turns it on with a code from the app; returns recovery codes (show once). */
export const enableTwoFactor = (code: string): Promise<ApiResult<string[]>> =>
  post<string[]>('api/me/two-factor/enable', { code })

/** POST /api/me/two-factor/disable (needs the password; not allowed for admins). */
export const disableTwoFactor = (password: string) => post<void>('api/me/two-factor/disable', { password })

/** POST /api/me/two-factor/recovery-codes: new codes (needs the password; the old ones stop working). */
export const regenerateRecoveryCodes = (password: string): Promise<ApiResult<string[]>> =>
  post<string[]>('api/me/two-factor/recovery-codes', { password })

/** POST /api/me/terms/accept: accept the Terms version shown (409 Terms.Outdated if a newer one was published). */
export const acceptTerms = (version: number) => post('api/me/terms/accept', { version })

/** POST /api/me/privacy/seen: "Got it" on the updated Privacy Policy notice. */
export const acknowledgePrivacy = (version: number) => post('api/me/privacy/seen', { version })
