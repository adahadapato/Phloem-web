/**
 * Admin → AI: the API's /api/admin/ai (permission ai.prompts.manage): status and spend, the prompts AI jobs use, and
 * the AI call log. Prompt changes are one step and logged; opening a call is audited.
 */
import type { ApiResult } from '../apiError'
import { withQuery } from '../apiQuery'
import { get, post, put } from '../client'
import type {
  AiCallDetailsDto, AiCallSummaryDto, AiPromptDetailsDto, AiPromptSuggestionDto, AiPromptSummaryDto, AiStatusDto,
  PagedResult,
} from '../contracts/dtos'
import type { AiCallOutcome } from '../contracts/enums'

const ai = 'api/admin/ai'
const prompt = (key: string) => `${ai}/prompts/${encodeURIComponent(key)}`

/** On or off, the model, and this month's calls and spend against the cap. */
export const getAiStatus = (signal?: AbortSignal): Promise<ApiResult<AiStatusDto>> =>
  get<AiStatusDto>(`${ai}/status`, signal)

/** Every AI prompt with the version in use. */
export const getAiPrompts = (signal?: AbortSignal): Promise<ApiResult<AiPromptSummaryDto[]>> =>
  get<AiPromptSummaryDto[]>(`${ai}/prompts`, signal)

/** One prompt: wording in use, default, required answer fields, saved versions. */
export const getAiPrompt = (key: string, signal?: AbortSignal): Promise<ApiResult<AiPromptDetailsDto>> =>
  get<AiPromptDetailsDto>(prompt(key), signal)

/** Save a new wording (used at once). Returns the new version number. */
export const saveAiPrompt = (key: string, text: string, note: string | null): Promise<ApiResult<number>> =>
  put<number>(prompt(key), { text, note })

/** Bring back an older wording (saved as a new version). */
export const restoreAiPrompt = (key: string, version: number): Promise<ApiResult<number>> =>
  post<number>(`${prompt(key)}/versions/${version}/restore`)

/** Go back to Phloem's default wording (saved as a new version). */
export const resetAiPrompt = (key: string): Promise<ApiResult<number>> => post<number>(`${prompt(key)}/reset`)

/** Ask AI to rewrite the wording in the editor. Nothing is saved. */
export const suggestAiPrompt = (key: string, currentText: string, request: string | null):
  Promise<ApiResult<AiPromptSuggestionDto>> =>
  post<AiPromptSuggestionDto>(`${prompt(key)}/suggest`, { currentText, request })

/** The AI call log, newest first (no text). */
export const getAiCalls = (filter: { promptKey?: string; outcome?: AiCallOutcome; page: number; pageSize: number },
                           signal?: AbortSignal): Promise<ApiResult<PagedResult<AiCallSummaryDto>>> =>
  get<PagedResult<AiCallSummaryDto>>(withQuery(`${ai}/calls`, filter), signal)

/** One call with its text (the view is written to the audit log). */
export const getAiCall = (id: string, signal?: AbortSignal): Promise<ApiResult<AiCallDetailsDto>> =>
  get<AiCallDetailsDto>(`${ai}/calls/${encodeURIComponent(id)}`, signal)
