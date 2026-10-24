/**
 * The signed-in person's own account: /api/me. Same as the app's AccountService.
 * Grows with the Account pages (phase 2).
 */
import type { ApiResult } from '../apiError'
import { get } from '../client'
import type { ProfileDto } from '../contracts/dtos'

/** GET /api/me: the full profile (name, photo, country, addresses, notification switches). */
export const getProfile = (signal?: AbortSignal): Promise<ApiResult<ProfileDto>> =>
  get<ProfileDto>('api/me', signal)
