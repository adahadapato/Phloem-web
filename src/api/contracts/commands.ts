/**
 * What the website sends to the API (request bodies). Same shapes as the API's commands (JSON, camelCase).
 * Grows feature by feature; keep in step with the app's Services/Api/Contracts/Commands.
 */
import type {
  CatalogGroup, ContactTopic, Country, DeliverySpeed, DeliveryWindow, DishCategory, ShipmentItemCategory,
} from './enums'

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
  /** Who receives the food; empty = me. */
  recipientName?: string | null
  /** Who the seller calls; empty = my phone. */
  phoneNumber?: string | null
}

/** PUT /api/me/addresses/{id} */
export interface AddressRequest {
  label: string
  fullAddress: string
  country: Country
  recipientName?: string | null
  phoneNumber?: string | null
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

// ───────────────────────────── Parcels ─────────────────────────────

/** POST /api/shipments/quote (no sign-in needed). */
export interface GetShipmentQuoteQuery {
  fromCountry: Country
  toCountry: Country
  speed: DeliverySpeed
  estimatedWeightKg: number
}

/** One item as the sender types it. */
export interface ShipmentItemInputDto {
  category: ShipmentItemCategory
  description: string
  quantity: number
  /** Value of ONE item, in the origin currency (for customs). */
  unitDeclaredValue: number
}

/** POST /api/shipments: book a parcel. The sender is the signed-in person. */
export interface BookShipmentCommand {
  fromCountry: Country
  toCountry: Country
  senderPhone: string
  recipientName: string
  recipientPhone: string
  recipientAddressLine: string
  recipientCity: string
  recipientRegionOrPostcode: string
  items: ShipmentItemInputDto[]
  speed: DeliverySpeed
  estimatedWeightKg: number
  confirmedNoProhibitedItems: boolean
  acceptedTerms: boolean
}

// ───────────────────────────── Seller ─────────────────────────────

/** POST /api/shops: open my shop (waits for approval). Blank email / phone = my account's. */
export interface OpenShopCommand {
  shopName: string
  businessEmail: string | null
  businessPhone: string | null
}

/** POST /api/shops/mine/dishes (and PUT …/{id} for changes). The name comes from the dish list. */
export interface DishCommand {
  dishCatalogId: string
  /** Optional extra after the name, e.g. "& Chicken" (40 characters at most). */
  detail: string | null
  price: number
  description: string | null
  isAvailable: boolean
}

/** POST /api/dish-catalog/suggestions: "Can't find your dish?" (an admin approves it). */
export interface SuggestDishNameCommand {
  name: string
  category: DishCategory
  group: CatalogGroup
}

/** PUT /api/shops/mine: shop name, business email and phone (blank = my account's). */
export interface UpdateShopDetailsCommand {
  shopName: string
  businessEmail: string | null
  businessPhone: string | null
}

/** POST /api/contact/messages: the Contact us form (signed in or not). */
export interface SendContactMessageCommand {
  name: string
  email: string
  topic: ContactTopic
  /** Order or tracking number, if any. */
  reference: string | null
  message: string
  /** Spam trap: a hidden field people never fill in. */
  website: string | null
}
