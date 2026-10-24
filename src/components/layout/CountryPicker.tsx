import { useEffect, useId, useRef, useState } from 'react'
import { CountryFlag } from '../ui/CountryFlag'
import { useCountry } from '../../state/CountryContext'
import styles from './HeaderMenu.module.css'

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
        <CountryFlag country={selected} />
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
                <CountryFlag country={country} />
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
