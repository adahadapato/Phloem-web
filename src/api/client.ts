/**
 * The one way the website talks to the Phloem API. Every call returns an {@link ApiResult}: it never throws for
 * HTTP errors or a missing connection (only when the CALLER cancels, with an AbortError).
 * Same job as the app's ApiClient + AuthTokenHandler:
 * 1. Before: if the access token is about to run out, renews it first; adds "Authorization: Bearer …".
 * 2. After: on 401, renews ONCE and sends the request again.
 * 3. Renewal refused (refresh token expired / revoked): signs out ({@link tokens.expire}).
 * Failures are read from the API's ProblemDetails: detail → message, code → code, errors → field errors.
 */
import { ApiError, failure, success, type ApiResult } from './apiError'
import { apiUrl } from './config'
import type { AuthTokensDto } from './contracts/dtos'
import { tokens } from './tokens'

/** How long one request may take. */
const TIMEOUT_MS = 30_000

/** The API's refresh endpoint. */
const REFRESH_PATH = 'api/auth/refresh'

/** Only one renewal at a time; other requests wait for it. */
let renewal: Promise<boolean> | null = null

// ───────────────────────────── 1. JSON calls ─────────────────────────────

/** GET a value. */
export const get = <T>(path: string, signal?: AbortSignal) => send<T>('GET', path, undefined, signal)

/** POST a body and read the answer (use `post<void>` when the API answers 204). */
export const post = <T = void>(path: string, body?: unknown, signal?: AbortSignal) =>
  send<T>('POST', path, body, signal)

/** PUT a body and read the answer (use `put<void>` when the API answers 204). */
export const put = <T = void>(path: string, body?: unknown, signal?: AbortSignal) =>
  send<T>('PUT', path, body, signal)

/** DELETE (the API answers 204). */
export const del = (path: string, signal?: AbortSignal) => send<void>('DELETE', path, undefined, signal)

// ───────────────────────────── 2. File uploads ─────────────────────────────

/**
 * Uploads one file as a form (multipart), e.g. a photo or a document.
 * @param method POST or PUT, as the endpoint expects.
 * @param path The endpoint.
 * @param fieldName The form field the endpoint reads the file from (e.g. "photo", "logo", "file").
 * @param file The file the person picked.
 * @param fields Other form fields, if any.
 */
export function upload<T>(method: 'POST' | 'PUT', path: string, fieldName: string, file: File,
                          fields?: Record<string, string>, signal?: AbortSignal): Promise<ApiResult<T>> {
  const form = new FormData()
  form.append(fieldName, file, file.name)
  Object.entries(fields ?? {}).forEach(([name, value]) => form.append(name, value))
  return send<T>(method, path, form, signal)
}

// ───────────────────────────── 3. Sending ─────────────────────────────

async function send<T>(method: string, path: string, body: unknown, signal?: AbortSignal): Promise<ApiResult<T>> {
  // 1. Renew first if the token is about to run out (saves a wasted round trip)
  if (tokens.canRefresh && tokens.accessTokenExpiresSoon) await renew(tokens.accessToken)

  let response = await trySend(method, path, body, signal)
  if (response instanceof ApiError) return failure(response)

  // 2. Rejected: renew once and try again
  if (response.status === 401 && tokens.canRefresh) {
    const tokenUsed = tokens.accessToken
    if (await renew(tokenUsed)) {
      response = await trySend(method, path, body, signal)
      if (response instanceof ApiError) return failure(response)
    }
  }

  if (!response.ok) return failure(await readError(response))
  if (response.status === 204) return success(undefined as T)

  try {
    const text = await response.text()
    return success((text ? JSON.parse(text) : undefined) as T)
  } catch {
    return failure(ApiError.unexpected(response.status))
  }
}

/** Sends, turning "no connection" and "too slow" into errors. A cancel by the caller is re-thrown. */
async function trySend(method: string, path: string, body: unknown,
                       signal?: AbortSignal): Promise<Response | ApiError> {
  const timeout = AbortSignal.timeout(TIMEOUT_MS)
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (tokens.accessToken) headers.Authorization = `Bearer ${tokens.accessToken}`

  let payload: BodyInit | undefined
  if (body instanceof FormData) payload = body   // the browser sets the multipart header itself
  else if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
    payload = JSON.stringify(body)
  }

  try {
    return await fetch(apiUrl(path), {
      method,
      headers,
      body: payload,
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    })
  } catch (error) {
    if (signal?.aborted) throw error              // the caller cancelled (e.g. left the page): not an error to show
    if (timeout.aborted) return ApiError.timeout
    return ApiError.unreachable
  }
}

/**
 * Swaps the refresh token for new tokens. Only one renewal runs at a time; a request that waited finds the tokens
 * already renewed and doesn't renew again.
 * @param staleAccessToken The token the caller had; if it changed meanwhile, someone else renewed.
 * @returns True when there is a fresh access token to use.
 */
function renew(staleAccessToken: string | null): Promise<boolean> {
  if (tokens.accessToken && tokens.accessToken !== staleAccessToken && !tokens.accessTokenExpiresSoon) {
    return Promise.resolve(true)
  }

  renewal ??= (async () => {
    try {
      const refreshToken = tokens.refreshToken
      if (!refreshToken) return false

      const response = await fetch(apiUrl(REFRESH_PATH), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ refreshToken }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })

      if (response.ok) {
        const renewed = (await response.json()) as AuthTokensDto
        if (renewed.accessToken) {
          tokens.save(renewed, tokens.remember)
          return true
        }
      }

      // The API refused the refresh token (expired, revoked, reused, account suspended): sign out
      if ([400, 401, 403].includes(response.status)) tokens.expire()
      return false
    } catch {
      return false   // no connection: keep the tokens; still signed in once the network is back
    } finally {
      renewal = null
    }
  })()

  return renewal
}

// ───────────────────────────── 4. Errors ─────────────────────────────

/** Reads the API's ProblemDetails answer. */
async function readError(response: Response): Promise<ApiError> {
  const fallback = response.status === 401 ? ApiError.sessionExpired : ApiError.unexpected(response.status)
  try {
    const problem = (await response.json()) as {
      detail?: unknown
      title?: unknown
      code?: unknown
      errors?: Record<string, unknown>
    }

    const text = (value: unknown) => (typeof value === 'string' && value.length > 0 ? value : undefined)
    const fields: Record<string, string[]> = {}
    for (const [name, messages] of Object.entries(problem.errors ?? {})) {
      if (Array.isArray(messages)) fields[name] = messages.filter((m): m is string => typeof m === 'string' && !!m)
    }

    return new ApiError(
      response.status,
      text(problem.code) ?? `Http.${response.status}`,
      text(problem.detail) ?? text(problem.title) ?? fallback.message,
      fields,
    )
  } catch {
    return fallback
  }
}
