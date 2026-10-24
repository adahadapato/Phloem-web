import type { ReactNode } from 'react'
import styles from './EmptyState.module.css'

/** The pictures an empty page can show, drawn like the app's icons (green line on a pale mint circle). */
const ICONS = {
  cart: (
    <>
      <path d="M3 4h2l2.4 11.2a1.5 1.5 0 0 0 1.5 1.2h8.6a1.5 1.5 0 0 0 1.5-1.1L21 8H6.2" />
      <circle cx="9.5" cy="20" r="1.3" />
      <circle cx="17.5" cy="20" r="1.3" />
    </>
  ),
  parcel: (
    <>
      <path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z" />
      <path d="M3 7.5 12 12l9-4.5M12 12v9M7.5 5.2l9 4.6" />
    </>
  ),
  receipt: (
    <>
      <path d="M6 3h12v18l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5L6 21z" />
      <path d="M9 8h6M9 12h6M9 16h3" />
    </>
  ),
} as const

/**
 * "Nothing here yet", like the app's empty basket card: a white card with an icon in a mint circle, a title,
 * a short line and one button.
 */
export function EmptyState({ icon, title, text, action }: {
  icon: keyof typeof ICONS
  title: string
  text: string
  /** Usually a ButtonLink, e.g. "Browse dishes". */
  action?: ReactNode
}) {
  return (
    <div className={styles.card}>
      <span className={styles.icon} aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
             strokeLinejoin="round">
          {ICONS[icon]}
        </svg>
      </span>
      <h2 className={styles.title}>{title}</h2>
      <p className="muted">{text}</p>
      {action}
    </div>
  )
}
