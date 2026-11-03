/**
 * Smart SEO: how Phloem appears on Google and in shared links.
 * - Admin (/api/admin/seo, permission seo.manage): website health, pages, edit, "Write with AI".
 * - Public (/api/seo?path=…): what each public page puts in its head (title, description, preview picture).
 */
import type { ApiResult } from '../apiError'
import { withQuery } from '../apiQuery'
import { get, post, put } from '../client'
import type { PagedResult, PublicSeoDto, SeoOverviewDto, SeoPageDetailsDto, SeoPageRowDto } from '../contracts/dtos'
import type { Country, SeoPageKind, SeoPageStatus } from '../contracts/enums'

const admin = 'api/admin/seo'
const page = (key: string) => `${admin}/pages/${encodeURIComponent(key)}`

/** Website health: how many pages have text, sitemap and robots links. */
export const getSeoOverview = (signal?: AbortSignal): Promise<ApiResult<SeoOverviewDto>> =>
  get<SeoOverviewDto>(`${admin}/overview`, signal)

/** The pages (fixed pages and live shops), with filters. */
export const getSeoPages = (filter: { kind?: SeoPageKind; status?: SeoPageStatus; changedOnly?: boolean; search?: string;
                                      country?: Country; page: number; pageSize: number },
                            signal?: AbortSignal): Promise<ApiResult<PagedResult<SeoPageRowDto>>> =>
  get<PagedResult<SeoPageRowDto>>(withQuery(`${admin}/pages`, filter), signal)

/** One page: its text, the AI's tips and score. */
export const getSeoPage = (key: string, signal?: AbortSignal): Promise<ApiResult<SeoPageDetailsDto>> =>
  get<SeoPageDetailsDto>(page(key), signal)

/** Save your own wording (the AI then leaves it alone). */
export const saveSeoPage = (key: string, title: string, description: string, keywords: string[]) =>
  put(page(key), { title, description, keywords })

/** The AI writes this page's text now. */
export const writeSeoPage = (key: string) => post(`${page(key)}/write`)

/** Write up to 25 pages that need it now. Returns how many were written. */
export const writeMissingSeo = (): Promise<ApiResult<number>> => post<number>(`${admin}/write-missing`)

/** Public: what a page puts in its head. */
export const getPublicSeo = (path: string, signal?: AbortSignal): Promise<ApiResult<PublicSeoDto>> =>
  get<PublicSeoDto>(withQuery('api/seo', { path }), signal)
