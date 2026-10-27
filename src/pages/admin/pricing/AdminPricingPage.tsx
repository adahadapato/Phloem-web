import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { unwrap, type ApiResult } from '../../../api/apiError'
import type { CommissionDto, CountryDto, DeliveryPricingDto } from '../../../api/contracts/dtos'
import type { DeliveryWindow } from '../../../api/contracts/enums'
import {
  getCommissions, getDeliveryPricing, removeWindow, setCommission, setShopFeeRange, setWindowCharge,
} from '../../../api/services/adminService'
import { Button } from '../../../components/ui/Button'
import { CountryFlag } from '../../../components/ui/CountryFlag'
import { deliveryWindows } from '../../../components/ui/labels'
import { StatusBanner } from '../../../components/ui/StatusBanner'
import { useCountry } from '../../../state/CountryContext'
import styles from '../Admin.module.css'
import { AdminHead } from '../AdminParts'

const MAX_COMMISSION = 50   // Commission.MaxRatePercent

type Message = { text: string; isError: boolean } | null
/** What is being changed on a card. */
type Editing =
  | { kind: 'commission'; rate: string }
  | { kind: 'fees'; min: string; max: string }
  | { kind: 'window'; window: DeliveryWindow; charge: string }
  | null

const toNumber = (text: string) => Number(text.trim().replace(',', '.'))

/**
 * One country's money settings on a card: Phloem's commission (on dishes only), the range shops may charge for
 * delivery, and the delivery times offered with what each adds. A country without delivery fees set up can't take
 * orders, so its card says so and offers to set them up first.
 */
function CountryCard({ country, commission, pricing }: {
  country: CountryDto
  commission: CommissionDto | undefined
  pricing: DeliveryPricingDto | undefined
}) {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState<Editing>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<Message>(null)
  const symbol = country.currencySymbol
  const money = (n: number) => `${symbol}${n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const run = async (action: () => Promise<ApiResult<unknown>>, done: (value: unknown) => string) => {
    setBusy(true)
    setMessage(null)
    const result = await action()
    setBusy(false)
    if (!result.ok) { setMessage({ text: result.error.displayMessage, isError: true }); return }
    await queryClient.invalidateQueries({ queryKey: ['admin', 'pricing'] })
    setMessage({ text: done(result.value), isError: false })
    setEditing(null)
  }

  const saveCommission = (e: FormEvent) => {
    e.preventDefault()
    if (editing?.kind !== 'commission') return
    const rate = toNumber(editing.rate)
    if (!(rate >= 0 && rate <= MAX_COMMISSION)) {
      setMessage({ text: `Enter a commission between 0 and ${MAX_COMMISSION}%.`, isError: true })
      return
    }
    void run(() => setCommission(country.country, rate), () => `Commission in ${country.name} is now ${rate}%. It applies to orders delivered from now on.`)
  }

  const saveFees = (e: FormEvent) => {
    e.preventDefault()
    if (editing?.kind !== 'fees') return
    const min = toNumber(editing.min)
    const max = toNumber(editing.max)
    if (!(min >= 0) || !(max >= min)) {
      setMessage({ text: 'Enter a lowest fee of 0 or more, and a highest fee at least as high.', isError: true })
      return
    }
    void run(() => setShopFeeRange(country.country, min, max), (moved) => {
      const n = typeof moved === 'number' ? moved : 0
      return `Shops in ${country.name} can now charge ${money(min)} – ${money(max)} for delivery.` +
        (n > 0 ? ` ${n} shop${n === 1 ? '' : 's'} had their fee moved into the range and were emailed.` : '')
    })
  }

  const saveWindow = (e: FormEvent) => {
    e.preventDefault()
    if (editing?.kind !== 'window') return
    const charge = toNumber(editing.charge || '0')
    if (!(charge >= 0)) { setMessage({ text: 'Enter 0 or more.', isError: true }); return }
    const label = deliveryWindows.find((w) => w.value === editing.window)?.label ?? editing.window
    void run(() => setWindowCharge(country.country, editing.window, charge),
      () => `"${label}" in ${country.name}: ${charge === 0 ? 'free' : `adds ${money(charge)}`}.`)
  }

  const ready = !!pricing && pricing.windows.length > 0

  return (
    <li className={styles.priceCard}>
      <div className={styles.priceCardHead}>
        <span className={styles.place}><CountryFlag country={country} /> <strong>{country.name}</strong></span>
        <span className="muted">{country.currency}</span>
        {ready
          ? <span className={`${styles.chip} ${styles.chipGo}`}>Taking orders</span>
          : <span className={`${styles.chip} ${styles.chipWait}`}>Not set up</span>}
      </div>
      <StatusBanner message={message?.text} isError={message?.isError} />

      {/* ── Commission ── */}
      <div className={styles.priceBlock}>
        <div className={styles.priceLine}>
          <span>
            <strong>Phloem's commission</strong>
            <span className={styles.priceHint}>On the dishes of each delivered order. Delivery fees always go to the seller.</span>
          </span>
          {editing?.kind !== 'commission' && (
            <span className={styles.priceValue}>
              {commission?.isSet ? `${commission.ratePercent}%` : <span className={styles.notSet}>Not set (0%)</span>}
              <button type="button" className={styles.linkButton} disabled={busy}
                      onClick={() => { setEditing({ kind: 'commission', rate: commission?.isSet ? String(commission.ratePercent) : '' }); setMessage(null) }}>
                Change
              </button>
            </span>
          )}
        </div>
        {editing?.kind === 'commission' && (
          <form className={styles.inlineForm} onSubmit={saveCommission}>
            <label className={styles.unitInput}>
              <input inputMode="decimal" aria-label={`Commission in ${country.name}`} value={editing.rate} autoFocus
                     onChange={(e) => setEditing({ ...editing, rate: e.target.value })} />
              <span>%</span>
            </label>
            <Button type="submit" small variant="secondary" busy={busy} busyText="Saving…">Save</Button>
            <Button small variant="plain" onClick={() => setEditing(null)}>Cancel</Button>
          </form>
        )}
      </div>

      {/* ── Shop delivery fee range ── */}
      <div className={styles.priceBlock}>
        <div className={styles.priceLine}>
          <span>
            <strong>Shop delivery fee</strong>
            <span className={styles.priceHint}>Each shop sets its own fee inside this range.</span>
          </span>
          {editing?.kind !== 'fees' && (
            pricing ? (
              <span className={styles.priceValue}>
                {money(pricing.minShopFee)} – {money(pricing.maxShopFee)}
                <button type="button" className={styles.linkButton} disabled={busy}
                        onClick={() => { setEditing({ kind: 'fees', min: String(pricing.minShopFee), max: String(pricing.maxShopFee) }); setMessage(null) }}>
                  Change
                </button>
              </span>
            ) : (
              <button type="button" className={`${styles.rangeButton} ${styles.rangeMissing}`} disabled={busy}
                      onClick={() => { setEditing({ kind: 'fees', min: '', max: '' }); setMessage(null) }}>
                + Set up
              </button>
            )
          )}
        </div>
        {!pricing && editing?.kind !== 'fees' && (
          <p className={styles.setupNote}>Set the delivery fee range first. Until then nobody can order in {country.name}.</p>
        )}
        {editing?.kind === 'fees' && (
          <form className={styles.inlineForm} onSubmit={saveFees}>
            <label className={styles.unitInput}>
              <span>{symbol}</span>
              <input inputMode="decimal" aria-label={`Lowest shop fee in ${country.name}`} placeholder="Lowest" value={editing.min} autoFocus
                     onChange={(e) => setEditing({ ...editing, min: e.target.value })} />
            </label>
            <span aria-hidden="true">to</span>
            <label className={styles.unitInput}>
              <span>{symbol}</span>
              <input inputMode="decimal" aria-label={`Highest shop fee in ${country.name}`} placeholder="Highest" value={editing.max}
                     onChange={(e) => setEditing({ ...editing, max: e.target.value })} />
            </label>
            <Button type="submit" small variant="secondary" busy={busy} busyText="Saving…">Save</Button>
            <Button small variant="plain" onClick={() => setEditing(null)}>Cancel</Button>
          </form>
        )}
      </div>

      {/* ── Delivery times ── */}
      {pricing && (
        <div className={styles.priceBlock}>
          <strong>Delivery times buyers can pick</strong>
          <ul className={styles.windowList}>
            {deliveryWindows.map((w) => {
              const offered = pricing.windows.find((x) => x.window === w.value)
              const isEditing = editing?.kind === 'window' && editing.window === w.value
              return (
                <li key={w.value}>
                  <label className={styles.windowToggle}>
                    <input type="checkbox" checked={!!offered} disabled={busy}
                           onChange={() => offered
                             ? run(() => removeWindow(country.country, w.value), () => `"${w.label}" is no longer offered in ${country.name}.`)
                             : run(() => setWindowCharge(country.country, w.value, 0), () => `"${w.label}" is now offered in ${country.name}, free. Change the charge if needed.`)} />
                    <span className={offered ? undefined : styles.windowOff}>{w.label}</span>
                  </label>
                  {offered && !isEditing && (
                    <span className={styles.priceValue}>
                      {offered.extraCharge === 0 ? <span className={styles.free}>Free</span> : `+ ${money(offered.extraCharge)}`}
                      <button type="button" className={styles.linkButton} disabled={busy}
                              onClick={() => { setEditing({ kind: 'window', window: w.value, charge: String(offered.extraCharge) }); setMessage(null) }}>
                        Change
                      </button>
                    </span>
                  )}
                  {!offered && <span className="muted">Not offered</span>}
                  {isEditing && editing?.kind === 'window' && (
                    <form className={styles.inlineForm} onSubmit={saveWindow}>
                      <label className={styles.unitInput}>
                        <span>+{symbol}</span>
                        <input inputMode="decimal" aria-label={`Extra charge for ${w.label} in ${country.name}`} value={editing.charge} autoFocus
                               onChange={(e) => setEditing({ ...editing, charge: e.target.value })} />
                      </label>
                      <Button type="submit" small variant="secondary" busy={busy} busyText="Saving…">Save</Button>
                      <Button small variant="plain" onClick={() => setEditing(null)}>Cancel</Button>
                    </form>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </li>
  )
}

/**
 * Admin → Pricing: one card per country (it grows with every new country) with Phloem's commission, the shop
 * delivery-fee range and the delivery times offered. Countries not set up yet are marked and put first.
 */
export default function AdminPricingPage() {
  const { countries } = useCountry()
  const commissions = useQuery({
    queryKey: ['admin', 'pricing', 'commissions'],
    queryFn: async ({ signal }) => unwrap(await getCommissions(signal)),
  })
  const pricing = useQuery({
    queryKey: ['admin', 'pricing', 'delivery'],
    queryFn: async ({ signal }) => unwrap(await getDeliveryPricing(signal)),
  })
  const failed = commissions.isError || pricing.isError
  const loading = commissions.isPending || pricing.isPending

  // Countries still to set up come first
  const ordered = [...countries].sort((a, b) =>
    Number(!!pricing.data?.some((p) => p.country === a.country)) - Number(!!pricing.data?.some((p) => p.country === b.country)))

  return (
    <>
      <AdminHead title="Pricing" sub="Phloem's commission, what shops may charge for delivery, and the delivery times in each country." />
      {failed && (
        <div className={styles.error}>
          <StatusBanner isError message="We couldn't load the pricing." />
          <Button small variant="outline" onClick={() => { void commissions.refetch(); void pricing.refetch() }}>Try again</Button>
        </div>
      )}
      {loading && !failed && <p className="muted" aria-busy="true">Loading…</p>}
      {!loading && !failed && (
        <ul className={styles.priceCards}>
          {ordered.map((c) => (
            <CountryCard key={c.country} country={c}
                         commission={commissions.data?.find((x) => x.country === c.country)}
                         pricing={pricing.data?.find((x) => x.country === c.country)} />
          ))}
        </ul>
      )}
    </>
  )
}
