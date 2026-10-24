/**
 * Why a request failed: read from the API's ProblemDetails answer, or made up here when the API couldn't be reached.
 * Show {@link ApiError.displayMessage} to people; check {@link ApiError.code} in code.
 * Same idea as the app's `ApiError`.
 */
export class ApiError {
  /** HTTP status (0 when the API wasn't reached). */
  readonly status: number
  /** The API's error code, e.g. "Auth.InvalidCredentials". */
  readonly code: string
  /** The API's explanation, ready to show. */
  readonly message: string
  /** Validation problems per field (empty when there are none). */
  readonly fieldErrors: Readonly<Record<string, string[]>>

  constructor(status: number, code: string, message: string, fieldErrors: Record<string, string[]> = {}) {
    this.status = status
    this.code = code
    this.message = message
    this.fieldErrors = fieldErrors
  }

  /** The API couldn't be reached (no internet, server down, blocked by the browser). */
  static readonly unreachable = new ApiError(
    0, 'Network.Unreachable', "We couldn't reach Phloem. Please check your internet connection and try again.")

  /** The API didn't answer in time. */
  static readonly timeout = new ApiError(
    0, 'Network.Timeout', 'Phloem is taking too long to answer. Please try again.')

  /** The sign-in ran out and couldn't be renewed. */
  static readonly sessionExpired = new ApiError(
    401, 'Auth.SessionExpired', 'Your session has ended. Please sign in again.')

  /** Anything else that went wrong without a usable answer. */
  static unexpected(status: number): ApiError {
    return new ApiError(status, 'Api.Unexpected', 'Something went wrong. Please try again.')
  }

  /** The message for people: every field problem (one per line), or the general message. */
  get displayMessage(): string {
    const fields = [...new Set(Object.values(this.fieldErrors).flat())]
    return fields.length > 0 ? fields.join('\n') : this.message
  }

  /** True when the person isn't (or is no longer) signed in. */
  get isUnauthorized(): boolean {
    return this.status === 401
  }

  /** True when the API couldn't be reached at all. */
  get isNetworkError(): boolean {
    return this.status === 0
  }
}

/** The outcome of an API call: the value, or an {@link ApiError}. Calls never throw for HTTP problems. */
export type ApiResult<T> = { ok: true; value: T } | { ok: false; error: ApiError }

/** A successful result. */
export const success = <T>(value: T): ApiResult<T> => ({ ok: true, value })

/** A failed result. */
export const failure = <T = never>(error: ApiError): ApiResult<T> => ({ ok: false, error })

/**
 * The value, or throws the {@link ApiError}. Only for React Query's `queryFn`, which expects a failure to be thrown
 * (the page then reads it from `query.error`).
 */
export function unwrap<T>(result: ApiResult<T>): T {
  if (result.ok) return result.value
  throw result.error
}
