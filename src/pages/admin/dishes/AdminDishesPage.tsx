import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState, type FormEvent } from 'react'
import { unwrap, type ApiResult } from '../../../api/apiError'
import type { AdminDishCatalogDto, CountryDto } from '../../../api/contracts/dtos'
import type { Country, DishCategory } from '../../../api/contracts/enums'
import {
  approveDishName, getDishNames, getDishSuggestions, rejectDishName, setPriceRange,
} from '../../../api/services/adminService'
import { Button } from '../../../components/ui/Button'
import { CountryFlag } from '../../../components/ui/CountryFlag'
import { catalogGroupText, dishCategories } from '../../../components/ui/labels'
import { StatusBanner } from '../../../components/ui/StatusBanner'
import { useCountry } from '../../../state/CountryContext'
import styles from '../Admin.module.css'
import { AdminHead } from '../AdminParts'

type Message = { text: string; isError: boolean } | null
/** The price being changed: one dish in one country. `unusual` = asked "save anyway?" once. */
type Editing = { id: string; country: Country; min: string; max: string; unusual?: string } | null

const categoryText = (c: DishCategory) => dishCategories.find((x) => x.value === c)?.label ?? c
const day = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
const money = (symbol: string, n: number) =>
  `${symbol}${n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/** The middle of a range. */
const mid = (min: number, max: number) => (min + max) / 2

/**
 * A country's "usual" price: the median middle of its ranges (needs 4 or more to be meaningful). A range more than
 * 8 times above or below it is probably in the wrong currency (e.g. Naira typed into Ghana).
 */
function usualPrice(names: AdminDishCatalogDto[], country: Country): number | null {
  const mids = names.flatMap((d) => d.priceRanges.filter((r) => r.country === country).map((r) => mid(r.minPrice, r.maxPrice)))
    .sort((a, b) => a - b)
  if (mids.length < 4) return null
  const m = Math.floor(mids.length / 2)
  return mids.length % 2 ? mids[m] : (mids[m - 1] + mids[m]) / 2
}
const isUnusual = (usual: number | null, min: number, max: number) =>
  usual !== null && (mid(min, max) > usual * 8 || mid(min, max) < usual / 8)

/**
 * Admin → Dish names. Sellers can only sell dishes whose name is on this list AND priced in their country, so the page
 * is organised by country (it stays tidy however many countries Phloem opens in):
 * <list>
 *   <li><b>Suggested by sellers</b>: approve or reject new names.</li>
 *   <li><b>Prices by country</b>: a chip per country with "n of N priced"; pick one to see every dish name with its
 *   range in that country's currency, edit it in place, or show only the names still missing a price there.</li>
 *   <li><b>All countries</b> on a dish opens a side panel listing its price in every country, one under the other.</li>
 * </list>
 * A price far from the country's usual prices (probably the wrong currency) is flagged, and saving one asks first.
 */
export default function AdminDishesPage() {
  const { countries, selected } = useCountry()
  const queryClient = useQueryClient()
  const suggestions = useQuery({
    queryKey: ['admin', 'dish-suggestions'],
    queryFn: async ({ signal }) => unwrap(await getDishSuggestions(signal)),
  })
  const names = useQuery({
    queryKey: ['admin', 'dish-names'],
    queryFn: async ({ signal }) => unwrap(await getDishNames(signal)),
  })
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<Message>(null)
  const [editing, setEditing] = useState<Editing>(null)
  const [pickedCountry, setPickedCountry] = useState<Country | null>(null)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<DishCategory | ''>('')
  const [missingOnly, setMissingOnly] = useState(false)
  const [dishPanel, setDishPanel] = useState<string | null>(null)

  const all = useMemo(() => names.data ?? [], [names.data])
  const country: CountryDto | undefined =
    countries.find((c) => c.country === pickedCountry) ?? countries.find((c) => c.country === selected?.country) ?? countries[0]
  const rangeOf = (d: AdminDishCatalogDto, c: Country) => d.priceRanges.find((r) => r.country === c)
  const pricedIn = (c: Country) => all.filter((d) => rangeOf(d, c)).length
  const usual = useMemo(() => Object.fromEntries(countries.map((c) => [c.country, usualPrice(all, c.country)])) as Record<Country, number | null>,
    [all, countries])

  const shown = useMemo(() => !country ? [] : all
    .filter((d) => !search.trim() || d.name.toLowerCase().includes(search.trim().toLowerCase()))
    .filter((d) => !category || d.category === category)
    .filter((d) => !missingOnly || !d.priceRanges.some((r) => r.country === country.country))
    .sort((a, b) => a.name.localeCompare(b.name)),
  [all, country, search, category, missingOnly])

  const run = async (key: string, action: () => Promise<ApiResult<unknown>>, done: string) => {
    setBusy(key)
    setMessage(null)
    const result = await action()
    setBusy(null)
    if (result.ok) await queryClient.invalidateQueries({ queryKey: ['admin'] })
    setMessage(result.ok ? { text: done, isError: false } : { text: result.error.displayMessage, isError: true })
  }

  const startEdit = (d: AdminDishCatalogDto, c: Country) => {
    const r = rangeOf(d, c)
    setEditing({ id: d.id, country: c, min: r ? String(r.minPrice) : '', max: r ? String(r.maxPrice) : '' })
    setMessage(null)
  }

  const onSave = async (e: FormEvent, d: AdminDishCatalogDto) => {
    e.preventDefault()
    if (!editing) return
    const c = countries.find((x) => x.country === editing.country)
    const min = Number(editing.min.replace(',', '.'))
    const max = Number(editing.max.replace(',', '.'))
    if (!(min > 0) || !(max >= min)) {
      setMessage({ text: 'Enter a lowest price above 0 and a highest price at least as high.', isError: true })
      return
    }
    // Probably the wrong currency? Ask once before saving
    const u = usual[editing.country]
    if (!editing.unusual && isUnusual(u, min, max)) {
      setEditing({ ...editing, unusual: `Most dishes in ${c?.name} cost around ${money(c?.currencySymbol ?? '', u!)}. Is this price in ${c?.currency}?` })
      return
    }
    setBusy(`range:${d.id}`); setMessage(null)
    const result = await setPriceRange(d.id, editing.country, min, max)
    setBusy(null)
    if (!result.ok) { setMessage({ text: result.error.displayMessage, isError: true }); return }
    await queryClient.invalidateQueries({ queryKey: ['admin', 'dish-names'] })
    const affected = result.value
    setMessage({
      text: `${d.name} in ${c?.name}: ${money(c?.currencySymbol ?? '', min)} – ${money(c?.currencySymbol ?? '', max)}.` +
        (affected > 0 ? ` ${affected} dish${affected === 1 ? '' : 'es'} now need a new price; their sellers were emailed.` : ''),
      isError: false,
    })
    setEditing(null)
  }

  /** The price of one dish in one country: the range (or "+ Set price"), or the form while it's being changed. */
  const priceCell = (d: AdminDishCatalogDto, c: CountryDto) => {
    const r = rangeOf(d, c.country)
    if (editing?.id === d.id && editing.country === c.country) {
      return (
        <form className={styles.rangeForm} onSubmit={(e) => onSave(e, d)}>
          <span className={styles.rangeInputs}>
            <span className={styles.currency}>{c.currencySymbol}</span>
            <input inputMode="decimal" aria-label={`Lowest price in ${c.name}`} placeholder="Lowest"
                   value={editing.min} onChange={(e) => setEditing({ ...editing, min: e.target.value, unusual: undefined })} autoFocus />
            <span aria-hidden="true">to</span>
            <input inputMode="decimal" aria-label={`Highest price in ${c.name}`} placeholder="Highest"
                   value={editing.max} onChange={(e) => setEditing({ ...editing, max: e.target.value, unusual: undefined })} />
          </span>
          {editing.unusual && <span className={styles.unusualNote} role="alert">⚠ {editing.unusual}</span>}
          <span className={styles.rowButtons} style={{ justifyContent: 'flex-start' }}>
            <Button type="submit" small variant={editing.unusual ? 'cta' : 'secondary'} busy={busy === `range:${d.id}`} busyText="Saving…">
              {editing.unusual ? 'Yes, save it' : 'Save'}
            </Button>
            <Button small variant="plain" onClick={() => setEditing(null)}>Cancel</Button>
          </span>
        </form>
      )
    }
    if (!r) {
      return (
        <button type="button" className={`${styles.rangeButton} ${styles.rangeMissing}`} onClick={() => startEdit(d, c.country)}>
          + Set price
        </button>
      )
    }
    const odd = isUnusual(usual[c.country], r.minPrice, r.maxPrice)
    return (
      <button type="button" className={`${styles.rangeButton} ${odd ? styles.rangeOdd : ''}`} onClick={() => startEdit(d, c.country)}
              title={odd ? 'Far from the usual prices here: check the currency' : 'Change'}>
        {money(c.currencySymbol, r.minPrice)} – {money(c.currencySymbol, r.maxPrice)}
        {odd && <span className={styles.oddTag}>⚠ Check</span>}
      </button>
    )
  }

  const waiting = suggestions.data ?? []
  const panelDish = all.find((d) => d.id === dishPanel)

  return (
    <>
      <AdminHead title="Dish names" sub="The names sellers pick from, and the price range allowed in each country." />
      <StatusBanner message={message?.text} isError={message?.isError} />

      {/* ── Suggested by sellers ── */}
      <section className={styles.panel} aria-labelledby="suggested-title">
        <div className={styles.panelHead}>
          <h2 id="suggested-title">
            Suggested by sellers {waiting.length > 0 && <span className={styles.navCount}>{waiting.length}</span>}
          </h2>
        </div>
        {suggestions.isPending && <p className="muted" aria-busy="true">Loading…</p>}
        {suggestions.isError && <p className="muted">We couldn't load the suggestions.</p>}
        {suggestions.isSuccess && waiting.length === 0 && <p className={styles.allClear}>✓ No new names to review.</p>}
        <ul className={styles.attention}>
          {waiting.map((s) => (
            <li key={s.id} className={styles.suggestion}>
              <span className={styles.rowText}>
                <strong>{s.name}</strong>
                <span className="muted">
                  {categoryText(s.category)} · {catalogGroupText[s.group]} · suggested by {s.suggestedBy}
                  {s.shopName && ` (${s.shopName})`} on {day(s.suggestedAt)}
                </span>
              </span>
              <span className={styles.rowButtons}>
                <Button small variant="secondary" busy={busy === `approve:${s.id}`} busyText="Approving…" disabled={!!busy}
                        onClick={() => run(`approve:${s.id}`, () => approveDishName(s.id),
                          `"${s.name}" approved. Give it a price in each country below so sellers can use it.`)}>
                  Approve
                </Button>
                <Button small variant="outline" disabled={!!busy}
                        onClick={() => run(`reject:${s.id}`, () => rejectDishName(s.id), `"${s.name}" rejected.`)}>
                  Reject
                </Button>
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* ── Prices, one country at a time ── */}
      <section aria-labelledby="prices-title">
        <h2 id="prices-title" className={styles.sectionTitle}>Prices by country</h2>
        {names.isError && (
          <div className={styles.error}>
            <StatusBanner isError message="We couldn't load the dish names." />
            <Button small variant="outline" onClick={() => names.refetch()}>Try again</Button>
          </div>
        )}
        {names.isPending && <p className="muted" aria-busy="true">Loading…</p>}

        {names.isSuccess && country && (
          <>
            <div className={styles.countryChips} role="tablist" aria-label="Country">
              {countries.map((c) => {
                const n = pricedIn(c.country)
                const pct = all.length ? Math.round((n / all.length) * 100) : 0
                return (
                  <button key={c.country} type="button" role="tab" aria-selected={c.country === country.country}
                          className={styles.countryChip} onClick={() => { setPickedCountry(c.country); setEditing(null) }}>
                    <span className={styles.countryChipTop}><CountryFlag country={c} /> {c.name}</span>
                    <span className={styles.countryChipCount}>{n} of {all.length} priced</span>
                    <span className={styles.bar} aria-hidden="true"><span style={{ width: `${pct}%` }} /></span>
                  </button>
                )
              })}
            </div>

            <div className={styles.filters}>
              <div className={styles.search}>
                <input type="search" value={search} onChange={(e) => setSearch(e.target.value)}
                       placeholder="Search dish names" aria-label="Search dish names" />
              </div>
              <label className={styles.select}>
                <span className="muted">Category</span>
                <select value={category} onChange={(e) => setCategory(e.target.value as DishCategory | '')}>
                  <option value="">All</option>
                  {dishCategories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </label>
              <label className={styles.toggle}>
                <input type="checkbox" checked={missingOnly} onChange={(e) => setMissingOnly(e.target.checked)} />
                Only missing a price in {country.name}
              </label>
            </div>

            <div className={styles.priceList} role="tabpanel" aria-label={`Prices in ${country.name}`}>
              <div className={styles.priceHead}>
                <span>Dish name</span>
                <span><CountryFlag country={country} /> Price in {country.name} ({country.currency})</span>
                <span aria-hidden="true" />
              </div>
              {shown.length === 0 && (
                <p className={styles.allClear} style={{ margin: 16 }}>
                  {missingOnly ? `✓ Every dish name has a price in ${country.name}.` : 'No dish names match.'}
                </p>
              )}
              {shown.map((d) => (
                <div key={d.id} className={styles.priceRow}>
                  <span className={styles.rowText}>
                    <strong>{d.name}</strong>
                    <span className="muted">{categoryText(d.category)} · {catalogGroupText[d.group]}</span>
                  </span>
                  <span>{priceCell(d, country)}</span>
                  <button type="button" className={styles.allCountries} onClick={() => { setDishPanel(d.id); setEditing(null) }}>
                    All countries ({d.priceRanges.length}/{countries.length}) ›
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      {/* ── One dish, every country (side panel) ── */}
      {panelDish && (
        <div className={styles.drawerBack} onClick={() => { setDishPanel(null); setEditing(null) }}>
          <aside className={styles.drawer} role="dialog" aria-modal="true" aria-label={`${panelDish.name} in every country`}
                 onClick={(e) => e.stopPropagation()}>
            <div className={styles.drawerHead}>
              <div>
                <h2>{panelDish.name}</h2>
                <span className="muted">{categoryText(panelDish.category)} · {catalogGroupText[panelDish.group]}</span>
              </div>
              <button type="button" className={styles.drawerClose} aria-label="Close"
                      onClick={() => { setDishPanel(null); setEditing(null) }}>✕</button>
            </div>
            <p className={styles.panelHint}>
              Priced in {panelDish.priceRanges.length} of {countries.length} countries. Sellers in a country without a
              price can't sell it there.
            </p>
            <ul className={styles.drawerList}>
              {countries.map((c) => (
                <li key={c.country}>
                  <span className={styles.place}><CountryFlag country={c} /> <strong>{c.name}</strong></span>
                  {priceCell(panelDish, c)}
                </li>
              ))}
            </ul>
          </aside>
        </div>
      )}
    </>
  )
}
