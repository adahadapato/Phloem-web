/**
 * Where the API is. Comes from the .env files (VITE_API_BASE_URL), never typed in code:
 * .env.development → your local API, .env.production → https://phloemapi.phloemmarket.com.
 */
const configured = import.meta.env.VITE_API_BASE_URL

if (!configured) {
  throw new Error('VITE_API_BASE_URL is empty. Set it in .env.development / .env.production.')
}

/** The API's address without a trailing slash. */
export const apiBaseUrl = configured.replace(/\/+$/, '')

/** A full address for an API path, e.g. "api/countries" → "https://…/api/countries". */
export function apiUrl(path: string): string {
  return `${apiBaseUrl}/${path.replace(/^\/+/, '')}`
}

/**
 * The link to use for a picture or file the API returned (dish photo, shop logo, profile photo).
 * The API normally sends full links; a relative one ("/uploads/…") is put on the API's address.
 * @returns The link to load, or undefined when there is no picture.
 */
export function fileUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined
  return /^https?:\/\//i.test(url) ? url : apiUrl(url)
}
