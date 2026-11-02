/**
 * Admin → Staff, Job roles and the Audit log: the API's /api/admin/staff and /api/admin/audit.
 *
 * The API decides who may call what: the staff list and countries need the Staff permission (`staff.manage`),
 * changing what a job role may do is for owners only, and the audit log needs `audit.view`. Giving and taking roles
 * uses the Users endpoints (`grantRole` / `removeRole` in adminService).
 */
import type { ApiResult } from '../apiError'
import { withQuery } from '../apiQuery'
import { get, put } from '../client'
import type { JobRolesDto, PagedResult, StaffAuditEntryDto, StaffMemberDto } from '../contracts/dtos'
import type { Country, StaffAction } from '../contracts/enums'

const staff = 'api/admin/staff'

/** GET /api/admin/staff: the owners and everyone with a job role. */
export const getStaff = (signal?: AbortSignal): Promise<ApiResult<StaffMemberDto[]>> =>
  get<StaffMemberDto[]>(staff, signal)

/**
 * PUT /api/admin/staff/{id}/countries: one, several or all countries. The person is signed out so it applies now.
 * @param userId The staff member.
 * @param allCountries Every country (only people covering every country may give this).
 * @param countries The countries when not all.
 */
export const setStaffCountries = (userId: string, allCountries: boolean, countries: Country[]) =>
  put(`${staff}/${encodeURIComponent(userId)}/countries`, { allCountries, countries: allCountries ? [] : countries })

/** GET /api/admin/staff/job-roles: every job role, its permissions and member count. */
export const getJobRoles = (signal?: AbortSignal): Promise<ApiResult<JobRolesDto>> =>
  get<JobRolesDto>(`${staff}/job-roles`, signal)

/**
 * PUT /api/admin/staff/job-roles/{role}/permissions (owners only): exactly these permissions afterwards. Taking any
 * away signs the role's members out.
 */
export const setJobRolePermissions = (role: string, permissions: string[]) =>
  put(`${staff}/job-roles/${encodeURIComponent(role)}/permissions`, { permissions })

/** The audit log's filters (all optional) and page. */
export interface AuditFilter {
  actorId?: string
  action?: StaffAction
  country?: Country
  /** ISO, UTC. */
  from?: string
  /** ISO, UTC (before this moment). */
  to?: string
  page: number
  pageSize: number
}

/** GET /api/admin/audit: who did what, newest first. */
export const getAudit = (filter: AuditFilter, signal?: AbortSignal):
  Promise<ApiResult<PagedResult<StaffAuditEntryDto>>> =>
  get<PagedResult<StaffAuditEntryDto>>(withQuery('api/admin/audit', { ...filter }), signal)
