/**
 * The Terms & Conditions and the Privacy Policy, from the API's database (GET /api/legal/{type}), so the website and
 * the app always show the same, current wording. Open to everyone.
 */
import type { ApiResult } from '../apiError'
import { get, post } from '../client'
import type { LegalDocumentDto, LegalPublishResultDto } from '../contracts/dtos'
import type { LegalDocumentType } from '../contracts/enums'

/** GET /api/legal/{type}: the current version. */
export const getLegalDocument = (type: LegalDocumentType, signal?: AbortSignal): Promise<ApiResult<LegalDocumentDto>> =>
  get<LegalDocumentDto>(`api/legal/${type}`, signal)

/**
 * POST /api/admin/legal/{type}: publish a new version. Help goes live now (`version` set); Terms and Privacy wait for
 * another owner to approve them on Approvals (`waitingForApproval`).
 */
export const publishLegalDocument = (type: LegalDocumentType, title: string, content: string, isDraft: boolean):
  Promise<ApiResult<LegalPublishResultDto>> =>
  post<LegalPublishResultDto>(`api/admin/legal/${type}`, { title, content, isDraft })
