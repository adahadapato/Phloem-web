/**
 * Staff permissions, exactly as the API's `Permissions` (Phloem.Domain/Constants).
 *
 * The BACKEND decides who holds what and sends it with every sign-in and renewal (`permissions` in the sign-in
 * answer; "*" = every permission, i.e. the owners). The website only uses them to show or hide menus and pages:
 * every API call is still checked by the API, so hiding something here is tidiness, not security.
 */
export const Permissions = {
  /** Stands for every permission (owners / Admin). */
  Everything: '*',

  UsersManage: 'users.manage',
  StaffManage: 'staff.manage',
  ShopsManage: 'shops.manage',
  CatalogManage: 'catalog.manage',
  PricingManage: 'pricing.manage',
  Commission: 'commission.manage',
  PaymentsView: 'payments.view',
  RefundsIssue: 'refunds.issue',
  WithdrawalsApprove: 'withdrawals.approve',
  OrdersView: 'orders.view',
  ParcelsManage: 'parcels.manage',
  ParcelsSettings: 'parcels.settings',
  ContactRead: 'contact.read',
  EmailsRead: 'emails.read',
  EmailsReply: 'emails.reply',
  ChatsRead: 'chats.read',
  CasesManage: 'cases.manage',
  LegalPublish: 'legal.publish',
  Seo: 'seo.manage',
  AiPrompts: 'ai.prompts.manage',
  Settings: 'settings.manage',
  AuditView: 'audit.view',
} as const

/** One permission value. */
export type Permission = (typeof Permissions)[keyof typeof Permissions]

/** The words people read for each permission, grouped as on the Job roles page. */
export const permissionGroups: { title: string; items: { permission: string; name: string; about: string }[] }[] = [
  {
    title: 'People',
    items: [
      { permission: Permissions.UsersManage, name: 'Users', about: 'See people, suspend and reinstate them.' },
      { permission: Permissions.StaffManage, name: 'Staff', about: 'Give or take job roles and countries (never Admin).' },
    ],
  },
  {
    title: 'Shops & food',
    items: [
      { permission: Permissions.ShopsManage, name: 'Shops', about: 'Approve, verify and block shops; check their documents.' },
      { permission: Permissions.CatalogManage, name: 'Dish list', about: 'Dish names, suggestions and price ranges.' },
      { permission: Permissions.PricingManage, name: 'Delivery pricing', about: 'Delivery fee ranges and delivery times.' },
      { permission: Permissions.OrdersView, name: 'Orders', about: 'See any order (coming soon).' },
    ],
  },
  {
    title: 'Money',
    items: [
      { permission: Permissions.Commission, name: 'Commission', about: "Phloem's commission in each country." },
      { permission: Permissions.PaymentsView, name: 'Payments', about: 'See payments (coming soon).' },
      { permission: Permissions.RefundsIssue, name: 'Refunds', about: 'Refund buyers (coming soon).' },
      { permission: Permissions.WithdrawalsApprove, name: 'Withdrawals', about: 'Approve seller withdrawals (coming soon).' },
    ],
  },
  {
    title: 'Parcels',
    items: [
      { permission: Permissions.ParcelsManage, name: 'Parcels', about: 'Receive and weigh parcels, move them along, pick couriers.' },
      { permission: Permissions.ParcelsSettings, name: 'Routes & rules', about: 'Routes, prices, hubs and what can be sent.' },
    ],
  },
  {
    title: 'Messages',
    items: [
      { permission: Permissions.ContactRead, name: 'Contact messages', about: 'Read and answer Contact us messages.' },
      { permission: Permissions.EmailsRead, name: 'Team emails', about: 'Read the team mailboxes (coming soon).' },
      { permission: Permissions.EmailsReply, name: 'Reply to emails', about: 'Reply from the team mailboxes (coming soon).' },
      { permission: Permissions.ChatsRead, name: 'Order chats', about: 'Read order chats for a problem report (coming soon).' },
      { permission: Permissions.CasesManage, name: 'Problem reports', about: 'Handle "Report a problem" cases (coming soon).' },
    ],
  },
  {
    title: 'Words & system',
    items: [
      { permission: Permissions.LegalPublish, name: 'Terms & Help', about: 'Publish Terms, Privacy and Help.' },
      { permission: Permissions.Seo, name: 'Search engines', about: 'Search engine titles and descriptions (coming soon).' },
      { permission: Permissions.AiPrompts, name: 'AI prompts', about: 'The prompts the AI features use (coming soon).' },
      { permission: Permissions.Settings, name: 'Settings', about: 'Settings and system health (coming soon).' },
      { permission: Permissions.AuditView, name: 'Audit log', about: 'See who did what.' },
    ],
  },
]

/** A permission as people read it: "parcels.manage" → "Parcels". */
export const permissionName = (permission: string): string =>
  permissionGroups.flatMap((g) => g.items).find((i) => i.permission === permission)?.name ?? permission
