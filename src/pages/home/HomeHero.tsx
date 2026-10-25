import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { useCountry } from '../../state/CountryContext'
import { useSession } from '../../state/SessionContext'
import styles from './HomePage.module.css'
import { WaxPattern } from './WaxPattern'

/**
 * The top of Home: the branded food photo across the whole width under a dark green fade, a warm serif headline,
 * a search box with the orange "Find food" button, a link for cooks, and three short, true reassurances.
 */
export function HomeHero() {
  const { profile } = useSession()
  const { selected } = useCountry()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')

  const onSearch = (event: FormEvent) => {
    event.preventDefault()
    const text = search.trim()
    navigate(text ? `/explore?search=${encodeURIComponent(text)}` : '/explore')
  }

  return (
    <section className={styles.hero} aria-labelledby="hero-title">
      <img className={styles.heroPhoto} src="/images/hero-food.webp" alt="" width="1200" height="800" fetchPriority="high" />
      <div className={styles.heroFade} aria-hidden="true" />
      <WaxPattern className={styles.heroPattern} />
      <div className={`container ${styles.heroInner}`}>
        <p className={styles.heroEyebrow}>
          {profile ? `Welcome back, ${profile.firstName}` : 'Ghana · Nigeria · United Kingdom'}
        </p>
        <h1 id="hero-title" className={styles.heroTitle}>
          Home-cooked African food, <span>delivered.</span>
        </h1>
        <p className={styles.heroText}>
          Jollof, egusi, waakye, suya and more, cooked by approved home cooks and kitchens
          {selected ? ` in ${selected.name}` : ' near you'}.
        </p>

        <form className={styles.heroSearch} role="search" onSubmit={onSearch}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <circle cx="10.5" cy="10.5" r="7" />
            <path d="M16 16l5.5 5.5" />
          </svg>
          <label htmlFor="home-search" className="visually-hidden">What would you like to eat?</label>
          <input id="home-search" type="search" placeholder="Jollof, suya, egusi…" value={search}
                 onChange={(e) => setSearch(e.target.value)} />
          <button type="submit" className={styles.heroButton}>Find food</button>
        </form>
        <p className={styles.heroCook}>
          Love to cook? <Link to="/sell">Sell your food on Phloem ›</Link>
        </p>

        <ul className={styles.trust}>
          <li><span aria-hidden="true">✓</span> Every shop checked by Phloem</li>
          <li><span aria-hidden="true">★</span> Rated by real buyers</li>
          <li><span aria-hidden="true">✈</span> Send food home to the UK</li>
        </ul>
      </div>
    </section>
  )
}
