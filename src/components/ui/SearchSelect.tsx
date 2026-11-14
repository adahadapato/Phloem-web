import { useId, useMemo, useState, type KeyboardEvent } from 'react'
import { matchScore } from './textMatch'
import styles from './SearchSelect.module.css'

export interface SearchSelectOption {
  value: string
  label: string
}

/**
 * A dropdown you can type in: the list filters as you type and forgives small typing mistakes ("port harcort" finds
 * Port Harcourt). ↑ ↓ move, Enter picks, Esc closes. Built as an ARIA combobox. Used for long lists such as the 37
 * Nigerian states and their LGAs.
 */
export function SearchSelect({ label, options, value, onChange, placeholder, error, hint, disabled }: {
  label: string
  options: SearchSelectOption[]
  /** The picked value, or null. */
  value: string | null
  onChange: (value: string | null) => void
  placeholder?: string
  error?: string
  hint?: string
  disabled?: boolean
}) {
  const id = useId()
  const listId = `${id}-list`
  const picked = options.find((o) => o.value === value) ?? null
  const [text, setText] = useState<string | null>(null)   // null = show the picked option's label
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)

  const typed = text ?? ''
  const shown = useMemo(() => {
    if (!typed.trim()) return options
    return options
      .map((o) => ({ o, score: matchScore(o.label, typed) }))
      .filter((x) => x.score !== null)
      .sort((a, b) => a.score! - b.score! || a.o.label.localeCompare(b.o.label))
      .map((x) => x.o)
  }, [options, typed])

  const choose = (option: SearchSelectOption) => {
    onChange(option.value)
    setText(null)
    setOpen(false)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setOpen(true)
      setActiveIndex((i) => Math.min(i + 1, shown.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, 0))
    } else if (event.key === 'Enter' && open && shown[activeIndex]) {
      event.preventDefault()
      choose(shown[activeIndex])
    } else if (event.key === 'Escape') {
      setOpen(false)
      setText(null)
    }
  }

  const describedBy = [hint && !error && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined

  return (
    <div className={[styles.field, error && styles.invalid].filter(Boolean).join(' ')}>
      <label htmlFor={id} className={styles.label}>{label}</label>
      <div className={styles.box}>
        <input id={id} className={styles.input} role="combobox" aria-expanded={open} aria-controls={listId}
               aria-autocomplete="list" autoComplete="off" disabled={disabled} placeholder={placeholder}
               aria-invalid={!!error || undefined} aria-describedby={describedBy}
               aria-activedescendant={open && shown[activeIndex] ? `${id}-opt-${activeIndex}` : undefined}
               value={text ?? picked?.label ?? ''}
               onChange={(e) => { setText(e.target.value); setOpen(true); setActiveIndex(0) }}
               onFocus={() => { setOpen(true); setActiveIndex(0) }}
               onBlur={() => { setOpen(false); setText(null) }}
               onKeyDown={onKeyDown} />
        <span className={styles.caret} aria-hidden="true">▾</span>
        <ul id={listId} role="listbox" className={styles.list} hidden={!open || disabled}>
          {shown.length === 0 && <li className={styles.empty}>No match. Check the spelling.</li>}
          {shown.map((o, index) => (
            <li key={o.value} id={`${id}-opt-${index}`} role="option" aria-selected={o.value === value}
                className={[styles.option, index === activeIndex && styles.active].filter(Boolean).join(' ')}
                onMouseDown={(e) => { e.preventDefault(); choose(o) }}
                onMouseEnter={() => setActiveIndex(index)}>
              {o.label}
            </li>
          ))}
        </ul>
      </div>
      {hint && !error && <p id={`${id}-hint`} className={styles.hint}>{hint}</p>}
      {error && <p id={`${id}-error`} className={styles.error}>{error}</p>}
    </div>
  )
}
