import { useId, useState } from 'react'
import styles from './Reviews.module.css'
import { STAR_WORDS } from './starWords'


/**
 * Five big stars to tap. Underneath they're radio buttons, so arrow keys and screen readers work; hovering previews
 * a score.
 */
export function StarPicker({ value, onChange, legend }: { value: number; onChange: (stars: number) => void; legend: string }) {
  const name = useId()
  const [hover, setHover] = useState(0)
  const shown = hover || value

  return (
    <fieldset className={styles.picker}>
      <legend>{legend}</legend>
      <div className={styles.pickerRow} onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <label key={n} className={`${styles.pickerStar} ${n <= shown ? styles.on : ''}`}
                 onMouseEnter={() => setHover(n)}>
            <input type="radio" name={name} value={n} checked={value === n} onChange={() => onChange(n)}
                   aria-label={`${n} ${n === 1 ? 'star' : 'stars'}: ${STAR_WORDS[n]}`} />
            <span aria-hidden="true">★</span>
          </label>
        ))}
        {shown > 0 && <span className={styles.pickerWord} aria-hidden="true">{STAR_WORDS[shown]}</span>}
      </div>
    </fieldset>
  )
}
