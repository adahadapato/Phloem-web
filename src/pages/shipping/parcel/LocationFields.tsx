import { useQuery } from '@tanstack/react-query'
import { useDeferredValue, useId, useState, type KeyboardEvent } from 'react'
import { unwrap } from '../../../api/apiError'
import type { TownDto } from '../../../api/contracts/dtos'
import type { Country } from '../../../api/contracts/enums'
import { getDistricts, getRegions, searchTowns, suggestTownDistrict } from '../../../api/services/locationService'
import { Field } from '../../../components/ui/Field'
import { SearchSelect } from '../../../components/ui/SearchSelect'
import type { PlaceDraft } from './place'
import styles from './Parcel.module.css'

/** What the "which LGA?" helper says under the fields. */
type Hint = { tone: 'info' | 'ai' | 'warn'; text: string } | null

/**
 * The recipient's town, state and LGA. Where the destination has lists (Nigeria): type the town and pick from the
 * suggestions to fill in the state and LGA at once, or pick the state and LGA from type-to-search lists. A town we
 * don't know: once the state is chosen, we suggest its LGA (from our list, else the AI) for the customer to check.
 * Elsewhere (UK): plain "City or town" and "Postcode" boxes.
 */
export function LocationFields({ country, hasList, place, onChange, fieldError }: {
  country: Country
  hasList: boolean
  place: PlaceDraft
  onChange: (place: PlaceDraft) => void
  fieldError: (name: string) => string | undefined
}) {
  const regionsQuery = useQuery({
    queryKey: ['regions', country],
    queryFn: async ({ signal }) => unwrap(await getRegions(country, signal)),
    enabled: hasList,
    staleTime: 24 * 60 * 60_000,
  })
  const districtsQuery = useQuery({
    queryKey: ['districts', place.regionId],
    queryFn: async ({ signal }) => unwrap(await getDistricts(place.regionId!, signal)),
    enabled: hasList && !!place.regionId,
    staleTime: 24 * 60 * 60_000,
  })
  const [hint, setHint] = useState<Hint>(null)
  const [asking, setAsking] = useState(false)

  if (!hasList) {
    return (
      <div className={styles.two}>
        <Field label="City or town" autoComplete="off" maxLength={100} value={place.town}
               onChange={(e) => onChange({ ...place, town: e.target.value, townId: null })}
               error={fieldError('RecipientCity')} />
        <Field label={country === 'UnitedKingdom' ? 'Postcode' : 'Region'} autoComplete="off" maxLength={50}
               value={place.postcode} onChange={(e) => onChange({ ...place, postcode: e.target.value })}
               error={fieldError('RecipientRegionOrPostcode')} />
      </div>
    )
  }

  const labels = regionsQuery.data
  const regionLabel = labels?.regionLabel ?? 'State'
  const districtLabel = labels?.districtLabel ?? 'LGA'
  const regions = labels?.regions ?? []

  /** Ask which LGA a typed town is in (our list first, then the AI) and pre-fill it for the customer to check. */
  const findDistrict = async (next: PlaceDraft) => {
    if (!next.regionId || next.districtId || next.townId || next.town.trim().length < 2) return
    setAsking(true)
    setHint({ tone: 'info', text: `Looking up which ${districtLabel} ${next.town.trim()} is in…` })
    const result = await suggestTownDistrict(next.regionId, next.town.trim())
    setAsking(false)
    if (!result.ok) {
      setHint({ tone: 'warn', text: `Please choose the ${districtLabel} from the list.` })
      return
    }
    const s = result.value
    if (!s.districtId) {
      setHint({ tone: 'warn', text: `We don't know ${s.townName} yet. Please choose its ${districtLabel} from the list.` })
      return
    }
    onChange({ ...next, town: s.townName, townId: s.townId, districtId: s.districtId })
    setHint(s.fromAi
      ? { tone: 'ai', text: `Suggested: ${s.townName} is ${s.confidence === 'high' ? '' : 'probably '}in ${s.districtName} ${districtLabel}. Please check, and change it below if it's wrong.` }
      : { tone: 'info', text: `${s.townName} is in ${s.districtName} ${districtLabel}.` })
  }

  const pickTown = (t: TownDto) => {
    onChange({ ...place, town: t.name, townId: t.townId, regionId: t.regionId, regionName: t.regionName, districtId: t.districtId })
    setHint({ tone: 'info', text: `${t.name}: ${t.districtName} ${districtLabel}, ${t.regionName}.` })
  }

  return (
    <>
      <TownInput country={country} regionId={place.regionId} value={place.town}
                 label={`Town or area`} error={fieldError('RecipientCity')}
                 hint={`Start typing, e.g. Lekki, Wuse 2, Rumuokoro: we fill in the ${regionLabel.toLowerCase()} and ${districtLabel}.`}
                 onType={(text) => { onChange({ ...place, town: text, townId: null }); setHint(null) }}
                 onPick={pickTown}
                 onLeave={() => void findDistrict(place)} />
      <div className={styles.two}>
        <SearchSelect label={regionLabel} placeholder={`Choose the ${regionLabel.toLowerCase()}`}
                      options={regions.map((r) => ({ value: r.id, label: r.name }))}
                      value={place.regionId} error={fieldError('RecipientRegionId') ?? fieldError('RecipientRegionOrPostcode')}
                      onChange={(id) => {
                        const next = { ...place, regionId: id, regionName: regions.find((r) => r.id === id)?.name ?? '',
                                       districtId: null, townId: null }
                        onChange(next)
                        setHint(null)
                        void findDistrict(next)
                      }} />
        <SearchSelect label={districtLabel} disabled={!place.regionId || asking}
                      placeholder={place.regionId ? `Choose the ${districtLabel}` : `Choose the ${regionLabel.toLowerCase()} first`}
                      options={(districtsQuery.data ?? []).map((d) => ({ value: d.id, label: d.name }))}
                      value={place.districtId} error={fieldError('RecipientDistrictId')}
                      onChange={(id) => { onChange({ ...place, districtId: id, townId: null }); setHint(null) }} />
      </div>
      {hint && (
        <p className={hint.tone === 'ai' ? styles.hintAi : hint.tone === 'warn' ? styles.hintWarn : styles.hintInfo}
           aria-live="polite">
          {hint.tone === 'ai' && <span className={styles.aiBadge}>AI</span>} {hint.text}
        </p>
      )}
    </>
  )
}

/** The Town box with suggestions (known towns and LGA names) as the customer types. */
function TownInput({ country, regionId, value, label, hint, error, onType, onPick, onLeave }: {
  country: Country
  regionId: string | null
  value: string
  label: string
  hint: string
  error?: string
  onType: (text: string) => void
  onPick: (town: TownDto) => void
  onLeave: () => void
}) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const typed = useDeferredValue(value.trim())
  const suggestions = useQuery({
    queryKey: ['towns', country, regionId, typed],
    queryFn: async ({ signal }) => unwrap(await searchTowns(country, typed, regionId, signal)),
    enabled: open && typed.length >= 2,
    staleTime: 60 * 60_000,
    placeholderData: (previous) => previous,
  })
  const list = typed.length >= 2 ? suggestions.data ?? [] : []
  const showList = open && list.length > 0

  const pick = (t: TownDto) => { onPick(t); setOpen(false) }
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!showList) return
    if (event.key === 'ArrowDown') { event.preventDefault(); setActiveIndex((i) => Math.min(i + 1, list.length - 1)) }
    else if (event.key === 'ArrowUp') { event.preventDefault(); setActiveIndex((i) => Math.max(i - 1, 0)) }
    else if (event.key === 'Enter' && list[activeIndex]) { event.preventDefault(); pick(list[activeIndex]) }
    else if (event.key === 'Escape') setOpen(false)
  }

  return (
    <div className={styles.townField}>
      <Field label={label} autoComplete="off" maxLength={80} value={value} hint={hint} error={error}
             role="combobox" aria-expanded={showList} aria-controls={`${id}-list`} aria-autocomplete="list"
             aria-activedescendant={showList ? `${id}-opt-${activeIndex}` : undefined}
             onChange={(e) => { onType(e.target.value); setOpen(true); setActiveIndex(0) }}
             onFocus={() => setOpen(true)}
             onBlur={() => { setOpen(false); onLeave() }}
             onKeyDown={onKeyDown} />
      <ul id={`${id}-list`} role="listbox" className={styles.townList} hidden={!showList}>
        {list.map((t, index) => (
          <li key={`${t.townId ?? 'lga'}-${t.districtId}-${t.name}`} id={`${id}-opt-${index}`} role="option"
              aria-selected={index === activeIndex}
              className={index === activeIndex ? styles.townOptionActive : styles.townOption}
              onMouseDown={(e) => { e.preventDefault(); pick(t) }} onMouseEnter={() => setActiveIndex(index)}>
            <strong>{t.name}</strong>
            <span className="muted">{t.townId ? `${t.districtName}, ${t.regionName}` : `LGA in ${t.regionName}`}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
