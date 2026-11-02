/**
 * Role names in the sign-in token. Same as the API's `Roles` (Phloem.Domain/Constants).
 *
 * The three older staff roles keep their stored names (SupportAgent, CatalogManager, ShipmentManager) and are shown
 * as Support, Shops & catalogue and Parcel hub. What a person may DO comes from their permissions (see
 * permissions.ts), not from these names.
 */
export const Roles = {
  Admin: 'Admin',
  Customer: 'Customer',
  Seller: 'Seller',
  CountryManager: 'CountryManager',
  SupportAgent: 'SupportAgent',
  CatalogManager: 'CatalogManager',
  ShipmentManager: 'ShipmentManager',
  Finance: 'Finance',
  Content: 'Content',
  Technical: 'Technical',
  Courier: 'Courier',
} as const

/** One of the role names. */
export type Role = (typeof Roles)[keyof typeof Roles]

/** The staff job roles (not Admin), each with its name and what it's for. */
export const jobRoles: { role: Role; name: string; about: string }[] = [
  { role: Roles.CountryManager, name: 'Country manager', about: 'Runs one country: shops, dish list, pricing, orders and parcels.' },
  { role: Roles.SupportAgent, name: 'Support', about: 'Contact messages, orders, team emails, chats and problem reports.' },
  { role: Roles.CatalogManager, name: 'Shops & catalogue', about: 'Approves shops and their documents, edits the dish list.' },
  { role: Roles.ShipmentManager, name: 'Parcel hub', about: 'Receives and weighs parcels and moves them along.' },
  { role: Roles.Finance, name: 'Finance', about: 'Payments, refunds, seller withdrawals and commission.' },
  { role: Roles.Content, name: 'Content', about: 'Search engine text and AI prompts.' },
  { role: Roles.Technical, name: 'Technical', about: 'Settings and system health; no customer data.' },
]

/**
 * The roles that can be given or taken on Admin → Users (same as the API's `Roles.Assignable`). Customer is
 * everyone's; Seller follows the person's shop. Only owners (Admin) can give or take Admin.
 */
export const assignableRoles: { role: Role; name: string; about: string }[] = [
  { role: Roles.Admin, name: 'Admin (owner)', about: 'Everything, in every country. Only owners can give this.' },
  ...jobRoles,
  { role: Roles.Courier, name: 'Courier', about: 'Delivers food orders and parcels, with a photo as proof.' },
]

/** A role as people read it: "ShipmentManager" → "Parcel hub". */
export const roleName = (role: string): string =>
  role === Roles.Admin ? 'Admin' : assignableRoles.find((r) => r.role === role)?.name ?? role

/** True for a staff job role. */
export const isJobRole = (role: string): boolean => jobRoles.some((r) => r.role === role)
