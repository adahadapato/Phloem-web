import { MAX_QUANTITY } from '../../state/CartContext'
import styles from './QuantityStepper.module.css'

/**
 * Add to basket, like the app: a round green "+" while the dish isn't in the basket; then "− 2 +".
 * Going below 1 takes the dish out.
 */
export function QuantityStepper({ quantity, onAdd, onChange, label }: {
  quantity: number
  /** First "+" (puts the dish in the basket). */
  onAdd: () => void
  /** Later changes; 0 = take it out. */
  onChange: (quantity: number) => void
  /** The dish's name, for screen readers ("Add Jollof rice to basket"). */
  label: string
}) {
  if (quantity === 0) {
    return (
      <button type="button" className={styles.add} onClick={onAdd} aria-label={`Add ${label} to basket`}>
        +
      </button>
    )
  }

  return (
    <span className={styles.stepper} role="group" aria-label={`${label} in basket`}>
      <button type="button" className={`${styles.step} ${styles.minus}`} onClick={() => onChange(quantity - 1)}
              aria-label={quantity === 1 ? `Remove ${label} from basket` : `One less ${label}`}>
        −
      </button>
      <span className={styles.count} aria-live="polite">{quantity}</span>
      <button type="button" className={styles.step} onClick={() => onChange(quantity + 1)}
              disabled={quantity >= MAX_QUANTITY} aria-label={`One more ${label}`}>
        +
      </button>
    </span>
  )
}
