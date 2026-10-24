import styles from './StatusBanner.module.css'

/**
 * A short message under a form, like the app's StatusBanner. Shows nothing when `message` is empty.
 * Screen readers announce it when it changes.
 */
export function StatusBanner({ message, isError = false }: { message?: string | null; isError?: boolean }) {
  if (!message) return null
  return (
    <div className={`${styles.banner} ${isError ? styles.error : styles.info}`}
         role={isError ? 'alert' : 'status'}>
      {message}
    </div>
  )
}
