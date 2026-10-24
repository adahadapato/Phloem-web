/**
 * Where to go after signing in: the `?returnTo=` page (set by ProtectedRoute, e.g. Checkout), or Home.
 * Only pages on THIS site are allowed ("/orders", not "https://…" or "//evil.com"), so a link can't be used to send
 * people to another website after they sign in.
 */
export function safeReturnTo(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return '/'
  return value
}
