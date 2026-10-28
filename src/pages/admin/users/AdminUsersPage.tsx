import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router'
import { unwrap, type ApiResult } from '../../../api/apiError'
import type { AdminUserDto } from '../../../api/contracts/dtos'
import { assignableRoles, roleName, Roles } from '../../../api/contracts/roles'
import { getUsers, grantRole, reinstateUser, removeRole, suspendUser } from '../../../api/services/adminService'
import { ApiImage } from '../../../components/ui/ApiImage'
import { Button } from '../../../components/ui/Button'
import { CountryFlag } from '../../../components/ui/CountryFlag'
import { Pager } from '../../../components/ui/Pager'
import { StatusBanner } from '../../../components/ui/StatusBanner'
import { useCountry } from '../../../state/CountryContext'
import styles from '../Admin.module.css'
import { AdminHead } from '../AdminParts'

const PAGE_SIZE = 20
const REASON_MAX = 500   // UserProfile.SuspensionReasonMaxLength

type Message = { text: string; isError: boolean } | null
type Panel = { id: string; kind: 'roles' | 'suspend' } | null

const day = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

/** How long a suspension lasts. */
const LENGTHS = [
  { key: '7', label: '7 days', days: 7 },
  { key: '30', label: '30 days', days: 30 },
  { key: 'open', label: 'Until further notice', days: null },
] as const

/** The person's roles as small chips (Customer, which everyone has, is left out). */
function RoleChips({ roles }: { roles: string[] }) {
  const shown = roles.filter((r) => r !== Roles.Customer).sort()
  if (shown.length === 0) return <span className="muted">Customer</span>
  return (
    <span className={styles.roleChips}>
      {shown.map((r) => (
        <span key={r} className={`${styles.chip} ${r === Roles.Admin ? styles.chipWait : styles.chipGo}`}>{roleName(r)}</span>
      ))}
    </span>
  )
}

/**
 * Admin → Users: everyone who has signed up, newest first, as cards (two per row on a big screen): photo, name,
 * email and phone, Active / Suspended; then country, joined, shop and roles; then, under a line, the buttons.
 * Search by name, or show only suspended people. Each card opens, under its buttons:
 * <b>Roles</b>: tick or untick Admin and the staff roles (your own Admin can't be removed; Seller follows the shop),
 * or <b>Suspend</b>: how long and why (they see the reason; their shop is hidden with them). Lift ends a suspension.
 */
export default function AdminUsersPage() {
  const { countries } = useCountry()
  const queryClient = useQueryClient()
  const [params, setParams] = useSearchParams()
  const search = params.get('q') ?? ''
  const suspendedOnly = params.get('suspended') === '1'
  const page = Math.max(1, Number(params.get('page')) || 1)
  const [typed, setTyped] = useState(search)
  const [panel, setPanel] = useState<Panel>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<Message>(null)
  const [length, setLength] = useState<(typeof LENGTHS)[number]['key']>('7')
  const [reason, setReason] = useState('')

  const query = useQuery({
    queryKey: ['admin', 'users', search, suspendedOnly, page],
    queryFn: async ({ signal }) => unwrap(await getUsers({ search, suspendedOnly, page, pageSize: PAGE_SIZE }, signal)),
    placeholderData: (previous) => previous,
  })
  const list = query.data

  const change = (next: Record<string, string | null>) => {
    const p = new URLSearchParams(params)
    for (const [k, v] of Object.entries(next)) { if (v) p.set(k, v); else p.delete(k) }
    if (!('page' in next)) p.delete('page')
    setParams(p)
    setPanel(null)
  }

  const run = async (action: () => Promise<ApiResult<unknown>>, done: string) => {
    setBusy(true)
    setMessage(null)
    const result = await action()
    setBusy(false)
    if (result.ok) await queryClient.invalidateQueries({ queryKey: ['admin'] })
    setMessage(result.ok ? { text: done, isError: false } : { text: result.error.displayMessage, isError: true })
    return result.ok
  }

  const open = (u: AdminUserDto, kind: 'roles' | 'suspend') => {
    setPanel(panel?.id === u.id && panel.kind === kind ? null : { id: u.id, kind })
    setLength('7'); setReason(''); setMessage(null)
  }

  const toggleRole = (u: AdminUserDto, role: string, has: boolean) => run(
    () => has ? removeRole(u.id, role) : grantRole(u.id, role),
    has ? `${u.fullName} is no longer ${roleName(role)}. They've been signed out so it applies now.`
        : `${u.fullName} is now ${roleName(role)}. It applies the next time they sign in.`)

  const onSuspend = async (u: AdminUserDto) => {
    const days = LENGTHS.find((l) => l.key === length)?.days ?? null
    const until = days === null ? null : new Date(Date.now() + days * 86_400_000).toISOString()
    setBusy(true); setMessage(null)
    const result = await suspendUser(u.id, reason.trim(), until)
    setBusy(false)
    if (!result.ok) { setMessage({ text: result.error.displayMessage, isError: true }); return }
    const d = result.value
    await queryClient.invalidateQueries({ queryKey: ['admin'] })
    setMessage({
      text: `${u.fullName} is suspended.` + (d.shopSuspended
        ? ` Their shop is hidden; ${d.cancelledShopOrders} order(s) cancelled (${d.ordersToRefund} to refund).` : ''),
      isError: false,
    })
    setPanel(null)
  }

  const onSearch = (e: FormEvent) => { e.preventDefault(); change({ q: typed.trim() || null }) }

  return (
    <>
      <AdminHead title="Users" sub="Everyone who has signed up. Give staff roles, or suspend people who abuse Phloem." />
      <StatusBanner message={message?.text} isError={message?.isError} />

      <div className={styles.filters}>
        <form className={styles.search} onSubmit={onSearch} role="search">
          <input type="search" value={typed} onChange={(e) => setTyped(e.target.value)}
                 placeholder="Search by name" aria-label="Search by name" />
          <Button type="submit" small variant="secondary">Search</Button>
        </form>
        <label className={styles.toggle}>
          <input type="checkbox" checked={suspendedOnly} onChange={(e) => change({ suspended: e.target.checked ? '1' : null })} />
          Suspended only
        </label>
      </div>

      {query.isError && (
        <div className={styles.error}>
          <StatusBanner isError message="We couldn't load the users." />
          <Button small variant="outline" onClick={() => query.refetch()}>Try again</Button>
        </div>
      )}
      {!list && query.isPending && <p className="muted" aria-busy="true">Loading…</p>}

      {list && (
        <>
          <p className={styles.count}>
            {list.totalCount === 0 ? 'Nobody here.' : `${list.totalCount} ${list.totalCount === 1 ? 'person' : 'people'}`}
            {search && <> matching "{search}" <button type="button" className={styles.clear} onClick={() => { setTyped(''); change({ q: null }) }}>Clear</button></>}
          </p>
          {list.items.length > 0 && (
            <ul className={styles.people}>
              {list.items.map((u) => {
                const c = countries.find((x) => x.country === u.country)
                const isOpen = panel?.id === u.id
                return (
                  <li key={u.id} className={`${styles.person} ${u.isSuspended ? styles.personSuspended : ''}`}>
                    {/* Who */}
                    <div className={styles.personTop}>
                      {u.photoUrl
                        ? <ApiImage src={u.photoUrl} alt="" className={styles.personPhoto} />
                        : <span className={styles.personInitial} aria-hidden="true">{u.fullName.charAt(0).toUpperCase()}</span>}
                      <div className={styles.personWho}>
                        <h2 className={styles.personName}>
                          {u.fullName}{u.isYou && <span className={styles.you}> (you)</span>}
                        </h2>
                        <a href={`mailto:${u.email}`} className={styles.personContact}>{u.email}</a>
                        {u.phoneNumber && <a href={`tel:${u.phoneNumber}`} className={styles.personContact}>{u.phoneNumber}</a>}
                      </div>
                      {u.isSuspended
                        ? <span className={`${styles.chip} ${styles.chipStop}`}>Suspended</span>
                        : <span className={`${styles.chip} ${styles.chipGo}`}>Active</span>}
                    </div>

                    {/* Facts */}
                    <div className={styles.personFacts}>
                      {c && <span className={styles.fact}><CountryFlag country={c} /> {c.name}</span>}
                      <span className={styles.fact}>Joined {day(u.memberSince)}</span>
                      {u.shopName && <span className={styles.fact}>🏪 {u.shopName}</span>}
                      <span className={styles.fact} title="The latest Terms & Conditions version they accepted">
                        📄 {u.acceptedTermsVersion
                          ? `Terms v${u.acceptedTermsVersion}${u.acceptedTermsAt ? ` · ${day(u.acceptedTermsAt)}` : ''}`
                          : 'Terms not accepted yet'}
                      </span>
                      <RoleChips roles={u.roles} />
                    </div>
                    {u.isSuspended && (
                      <p className={styles.personNote}>
                        Suspended {u.suspendedUntil ? `until ${day(u.suspendedUntil)}` : 'until further notice'}
                        {u.suspensionReason && <>: "{u.suspensionReason}"</>}
                      </p>
                    )}

                    {/* Actions, under a line */}
                    <div className={styles.personActions}>
                      <Button small variant={isOpen && panel?.kind === 'roles' ? 'primary' : 'secondary'}
                              aria-expanded={isOpen && panel?.kind === 'roles'} onClick={() => open(u, 'roles')}>
                        Roles
                      </Button>
                      {u.isSuspended ? (
                        <Button small variant="outline" disabled={busy}
                                onClick={() => run(() => reinstateUser(u.id), `${u.fullName} can sign in again.`)}>
                          Lift suspension
                        </Button>
                      ) : u.canBeSuspended && (
                        <Button small variant="outline" className={styles.danger}
                                aria-expanded={isOpen && panel?.kind === 'suspend'} onClick={() => open(u, 'suspend')}>
                          Suspend
                        </Button>
                      )}
                    </div>

                    {isOpen && (panel.kind === 'roles' ? (
                      <div className={styles.inlinePanel} role="group" aria-label={`Roles for ${u.fullName}`}>
                        <ul className={styles.roleList}>
                          {assignableRoles.map((r) => {
                            const has = u.roles.includes(r.role)
                            const locked = !!u.isYou && r.role === Roles.Admin && has
                            return (
                              <li key={r.role}>
                                <label className={locked ? styles.locked : undefined}>
                                  <input type="checkbox" checked={has} disabled={busy || locked}
                                         onChange={() => toggleRole(u, r.role, has)} />
                                  <span><strong>{r.name}</strong><span className={styles.roleAbout}>{r.about}</span>
                                    {locked && <span className={styles.lockNote}>You can't remove your own Admin role. Another admin has to.</span>}
                                  </span>
                                </label>
                              </li>
                            )
                          })}
                        </ul>
                        <p className={styles.panelHint}>
                          Seller follows their shop, and everyone is a Customer. Taking a role away signs them out so it
                          applies straight away.
                        </p>
                      </div>
                    ) : (
                      <form className={styles.inlinePanel} onSubmit={(e) => { e.preventDefault(); void onSuspend(u) }}>
                        <span className={styles.panelHint}>
                          They're signed out and can't sign in.{u.shopName && ' Their shop is hidden and its unfinished orders are cancelled (paid ones refunded).'} They're emailed the reason.
                        </span>
                        <div className={styles.lengths} role="radiogroup" aria-label="How long">
                          {LENGTHS.map((l) => (
                            <label key={l.key} className={styles.lengthChoice}>
                              <input type="radio" name={`length-${u.id}`} checked={length === l.key} onChange={() => setLength(l.key)} />
                              {l.label}
                            </label>
                          ))}
                        </div>
                        <label className={styles.reasonLabel}>
                          <span>Why? They'll see this.</span>
                          <textarea value={reason} maxLength={REASON_MAX} onChange={(e) => setReason(e.target.value)}
                                    placeholder="e.g. Repeated fake orders" />
                        </label>
                        <div className={styles.row}>
                          <Button type="submit" small variant="cta" busy={busy} busyText="Suspending…" disabled={!reason.trim()}>
                            Suspend {u.fullName.split(' ')[0]}
                          </Button>
                          <Button small variant="outline" onClick={() => setPanel(null)}>Cancel</Button>
                        </div>
                      </form>
                    ))}
                  </li>
                )
              })}
            </ul>
          )}
          <Pager page={list.page} totalPages={list.totalPages} onChange={(p) => change({ page: String(p) })} />
        </>
      )}
    </>
  )
}
