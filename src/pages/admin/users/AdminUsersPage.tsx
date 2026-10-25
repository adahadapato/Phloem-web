import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Fragment, useState, type FormEvent } from 'react'
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
 * Admin → Users: everyone who has signed up, newest first, in a table (photo, name, email and phone, country, roles,
 * shop, joined, suspended or not). Search by name, or show only suspended people. Each row opens, underneath it:
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
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr><th>Person</th><th>Country</th><th>Roles</th><th>Joined</th><th>Status</th><th aria-label="Actions" /></tr>
                </thead>
                <tbody>
                  {list.items.map((u) => {
                    const c = countries.find((x) => x.country === u.country)
                    const isOpen = panel?.id === u.id
                    return (
                      <Fragment key={u.id}>
                        <tr className={isOpen ? styles.rowOpen : undefined}>
                          <td>
                            <div className={styles.shopCell}>
                              {u.photoUrl
                                ? <ApiImage src={u.photoUrl} alt="" className={styles.rowLogo} />
                                : <span className={styles.initial} aria-hidden="true">{u.fullName.charAt(0).toUpperCase()}</span>}
                              <span className={styles.rowText}>
                                <strong>{u.fullName}{u.isYou && <span className={styles.you}> (you)</span>}</strong>
                                <span className="muted">{u.email}{u.phoneNumber && ` · ${u.phoneNumber}`}</span>
                                {u.shopName && <span className="muted">Shop: {u.shopName}</span>}
                              </span>
                            </div>
                          </td>
                          <td>{c ? <span className={styles.place}><CountryFlag country={c} /> {c.name}</span> : u.country}</td>
                          <td><RoleChips roles={u.roles} /></td>
                          <td>{day(u.memberSince)}</td>
                          <td>
                            {u.isSuspended
                              ? <span className={`${styles.chip} ${styles.chipStop}`} title={u.suspensionReason ?? undefined}>
                                  Suspended {u.suspendedUntil ? `to ${day(u.suspendedUntil)}` : '(no end date)'}
                                </span>
                              : <span className={`${styles.chip} ${styles.chipGo}`}>Active</span>}
                          </td>
                          <td>
                            <div className={styles.rowButtons}>
                              <Button small variant="secondary" aria-expanded={isOpen && panel?.kind === 'roles'}
                                      onClick={() => open(u, 'roles')}>Roles</Button>
                              {u.isSuspended ? (
                                <Button small variant="outline" disabled={busy}
                                        onClick={() => run(() => reinstateUser(u.id), `${u.fullName} can sign in again.`)}>
                                  Lift suspension
                                </Button>
                              ) : u.canBeSuspended && (
                                <Button small variant="outline" className={styles.danger} aria-expanded={isOpen && panel?.kind === 'suspend'}
                                        onClick={() => open(u, 'suspend')}>Suspend</Button>
                              )}
                            </div>
                          </td>
                        </tr>
                        {isOpen && (
                          <tr className={styles.panelRow}>
                            <td colSpan={6}>
                              {panel.kind === 'roles' ? (
                                <div className={styles.inlinePanel} role="group" aria-label={`Roles for ${u.fullName}`}>
                                  <strong>Roles for {u.fullName}</strong>
                                  <ul className={styles.roleList}>
                                    {assignableRoles.map((r) => {
                                      const has = u.roles.includes(r.role)
                                      const locked = !!u.isYou && r.role === Roles.Admin && has
                                      return (
                                        <li key={r.role}>
                                          <label className={locked ? styles.locked : undefined}>
                                            <input type="checkbox" checked={has} disabled={busy || locked}
                                                   onChange={() => toggleRole(u, r.role, has)} />
                                            <span><strong>{r.name}</strong> <span className="muted">{r.about}</span>
                                              {locked && <span className={styles.lockNote}>You can't remove your own Admin role. Another admin has to.</span>}
                                            </span>
                                          </label>
                                        </li>
                                      )
                                    })}
                                  </ul>
                                  <p className="muted" style={{ margin: 0, fontSize: 13 }}>
                                    Seller follows their shop (approving gives it, blocking takes it away). Everyone is a Customer.
                                    Taking a role away signs them out so it applies straight away.
                                  </p>
                                </div>
                              ) : (
                                <form className={styles.inlinePanel} onSubmit={(e) => { e.preventDefault(); void onSuspend(u) }}>
                                  <strong>Suspend {u.fullName}</strong>
                                  <span className="muted">
                                    They're signed out and can't sign in.{u.shopName && ' Their shop is hidden and its unfinished orders are cancelled (paid ones refunded).'} They're emailed the reason.
                                  </span>
                                  <div className={styles.lengths} role="radiogroup" aria-label="How long">
                                    {LENGTHS.map((l) => (
                                      <label key={l.key} className={styles.lengthChoice}>
                                        <input type="radio" name="length" checked={length === l.key} onChange={() => setLength(l.key)} />
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
                                      Suspend
                                    </Button>
                                    <Button small variant="outline" onClick={() => setPanel(null)}>Cancel</Button>
                                  </div>
                                </form>
                              )}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          <Pager page={list.page} totalPages={list.totalPages} onChange={(p) => change({ page: String(p) })} />
        </>
      )}
    </>
  )
}
