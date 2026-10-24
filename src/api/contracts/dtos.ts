/**
 * What the API sends back. Same shapes as the API's DTOs (JSON, camelCase). Dates arrive as ISO text.
 * Grows feature by feature; keep in step with the app's Services/Api/Contracts/Dtos.
 */
import type { Country, Currency, DishCategory } from './enums'

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

/** One page of a long list. `totalPages`, `hasPrevious` and `hasNext` are worked out by the API. */
export interface PagedResult<T> {
  items: T[]
  totalCount: number
  page: number
  pageSize: number
  totalPages: number
  hasPrevious: boolean
  hasNext: boolean
}

/** A dish in a list (GET /api/dishes). `imageUrl` is the 400×300 thumbnail. */
export interface DishCardDto {
  id: string
  name: string
  category: DishCategory
  description: string | null
  price: number
  currency: Currency
  country: Country
  rating: number
  ratingCount: number
  imageUrl: string | null
  /** The shop's Id (the API says "vendor" here). */
  vendorId: string
  vendorName: string
  isVerifiedShop: boolean
}

/** A shop in a list (GET /api/shops, /api/shops/top). */
export interface ShopListItemDto {
  id: string
  name: string
  country: Country
  isVerified: boolean
  rating: number
  ratingCount: number
  dishCount: number
  logoUrl: string | null
  coverPhotoUrl: string | null
}

/** A shop's page header (GET /api/shops/{id}); its menu is GET /api/dishes?shopId=…. */
export interface ShopDetailsDto {
  id: string
  name: string
  country: Country
  currency: Currency
  isVerified: boolean
  rating: number
  ratingCount: number
  dishCount: number
  /** The shop's own delivery fee; null = the country's minimum. */
  deliveryFee: number | null
  logoUrl: string | null
  coverPhotoUrl: string | null
  /** When the shop was approved (ISO), or null. */
  onPhloemSince: string | null
}
