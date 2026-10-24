/**
 * What the API sends back. Same shapes as the API's DTOs (JSON, camelCase). Dates arrive as ISO text.
 * Grows feature by feature; keep in step with the app's Services/Api/Contracts/Dtos.
 */
import type { Country, Currency } from './enums'

/** Answer of login, register, two-factor, refresh and Google exchange. */
export interface AuthTokensDto {
  accessToken: string | null
  refreshToken: string | null
  /** When the access token runs out (ISO, UTC). */
  expiresAt: string | null
  refreshTokenExpiresAt: string | null
  userId: string | null
  roles: string[] | null
  fullName: string | null
  email: string | null
  /** True: no tokens yet; ask for the 2FA code and send it with `twoFactorChallengeToken`. */
  requiresTwoFactor: boolean
  twoFactorChallengeToken: string | null
}

/** One country from GET /api/countries. Send `country` back to the API; show the rest. */
export interface CountryDto {
  country: Country
  name: string
  isoCode: string
  flag: string
  currency: Currency
  currencySymbol: string
  canSendParcels: boolean
  sendsParcelsTo: Country[]
}

/** A saved delivery address. */
export interface AddressDto {
  id: string
  label: string
  fullAddress: string
  country: Country
  isDefault: boolean
}

/** The home address on the profile (needed to open a shop or send a parcel). */
export interface HomeAddressDto {
  line1: string
  line2: string | null
  city: string
  regionOrPostcode: string
  country: Country
  singleLine: string
}

/** GET /api/me: the signed-in person. */
export interface ProfileDto {
  id: string
  firstName: string
  lastName: string
  fullName: string
  email: string
  emailConfirmed: boolean
  phoneNumber: string | null
  country: Country
  currency: Currency
  photoUrl: string | null
  memberSince: string
  hasShop: boolean
  dateOfBirth: string | null
  homeAddress: HomeAddressDto | null
  hasPersonalDetails: boolean
  notifyOrderUpdates: boolean
  notifyShipmentUpdates: boolean
  notifyOffers: boolean
  notifyNewDishes: boolean
  notifyShopOrders: boolean
  addresses: AddressDto[]
}

/** GET /api/auth/external/providers: which "Continue with …" buttons to show. */
export interface ExternalProvidersDto {
  google: boolean
}
