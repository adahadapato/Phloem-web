/**
 * The API's enums. The API sends and accepts them as NAMES ("Ghana", not 1), so they are string unions here
 * (TypeScript `enum`s aren't used: the project builds with `erasableSyntaxOnly`).
 * Keep in step with the API (Phloem.Domain/Enums) and the app (Services/Api/Contracts/Enums).
 */

/** A country Phloem works in. Names, flags and currencies come from GET /api/countries. */
export type Country = 'Ghana' | 'Nigeria' | 'UnitedKingdom'

/** A currency (each country has one). */
export type Currency = 'GHS' | 'NGN' | 'GBP'

/** A dish's category (the tabs on Home and Explore). */
export type DishCategory = 'LocalMeals' | 'Snacks' | 'Drinks'

/** How a dish list is ordered. */
export type DishSort = 'Rating' | 'PriceLow' | 'PriceHigh'

/** When an order should arrive. Shops stop taking same-day orders at their cut-off time (then only Tomorrow). */
export type DeliveryWindow = 'Asap' | 'TodayEvening' | 'Tomorrow'

/** Where an order is: AwaitingPayment → Paid → Preparing → OutForDelivery → Delivered (or Cancelled). */
export type OrderStatus = 'AwaitingPayment' | 'Paid' | 'Preparing' | 'OutForDelivery' | 'Delivered' | 'Cancelled'

/** One step on an order's timeline (same as the API's `OrderEventKind`). */
export type OrderEventKind =
  | 'Placed' | 'ItemsRemoved' | 'Paid' | 'Accepted' | 'Declined' | 'Cancelled' | 'CancelledShopSuspended'
  | 'SentOut' | 'CourierChanged' | 'Delivered'

/** Who did a step on an order's timeline (same as the API's `OrderActorKind`). */
export type OrderActorKind = 'Customer' | 'Seller' | 'Courier' | 'Staff' | 'System'

/** The tabs on My orders (GET /api/orders?show=…): orders grouped the way buyers think about them. */
export type OrderStatusGroup = 'All' | 'WaitingForPayment' | 'InProgress' | 'Completed' | 'Cancelled'

/** Where a parcel is: Booked → ReceivedAtHub (weighed, final price) → Paid → InTransit → ArrivedInDestination →
 *  OutForDelivery → Delivered (or Cancelled before it leaves). */
export type ShipmentStatus =
  | 'Booked' | 'ReceivedAtHub' | 'Paid' | 'InTransit' | 'ArrivedInDestination' | 'OutForDelivery' | 'Delivered'
  | 'Cancelled'

/** How fast a parcel travels (each route prices its own speeds). */
export type DeliverySpeed = 'Standard' | 'Express' | 'Bulk'

/** What kind of item is in a parcel (for customs). */
export type ShipmentItemCategory = 'PackagedFood' | 'Clothing' | 'Documents' | 'Electronics' | 'Other'

/** A shop's state: waiting for approval → approved (live); or rejected (with a reason, fixable) / blocked. */
export type VendorStatus = 'PendingApproval' | 'Approved' | 'Blocked' | 'Rejected' | 'Closed'

/** Documents a seller uploads for the ✓ badge. */
export type VendorDocumentType = 'BusinessRegistration' | 'FoodHygieneCertificate' | 'OwnerId' | 'Other'

/** Where a document's review is. */
export type DocumentStatus = 'Pending' | 'Accepted' | 'Rejected'

/** How the dish-name list is grouped in the seller's picker. */
export type CatalogGroup = 'Ghana' | 'Nigeria' | 'WestAfrican' | 'Snacks' | 'Drinks'

/** The texts stored in the API's database and shown by the website and the app: Terms, Privacy Policy, Help. */
export type LegalDocumentType = 'Terms' | 'Privacy' | 'Help'

/** A line of the "what can be sent" list: never carried, or carried only as its detail says. */
export type ParcelItemRuleKind = 'NotAllowed' | 'Restricted'

/** What a Contact us message is about. */
export type ContactTopic = 'Order' | 'Parcel' | 'Selling' | 'Account' | 'Other'

/** Where a Contact us message is in the team's inbox. */
export type ContactMessageStatus = 'New' | 'Replied' | 'Closed' | 'Spam'

/** How a delivery was handed over (the courier picks one on "Delivered"). */
export type HandoverMethod = 'InPerson' | 'FrontDoor' | 'Neighbour' | 'SafePlace' | 'Reception'

/** What a courier is delivering: a food order or a parcel. */
export type DeliveryKind = 'Order' | 'Parcel'

/** What a staff member did, as recorded in the staff audit log (same as the API's `StaffAction`). */
export type StaffAction =
  | 'RoleGiven' | 'RoleRemoved' | 'CountriesChanged' | 'UserSuspended' | 'UserReinstated'
  | 'ContactMessagesViewed' | 'ContactMessageUpdated' | 'ParcelViewed' | 'RolePermissionsChanged'
  | 'ShopDocumentOpened' | 'ChangeProposed' | 'ChangeApproved' | 'ChangeRejected' | 'ChangeWithdrawn'
  | 'ShopBlocked' | 'ShopUnblocked' | 'OrderViewed' | 'AiPromptSaved' | 'AiPromptRestored' | 'AiPromptReset'
  | 'AiCallViewed' | 'SeoEdited' | 'SeoRewritten' | 'ContentApproved' | 'ContentRejected'
  | 'ChatViewed' | 'ChatReportClosed'

/** A change that needs a second person (same as the API's `PendingChangeKind`). */
export type PendingChangeKind = 'PublishLegalDocument' | 'ConfirmShopBlock'

/** Where a change waiting for a second person stands (same as the API's `PendingChangeStatus`). */
export type PendingChangeStatus = 'Waiting' | 'Approved' | 'Rejected' | 'Withdrawn' | 'Expired' | 'Failed'

/** Which AI service the API talks to (same as the API's `AiProvider`). */
export type AiProvider = 'Off' | 'Fake' | 'Anthropic' | 'OpenAiCompatible'

/** How one AI call ended (same as the API's `AiCallOutcome`). */
export type AiCallOutcome = 'Succeeded' | 'ProviderFailed' | 'BadAnswer'

/** Fixed website page or a shop's page (same as the API's `SeoPageKind`). */
export type SeoPageKind = 'Main' | 'Shop'

/** Where a page's search engine text stands (same as the API's `SeoPageStatus`). */
export type SeoPageStatus = 'NotWritten' | 'WrittenByAi' | 'EditedByStaff'

/** Whether a dish's text passed the check (same as the API's `ContentReviewStatus`). Buyers only see Approved. */
export type ContentReviewStatus = 'Approved' | 'Checking' | 'WithStaff' | 'Rejected'

/** What a moderation check is about (same as the API's `ModerationKind`). */
export type ModerationKind = 'Dish' | 'ShopName' | 'DishNameSuggestion' | 'ContactMessage'

/** What the AI or a person thought (same as the API's `ModerationVerdict`). */
export type ModerationVerdict = 'Ok' | 'NeedsLook' | 'NotAllowed'

/** Where a check is (same as the API's `ModerationState`). */
export type ModerationState = 'WaitingForAi' | 'WaitingForPerson' | 'DoneByAi' | 'DecidedByStaff' | 'Replaced'

/** Which side of an order chat someone is on (same as the API's `ChatRole`). */
export type ChatRole = 'Customer' | 'Seller'
