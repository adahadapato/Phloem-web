import { useQuery } from '@tanstack/react-query'
import { useEffect, useId, useState, type KeyboardEvent, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { unwrap } from '../../api/apiError'
import type { SearchSuggestionDto } from '../../api/contracts/dtos'
import type { Country } from '../../api/contracts/enums'
import { getSearchSuggestions } from '../../api/services/dishService'
import styles from './SearchSuggest.module.css'

const MIN_LENGTH = 2
const WAIT_MS = 200

/** "Jollof Rice" with the typed part ("jol") in bold. */
function Highlight({ text, typed }: { text: string; typed: string }): ReactNode {
  const at = text.toLowerCase().indexOf(typed.toLowerCase())
  if (!typed || at < 0) return text
  return (
    <>
      {text.slice(0, at)}<strong>{text.slice(at, at + typed.length)}</strong>{text.slice(at + typed.length)}
    </>
  )
}

/**
 * A search box with predictions: from 2 letters (after a short pause in typing) a list opens under it with full dish
 * names containing the word, best first, then matching shops (GET /api/dishes/suggest). Picking a dish name searches
 * for it (`onSearch`); picking a shop opens it. ↑ ↓ move, Enter picks, Esc closes (a second Esc clears the text);
 * built as an ARIA combobox.
 * Put it inside the page's own search form (which must be `position: relative`) so the list lines up with the form.
 */
export function SearchSuggest({ id, value, onChange, onSearch, country, placeholder, label }: {
  id: string
  value: string
  onChange: (text: string) => void
  /** Search for this text (a picked dish name). */
  onSearch: (text: string) => void
  country?: Country
  placeholder?: string
  /** The hidden label read by screen readers. */
  label: string
}) {
  const navigate = useNavigate()
  const listId = useId()
  const [typed, setTyped] = useState('')        // the text after the pause
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)

  // Wait for a short pause in typing before asking
  useEffect(() => {
    const timer = window.setTimeout(() => setTyped(value.trim()), WAIT_MS)
    return () => window.clearTimeout(timer)
  }, [value])

  const enabled = typed.length >= MIN_LENGTH
  const suggestions = useQuery({
    queryKey: ['dishes', 'suggest', country, typed.toLowerCase()],
    queryFn: async ({ signal }) => unwrap(await getSearchSuggestions(typed, country, signal)),
    enabled,
    staleTime: 60_000,
    placeholderData: (previous) => previous,
  })
  const items = enabled && value.trim().length >= MIN_LENGTH ? suggestions.data ?? [] : []
  const shown = open && items.length > 0

  const pick = (s: SearchSuggestionDto) => {
    setOpen(false)
    setActive(-1)
    if (s.kind === 'Shop' && s.shopId) {
      navigate(`/shops/${s.shopId}`)
      return
    }
    onChange(s.text)
    onSearch(s.text)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      // First Esc only closes the list (a search box would otherwise also clear the text); a second Esc clears it
      if (shown) e.preventDefault()
      setOpen(false)
      setActive(-1)
      return
    }
    if (!items.length) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      setActive((i) => (i + 1) % items.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setOpen(true)
      setActive((i) => (i <= 0 ? items.length - 1 : i - 1))
    } else if (e.key === 'Enter' && shown && active >= 0) {
      e.preventDefault()
      pick(items[active])
    } else if (e.key === 'Enter') {
      setOpen(false)   // a normal search: the form submits
    }
  }

  const firstShop = items.findIndex((s) => s.kind === 'Shop')

  return (
    <>
      <label htmlFor={id} className="visually-hidden">{label}</label>
      <input id={id} type="search" placeholder={placeholder} value={value} autoComplete="off"
             role="combobox" aria-autocomplete="list" aria-expanded={shown} aria-controls={listId}
             aria-activedescendant={shown && active >= 0 ? `${listId}-${active}` : undefined}
             onChange={(e) => { onChange(e.target.value); setOpen(true); setActive(-1) }}
             onFocus={() => setOpen(true)}
             onBlur={() => setOpen(false)}
             onKeyDown={onKeyDown} />
      <ul id={listId} role="listbox" aria-label="Suggestions" className={styles.list} hidden={!shown}>
        {items.map((s, i) => (
          <li key={`${s.kind}-${s.shopId ?? s.text}`} id={`${listId}-${i}`} role="option" aria-selected={i === active}
              className={[styles.option, i === active && styles.active, i === firstShop && i > 0 && styles.groupStart]
                .filter(Boolean).join(' ')}
              // mousedown, not click: the input would lose focus (and close the list) before a click lands
              onMouseDown={(e) => { e.preventDefault(); pick(s) }}
              onMouseEnter={() => setActive(i)}>
            <span className={styles.icon} aria-hidden="true">{s.kind === 'Shop' ? '🏪' : '🍲'}</span>
            <span className={styles.text}><Highlight text={s.text} typed={value.trim()} /></span>
            <span className={styles.meta}>
              {s.kind === 'Shop' ? 'Shop' : s.dishCount > 1 ? `${s.dishCount} dishes` : ''}
            </span>
          </li>
        ))}
      </ul>
    </>
  )
}
