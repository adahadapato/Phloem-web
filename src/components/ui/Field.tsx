import { useId, useState, type InputHTMLAttributes } from 'react'
import styles from './Field.module.css'

type FieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> & {
  /** The label above the box. */
  label: string
  /** Shows "(optional)" after the label. */
  optional?: boolean
  /** A short help line under the box. */
  hint?: string
  /** The problem with this field (from the API's field errors or a local check). */
  error?: string
}

/**
 * A labelled text field like the app's (label above, white rounded box). A password field gets the eye button to
 * show / hide what was typed.
 */
export function Field({ label, optional, hint, error, type = 'text', className, ...input }: FieldProps) {
  const id = useId()
  const [showPassword, setShowPassword] = useState(false)
  const isPassword = type === 'password'
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined

  return (
    <div className={[styles.field, error && styles.invalid, className].filter(Boolean).join(' ')}>
      <label htmlFor={id} className={styles.label}>
        {label} {optional && <span className={styles.optional}>(optional)</span>}
      </label>
      <div className={styles.box}>
        <input id={id} className={styles.input} type={isPassword && showPassword ? 'text' : type}
               aria-invalid={!!error || undefined} aria-describedby={describedBy} {...input} />
        {isPassword && (
          <button type="button" className={styles.toggle} onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
                 aria-hidden="true">
              <path d="M2 12c3-5.5 6.5-7.5 10-7.5s7 2 10 7.5c-3 5.5-6.5 7.5-10 7.5S5 17.5 2 12Z" />
              <circle cx="12" cy="12" r="3" />
              {showPassword && <path d="M4 4l16 16" />}
            </svg>
          </button>
        )}
      </div>
      {hint && !error && <p id={`${id}-hint`} className={styles.hint}>{hint}</p>}
      {error && <p id={`${id}-error`} className={styles.error}>{error}</p>}
    </div>
  )
}
