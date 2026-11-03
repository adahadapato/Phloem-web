import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router'
import { unwrap } from '../../../api/apiError'
import type { Country, StaffAction } from '../../../api/contracts/enums'
import { getAudit } from '../../../api/services/staffService'
import { Button } from '../../../components/ui/Button'
import { Pager } from '../../../components/ui/Pager'
import { StatusBanner } from '../../../components/ui/StatusBanner'
import { useCountry } from '../../../state/CountryContext'
import styles from '../Admin.module.css'
import { AdminHead } from '../AdminParts'

const PAGE_SIZE = 30

/** Each action in words, in the order the filter lists them. */
const ACTIONS: { value: StaffAction; label: string }[] = [
  { value: 'RoleGiven', label: 'Gave a role' },
  { value: 'RoleRemoved', label: 'Took a role away' },
  { value: 'CountriesChanged', label: 'Changed countries' },
  { value: 'RolePermissionsChanged', label: 'Changed a job role' },
  { value: 'UserSuspended', label: 'Suspended someone' },
  { value: 'UserReinstated', label: 'Lifted a suspension' },
  { value: 'ContactMessagesViewed', label: 'Opened Contact messages' },
  { value: 'ContactMessageUpdated', label: 'Updated a Contact message' },
  { value: 'ParcelViewed', label: "Opened a parcel's details" },
  { value: 'ShopDocumentOpened', label: "Opened a shop's document" },
  { value: 'ShopBlocked', label: 'Blocked a shop' },
  { value: 'ShopUnblocked', label: 'Unblocked a shop' },
  { value: 'OrderViewed', label: "Opened an order's details" },
  { value: 'AiPromptSaved', label: 'Changed an AI prompt' },
  { value: 'AiPromptRestored', label: 'Restored an AI prompt' },
  { value: 'AiPromptReset', label: 'Reset an AI prompt' },
  { value: 'AiCallViewed', label: 'Opened an AI request' },
  { value: 'SeoEdited', label: "Changed a page's search text" },
  { value: 'SeoRewritten', label: 'Asked AI to rewrite a page\'s search text' },
  { value: 'ChangeProposed', label: 'Asked for a second person' },
  { value: 'ChangeApproved', label: 'Approved a change' },
  { value: 'ChangeRejected', label: 'Rejected a change' },
  { value: 'ChangeWithdrawn', label: 'Took back a proposal' },
]

const actionLabel = (a: StaffAction) => ACTIONS.find((x) => x.value === a)?.label ?? a

const when = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

/** "2026-11-02" (a date picked here, local) → the start of that day, UTC ISO. */
const startOf = (day: string) => new Date(`${day}T00:00:00`).toISOString()

/** "2026-11-02" → the start of the NEXT day, so the whole day is included. */
const endOf = (day: string) => {
  const d = new Date(`${day}T00:00:00`)
  d.setDate(d.getDate() + 1)
  return d.toISOString()
}

/**
 * Admin → Audit log: who did what, newest first. Filter by kind of action, country, dates, or one person (click a
 * name). Everything is in the address (?action=&country=&from=&to=&actor=&page=), so a filtered view can be shared.
 *
 * Recorded so far: changes to who can do what, suspensions, and every opening of people's messages, parcel details
 * and shop documents. Lines are never changed or deleted.
 */
export default function AdminAuditPage() {
  const { countries } = useCountry()
  const [params, setParams] = useSearchParams()
  const action = (params.get('action') as StaffAction | null) ?? undefined
  const country = (params.get('country') as Country | null) ?? undefined
  const from = params.get('from') ?? ''
  const to = params.get('to') ?? ''
  const actorId = params.get('actor') ?? undefined
  const actorName = params.get('actorName') ?? ''
  const page = Math.max(1, Number(params.get('page')) || 1)

  const query = useQuery({
    queryKey: ['admin', 'audit', action, country, from, to, actorId, page],
    queryFn: async ({ signal }) => unwrap(await getAudit({
      action, country, actorId,
      from: from ? startOf(from) : undefined,
      to: to ? endOf(to) : undefined,
      page, pageSize: PAGE_SIZE,
    }, signal)),
    placeholderData: (previous) => previous,
  })
  const list = query.data

  const change = (next: Record<string, string | null>) => {
    const p = new URLSearchParams(params)
    for (const [k, v] of Object.entries(next)) { if (v) p.set(k, v); else p.delete(k) }
    if (!('page' in next)) p.delete('page')
    setParams(p)
  }
  const countryName = (c: Country) => countries.find((x) => x.country === c)?.name ?? c

  return (
    <>
      <AdminHead title="Audit log"
                 sub="Who did what: changes to access, suspensions, and every time staff opened people's messages, parcels or shop documents." />

      <div className={styles.filters}>
        <select className={styles.select} aria-label="What" value={action ?? ''}
                onChange={(e) => change({ action: e.target.value || null })}>
          <option value="">Everything</option>
          {ACTIONS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
        </select>
        <select className={styles.select} aria-label="Country" value={country ?? ''}
                onChange={(e) => change({ country: e.target.value || null })}>
          <option value="">All countries</option>
          {countries.map((c) => <option key={c.country} value={c.country}>{c.name}</option>)}
        </select>
        <label className={styles.toggle}>
          From <input type="date" value={from} max={to || undefined} onChange={(e) => change({ from: e.target.value || null })} />
        </label>
        <label className={styles.toggle}>
          To <input type="date" value={to} min={from || undefined} onChange={(e) => change({ to: e.target.value || null })} />
        </label>
        {actorId && (
          <span className={styles.fact}>
            By {actorName || 'one person'}{' '}
            <button type="button" className={styles.clear} onClick={() => change({ actor: null, actorName: null })}>Clear</button>
          </span>
        )}
      </div>

      {query.isError && (
        <div className={styles.error}>
          <StatusBanner isError message="We couldn't load the audit log." />
          <Button small variant="outline" onClick={() => query.refetch()}>Try again</Button>
        </div>
      )}
      {!list && query.isPending && <p className="muted" aria-busy="true">Loading…</p>}

      {list && (
        <>
          <p className={styles.count}>
            {list.totalCount === 0 ? 'Nothing recorded for these filters.' : `${list.totalCount} ${list.totalCount === 1 ? 'entry' : 'entries'}`}
          </p>
          {list.items.length > 0 && (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">When</th>
                    <th scope="col">Who</th>
                    <th scope="col">What</th>
                    <th scope="col">To what</th>
                    <th scope="col">Country</th>
                    <th scope="col">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {list.items.map((e) => (
                    <tr key={e.id}>
                      <td>{when(e.at)}</td>
                      <td>
                        <button type="button" className={styles.linkButton} title={`Only what ${e.actorName} did`}
                                onClick={() => change({ actor: e.actorId, actorName: e.actorName })}>
                          {e.actorName}
                        </button>
                      </td>
                      <td>{actionLabel(e.action)}</td>
                      <td>{e.target}</td>
                      <td>{e.country ? countryName(e.country) : '—'}</td>
                      <td>{e.detail ?? ''}</td>
                    </tr>
                  ))}
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
