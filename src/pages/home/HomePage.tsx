import { useQuery } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { unwrap } from '../../api/apiError'
import type { DishCategory } from '../../api/contracts/enums'
import { searchDishes } from '../../api/services/dishService'
import { getTopShops } from '../../api/services/shopService'
import cards from '../../components/ui/Cards.module.css'
import { DishCard } from '../../components/ui/DishCard'
import { ListStatus } from '../../components/ui/ListStatus'
import { ShopCard } from '../../components/ui/ShopCard'
import { dishCategories } from '../../components/ui/labels'
import { useCountry } from '../../state/CountryContext'
import { useSession } from '../../state/SessionContext'
import styles from './HomePage.module.css'

/** How many dishes and shops Home shows in each row. */
const ROW_SIZE = 8

/**
 * Home, laid out like the app's: search, "What are you craving today?" with the dish photo, Buy Food / Sell Food,
 * the UK delivery banner, category chips (Popular · Local Meals · Snacks · Drinks), the dishes for the chosen chip,
 * and Top sellers. Dishes and shops come from the API for the country picked at the top.
 */
export default function HomePage() {
  const { profile } = useSession()
  const country = useCountry()
  const { selected } = country
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  /** The chosen chip; undefined = "Popular" (all categories, best rated first). */
  const [category, setCategory] = useState<DishCategory | undefined>()

  const dishes = useQuery({
    queryKey: ['dishes', 'home', selected?.country, category],
    queryFn: ({ signal }) =>
      searchDishes({ country: selected?.country, category, sort: 'Rating', pageSize: ROW_SIZE }, signal).then(unwrap),
    enabled: !!selected,
    placeholderData: (previous) => previous,   // keep the dishes on screen while another chip loads
  })

  const topShops = useQuery({
    queryKey: ['shops', 'top', selected?.country],
    queryFn: ({ signal }) => getTopShops(selected?.country, ROW_SIZE, signal).then(unwrap),
    enabled: !!selected,
  })

  // Until a country is known, the lists wait for the countries; if those fail, say so (with "Try again")
  const waitingForCountry = !selected
  const listState = (query: typeof dishes | typeof topShops) => ({
    isLoading: waitingForCountry ? country.isLoading : query.isPending,
    error: waitingForCountry ? country.error : query.error,
    onRetry: waitingForCountry ? country.reload : () => void query.refetch(),
  })

  const onSearch = (event: FormEvent) => {
    event.preventDefault()
    const text = search.trim()
    navigate(text ? `/explore?search=${encodeURIComponent(text)}` : '/explore')
  }

  const chipLabel = dishCategories.find((c) => c.value === category)?.label
  const seeAllDishes = category ? `/explore?category=${category}` : '/explore'

  return (
    <>
      {/* ============ HERO: search, title, dish photo ============ */}
      <section className={styles.hero}>
        <div className="container">
          <form className={styles.search} role="search" onSubmit={onSearch}>
            <svg className={styles.searchIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
                 strokeLinecap="round" aria-hidden="true">
              <circle cx="10.5" cy="10.5" r="7" />
              <path d="M16 16l5.5 5.5" />
            </svg>
            <label htmlFor="home-search" className="visually-hidden">Search meals, ingredients or vendors</label>
            <input id="home-search" type="search" placeholder="Search meals, ingredients, or vendors" value={search}
                   onChange={(e) => setSearch(e.target.value)} />
            <span className={styles.searchDivider} aria-hidden="true" />
            <Link to="/explore" className={styles.filterButton} aria-label="Filters and categories">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"
                   aria-hidden="true">
                <path d="M3 6h18M3 12h18M3 18h18" />
                <circle cx="8" cy="6" r="2.2" fill="var(--white)" />
                <circle cx="16" cy="12" r="2.2" fill="var(--white)" />
                <circle cx="10" cy="18" r="2.2" fill="var(--white)" />
              </svg>
            </Link>
          </form>

          <div className={styles.heroInner}>
            <div>
              {profile && <p className={styles.greeting}>Good to see you, {profile.firstName} 👋</p>}
              <h1 className={styles.title}>What are you craving today?</h1>
              <p className={styles.subtitle}>
                Discover authentic African food from local vendors {selected ? `in ${selected.name}` : 'near you'}.
              </p>
            </div>
            <img className={styles.heroImage} src="/images/hero-food.webp" alt="" width="1200" height="800" />
          </div>
        </div>
      </section>

      <div className="container">
        {/* ============ BUY / SELL (overlap the hero, like the app) ============ */}
        <div className={styles.choices}>
          <Link to="/explore" className={`${styles.choice} ${styles.buy}`}>
            <span className={styles.choiceIcon}>
              <img src="/images/buy-food.webp" alt="" width="640" height="536" />
            </span>
            <span className={styles.choiceText}>
              <span className={styles.choiceTitle}>Buy Food</span>
              <span className={styles.choiceSub}>Browse local vendors</span>
            </span>
            <span className={styles.arrow} aria-hidden="true">›</span>
          </Link>
          <Link to="/sell" className={`${styles.choice} ${styles.sell}`}>
            <span className={styles.choiceIcon}>
              <img src="/images/sell-food.webp" alt="" width="640" height="499" />
            </span>
            <span className={styles.choiceText}>
              <span className={styles.choiceTitle}>Sell Food</span>
              <span className={styles.choiceSub}>Start earning today</span>
            </span>
            <span className={styles.arrow} aria-hidden="true">›</span>
          </Link>
        </div>

        {/* ============ UK BANNER (before the dishes, like the app) ============ */}
        <Link to="/send-parcel" className={styles.banner} aria-labelledby="banner-title">
          <img className={styles.bannerImage} src="/images/global-shipping.webp" alt="" width="1600" height="538" />
          <span className={styles.bannerText}>
            <span id="banner-title" className={styles.bannerTitle}>Free delivery on your first UK order</span>
            <span className={styles.bannerSub}>Send authentic African food straight to family in the diaspora.</span>
          </span>
          <span className={`${styles.arrow} ${styles.bannerArrow}`} aria-hidden="true">›</span>
        </Link>

        {/* ============ CATEGORY CHIPS ============ */}
        <div className={styles.chips} role="group" aria-label="Category">
          <button type="button" className={styles.chip} aria-pressed={!category} onClick={() => setCategory(undefined)}>
            Popular
          </button>
          {dishCategories.map((c) => (
            <button key={c.value} type="button" className={styles.chip} aria-pressed={category === c.value}
                    onClick={() => setCategory(c.value)}>
              {c.label}
            </button>
          ))}
        </div>

        {/* ============ DISHES FOR THE CHOSEN CHIP ============ */}
        <section className={styles.row} aria-labelledby="dishes-title">
          <div className={styles.rowHead}>
            <h2 id="dishes-title">{chipLabel ?? 'Popular Dishes'}</h2>
            <Link to={seeAllDishes}>See all ›</Link>
          </div>
          <ListStatus {...listState(dishes)} placeholders={4}
                      isEmpty={(dishes.data?.items.length ?? 0) === 0}
                      emptyText={category ? `No ${chipLabel?.toLowerCase()} here yet.`
                        : 'No dishes here yet. Check back soon, or pick another country at the top.'} />
          {dishes.data && dishes.data.items.length > 0 && (
            <div className={cards.grid} style={{ opacity: dishes.isPlaceholderData ? 0.6 : 1 }}>
              {dishes.data.items.map((dish) => <DishCard key={dish.id} dish={dish} />)}
            </div>
          )}
        </section>

        {/* ============ TOP SELLERS ============ */}
        <section className={styles.row} aria-labelledby="sellers-title">
          <div className={styles.rowHead}>
            <h2 id="sellers-title">Top Sellers</h2>
            <Link to="/shops">See all ›</Link>
          </div>
          <ListStatus {...listState(topShops)} placeholders={4}
                      isEmpty={(topShops.data?.length ?? 0) === 0}
                      emptyText="No shops here yet. Check back soon." />
          {topShops.data && topShops.data.length > 0 && (
            <div className={cards.grid}>
              {topShops.data.map((shop) => <ShopCard key={shop.id} shop={shop} />)}
            </div>
          )}
        </section>
      </div>
    </>
  )
}
