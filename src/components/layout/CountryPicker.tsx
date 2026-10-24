import { useEffect, useId, useRef, useState } from 'react'
import type { CountryDto } from '../../api/contracts/dtos'
import { useCountry } from '../../state/CountryContext'
import styles from './CountryPicker.module.css'

/**
 * A country's flag as a picture. Windows browsers can't draw flag emojis (they show "GH"), so the flag comes from
 * flagcdn.com by the country's ISO code (from the API, so a new country needs no website change). If the picture
 * can't load, the API's emoji is shown instead.
 */
function Flag({ country }: { country: CountryDto }) {
  const [failed, setFailed] = useState(false)
  if (failed) return <span aria-hidden="true">{country.flag}</span>
  return (
    <img className={styles.flag} src={`https://flagcdn.com/w80/${country.isoCode.toLowerCase()}.png`}
         alt="" width="30" height="20" onError={() => setFailed(true)} />
  )
}

/**
 * The white flag pill in the header, like the app's: shows the picked country's flag; the list of countries opens
 * underneath. Closes on a pick, on Escape, or on a click outside.
 */
export function CountryPicker() {
  const { countries, selected, select } = useCountry()
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const listId = useId()

  // Close when clicking outside or pressing Escape
  useEffect(() => {
    if (!open) return
    const onClick = (event: MouseEvent) => {
      if (!box.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!selected) return null

  return (
    <div className={styles.picker} ref={box}>
      <button type="button" className={styles.pill} onClick={() => setOpen((o) => !o)}
              aria-haspopup="listbox" aria-expanded={open} aria-controls={listId}
              aria-label={`Country: ${selected.name}. Change country`}>
        <Flag country={selected} />
        <svg className={styles.chevron} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2"
             strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d={open ? 'M2 8l4-4 4 4' : 'M2 4l4 4 4-4'} />
        </svg>
      </button>

      {open && (
        <ul id={listId} className={styles.list} role="listbox" aria-label="Country">
          {countries.map((country) => (
            <li key={country.country} role="presentation">
              <button type="button" role="option" className={styles.option}
                      aria-selected={country.country === selected.country}
                      onClick={() => { select(country.country); setOpen(false) }}>
                <Flag country={country} />
                {country.name}
                {country.country === selected.country && <span className={styles.tick} aria-hidden="true">✓</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
