import styles from './Reviews.module.css'

/** "★★★★☆": a score of 1–5 as gold and grey stars, read out as "4 out of 5 stars". */
export function StarText({ stars }: { stars: number }) {
  const whole = Math.max(0, Math.min(5, Math.round(stars)))
  return (
    <span className={styles.stars} role="img" aria-label={`${whole} out of 5 stars`}>
      {'★'.repeat(whole)}<span className={styles.starsOff}>{'★'.repeat(5 - whole)}</span>
    </span>
  )
}
