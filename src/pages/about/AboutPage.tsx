import styles from './AboutPage.module.css'

/** About Phloem: the same story and three points as the app's About page. */
export default function AboutPage() {
  return (
    <>
      <section className={styles.hero}>
        <div className="container">
          <p className="eyebrow">Our story</p>
          <h1>Food that feels like home.</h1>
          <p>Phloem brings authentic African food closer to families, homes and hearts.</p>
        </div>
      </section>

      <div className={`container ${styles.points}`}>
        <article className={`card ${styles.point}`}>
          <span className={styles.icon} aria-hidden="true">✦</span>
          <h2>Celebrate African cuisine</h2>
          <p className="muted">Local meals and cultural flavours.</p>
        </article>
        <article className={`card ${styles.point}`}>
          <span className={styles.icon} aria-hidden="true">✓</span>
          <h2>Empower independent sellers</h2>
          <p className="muted">Tools for cooks and food businesses.</p>
        </article>
        <article className={`card ${styles.point}`}>
          <span className={styles.icon} aria-hidden="true">✈</span>
          <h2>Connect Africa with the UK</h2>
          <p className="muted">Convenient cross-border ordering.</p>
        </article>
      </div>
    </>
  )
}
