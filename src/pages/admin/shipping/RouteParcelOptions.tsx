import { useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import type { ApiResult } from '../../../api/apiError'
import type { AdminShipmentRouteDto } from '../../../api/contracts/dtos'
import { removeZoneCharge, setParcelOptions, setZoneCharge } from '../../../api/services/adminService'
import { Button } from '../../../components/ui/Button'
import { StatusBanner } from '../../../components/ui/StatusBanner'
import styles from '../Admin.module.css'

type Message = { text: string; isError: boolean } | null
type OptionsDraft = { divisor: string; fragile: string; pickupOn: boolean; pickup: string; hubAddress: string; hubHours: string }

const num = (t: string) => Number(t.trim().replace(',', '.'))
const MIN_DIVISOR = 1000
const MAX_DIVISOR = 10000

/** A copy of the drafts without one zone's entry. */
const withoutKey = (drafts: Record<string, string>, key: string) =>
  Object.fromEntries(Object.entries(drafts).filter(([k]) => k !== key))

/**
 * On a route's card: the parcel options (size divisor, fragile charge, home pickup, the destination hub where
 * recipients can collect) and the door delivery charge for each zone of the destination country. Zones themselves
 * (which states are in which) are set on Shipping → Zones.
 */
export function RouteParcelOptions({ r, money, symbol }: {
  r: AdminShipmentRouteDto
  money: (n: number) => string
  symbol: string
}) {
  const queryClient = useQueryClient()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<Message>(null)
  const [options, setOptions] = useState<OptionsDraft | null>(null)
  const [zoneDrafts, setZoneDrafts] = useState<Record<string, string>>({})

  const run = async (action: () => Promise<ApiResult<unknown>>, done: string) => {
    setBusy(true); setMessage(null)
    const result = await action()
    setBusy(false)
    if (!result.ok) { setMessage({ text: result.error.displayMessage, isError: true }); return false }
    await queryClient.invalidateQueries({ queryKey: ['admin', 'routes'] })
    setMessage({ text: done, isError: false })
    return true
  }

  const startOptions = () => {
    setOptions({
      divisor: String(r.volumeDivisor), fragile: String(r.fragileCharge),
      pickupOn: r.homePickupCharge !== null, pickup: r.homePickupCharge !== null ? String(r.homePickupCharge) : '',
      hubAddress: r.collectionHubAddress ?? '', hubHours: r.collectionHubHours ?? '',
    })
    setMessage(null)
  }

  const saveOptions = async (e: FormEvent) => {
    e.preventDefault()
    if (!options) return
    const divisor = num(options.divisor), fragile = num(options.fragile), pickup = num(options.pickup)
    if (!Number.isInteger(divisor) || divisor < MIN_DIVISOR || divisor > MAX_DIVISOR) {
      setMessage({ text: `The size divisor must be a whole number from ${MIN_DIVISOR} to ${MAX_DIVISOR} (usually 5000).`, isError: true }); return
    }
    if (!(fragile >= 0)) { setMessage({ text: 'Enter the fragile charge (0 or more).', isError: true }); return }
    if (options.pickupOn && !(pickup >= 0)) { setMessage({ text: 'Enter the home pickup charge (0 or more).', isError: true }); return }
    if (!options.hubAddress.trim() !== !options.hubHours.trim()) {
      setMessage({ text: "Give the collection hub's address AND opening hours, or leave both empty.", isError: true }); return
    }
    const ok = await run(() => setParcelOptions(r.fromCountry, r.toCountry, {
      volumeDivisor: divisor, fragileCharge: fragile, homePickupCharge: options.pickupOn ? pickup : null,
      collectionHubAddress: options.hubAddress.trim() || null, collectionHubHours: options.hubHours.trim() || null,
    }), 'Parcel options saved. New quotes use them at once.')
    if (ok) setOptions(null)
  }

  const saveZone = async (zoneId: string, name: string) => {
    const value = num(zoneDrafts[zoneId] ?? '')
    if (!(value >= 0)) { setMessage({ text: `Enter the door delivery charge for ${name} (0 or more).`, isError: true }); return }
    const ok = await run(() => setZoneCharge(r.fromCountry, r.toCountry, zoneId, value), `Door delivery to ${name} saved.`)
    if (ok) setZoneDrafts((drafts) => withoutKey(drafts, zoneId))
  }

  return (
    <>
      <StatusBanner message={message?.text} isError={message?.isError} />

      {/* Parcel options */}
      <div className={styles.priceBlock}>
        <div className={styles.priceLine}>
          <strong>Parcel options</strong>
          {!options && <button type="button" className={styles.linkButton} disabled={busy} onClick={startOptions}>Change</button>}
        </div>
        {!options ? (
          <ul className={styles.windowList}>
            <li><span>Size divisor</span><span className={styles.priceValue}>L × W × H ÷ {r.volumeDivisor.toLocaleString('en-GB')}</span></li>
            <li><span>Fragile handling</span><span className={styles.priceValue}>{r.fragileCharge > 0 ? money(r.fragileCharge) : 'Free'}</span></li>
            <li><span>Home pickup</span><span className={styles.priceValue}>{r.homePickupCharge === null ? 'Off' : money(r.homePickupCharge)}</span></li>
            <li>
              <span>Recipient collects from our hub</span>
              <span className={styles.priceValue} style={{ whiteSpace: 'pre-line', textAlign: 'right' }}>
                {r.collectionHubAddress ? `${r.collectionHubAddress}\n${r.collectionHubHours}` : 'Off'}
              </span>
            </li>
          </ul>
        ) : (
          <form className={styles.stackForm} onSubmit={saveOptions}>
            <label>
              <span>Size divisor (L × W × H in cm ÷ this = size weight in kg)</span>
              <input inputMode="numeric" value={options.divisor} onChange={(e) => setOptions({ ...options, divisor: e.target.value })} />
            </label>
            <label>
              <span>Fragile handling charge ({symbol})</span>
              <input inputMode="decimal" value={options.fragile} onChange={(e) => setOptions({ ...options, fragile: e.target.value })} />
            </label>
            <label className={styles.checkRow}>
              <input type="checkbox" checked={options.pickupOn} onChange={(e) => setOptions({ ...options, pickupOn: e.target.checked })} />
              <span>Offer home pickup</span>
            </label>
            {options.pickupOn && (
              <label>
                <span>Home pickup charge ({symbol})</span>
                <input inputMode="decimal" value={options.pickup} onChange={(e) => setOptions({ ...options, pickup: e.target.value })} />
              </label>
            )}
            <label>
              <span>Collection hub address (blank = recipients can't collect)</span>
              <textarea value={options.hubAddress} maxLength={300} onChange={(e) => setOptions({ ...options, hubAddress: e.target.value })} />
            </label>
            <label>
              <span>Collection hub opening hours</span>
              <input value={options.hubHours} maxLength={200} placeholder="e.g. Mon–Sat, 9am–5pm"
                     onChange={(e) => setOptions({ ...options, hubHours: e.target.value })} />
            </label>
            <div className={styles.row}>
              <Button type="submit" small variant="secondary" busy={busy} busyText="Saving…">Save options</Button>
              <Button small variant="plain" onClick={() => setOptions(null)}>Cancel</Button>
            </div>
          </form>
        )}
      </div>

      {/* Door delivery per zone */}
      <div className={styles.priceBlock}>
        <strong>Door delivery by zone ({r.currency})</strong>
        {r.zoneCharges.length === 0 ? (
          <p className={styles.priceHint}>
            The destination has no delivery zones, so door delivery costs nothing extra.{' '}
            <Link to="/admin/shipping/zones">Set up zones</Link>
          </p>
        ) : (
          <ul className={styles.windowList}>
            {r.zoneCharges.map((z) => {
              const draft = zoneDrafts[z.zoneId]
              return (
                <li key={z.zoneId}>
                  <span>{z.zoneName}{z.doorDeliveryCharge === null && <span className={styles.setupNote}> · no charge set</span>}</span>
                  {draft === undefined ? (
                    <span className={styles.priceValue}>
                      {z.doorDeliveryCharge === null ? '—' : money(z.doorDeliveryCharge)}
                      <button type="button" className={styles.linkButton} disabled={busy}
                              onClick={() => setZoneDrafts({ ...zoneDrafts, [z.zoneId]: z.doorDeliveryCharge?.toString() ?? '' })}>
                        {z.doorDeliveryCharge === null ? 'Set' : 'Change'}
                      </button>
                      {z.doorDeliveryCharge !== null && (
                        <button type="button" className={`${styles.linkButton} ${styles.linkDanger}`} disabled={busy}
                                onClick={() => void run(() => removeZoneCharge(r.fromCountry, r.toCountry, z.zoneId), `Door delivery to ${z.zoneName} is now free.`)}>
                          Remove
                        </button>
                      )}
                    </span>
                  ) : (
                    <span className={styles.inlineForm}>
                      <label className={styles.unitInput}>
                        <span>{symbol}</span>
                        <input inputMode="decimal" aria-label={`Door delivery to ${z.zoneName}`} value={draft} autoFocus
                               onChange={(e) => setZoneDrafts({ ...zoneDrafts, [z.zoneId]: e.target.value })} />
                      </label>
                      <Button small variant="secondary" busy={busy} busyText="…" onClick={() => void saveZone(z.zoneId, z.zoneName)}>Save</Button>
                      <Button small variant="plain" onClick={() => setZoneDrafts((drafts) => withoutKey(drafts, z.zoneId))}>Cancel</Button>
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
        )}
        <p className={styles.priceHint}>Added when the parcel goes to a door in that zone. Collecting from the hub has no delivery charge.</p>
      </div>
    </>
  )
}
