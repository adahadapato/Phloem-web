/**
 * What the API sends back. Same shapes as the API's DTOs (JSON, camelCase). Dates arrive as ISO text.
 * Grows feature by feature; keep in step with the app's Services/Api/Contracts/Dtos.
 */
import type { Country, Currency, DeliveryWindow, DishCategory, OrderStatus } from './enums'

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

/** GET /api/me/two-factor: is two-step sign-in on, and how many recovery codes are left. */
export interface TwoFactorStatusDto {
  isEnabled: boolean
  recoveryCodesLeft: number
  /** True for admins: they can't switch it off. */
  isRequired: boolean
}

/** GET /api/me/two-factor/setup: what the authenticator app needs. */
export interface TwoFactorSetupDto {
  /** The key to type in by hand, if the QR code can't be scanned. */
  manualEntryKey: string
  /** The otpauth:// link the QR code holds. */
  authenticatorUri: string
}

// ───────────────────────────── Checkout ─────────────────────────────

/** One dish in the checked basket, at TODAY's price. */
export interface BasketLineDto {
  dishId: string
  dishName: string
  imageUrl: string | null
  quantity: number
  unitPrice: number
  /** 0 when the dish can't be ordered now. */
  lineTotal: number
  /** False: out of stock or no longer sold (the order would leave it out). */
  isAvailable: boolean
}

/** One shop of the checked basket (it becomes its own order). */
export interface BasketShopDto {
  vendorId: string
  shopName: string
  currency: Currency
  lines: BasketLineDto[]
  /** Available dishes only. */
  subtotal: number
  /** Null when this shop can't deliver at the picked time (see `deliveryProblem`). */
  deliveryFee: number | null
  /** Why there's no fee, ready to show (e.g. "… Please choose Tomorrow"). */
  deliveryProblem: string | null
  total: number | null
  /** The delivery times this shop takes right now. */
  openWindows: DeliveryWindow[]
  /** After this time (shop's local "HH:mm:ss"), same-day orders close. */
  orderCutoffTime: string
}

/** POST /api/orders/basket/check: today's prices, stock and delivery fees, per shop. Nothing is saved. */
export interface BasketCheckDto {
  shops: BasketShopDto[]
  /** Dishes that are no longer on Phloem. */
  missingDishIds: string[]
  /** True when every dish can be ordered and every shop delivers at the picked time. */
  canPlaceOrder: boolean
}

/** A delivery time offered in a country and what it adds to each order. */
export interface DeliveryWindowOptionDto {
  window: DeliveryWindow
  /** 0 = free. */
  extraCharge: number
  currency: Currency
}

/** One order made by Place order (one per shop). */
export interface PlacedOrderDto {
  orderNumber: string
  shopName: string
  total: number
  currency: Currency
}

/** "Pay": the amount at today's prices and the dishes dropped because they ran out. */
export interface OrderPaymentDto {
  orderNumber: string
  amountToPay: number
  currency: Currency
  removedDishes: string[]
}

// ───────────────────────────── My orders ─────────────────────────────

/** One row of My orders (GET /api/orders). */
export interface OrderSummaryDto {
  orderNumber: string
  shopName: string
  status: OrderStatus
  placedAt: string
  paidAt: string | null
  itemCount: number
  /** "2 × Jollof Rice, 1 × Kelewele". */
  itemsSummary: string
  imageUrl: string | null
  /** Unpaid orders: at TODAY's prices. */
  total: number
  currency: Currency
  /** Unpaid: a price changed since ordering. */
  hasPriceChanges: boolean
  /** Unpaid: dishes that ran out (they'd be dropped at payment). */
  outOfStockCount: number
  canCancel: boolean
  /** When it should arrive. */
  deliveryWindow: DeliveryWindow
  /** The address's name when ordered, e.g. "Home". */
  deliveryLabel: string
  /** The full address when ordered. */
  deliveryAddress: string
  deliveredAt: string | null
  cancelledAt: string | null
  /** The shop couldn't make it (it cancelled the order). */
  declinedByShop: boolean
  /** Paid, then cancelled: the payment is being refunded. */
  needsRefund: boolean
  /** The dishes (unpaid: at today's prices, with what changed or ran out). */
  lines: OrderLineDto[]
}

/** One dish of an order. */
export interface OrderLineDto {
  dishId: string
  dishName: string
  imageUrl: string | null
  quantity: number
  unitPrice: number
  /** Unpaid orders: the price when ordered (null when unchanged or paid). */
  priceWhenAdded: number | null
  priceChanged: boolean
  isOutOfStock: boolean
  lineTotal: number
}

/** GET /api/orders/{orderNumber}: the whole order. */
export interface OrderDetailsDto {
  orderNumber: string
  shopName: string
  customerName: string
  status: OrderStatus
  lines: OrderLineDto[]
  subtotal: number
  deliveryFee: number
  total: number
  currency: Currency
  deliveryWindow: DeliveryWindow
  /** The address's name when ordered, e.g. "Home". */
  deliveryLabel: string
  deliveryAddress: string
  placedAt: string
  paidAt: string | null
  deliveredAt: string | null
  cancelledAt: string | null
  canCancel: boolean
  /** Paid orders: seconds left to cancel (null otherwise). */
  cancelSecondsLeft: number | null
  /** Paid then cancelled: the payment will be refunded. */
  needsRefund: boolean
  viewedBySeller: boolean
  declinedByShop: boolean
  declineReason: string | null
}

/** GET /api/orders/{n}/buy-again: what can go back in the basket (today's dishes only). */
export interface BuyAgainDto {
  items: { dishId: string; quantity: number }[]
  /** Names of dishes no longer on sale. */
  unavailableDishes: string[]
}

/** A dish photo (dish page). */
export interface DishPhotoDto {
  id: string
  url: string
  thumbnailUrl: string | null
  altText: string
  displayOrder: number
  isPrimary: boolean
}

/** GET /api/dishes/{dishId}: one dish with its shop. */
export interface DishDetailsDto {
  id: string
  name: string
  category: DishCategory
  description: string | null
  price: number
  currency: Currency
  country: Country
  rating: number
  ratingCount: number
  canBeOrdered: boolean
  photos: DishPhotoDto[]
  shopId: string
  shopName: string
  isVerifiedShop: boolean
  shopLogoUrl: string | null
}
