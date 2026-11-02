import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router'
import { unwrap, type ApiResult } from '../../../api/apiError'
import type { StaffMemberDto } from '../../../api/contracts/dtos'
import type { Country } from '../../../api/contracts/enums'
import { Permissions } from '../../../api/contracts/permissions'
import { jobRoles, roleName } from '../../../api/contracts/roles'
import { grantRole, removeRole } from '../../../api/services/adminService'
import { getStaff, setStaffCountries } from '../../../api/services/staffService'
import { Button } from '../../../components/ui/Button'
import { CountryFlag } from '../../../components/ui/CountryFlag'
import { StatusBanner } from '../../../components/ui/StatusBanner'
import { useCountry } from '../../../state/CountryContext'
import { useSession } from '../../../state/SessionContext'
import styles from '../Admin.module.css'
import { AdminHead } from '../AdminParts'

type Message = { text: string; isError: boolean } | null
type Panel = { id: string; kind: 'countries' | 'roles' } | null

const when = (iso: string | null) => iso
  ? new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  : 'Never'

/**
 * Admin → Staff: the owners and everyone with a job role, as cards: name and email, Admin or their job roles, the
 * countries they cover, whether two-step sign-in is on (required for all staff), last sign-in.
 *
 * - <b>Countries</b> (Staff permission): one, several, or all countries. Someone covering only some countries can
 *   only add or remove those, and can't give "All countries". Saving signs the person out so it applies at once.
 * - <b>Job roles</b> (Staff + Users permissions): tick or untick job roles; the first one starts with their home
 *   country. Admin is given on Users, by owners only.
 * - Nobody changes their own access, and owners always cover every country.
 *
 * To add someone, find them on Users and give them a job role. The API checks every change itself.
 */
export default function AdminStaffPage() {
  const { countries } = useCountry()
  const { hasPermission, coversAllCountries, coversCountry } = useSession()
  const queryClient = useQueryClient()
  const canEditRoles = hasPermission(Permissions.UsersManage)
  const [panel, setPanel] = useState<Panel>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<Message>(null)
  const [draftAll, setDraftAll] = useState(false)
  const [draft, setDraft] = useState<Country[]>([])

  const query = useQuery({
    queryKey: ['admin', 'staff'],
    queryFn: async ({ signal }) => unwrap(await getStaff(signal)),
  })

  const countryName = (c: Country) => countries.find((x) => x.country === c)?.name ?? c

  const run = async (action: () => Promise<ApiResult<unknown>>, done: string) => {
    setBusy(true)
    setMessage(null)
    const result = await action()
    setBusy(false)
    if (result.ok) await queryClient.invalidateQueries({ queryKey: ['admin'] })
    setMessage(result.ok ? { text: done, isError: false } : { text: result.error.displayMessage, isError: true })
    return result.ok
  }

  const open = (s: StaffMemberDto, kind: 'countries' | 'roles') => {
    if (panel?.id === s.id && panel.kind === kind) { setPanel(null); return }
    setPanel({ id: s.id, kind })
    setDraftAll(s.coversAllCountries)
    setDraft(s.countries)
    setMessage(null)
  }

  const toggleDraft = (c: Country) =>
    setDraft((d) => (d.includes(c) ? d.filter((x) => x !== c) : [...d, c]))

  const saveCountries = async (s: StaffMemberDto) => {
    const names = draftAll ? 'every country' : draft.map(countryName).join(', ')
    const ok = await run(() => setStaffCountries(s.id, draftAll, draft),
      `${s.fullName} now covers ${names}. They've been signed out so it applies now.`)
    if (ok) setPanel(null)
  }

  const toggleRole = (s: StaffMemberDto, role: string, has: boolean) => run(
    () => has ? removeRole(s.id, role) : grantRole(s.id, role),
    has ? `${s.fullName} is no longer ${roleName(role)}. They've been signed out so it applies now.`
        : `${s.fullName} is now ${roleName(role)}. It applies the next time they sign in.`)

  return (
    <>
      <AdminHead title="Staff" sub="The owners and everyone with a job role: what they do, and in which countries.">
        <Link to="/admin/staff/roles" className={styles.linkButton}>Job roles ›</Link>
        {hasPermission(Permissions.AuditView) && <Link to="/admin/audit" className={styles.linkButton}>Audit log ›</Link>}
      </AdminHead>
      <StatusBanner message={message?.text} isError={message?.isError} />

      {query.isError && (
        <div className={styles.error}>
          <StatusBanner isError message="We couldn't load the staff." />
          <Button small variant="outline" onClick={() => query.refetch()}>Try again</Button>
        </div>
      )}
      {query.isPending && <p className="muted" aria-busy="true">Loading…</p>}

      {query.data && (
        <>
          <p className={styles.count}>
            {query.data.length} {query.data.length === 1 ? 'person' : 'people'}. To add someone, find them on{' '}
            {canEditRoles ? <Link to="/admin/users">Users</Link> : 'Users'} and give them a job role.
          </p>
          <ul className={styles.people}>
            {query.data.map((s) => {
              const isOpen = panel?.id === s.id
              const canChange = !s.isAdmin && !s.isYou
              return (
                <li key={s.id} className={`${styles.person} ${s.isSuspended ? styles.personSuspended : ''}`}>
                  {/* Who */}
                  <div className={styles.personTop}>
                    <span className={styles.personInitial} aria-hidden="true">{s.fullName.charAt(0).toUpperCase()}</span>
                    <div className={styles.personWho}>
                      <h2 className={styles.personName}>
                        {s.fullName}{s.isYou && <span className={styles.you}> (you)</span>}
                      </h2>
                      <a href={`mailto:${s.email}`} className={styles.personContact}>{s.email}</a>
                    </div>
                    {s.isSuspended
                      ? <span className={`${styles.chip} ${styles.chipStop}`}>Suspended</span>
                      : s.twoFactorEnabled
                        ? <span className={`${styles.chip} ${styles.chipGo}`}>2-step on</span>
                        : <span className={`${styles.chip} ${styles.chipWait}`} title="Required for all staff">2-step off</span>}
                  </div>

                  {/* What and where */}
                  <div className={styles.personFacts}>
                    <span className={styles.roleChips}>
                      {s.isAdmin && <span className={`${styles.chip} ${styles.chipWait}`}>Admin (owner)</span>}
                      {s.jobRoleNames.map((name) => (
                        <span key={name} className={`${styles.chip} ${styles.chipGo}`}>{name}</span>
                      ))}
                    </span>
                    {s.coversAllCountries
                      ? <span className={styles.fact}>🌍 All countries</span>
                      : s.countries.length === 0
                        ? <span className={styles.fact}>No country yet</span>
                        : s.countries.map((c) => {
                            const dto = countries.find((x) => x.country === c)
                            return <span key={c} className={styles.fact}>{dto && <CountryFlag country={dto} />} {countryName(c)}</span>
                          })}
                    <span className={styles.fact}>Last sign-in: {when(s.lastSignIn)}</span>
                  </div>

                  {/* Actions */}
                  {canChange && (
                    <div className={styles.personActions}>
                      <Button small variant={isOpen && panel?.kind === 'countries' ? 'primary' : 'secondary'}
                              aria-expanded={isOpen && panel?.kind === 'countries'} onClick={() => open(s, 'countries')}>
                        Countries
                      </Button>
                      {canEditRoles && (
                        <Button small variant={isOpen && panel?.kind === 'roles' ? 'primary' : 'secondary'}
                                aria-expanded={isOpen && panel?.kind === 'roles'} onClick={() => open(s, 'roles')}>
                          Job roles
                        </Button>
                      )}
                    </div>
                  )}
                  {s.isAdmin && !s.isYou && <p className={styles.panelHint}>Owners always cover every country.</p>}

                  {isOpen && panel.kind === 'countries' && (
                    <form className={styles.inlinePanel} aria-label={`Countries for ${s.fullName}`}
                          onSubmit={(e) => { e.preventDefault(); void saveCountries(s) }}>
                      <ul className={styles.roleList}>
                        <li>
                          <label className={coversAllCountries ? undefined : styles.locked}>
                            <input type="checkbox" checked={draftAll} disabled={busy || !coversAllCountries}
                                   onChange={(e) => setDraftAll(e.target.checked)} />
                            <span><strong>All countries</strong>
                              <span className={styles.roleAbout}>Including countries Phloem adds later.</span>
                              {!coversAllCountries && <span className={styles.lockNote}>Only someone covering every country can give this.</span>}
                            </span>
                          </label>
                        </li>
                        {!draftAll && countries.map((c) => {
                          const mine = coversCountry(c.country)
                          return (
                            <li key={c.country}>
                              <label className={mine ? undefined : styles.locked}>
                                <input type="checkbox" checked={draft.includes(c.country)} disabled={busy || !mine}
                                       onChange={() => toggleDraft(c.country)} />
                                <span><CountryFlag country={c} /> <strong>{c.name}</strong>
                                  {!mine && <span className={styles.lockNote}>Not one of your countries.</span>}
                                </span>
                              </label>
                            </li>
                          )
                        })}
                      </ul>
                      <p className={styles.panelHint}>Saving signs them out so the change applies straight away.</p>
                      <div className={styles.row}>
                        <Button type="submit" small variant="secondary" busy={busy} busyText="Saving…"
                                disabled={!draftAll && draft.length === 0}>
                          Save countries
                        </Button>
                        <Button small variant="outline" onClick={() => setPanel(null)}>Cancel</Button>
                      </div>
                    </form>
                  )}

                  {isOpen && panel.kind === 'roles' && (
                    <div className={styles.inlinePanel} role="group" aria-label={`Job roles for ${s.fullName}`}>
                      <ul className={styles.roleList}>
                        {jobRoles.map((r) => {
                          const has = s.jobRoles.includes(r.role)
                          return (
                            <li key={r.role}>
                              <label>
                                <input type="checkbox" checked={has} disabled={busy}
                                       onChange={() => toggleRole(s, r.role, has)} />
                                <span><strong>{r.name}</strong><span className={styles.roleAbout}>{r.about}</span></span>
                              </label>
                            </li>
                          )
                        })}
                      </ul>
                      <p className={styles.panelHint}>
                        Taking away their last job role also takes their countries. What each role may do is on{' '}
                        <Link to="/admin/staff/roles">Job roles</Link>.
                      </p>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </>
      )}
    </>
  )
}
