import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useParams } from 'react-router'
import { ApiError, unwrap } from '../../api/apiError'
import { fileUrl } from '../../api/config'
import type { DishCategory } from '../../api/contracts/enums'
import { searchDishes } from '../../api/services/dishService'
import { getShop } from '../../api/services/shopService'
import { ApiImage } from '../../components/ui/ApiImage'
import { ButtonLink } from '../../components/ui/Button'
import styles from '../../components/ui/Cards.module.css'
import { DishCard } from '../../components/ui/DishCard'
import { ListStatus } from '../../components/ui/ListStatus'
import { Pager } from '../../components/ui/Pager'
import { Price } from '../../components/ui/Price'
import { Stars } from '../../components/ui/Stars'
import { dishCategories } from '../../components/ui/labels'
import page from './Explore.module.css'

const PAGE_SIZE = 24

/**
 * A shop's page: cover photo, logo, name, ✓ Verified, rating, delivery fee, and its menu (with category tabs and
 * pages). Header: GET /api/shops/{id}; menu: GET /api/dishes?shopId=….
 */
export default function ShopPage() {
  const { shopId = '' } = useParams()
  const [category, setCategory] = useState<DishCategory | undefined>()
  const [pageNumber, setPageNumber] = useState(1)

  const shop = useQuery({
    queryKey: ['shop', shopId],
    queryFn: ({ signal }) => getShop(shopId, signal).then(unwrap),
  })

  const menu = useQuery({
    queryKey: ['dishes', 'shop', shopId, category, pageNumber],
    queryFn: ({ signal }) => searchDishes({ shopId, category, page: pageNumber, pageSize: PAGE_SIZE }, signal)
      .then(unwrap),
    placeholderData: (previous) => previous,   // keep the current page on screen while the next one loads
  })

  if (shop.isPending) {
    return <div className="container" style={{ padding: '48px 16px' }} aria-busy="true">Loading the shop…</div>
  }

  if (shop.error) {
    const notFound = shop.error instanceof ApiError && shop.error.status === 404
    return (
      <div className="container stack" style={{ paddingBlock: 64, alignItems: 'center', textAlign: 'center' }}>
        <h1>{notFound ? "We couldn't find that shop." : "The shop couldn't be loaded."}</h1>
        <p className="muted">
          {notFound ? 'It may have closed or moved.' : 'Please check your connection and try again.'}
        </p>
        <ButtonLink to="/shops" variant="secondary">See all shops</ButtonLink>
      </div>
    )
  }

  const details = shop.data
  const cover = fileUrl(details.coverPhotoUrl)
  const dishes = menu.data?.items ?? []
  const since = details.onPhloemSince
    ? new Date(details.onPhloemSince).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
    : null

  const pickCategory = (value: DishCategory | undefined) => {
    setCategory(value)
    setPageNumber(1)
  }

  return (
    <>
      <div className={page.shopHero}>{cover && <img src={cover} alt="" />}</div>

      <div className="container">
        <div className={page.shopHead}>
          <ApiImage src={details.logoUrl} alt={`${details.name} logo`} className={page.shopLogo} />
          <div>
            <h1>{details.name}</h1>
            <div className={page.shopFacts}>
              {details.isVerified && <span className={styles.verified}>✓ Verified</span>}
              <Stars rating={details.rating} count={details.ratingCount} />
              <span className="muted">
                {details.dishCount} {details.dishCount === 1 ? 'dish' : 'dishes'}
              </span>
              {details.deliveryFee !== null && (
                <span className="muted">
                  Delivery from <Price amount={details.deliveryFee} currency={details.currency} />
                </span>
              )}
              {since && <span className="muted">On Phloem since {since}</span>}
            </div>
          </div>
        </div>

        <h2 style={{ marginBottom: 12 }}>Menu</h2>
        <div className={page.tabs} role="group" aria-label="Category">
          <button type="button" className={page.tab} aria-pressed={!category} onClick={() => pickCategory(undefined)}>
            All
          </button>
          {dishCategories.map((c) => (
            <button key={c.value} type="button" className={page.tab} aria-pressed={category === c.value}
                    onClick={() => pickCategory(c.value)}>
              {c.label}
            </button>
          ))}
        </div>

        <ListStatus isLoading={menu.isPending} error={menu.error} isEmpty={dishes.length === 0}
                    onRetry={() => menu.refetch()} placeholders={4}
                    emptyText={category ? 'Nothing in this category yet.' : 'This shop has no dishes yet.'} />

        {dishes.length > 0 && (
          <div className={styles.grid} style={{ opacity: menu.isPlaceholderData ? 0.6 : 1 }}>
            {dishes.map((dish) => <DishCard key={dish.id} dish={dish} onShopPage />)}
          </div>
        )}

        <Pager page={pageNumber} totalPages={menu.data?.totalPages ?? 0} onChange={setPageNumber} />
      </div>
    </>
  )
}
