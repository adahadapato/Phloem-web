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

/**
 * The roles an admin can give or take on Admin → Users (same as the API's `Roles.Assignable`). Customer is everyone's;
 * Seller follows the person's shop. Each with its name and what it lets someone do.
 */
export const assignableRoles: { role: Role; name: string; about: string }[] = [
  { role: Roles.Admin, name: 'Admin', about: 'Everything: shops, users, prices, shipping and staff.' },
  { role: Roles.CatalogManager, name: 'Catalog manager', about: 'Reviews dish-name suggestions and edits the dish list.' },
  { role: Roles.ShipmentManager, name: 'Shipment manager', about: 'Receives parcels at the hub and moves them along.' },
  { role: Roles.SupportAgent, name: 'Support agent', about: 'Looks up orders and users, and cancels orders for customers.' },
]

/** A role as people read it: "CatalogManager" → "Catalog manager". */
export const roleName = (role: string): string =>
  assignableRoles.find((r) => r.role === role)?.name ?? role

