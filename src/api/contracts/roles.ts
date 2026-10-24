/** Role names in the sign-in token. Same as the API's `Roles` (Phloem.Domain/Constants). */
export const Roles = {
  Admin: 'Admin',
  Customer: 'Customer',
  Seller: 'Seller',
  CatalogManager: 'CatalogManager',
  ShipmentManager: 'ShipmentManager',
  SupportAgent: 'SupportAgent',
} as const

/** One of the role names. */
export type Role = (typeof Roles)[keyof typeof Roles]
