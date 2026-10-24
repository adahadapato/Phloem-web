import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { Button, ButtonLink } from '../../components/ui/Button'
import { useCountry } from '../../state/CountryContext'
import { useSession } from '../../state/SessionContext'
import styles from './HomePage.module.css'

/**
 * Home, like the app's: greeting, "What are you craving today?", search, Buy Food / Sell Food, and the parcel banner.
 * Popular dishes and Top sellers (from the API, for the picked country) are added in the next step.
 */
export default function HomePage() {
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
    <>
      <section className={styles.hero}>
        <div className={`container ${styles.heroInner}`}>
          <div>
            <p className={styles.greeting}>
              {profile ? `Good to see you, ${profile.firstName} 👋` : 'Good to see you 👋'}
            </p>
            <h1 className={styles.title}>What are you craving today?</h1>
            <p className={styles.subtitle}>
              Discover authentic African food from local vendors
              {selected ? ` in ${selected.name}` : ' near you'}.
            </p>

            <form className={styles.search} role="search" onSubmit={onSearch}>
              <label htmlFor="home-search" className="visually-hidden">Search dishes or shops</label>
              <input id="home-search" type="search" placeholder="Jollof, suya, waakye…" value={search}
                     onChange={(e) => setSearch(e.target.value)} />
              <Button type="submit" variant="cta" small>Search</Button>
            </form>
          </div>

          <img className={styles.heroImage} src="/images/hero-food.webp" alt="" width="1200" height="800" />
        </div>
      </section>

      <div className="container">
        <div className={styles.choices}>
          <Link to="/explore" className={styles.choice}>
            <img src="/images/buy-food.webp" alt="" width="640" height="536" />
            <span>
              <span className={styles.choiceTitle}>Buy Food</span>
              <span className="muted" style={{ display: 'block' }}>Browse local vendors</span>
            </span>
          </Link>
          <Link to="/sell" className={`${styles.choice} ${styles.choiceSell}`}>
            <img src="/images/sell-food.webp" alt="" width="640" height="499" />
            <span>
              <span className={styles.choiceTitle}>Sell Food</span>
              <span className="muted" style={{ display: 'block' }}>Start earning today</span>
            </span>
          </Link>
        </div>

        <section className={styles.shipping} aria-labelledby="shipping-title">
          <img className={styles.shippingImage} src="/images/global-shipping.webp" alt="" width="1600" height="538" />
          <div className={styles.shippingText}>
            <h2 id="shipping-title">Food from home, across borders</h2>
            <p>Send authentic African food straight to family in the diaspora.</p>
            <ButtonLink to="/track" variant="plain" small>Track a parcel</ButtonLink>
          </div>
        </section>

        <p className={`muted ${styles.next}`}>Popular dishes and top sellers are coming to this page next.</p>
      </div>
    </>
  )
}
