import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState, type FormEvent } from 'react'
import { unwrap, type ApiResult } from '../../../api/apiError'
import type { AdminDishCatalogDto } from '../../../api/contracts/dtos'
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
type Editing = { id: string; country: Country; min: string; max: string } | null

const categoryText = (c: DishCategory) => dishCategories.find((x) => x.value === c)?.label ?? c
const day = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

/**
 * Admin → Dish names. Sellers can only sell dishes whose name is on this list and priced in their country.
 * <list>
 *   <li><b>Suggested by sellers</b>: approve or reject each new name.</li>
 *   <li><b>Dish names</b>: a table with each name's price range in every country; click a range (or "Set price") to
 *   change it. Sellers whose dishes fall outside a new range are emailed and must change the price.</li>
 * </list>
 * Search by name, filter by category, or show only names still missing a price somewhere.
 */
export default function AdminDishesPage() {
  const { countries } = useCountry()
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
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<DishCategory | ''>('')
  const [missingOnly, setMissingOnly] = useState(false)

  const run = async (key: string, action: () => Promise<ApiResult<unknown>>, done: string) => {
    setBusy(key)
    setMessage(null)
    const result = await action()
    setBusy(null)
    if (result.ok) await queryClient.invalidateQueries({ queryKey: ['admin'] })
    setMessage(result.ok ? { text: done, isError: false } : { text: result.error.displayMessage, isError: true })
    return result.ok
  }

  const rangeOf = (d: AdminDishCatalogDto, c: Country) => d.priceRanges.find((r) => r.country === c)
  const symbolOf = (c: Country) => countries.find((x) => x.country === c)?.currencySymbol ?? ''

  const shown = useMemo(() => (names.data ?? [])
    .filter((d) => !search.trim() || d.name.toLowerCase().includes(search.trim().toLowerCase()))
    .filter((d) => !category || d.category === category)
    .filter((d) => !missingOnly || countries.some((c) => !rangeOf(d, c.country)))
    .sort((a, b) => a.name.localeCompare(b.name)),
  [names.data, search, category, missingOnly, countries])

  const startEdit = (d: AdminDishCatalogDto, c: Country) => {
    const r = rangeOf(d, c)
    setEditing({ id: d.id, country: c, min: r ? String(r.minPrice) : '', max: r ? String(r.maxPrice) : '' })
    setMessage(null)
  }

  const onSave = async (e: FormEvent, d: AdminDishCatalogDto) => {
    e.preventDefault()
    if (!editing) return
    const min = Number(editing.min.replace(',', '.'))
    const max = Number(editing.max.replace(',', '.'))
    if (!(min > 0) || !(max >= min)) {
      setMessage({ text: 'Enter a lowest price above 0 and a highest price at least as high.', isError: true })
      return
    }
    setBusy(`range:${d.id}`); setMessage(null)
    const result = await setPriceRange(d.id, editing.country, min, max)
    setBusy(null)
    if (!result.ok) { setMessage({ text: result.error.displayMessage, isError: true }); return }
    await queryClient.invalidateQueries({ queryKey: ['admin', 'dish-names'] })
    const country = countries.find((c) => c.country === editing.country)?.name ?? editing.country
    const affected = result.value
    setMessage({
      text: `${d.name} in ${country}: ${symbolOf(editing.country)}${min.toFixed(2)} – ${symbolOf(editing.country)}${max.toFixed(2)}.` +
        (affected > 0 ? ` ${affected} dish${affected === 1 ? '' : 'es'} now need a new price; their sellers were emailed.` : ''),
      isError: false,
    })
    setEditing(null)
  }

  const waiting = suggestions.data ?? []

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
                          `"${s.name}" approved. Set its price range below so sellers can use it.`)}>
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

      {/* ── All names with their price ranges ── */}
      <section aria-labelledby="names-title">
        <h2 id="names-title" className={styles.sectionTitle}>Dish names and prices</h2>
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
            Missing a price
          </label>
        </div>

        {names.isError && (
          <div className={styles.error}>
            <StatusBanner isError message="We couldn't load the dish names." />
            <Button small variant="outline" onClick={() => names.refetch()}>Try again</Button>
          </div>
        )}
        {names.isPending && <p className="muted" aria-busy="true">Loading…</p>}
        {names.isSuccess && (
          <>
            <p className={styles.count}>{shown.length} of {names.data.length} names · click a price to change it</p>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Dish name</th>
                    {countries.map((c) => (
                      <th key={c.country}><span className={styles.place}><CountryFlag country={c} /> {c.name}</span></th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {shown.map((d) => (
                    <tr key={d.id}>
                      <td>
                        <span className={styles.rowText}>
                          <strong>{d.name}</strong>
                          <span className="muted">{categoryText(d.category)} · {catalogGroupText[d.group]}</span>
                        </span>
                      </td>
                      {countries.map((c) => {
                        const r = rangeOf(d, c.country)
                        const isEditing = editing?.id === d.id && editing.country === c.country
                        return (
                          <td key={c.country} className={styles.rangeCell}>
                            {isEditing ? (
                              <form className={styles.rangeForm} onSubmit={(e) => onSave(e, d)}>
                                <span className={styles.rangeInputs}>
                                  <input inputMode="decimal" aria-label={`Lowest price in ${c.name}`} placeholder="Lowest"
                                         value={editing.min} onChange={(e) => setEditing({ ...editing, min: e.target.value })} autoFocus />
                                  <span aria-hidden="true">–</span>
                                  <input inputMode="decimal" aria-label={`Highest price in ${c.name}`} placeholder="Highest"
                                         value={editing.max} onChange={(e) => setEditing({ ...editing, max: e.target.value })} />
                                </span>
                                <span className={styles.rowButtons}>
                                  <Button type="submit" small variant="secondary" busy={busy === `range:${d.id}`} busyText="Saving…">Save</Button>
                                  <Button small variant="plain" onClick={() => setEditing(null)}>Cancel</Button>
                                </span>
                              </form>
                            ) : r ? (
                              <button type="button" className={styles.rangeButton} onClick={() => startEdit(d, c.country)}
                                      aria-label={`${d.name} in ${c.name}: ${r.minPrice} to ${r.maxPrice}. Change`}>
                                {c.currencySymbol}{r.minPrice.toFixed(2)} – {c.currencySymbol}{r.maxPrice.toFixed(2)}
                              </button>
                            ) : (
                              <button type="button" className={`${styles.rangeButton} ${styles.rangeMissing}`}
                                      onClick={() => startEdit(d, c.country)}>
                                + Set price
                              </button>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </>
  )
}
