/**
 * What the website sends to the API (request bodies). Same shapes as the API's commands (JSON, camelCase).
 * Grows feature by feature; keep in step with the app's Services/Api/Contracts/Commands.
 */
import type { Country, DeliveryWindow } from './enums'

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

/** PUT /api/me */
export interface UpdateProfileCommand {
  firstName: string
  lastName: string
  country: Country
  phoneNumber: string | null
}

/** PUT /api/me/personal-details (both needed to open a shop or send a parcel). */
export interface UpdatePersonalDetailsCommand {
  /** "yyyy-MM-dd" */
  dateOfBirth: string
  homeAddress: HomeAddressInput
}

/** POST /api/me/addresses */
export interface AddAddressCommand {
  label: string
  fullAddress: string
  country: Country
  makeDefault: boolean
}

/** PUT /api/me/addresses/{id} */
export interface AddressRequest {
  label: string
  fullAddress: string
  country: Country
}

/** PUT /api/me/notifications */
export interface UpdateNotificationsCommand {
  orderUpdates: boolean
  shipmentUpdates: boolean
  offers: boolean
  newDishes: boolean
  shopOrders: boolean
}

/** PUT /api/me/password (signs out every device afterwards). */
export interface ChangePasswordCommand {
  currentPassword: string
  newPassword: string
  confirmNewPassword: string
}

// ───────────────────────────── Checkout ─────────────────────────────

/** One dish and how many (the API looks up every price itself). */
export interface BasketItemDto {
  dishId: string
  quantity: number
}

/** POST /api/orders/basket/check (works signed out too). */
export interface CheckBasketQuery {
  items: BasketItemDto[]
  deliveryWindow: DeliveryWindow
}

/** POST /api/orders: one UNPAID order per shop. The address must be a saved one, in the shops' country. */
export interface PlaceOrderCommand {
  items: BasketItemDto[]
  deliveryAddressId: string
  deliveryWindow: DeliveryWindow
}
