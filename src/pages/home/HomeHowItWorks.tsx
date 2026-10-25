import styles from './HomePage.module.css'

const STEPS = [
  { icon: '🍲', title: 'Choose', text: 'Browse dishes from approved home cooks and kitchens near you.' },
  { icon: '🛒', title: 'Order', text: 'Pick a delivery time: as soon as possible, this evening or tomorrow.' },
  { icon: '😋', title: 'Enjoy', text: 'Follow your order from the kitchen to your door.' },
]

/** "How Phloem works": three numbered steps. */
export function HomeHowItWorks() {
  return (
    <section className={`container ${styles.section}`} aria-labelledby="how-title">
      <p className={`${styles.eyebrow} ${styles.center}`}>Simple as 1, 2, 3</p>
      <h2 id="how-title" className={`${styles.sectionTitle} ${styles.center}`}>How Phloem works</h2>
      <ol className={styles.steps}>
        {STEPS.map((s, i) => (
          <li key={s.title} className={styles.step}>
            <span className={styles.stepIcon} aria-hidden="true">{s.icon}</span>
            <span className={styles.stepNumber}>{i + 1}</span>
            <strong>{s.title}</strong>
            <span>{s.text}</span>
          </li>
        ))}
      </ol>
    </section>
  )
}
