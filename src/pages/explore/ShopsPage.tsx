import { useQuery } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router'
import { unwrap } from '../../api/apiError'
import { getShops } from '../../api/services/shopService'
import { Button } from '../../components/ui/Button'
import styles from '../../components/ui/Cards.module.css'
import { ListStatus } from '../../components/ui/ListStatus'
import { Pager } from '../../components/ui/Pager'
import { ShopCard } from '../../components/ui/ShopCard'
import { useCountry } from '../../state/CountryContext'
import page from './Explore.module.css'

const PAGE_SIZE = 20

/**
 * Shops in the picked country: verified shops first, then by rating (the API's order). Search by name; the search
 * and page live in the address (?search=…&page=…).
 */
export default function ShopsPage() {
  const country = useCountry()
  const { selected } = country
  const [params, setParams] = useSearchParams()
  const search = params.get('search') ?? ''
  const pageNumber = Math.max(1, Number(params.get('page')) || 1)
  const [searchText, setSearchText] = useState(search)

  const query = useQuery({
    queryKey: ['shops', selected?.country, search, pageNumber],
    queryFn: ({ signal }) => getShops({
      country: selected?.country, search: search || undefined, page: pageNumber, pageSize: PAGE_SIZE,
    }, signal).then(unwrap),
    enabled: !!selected,
    placeholderData: (previous) => previous,   // keep the current page on screen while the next one loads
  })

  const onSearch = (event: FormEvent) => {
    event.preventDefault()
    const text = searchText.trim()
    setParams(text ? { search: text } : {})
  }

  const goToPage = (p: number) => {
    const next = new URLSearchParams(params)
    if (p > 1) next.set('page', String(p))
    else next.delete('page')
    setParams(next)
    window.scrollTo(0, 0)
  }

  const shops = query.data?.items ?? []

  return (
    <div className={`container ${page.page}`}>
      <div className={page.head}>
        <div>
          <h1>Shops</h1>
          <p className="muted">
            Home cooks and food businesses {selected ? `in ${selected.name}` : 'on Phloem'}.
          </p>
        </div>
      </div>

      <div className={page.toolbar}>
        <form className={page.search} role="search" onSubmit={onSearch}>
          <label htmlFor="shops-search" className="visually-hidden">Search shops</label>
          <input id="shops-search" type="search" placeholder="Search shops by name" value={searchText}
                 onChange={(e) => setSearchText(e.target.value)} />
          <Button type="submit" small>Search</Button>
        </form>
      </div>

      <ListStatus isLoading={selected ? query.isPending : country.isLoading}
                  error={selected ? query.error : country.error} isEmpty={shops.length === 0}
                  onRetry={selected ? () => void query.refetch() : country.reload} placeholders={6}
                  emptyText={search ? `No shops match "${search}".` : 'No shops here yet. Check back soon.'} />

      {shops.length > 0 && (
        <div className={styles.grid} style={{ opacity: query.isPlaceholderData ? 0.6 : 1 }}>
          {shops.map((shop) => <ShopCard key={shop.id} shop={shop} />)}
        </div>
      )}

      <Pager page={pageNumber} totalPages={query.data?.totalPages ?? 0} onChange={goToPage} />
    </div>
  )
}
