/**
 * What the API sends back. Same shapes as the API's DTOs (JSON, camelCase). Dates arrive as ISO text.
 * Grows feature by feature; keep in step with the app's Services/Api/Contracts/Dtos.
 */
import type {
  AiCallOutcome, AiProvider, CatalogGroup, ContentReviewStatus, ModerationKind, ModerationState, ModerationVerdict, ContactMessageStatus, ContactTopic, Country, Currency, DeliverySpeed, DeliveryWindow,
  DeliveryKind, DishCategory, DocumentStatus, HandoverMethod, LegalDocumentType, OrderActorKind, OrderEventKind, OrderStatus, SeoPageKind, SeoPageStatus, ParcelItemRuleKind,
  PendingChangeKind, PendingChangeStatus, ShipmentItemCategory, ShipmentStatus, StaffAction, VendorDocumentType,
  VendorStatus,
} from './enums'

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
  /**
   * Staff permissions the BACKEND gave this person ("*" = every permission, the owners); empty or missing for
   * everyone else. Only used to show or hide menus: the API checks every call itself.
   */
  permissions?: string[] | null
  /** The countries they cover as staff ("*" = every country), e.g. ["Ghana"]. */
  countries?: string[] | null
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
  /** Who receives the food; null = the account holder (show their name). Missing on an older API. */
  recipientName?: string | null
  /** Who the seller calls, e.g. "+447700900123"; null = the account holder's phone. */
  phoneNumber?: string | null
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
  /** Where I stand with the Terms and the Privacy Policy (GET /api/me). */
  terms?: TermsStatusDto | null
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

/** A suggested dish: the usual card, plus the short reason shown on it ("Often ordered with Jollof Rice"). */
export interface SuggestedDishDto {
  dish: DishCardDto
  reason: string
}

/** GET /api/me/suggestions: Home's "Order again" and "For you" rows for a signed-in customer. */
export interface SuggestionsDto {
  /** Dishes they've bought that can be ordered now in this country, most recent first. */
  orderAgain: DishCardDto[]
  /** New dishes picked from what they buy, each with its reason. */
  forYou: SuggestedDishDto[]
  /** False when they have no orders yet: forYou is then just "Popular in …". */
  isPersonal: boolean
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
  /** The dishes (unpaid: at today's prices, with what changed or ran out). Missing from APIs before 25 Oct 2026. */
  lines?: OrderLineDto[]
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
  /** Who receives it (the address's name, else the customer's). Missing on an older API. */
  deliveryRecipientName?: string
  /** Who the seller calls (the address's phone, else the customer's); null if neither. */
  deliveryPhone?: string | null
  /** Who is delivering it (or delivered it); null until it's sent out. */
  courierName?: string | null
  /** The courier's photo and handover details; null until delivered. */
  deliveryProof?: DeliveryProofDto | null
  /** The viewer is this order's courier and it's out for delivery (a seller delivering it themselves). */
  canMarkDelivered?: boolean
  /** Every step so far, oldest first, with who did it ("Kofi (courier)"). Missing on an older API. */
  timeline?: OrderEventDto[]
}

/** One step of an order's timeline. */
export interface OrderEventDto {
  kind: OrderEventKind
  statusAfter: OrderStatus
  at: string
  actorKind: OrderActorKind
  /** Staff see full names; customers and sellers see first name and role, e.g. "Ama (Phloem)". */
  actorName: string
  /** "Customer", "Shop", "Courier", "Phloem staff" or "Phloem". */
  actorRole: string
  /** Staff only: the account that did it. */
  actorId: string | null
  note: string | null
  /** Rebuilt from an older order's saved dates (times may be approximate, names may be missing). */
  isRebuilt: boolean
}

/** GET /api/admin/orders: one row. */
export interface AdminOrderSummaryDto {
  orderNumber: string
  shopId: string
  shopName: string
  customerName: string
  country: Country
  status: OrderStatus
  total: number
  currency: Currency
  itemCount: number
  placedAt: string
  courierName: string | null
  needsRefund: boolean
}

/** GET /api/admin/orders/{n}: everything about one order (read-only; the view is in the audit log). */
export interface AdminOrderDetailsDto {
  orderNumber: string
  status: OrderStatus
  country: Country
  shopId: string
  shopName: string
  customerId: string
  customerName: string
  customerEmail: string | null
  customerPhone: string | null
  lines: OrderLineDto[]
  subtotal: number
  deliveryFee: number
  total: number
  currency: Currency
  commissionAmount: number | null
  sellerEarnings: number | null
  deliveryWindow: DeliveryWindow
  deliveryLabel: string
  deliveryAddress: string
  deliveryRecipientName: string
  deliveryPhone: string | null
  placedAt: string
  paidAt: string | null
  paymentReference: string | null
  deliveredAt: string | null
  cancelledAt: string | null
  needsRefund: boolean
  declinedByShop: boolean
  declineReason: string | null
  courierId: string | null
  courierName: string | null
  deliveryProof: DeliveryProofDto | null
  timeline: OrderEventDto[]
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

// ───────────────────────────── Parcels ─────────────────────────────

/** One speed on a route: "Express · GH₵80 + GH₵45/kg · usually 3–5 days". */
export interface ShipmentSpeedOptionDto {
  speed: DeliverySpeed
  baseCharge: number
  /** Per chargeable kg (the weight is rounded up to the next 0.5 kg). */
  pricePerKg: number
  minTransitDays: number
  maxTransitDays: number
}

/** GET /api/shipments/routes: where parcels can go (switched-on routes), with the drop-off hub and speeds. */
export interface ShipmentRouteOptionDto {
  fromCountry: Country
  toCountry: Country
  /** The origin's currency (every price on the route). */
  currency: Currency
  dropOffAddress: string
  dropOffHours: string
  speeds: ShipmentSpeedOptionDto[]
}

/** POST /api/shipments/quote: the price for an estimated weight (the final price is set when weighed). */
export interface ShipmentQuoteDto {
  speed: DeliverySpeed
  estimatedWeightKg: number
  chargeableWeightKg: number
  estimatedPrice: number
  currency: Currency
  minTransitDays: number
  maxTransitDays: number
}

/** POST /api/shipments: the new tracking number and where to drop the parcel off. */
export interface BookedShipmentDto {
  trackingNumber: string
  estimatedPrice: number
  currency: Currency
  dropOffAddress: string
  dropOffHours: string
}

/** One step of a parcel's journey. `note` is always null in public tracking. */
export interface ShipmentEventDto {
  status: ShipmentStatus
  occurredAt: string
  note: string | null
}

/** GET /api/track/{n}: public tracking (no names, addresses, items or prices). */
export interface PublicTrackingDto {
  trackingNumber: string
  fromCountry: Country
  toCountry: Country
  speed: DeliverySpeed
  status: ShipmentStatus
  /** "yyyy-MM-dd"; null until it's in transit. */
  estimatedArrivalFrom: string | null
  estimatedArrivalTo: string | null
  /** Oldest first. */
  timeline: ShipmentEventDto[]
}

/** One row of My shipments. */
export interface ShipmentSummaryDto {
  trackingNumber: string
  fromCountry: Country
  toCountry: Country
  recipientName: string
  status: ShipmentStatus
  speed: DeliverySpeed
  itemCount: number
  /** Final once weighed, otherwise the estimate. */
  price: number
  isPriceFinal: boolean
  currency: Currency
  bookedAt: string
  /** Weighed and waiting for payment. */
  canPay: boolean
  canCancel: boolean
}

/** One declared item. */
export interface ShipmentItemDto {
  category: ShipmentItemCategory
  description: string
  quantity: number
  unitDeclaredValue: number
  totalDeclaredValue: number
}

/** GET /api/shipments/{n}: the sender's full view of a parcel. */
export interface ShipmentDetailsDto {
  trackingNumber: string
  fromCountry: Country
  toCountry: Country
  status: ShipmentStatus
  speed: DeliverySpeed
  senderName: string
  senderPhone: string
  recipientName: string
  recipientPhone: string
  recipientAddressLine: string
  recipientCity: string
  recipientRegionOrPostcode: string
  items: ShipmentItemDto[]
  totalDeclaredValue: number
  estimatedWeightKg: number
  weighedWeightKg: number | null
  estimatedPrice: number
  finalPrice: number | null
  currency: Currency
  dropOffAddress: string | null
  dropOffHours: string | null
  estimatedArrivalFrom: string | null
  estimatedArrivalTo: string | null
  deliveredAt: string | null
  /** Oldest first, with notes. */
  timeline: ShipmentEventDto[]
  canCancel: boolean
  canPay: boolean
  /** Paid, then cancelled. */
  needsRefund: boolean
  /** Who is delivering it (or delivered it); null until it's out for delivery. */
  courierName?: string | null
  /** The courier's photo and handover details; null until delivered. */
  deliveryProof?: DeliveryProofDto | null
}

// ───────────────────────────── Seller ─────────────────────────────

/** One of my shop's documents (the file itself is private: admins only). */
export interface MyShopDocumentDto {
  id: string
  type: VendorDocumentType
  status: DocumentStatus
  originalFileName: string
  rejectionReason: string | null
  expiresAt: string | null
  isExpired: boolean
  uploadedAt: string
}

/** GET /api/shops/mine: the signed-in seller's own shop (dashboard header, shop settings). */
export interface MyShopDto {
  id: string
  name: string
  businessEmail: string
  businessPhone: string | null
  country: Country
  currency: Currency
  status: VendorStatus
  /** Why an admin rejected it (the seller can fix it). */
  rejectionReason: string | null
  /** Approved and visible to buyers. */
  isLive: boolean
  /** Has the ✓ badge. */
  isVerified: boolean
  logoUrl: string | null
  coverPhotoUrl: string | null
  /** Null = the country's minimum. */
  deliveryFee: number | null
  rating: number
  ratingCount: number
  /** Earnings from delivered orders, not yet withdrawn. */
  balance: number
  openedAt: string
  documents: MyShopDocumentDto[]
  /** Required documents not accepted yet (the to-do list for the ✓ badge). */
  missingDocuments: VendorDocumentType[]
  /** "HH:mm:ss", shop's local time: after it, only Tomorrow. */
  orderCutoffTime: string
}

/** One row of Shop orders (sellers never see unpaid orders). */
export interface ShopOrderSummaryDto {
  orderNumber: string
  customerName: string
  status: OrderStatus
  paidAt: string | null
  itemCount: number
  /** "Jollof Rice ×2, Kelewele ×1" */
  itemsSummary: string
  total: number
  currency: Currency
  deliveryWindow: DeliveryWindow
  deliveryLabel: string
  deliveryAddress: string
  /** Who receives it (the address's name, else the customer's). Missing on an older API. */
  deliveryRecipientName?: string
  /** Who to call (the address's phone, else the customer's); null if neither. */
  deliveryPhone?: string | null
  /** Who is delivering it; null until it's sent out. */
  courierName?: string | null
  /** The seller is delivering it themselves (they mark it delivered, with a photo). */
  deliveringMyself?: boolean
}

/** One bar of the weekly sales chart. */
export interface DailySalesDto {
  /** "yyyy-MM-dd" (UTC). */
  date: string
  orders: number
}

/** GET /api/shops/mine/orders/stats: dashboard tiles and the weekly chart. */
export interface ShopOrderStatsDto {
  newOrders: number
  preparing: number
  outForDelivery: number
  delivered: number
  totalOrders: number
  /** The last 7 days, oldest first. */
  weeklySales: DailySalesDto[]
}

/** One of my dishes, with the price range allowed in my country. */
export interface MyDishDto {
  id: string
  dishCatalogId: string
  catalogName: string
  detail: string | null
  name: string
  category: DishCategory
  price: number
  currency: Currency
  allowedMinPrice: number | null
  allowedMaxPrice: number | null
  /** The range changed and the price is now outside it: hidden from buyers until updated. */
  needsPriceUpdate: boolean
  description: string | null
  isAvailable: boolean
  rating: number
  ratingCount: number
  photos: DishPhotoDto[]
  /** Whether the wording passed the check: buyers only see Approved dishes. Missing on an older API. */
  reviewStatus?: ContentReviewStatus
  /** Why it isn't allowed, when Rejected. */
  reviewNote?: string | null
}

/** GET /api/shops/mine/dishes */
export interface MyDishesDto {
  dishes: MyDishDto[]
  needsPriceUpdateCount: number
}

/** GET /api/dish-catalog: one name in the seller's dish picker, with the price range in their country. */
export interface DishCatalogItemDto {
  id: string
  name: string
  category: DishCategory
  group: CatalogGroup
  /** False: no price range in this country yet, so it can't be sold yet. */
  hasPriceRange: boolean
  minPrice: number | null
  maxPrice: number | null
  currency: Currency | null
}

/** GET /api/shops/mine/delivery-fee: my fee and the range allowed in my country. */
export interface MyDeliveryFeeDto {
  currentFee: number
  /** No fee set: the country minimum is used. */
  usesCountryMinimum: boolean
  minAllowed: number
  maxAllowed: number
  currency: Currency
}

/** GET /api/legal/{type}: the current Terms or Privacy Policy. */
export interface LegalDocumentDto {
  type: LegalDocumentType
  version: number
  title: string
  /** Markdown; headings may end with {#anchor} so links can open a section. */
  content: string
  /** Temporary wording: show a "Draft" note. */
  isDraft: boolean
  publishedAt: string
}

/** GET /api/parcel-rules: one line of the "what can be sent" list (the list comes in display order). */
export interface ParcelItemRuleDto {
  id: string
  kind: ParcelItemRuleKind
  /** e.g. "Fresh or frozen meat and fish". */
  name: string
  /** The condition (Restricted) or a short note; null when there's nothing to add. */
  detail: string | null
  sortOrder: number
}

// ───────────────────────────── Admin ─────────────────────────────

/** GET /api/admin/shops/stats: shops per status (closed shops aren't counted). */
export interface AdminShopStatsDto {
  pendingApproval: number
  approved: number
  rejected: number
  blocked: number
  total: number
}

/** One shop on Admin → Shops. */
export interface AdminShopDto {
  id: string
  name: string
  ownerName: string
  businessEmail: string
  businessPhone: string | null
  country: Country
  status: VendorStatus
  rejectionReason: string | null
  isVerified: boolean
  rating: number
  ratingCount: number
  openedAt: string
  logoUrl: string | null
  isOwnerSuspended: boolean
}

/** One document a shop uploaded (the file itself is private: ask for a 10-minute link to open it). */
export interface AdminShopDocumentDto {
  id: string
  type: VendorDocumentType
  status: DocumentStatus
  originalFileName: string
  contentType: string
  fileSizeBytes: number
  rejectionReason: string | null
  expiresAt: string | null
  isExpired: boolean
  uploadedAt: string
  reviewedAt: string | null
}

/** GET /api/admin/shops/{id}: one shop with its pictures, documents and what's missing for the ✓ badge. */
export interface AdminShopDetailsDto {
  shop: AdminShopDto
  logoUrl: string | null
  coverPhotoUrl: string | null
  documents: AdminShopDocumentDto[]
  missingDocuments: VendorDocumentType[]
  /** The AI's check of the shop's name; null until checked. */
  nameCheck?: ModerationAdviceDto | null
}

/** One person on Admin → Users: who they are, their roles and shop, and any suspension. */
export interface AdminUserDto {
  id: string
  fullName: string
  email: string
  phoneNumber: string | null
  country: Country
  roles: string[]
  memberSince: string
  shopName: string | null
  isSuspended: boolean
  /** When the suspension ends; null = until further notice (or not suspended). */
  suspendedUntil: string | null
  suspensionReason: string | null
  /** False for admins and for yourself: no Suspend button. */
  canBeSuspended: boolean
  photoUrl: string | null
  /** The admin looking at the list (their own Admin role can't be taken away). Missing on an older API. */
  isYou?: boolean
  /** The highest Terms version they accepted; null = none recorded. */
  acceptedTermsVersion?: number | null
  /** When they first accepted that version. */
  acceptedTermsAt?: string | null
}

/** What suspending someone did. */
export interface UserSuspendedDto {
  shopSuspended: boolean
  cancelledShopOrders: number
  ordersToRefund: number
}

/** One allowed price range (inclusive) for a dish name in one country. */
export interface DishPriceRangeDto {
  id: string
  dishCatalogId: string
  country: Country
  currency: Currency
  minPrice: number
  maxPrice: number
}

/** Admin → Dish names: each name with its price range in every country that has one. */
export interface AdminDishCatalogDto {
  id: string
  name: string
  category: DishCategory
  group: CatalogGroup
  priceRanges: DishPriceRangeDto[]
}

/** A dish name a seller suggested, waiting for a decision. */
export interface AdminDishSuggestionDto {
  id: string
  name: string
  category: DishCategory
  group: CatalogGroup
  suggestedBy: string
  shopName: string | null
  suggestedAt: string
  /** The AI's advice; null until it has looked. */
  aiAdvice?: ModerationAdviceDto | null
}

/** GET /api/admin/commissions: Phloem's cut of the dishes in one country (isSet = false: not set yet, 0% applies). */
export interface CommissionDto {
  country: Country
  ratePercent: number
  isSet: boolean
}

/** One delivery time a country offers, and what it adds to an order (0 = free). */
export interface DeliveryWindowChargeDto {
  window: DeliveryWindow
  extraCharge: number
}

/** GET /api/admin/delivery-pricing: a country's shop delivery-fee range and its delivery times. */
export interface DeliveryPricingDto {
  country: Country
  currency: Currency
  minShopFee: number
  maxShopFee: number
  windows: DeliveryWindowChargeDto[]
}

/** One speed's price on a route (admin). */
export interface ShipmentRateDto {
  speed: DeliverySpeed
  baseCharge: number
  pricePerKg: number
  minTransitDays: number
  maxTransitDays: number
}

/** GET /api/admin/shipment-routes: a route, on or off, with its drop-off hub and a rate per speed. */
export interface AdminShipmentRouteDto {
  fromCountry: Country
  toCountry: Country
  /** The origin's currency (every price on the route). */
  currency: Currency
  dropOffAddress: string
  dropOffHours: string
  isActive: boolean
  rates: ShipmentRateDto[]
}

/** GET /api/staff/shipments: one parcel in the hub's list. */
export interface StaffShipmentSummaryDto {
  trackingNumber: string
  fromCountry: Country
  toCountry: Country
  senderName: string
  recipientName: string
  status: ShipmentStatus
  speed: DeliverySpeed
  itemCount: number
  estimatedWeightKg: number
  weighedWeightKg: number | null
  /** The final price once weighed, else the estimate. */
  price: number
  currency: Currency
  bookedAt: string
  /** Who is delivering it (or delivered it); null until it's out for delivery. */
  courierName?: string | null
}

/** GET /api/contact: what the Contact us page shows. Null values are left off the page. */
export interface ContactDetailsDto {
  email: string
  phone: string | null
  /** International format, e.g. "+44 7700 900000". */
  whatsApp: string | null
  address: string | null
  openingHours: string | null
  /** e.g. "within 24 hours". */
  replyTime: string | null
}

/** One message in Admin → Contact messages. */
export interface ContactMessageDto {
  id: string
  name: string
  email: string
  topic: ContactTopic
  reference: string | null
  /** Plain text: show as text, never as HTML. */
  message: string
  status: ContactMessageStatus
  staffNote: string | null
  fromSignedInUser: boolean
  sentAt: string
  handledAt: string | null
  /** The AI thinks it's urgent (null: not sorted). */
  isUrgent?: boolean | null
  /** The AI's one-line summary. */
  aiSummary?: string | null
}

/** GET /api/admin/contact-messages: one page of the inbox and how many there are of each status. */
export interface ContactInboxDto {
  messages: PagedResult<ContactMessageDto>
  newCount: number
  repliedCount: number
  closedCount: number
  /** Moved to Spam (by the AI or staff). */
  spamCount?: number
}

/** GET /api/dishes/suggest: one search prediction: a dish name (search for it) or a shop (open it). */
export interface SearchSuggestionDto {
  text: string
  kind: 'Dish' | 'Shop'
  /** Dish: how many dishes have this name. Shop: 0. */
  dishCount: number
  /** Shop only. */
  shopId: string | null
}

/** On GET /api/me: where I stand with the Terms and the Privacy Policy. */
export interface TermsStatusDto {
  /** The latest published Terms (0 = none yet). */
  currentTermsVersion: number
  /** The highest version I accepted, or null. */
  acceptedTermsVersion: number | null
  /** True: ordering, sending parcels and selling wait until I accept the latest Terms. */
  needsToAcceptTerms: boolean
  /** The latest published Privacy Policy (0 = none yet). */
  currentPrivacyVersion: number
  /** True: show the "updated Privacy Policy" notice once. */
  needsToSeePrivacy: boolean
}

/** GET /api/admin/legal/acceptance: "84 of 120 people have accepted version 3". */
export interface TermsAcceptanceStatsDto {
  currentTermsVersion: number
  acceptedCount: number
  peopleCount: number
}

// ───────────────────────────── Deliveries (couriers, proof of delivery) ─────────────────────────────

/** The courier's photo and handover details on an order or parcel page. The photo link works for about 15 minutes. */
export interface DeliveryProofDto {
  photoUrl: string
  handover: HandoverMethod
  /** Ready to show: "Left at the front door", "Handed to Ama". */
  summary: string
  receivedBy: string | null
  note: string | null
  courierName: string | null
  deliveredAt: string
}

/** One entry in "Choose a courier"; `isMe` = the seller's "I'll deliver it myself". */
export interface CourierOptionDto {
  id: string
  name: string
  isMe: boolean
}

/** One card in "My deliveries" (GET /api/deliveries). */
export interface DeliveryJobDto {
  kind: DeliveryKind
  /** The order or tracking number. */
  reference: string
  /** The shop's name, or "Phloem hub" for parcels. */
  collectFrom: string
  collectPhone: string | null
  recipientName: string
  recipientPhone: string | null
  address: string
  country: Country
  itemsSummary: string
  deliveryWindow: DeliveryWindow | null
  assignedAt: string | null
  deliveredAt: string | null
  /** Delivered ones: "Left at the front door". */
  handoverSummary: string | null
}

// ───────────────────────────── Staff (Admin → Staff, Job roles, Audit log) ─────────────────────────────

/** One person on Admin → Staff: an owner (Admin) or someone with a staff job role. */
export interface StaffMemberDto {
  id: string
  fullName: string
  email: string
  /** The country on their profile. */
  homeCountry: Country
  /** The owners: everything, everywhere. */
  isAdmin: boolean
  /** Stored names, e.g. "ShipmentManager". */
  jobRoles: string[]
  /** As people read them, e.g. "Parcel hub". */
  jobRoleNames: string[]
  coversAllCountries: boolean
  /** Empty when `coversAllCountries`. */
  countries: Country[]
  twoFactorEnabled: boolean
  /** ISO, UTC; null = never. */
  lastSignIn: string | null
  isSuspended: boolean
  /** The person looking: they can't change their own access. */
  isYou: boolean
}

/** One staff job role and what it's allowed to do. */
export interface JobRoleDto {
  /** Stored name, used in addresses. */
  role: string
  name: string
  description: string | null
  permissions: string[]
  memberCount: number
}

/** Admin → Job roles: every role, every permission, and whether the viewer may edit (owners only). */
export interface JobRolesDto {
  roles: JobRoleDto[]
  allPermissions: string[]
  canEdit: boolean
}

/** One line of the staff audit log. */
export interface StaffAuditEntryDto {
  id: string
  /** ISO, UTC. */
  at: string
  actorId: string
  actorName: string
  action: StaffAction
  target: string
  country: Country | null
  detail: string | null
}

// ───────────────────────────── Two-person approval (Admin → Approvals) ─────────────────────────────

/** What happened when Publish was pressed on Terms & Help. */
export interface LegalPublishResultDto {
  /** The new version when it went live now (Help); null while waiting for approval. */
  version: number | null
  /** Terms / Privacy: another owner must approve it first. */
  waitingForApproval: boolean
  approvalId: string | null
  /** What to tell the person. */
  message: string
}

/** The Terms / Privacy wording waiting to be published: exactly what the approver approves. */
export interface LegalDocumentProposalDto {
  type: LegalDocumentType
  title: string
  content: string
  isDraft: boolean
}

/** One change on Admin → Approvals. */
export interface PendingChangeDto {
  id: string
  kind: PendingChangeKind
  status: PendingChangeStatus
  /** e.g. "Publish the Terms & Conditions", "Block Mama's Kitchen". */
  summary: string
  country: Country | null
  /** The record it concerns (e.g. the blocked shop). */
  targetId: string | null
  proposedByName: string
  /** ISO, UTC. */
  proposedAt: string
  /** ISO, UTC: when it stops waiting. */
  expiresAt: string
  decidedByName: string | null
  decidedAt: string | null
  /** Why it was rejected or withdrawn. */
  decisionNote: string | null
  /** What happened, e.g. "Published as version 6." */
  outcome: string | null
  /** The viewer may approve or reject it now. */
  canDecide: boolean
  /** The viewer may take it back now. */
  canWithdraw: boolean
  /** The viewer proposed it. */
  isYours: boolean
  /** Terms / Privacy: the wording to approve. */
  legal: LegalDocumentProposalDto | null
}


// ───────────────────────────── Admin → AI ─────────────────────────────

/** GET /api/admin/ai/status: on or off, the model, and this month's spend. */
export interface AiStatusDto {
  provider: AiProvider
  model: string
  isEnabled: boolean
  /** Why AI is off, e.g. "No Anthropic API key yet"; null when on. */
  notReadyReason: string | null
  monthCalls: number
  monthFailedCalls: number
  monthInputTokens: number
  monthOutputTokens: number
  /** US dollars. */
  monthCostUsd: number
  monthlyCapUsd: number
  capReached: boolean
  logRetentionMonths: number
}

/** GET /api/admin/ai/prompts: one prompt in the list. */
export interface AiPromptSummaryDto {
  key: string
  name: string
  description: string
  /** 0 = Phloem's default wording. */
  version: number
  changedAt: string | null
  changedBy: string | null
}

/** One saved wording of a prompt. */
export interface AiPromptVersionDto {
  version: number
  text: string
  note: string | null
  savedAt: string
  savedBy: string
}

/** GET /api/admin/ai/prompts/{key}: one prompt for editing. */
export interface AiPromptDetailsDto {
  key: string
  name: string
  description: string
  inputDescription: string
  /** Answer fields the wording must keep asking for. */
  requiredFields: string[]
  sampleAnswer: string
  text: string
  version: number
  defaultText: string
  maxLength: number
  /** Newest first. */
  versions: AiPromptVersionDto[]
}

/** POST /api/admin/ai/prompts/{key}/suggest: a suggested wording (not saved). */
export interface AiPromptSuggestionDto {
  text: string
  summary: string
  /** Required fields the suggestion forgot (add them back before saving). */
  missingFields: string[]
}

/** GET /api/admin/ai/calls: one row of the AI call log. */
export interface AiCallSummaryDto {
  id: string
  at: string
  promptKey: string
  promptName: string
  promptVersion: number
  subject: string | null
  model: string
  outcome: AiCallOutcome
  inputTokens: number
  outputTokens: number
  costUsd: number
  durationMs: number
  finalDecision: string | null
}

/** GET /api/admin/ai/calls/{id}: one call with its text (opening it is audited). */
export interface AiCallDetailsDto {
  call: AiCallSummaryDto
  input: string
  output: string | null
  error: string | null
  decidedBy: string | null
  decidedAt: string | null
}

// ───────────────────────────── Smart SEO ─────────────────────────────

/** GET /api/admin/seo/overview: website health. */
export interface SeoOverviewDto {
  aiIsOn: boolean
  aiNotReadyReason: string | null
  mainPages: number
  mainPagesWritten: number
  shops: number
  shopsWritten: number
  shopsByStaff: number
  /** AI-written pages whose page changed since (rewritten by themselves soon). */
  pagesChanged: number
  sitemapUrl: string
  robotsUrl: string
  pagesInSitemap: number
}

/** GET /api/admin/seo/pages: one page in the list. */
export interface SeoPageRowDto {
  key: string
  kind: SeoPageKind
  name: string
  path: string
  country: Country | null
  status: SeoPageStatus
  pageChanged: boolean
  title: string
  score: number | null
}

/** GET /api/admin/seo/pages/{key}: one page's text, tips and score. */
export interface SeoPageDetailsDto {
  key: string
  kind: SeoPageKind
  name: string
  path: string
  url: string
  /** Shops: the link that shows a preview on WhatsApp / Facebook. */
  shareUrl: string | null
  country: Country | null
  status: SeoPageStatus
  pageChanged: boolean
  title: string
  description: string
  keywords: string[]
  improvements: string[]
  /** 0–100, the AI's estimate (not a Google score). */
  score: number | null
  scoreExplanation: string | null
  whatTheAiGets: string
  changedBy: string | null
  changedAt: string | null
}

/** GET /api/seo?path=…: what a public page puts in its head. */
export interface PublicSeoDto {
  title: string
  description: string
  keywords: string
  imageUrl: string | null
  canonicalUrl: string
  /** schema.org details for Google (shops). */
  jsonLd: string | null
}

// ───────────────────────────── Moderation ─────────────────────────────

/** What the AI (or a person) made of some text. */
export interface ModerationAdviceDto {
  state: ModerationState
  /** The person's verdict when decided, else the AI's; null when not checked. */
  verdict: ModerationVerdict | null
  reason: string | null
  /** Rule broken / close match / topic. */
  label: string | null
  decidedByStaff: boolean
}

/** GET /api/admin/moderation: one item that needs a person. */
export interface ModerationItemDto {
  id: string
  kind: ModerationKind
  title: string
  shopId: string | null
  shopName: string | null
  country: Country | null
  /** The exact text checked (plain text). */
  text: string
  aiVerdict: ModerationVerdict | null
  aiReason: string | null
  aiRule: string | null
  /** Why a person needs to look, in plain words. */
  whyHere: string
  /** Dishes: false = hidden from buyers until decided. Shops: the shop is live. */
  isLive: boolean
  waitingSince: string
}
