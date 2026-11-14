import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { unwrap, type ApiResult } from '../../../api/apiError'
import type { AdminTownDto, AdminZoneDto, RegionDto } from '../../../api/contracts/dtos'
import type { Country } from '../../../api/contracts/enums'
import {
  checkTown, createZone, deleteTown, deleteZone, getAdminZones, getDistricts, getTownsToCheck, moveRegionToZone,
  renameZone,
} from '../../../api/services/locationService'
import { Button } from '../../../components/ui/Button'
import { Pager } from '../../../components/ui/Pager'
import { StatusBanner } from '../../../components/ui/StatusBanner'
import { useCountry } from '../../../state/CountryContext'
import styles from '../Admin.module.css'
import { AdminHead } from '../AdminParts'
import { ShippingTabs } from './ShippingTabs'

const ZONE_NAME_MAX = 60   // DeliveryZone.NameMaxLength
const TOWNS_PAGE_SIZE = 20

type Message = { text: string; isError: boolean } | null

/**
 * Admin → Shipping → Zones & towns.
 * <b>Zones</b>: which states cost the same to deliver to the door (e.g. "South-West"). Move a state with its
 * "Move to" list; each route then sets a door delivery charge per zone (Routes & prices).
 * <b>Towns to check</b>: towns customers typed that weren't on our list; the AI suggested the LGA and the customer
 * confirmed it. Mark each correct, move it to the right LGA, fix the spelling, or delete it.
 */
export default function AdminZonesPage() {
  const { countries } = useCountry()
  const queryClient = useQueryClient()
  const [country, setCountry] = useState<Country>('Nigeria')
  const [newName, setNewName] = useState<string | null>(null)
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<Message>(null)
  const zones = useQuery({
    queryKey: ['admin', 'zones', country],
    queryFn: async ({ signal }) => unwrap(await getAdminZones(country, signal)),
  })

  const run = async (action: () => Promise<ApiResult<unknown>>, done: string) => {
    setBusy(true); setMessage(null)
    const result = await action()
    setBusy(false)
    if (!result.ok) { setMessage({ text: result.error.displayMessage, isError: true }); return false }
    await queryClient.invalidateQueries({ queryKey: ['admin', 'zones'] })
    await queryClient.invalidateQueries({ queryKey: ['admin', 'routes'] })
    setMessage({ text: done, isError: false })
    return true
  }

  const onCreate = async (e: FormEvent) => {
    e.preventDefault()
    const name = newName?.trim() ?? ''
    if (!name) { setMessage({ text: 'Enter the zone name, e.g. "South-South".', isError: true }); return }
    if (await run(() => createZone(country, name), `Zone "${name}" added. Move states into it, then set its door delivery charge on each route.`)) setNewName(null)
  }

  const onRename = async (e: FormEvent) => {
    e.preventDefault()
    if (!renaming?.name.trim()) return
    if (await run(() => renameZone(renaming.id, renaming.name.trim()), 'Zone renamed.')) setRenaming(null)
  }

  const data = zones.data
  const label = data?.regionLabel ?? 'State'
  const allZones = data?.zones ?? []

  const moveSelect = (region: RegionDto, current: string | null) => (
    <select className={styles.miniSelect} aria-label={`Move ${region.name} to another zone`} disabled={busy} value={current ?? ''}
            onChange={(e) => {
              const target = e.target.value || null
              const name = allZones.find((z) => z.id === target)?.name
              void run(() => moveRegionToZone(region.id, target), target ? `${region.name} moved to ${name}.` : `${region.name} is in no zone now.`)
            }}>
      <option value="">No zone</option>
      {allZones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
    </select>
  )

  const zonePanel = (z: AdminZoneDto) => (
    <li key={z.id} className={styles.priceCard}>
      <div className={styles.priceCardHead}>
        {renaming?.id === z.id ? (
          <form className={styles.inlineForm} onSubmit={onRename}>
            <input className={styles.miniInput} value={renaming.name} maxLength={ZONE_NAME_MAX} autoFocus aria-label="Zone name"
                   onChange={(e) => setRenaming({ ...renaming, name: e.target.value })} />
            <Button type="submit" small variant="secondary" busy={busy} busyText="…">Save</Button>
            <Button small variant="plain" onClick={() => setRenaming(null)}>Cancel</Button>
          </form>
        ) : (
          <>
            <strong>{z.name}</strong>
            <span className={styles.rowButtons}>
              <span className="muted">{z.regions.length} {label.toLowerCase()}{z.regions.length === 1 ? '' : 's'}</span>
              <button type="button" className={styles.linkButton} disabled={busy} onClick={() => setRenaming({ id: z.id, name: z.name })}>Rename</button>
              {z.regions.length === 0 && (
                <button type="button" className={`${styles.linkButton} ${styles.linkDanger}`} disabled={busy}
                        onClick={() => void run(() => deleteZone(z.id), `Zone "${z.name}" deleted.`)}>Delete</button>
              )}
            </span>
          </>
        )}
      </div>
      {z.regions.length === 0
        ? <p className={styles.setupNote}>No {label.toLowerCase()}s yet. Use "Move to" on a {label.toLowerCase()} to put it here.</p>
        : (
          <ul className={styles.windowList}>
            {z.regions.map((r) => <li key={r.id}><span>{r.name}</span>{moveSelect(r, z.id)}</li>)}
          </ul>
        )}
    </li>
  )

  return (
    <>
      <AdminHead title="Shipping" sub="Parcels between countries: routes and prices, parcels at the hub, and what can be sent.">
        {newName === null && <Button small variant="cta" onClick={() => { setNewName(''); setMessage(null) }}>+ Add zone</Button>}
      </AdminHead>
      <ShippingTabs />

      <div className={styles.row} style={{ marginBottom: 12 }}>
        <label className={styles.inlineForm}>
          <span>Country</span>
          <select className={styles.miniSelect} value={country} onChange={(e) => setCountry(e.target.value as Country)}>
            {countries.map((c) => <option key={c.country} value={c.country}>{c.name}</option>)}
          </select>
        </label>
      </div>
      <p className="muted" style={{ margin: '0 0 12px' }}>
        A zone groups {label.toLowerCase()}s that cost the same to deliver to the door. Set each zone's charge on
        Routes & prices. {label}s in no zone get door delivery at no extra charge.
      </p>
      <StatusBanner message={message?.text} isError={message?.isError} />

      {newName !== null && (
        <form className={`${styles.panel} ${styles.stackForm}`} onSubmit={onCreate}>
          <label><span>New zone name</span>
            <input value={newName} maxLength={ZONE_NAME_MAX} autoFocus placeholder="e.g. South-South" onChange={(e) => setNewName(e.target.value)} />
          </label>
          <div className={styles.row}>
            <Button type="submit" small variant="secondary" busy={busy} busyText="Saving…">Add zone</Button>
            <Button small variant="plain" onClick={() => setNewName(null)}>Cancel</Button>
          </div>
        </form>
      )}

      {zones.isPending && <p className="muted" aria-busy="true">Loading…</p>}
      {zones.isError && (
        <div className={styles.error}>
          <StatusBanner isError message="We couldn't load the zones." />
          <Button small variant="outline" onClick={() => zones.refetch()}>Try again</Button>
        </div>
      )}
      {data && data.zones.length === 0 && data.regionsWithoutZone.length === 0 && (
        <p className="muted">This country has no {label.toLowerCase()} list yet, so its parcels have no zones.</p>
      )}
      {data && (data.zones.length > 0 || data.regionsWithoutZone.length > 0) && (
        <ul className={styles.priceCards}>
          {data.zones.map(zonePanel)}
          {data.regionsWithoutZone.length > 0 && (
            <li className={`${styles.priceCard} ${styles.routeOff}`}>
              <div className={styles.priceCardHead}><strong>In no zone</strong><span className="muted">No door delivery charge</span></div>
              <ul className={styles.windowList}>
                {data.regionsWithoutZone.map((r) => <li key={r.id}><span>{r.name}</span>{moveSelect(r, null)}</li>)}
              </ul>
            </li>
          )}
        </ul>
      )}

      <TownsToCheck />
    </>
  )
}

/** Towns customers added (the AI suggested the LGA, the customer confirmed it), for staff to check. */
function TownsToCheck() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState<{ town: AdminTownDto; districtId: string; name: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<Message>(null)
  const towns = useQuery({
    queryKey: ['admin', 'towns-to-check', page],
    queryFn: async ({ signal }) => unwrap(await getTownsToCheck(page, TOWNS_PAGE_SIZE, signal)),
  })
  const districts = useQuery({
    queryKey: ['districts', editing?.town.regionId],
    queryFn: async ({ signal }) => unwrap(await getDistricts(editing!.town.regionId, signal)),
    enabled: !!editing,
    staleTime: 24 * 60 * 60_000,
  })

  const run = async (action: () => Promise<ApiResult<unknown>>, done: string) => {
    setBusy(true); setMessage(null)
    const result = await action()
    setBusy(false)
    if (!result.ok) { setMessage({ text: result.error.displayMessage, isError: true }); return }
    await queryClient.invalidateQueries({ queryKey: ['admin', 'towns-to-check'] })
    setMessage({ text: done, isError: false })
    setEditing(null)
  }

  const list = towns.data?.items ?? []

  return (
    <section className={styles.panel} aria-labelledby="towns-title" style={{ marginTop: 20 }}>
      <h2 id="towns-title" className={styles.sectionTitle} style={{ margin: 0 }}>Towns to check</h2>
      <p className="muted" style={{ margin: 0 }}>
        Towns customers typed that weren't on our list. The AI suggested the LGA and the customer confirmed it; they're
        already used as suggestions. Check each one.
      </p>
      <StatusBanner message={message?.text} isError={message?.isError} />
      {towns.isPending && <p className="muted" aria-busy="true">Loading…</p>}
      {towns.isError && <StatusBanner isError message="We couldn't load the towns." />}
      {towns.isSuccess && list.length === 0 && <p className={styles.allClear}>✓ Nothing to check.</p>}
      {list.length > 0 && (
        <ul className={styles.ruleList}>
          {list.map((t) => (
            <li key={t.id} className={styles.ruleRow}>
              {editing?.town.id === t.id ? (
                <form className={`${styles.stackForm} ${styles.ruleForm}`}
                      onSubmit={(e) => {
                        e.preventDefault()
                        void run(() => checkTown(t.id, editing.districtId !== t.districtId ? editing.districtId : null,
                                                 editing.name.trim() !== t.name ? editing.name.trim() : null),
                                 `${editing.name.trim()} saved and checked.`)
                      }}>
                  <label><span>Town</span>
                    <input value={editing.name} maxLength={80} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
                  </label>
                  <label><span>LGA in {t.regionName}</span>
                    <select className={styles.miniSelect} value={editing.districtId}
                            onChange={(e) => setEditing({ ...editing, districtId: e.target.value })}>
                      {(districts.data ?? [{ id: t.districtId, name: t.districtName }]).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </label>
                  <div className={styles.row}>
                    <Button type="submit" small variant="secondary" busy={busy} busyText="Saving…">Save and mark checked</Button>
                    <Button small variant="plain" onClick={() => setEditing(null)}>Cancel</Button>
                  </div>
                </form>
              ) : (
                <>
                  <span className={styles.rowText}>
                    <strong>{t.name}</strong>
                    <span className="muted">{t.districtName} LGA, {t.regionName} · added {new Date(t.addedAt).toLocaleDateString('en-GB')}</span>
                  </span>
                  <span className={styles.rowButtons}>
                    <Button small variant="secondary" disabled={busy}
                            onClick={() => void run(() => checkTown(t.id, null, null), `${t.name}: marked correct.`)}>✓ Correct</Button>
                    <Button small variant="outline" disabled={busy}
                            onClick={() => { setEditing({ town: t, districtId: t.districtId, name: t.name }); setMessage(null) }}>Fix</Button>
                    <Button small variant="outline" className={styles.danger} disabled={busy}
                            onClick={() => void run(() => deleteTown(t.id), `${t.name} deleted.`)}>Delete</Button>
                  </span>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      {towns.data && towns.data.totalPages > 1 && <Pager page={page} totalPages={towns.data.totalPages} onChange={setPage} />}
    </section>
  )
}
