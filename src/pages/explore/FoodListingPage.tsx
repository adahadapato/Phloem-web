import { useQuery } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router'
import { unwrap } from '../../api/apiError'
import type { DishCategory, DishSort } from '../../api/contracts/enums'
import { searchDishes } from '../../api/services/dishService'
import { SearchSuggest } from '../../components/ui/SearchSuggest'
import { Button } from '../../components/ui/Button'
import styles from '../../components/ui/Cards.module.css'
import { DishCard } from '../../components/ui/DishCard'
import { ListStatus } from '../../components/ui/ListStatus'
import { Pager } from '../../components/ui/Pager'
import { dishCategories, dishSorts } from '../../components/ui/labels'
import { useCountry } from '../../state/CountryContext'
import page from './Explore.module.css'

const PAGE_SIZE = 20

/**
 * Explore (the app's "Browse & Order"): dishes in the picked country, with search, category tabs, sort and pages.
 * Search, category, sort and page live in the address (?search=…&category=…), so a search can be shared or
 * bookmarked, and Home's search box lands here.
 */
export default function FoodListingPage() {
  const country = useCountry()
  const { selected } = country
  const [params, setParams] = useSearchParams()

  const search = params.get('search') ?? ''
  const category = (params.get('category') as DishCategory | null) ?? undefined
  const sort = (params.get('sort') as DishSort | null) ?? 'Rating'
  const pageNumber = Math.max(1, Number(params.get('page')) || 1)
  const [searchText, setSearchText] = useState(search)

  const query = useQuery({
    queryKey: ['dishes', selected?.country, search, category, sort, pageNumber],
    queryFn: ({ signal }) => searchDishes({
      country: selected?.country, search: search || undefined, category, sort, page: pageNumber, pageSize: PAGE_SIZE,
    }, signal).then(unwrap),
    enabled: !!selected,
    placeholderData: (previous) => previous,   // keep the current page on screen while the next one loads
  })

  /** Changes some filters; any change except the page itself goes back to page 1. */
  const update = (changes: Record<string, string | undefined>) => {
    const next = new URLSearchParams(params)
    for (const [name, value] of Object.entries(changes)) {
      if (value) next.set(name, value)
      else next.delete(name)
    }
    if (!('page' in changes)) next.delete('page')
    setParams(next)
  }

  const onSearch = (event: FormEvent) => {
    event.preventDefault()
    update({ search: searchText.trim() || undefined })
  }
  const searchFor = (text: string) => update({ search: text.trim() || undefined })

  const result = query.data
  const dishes = result?.items ?? []

  return (
    <div className={`container ${page.page}`}>
      <div className={page.head}>
        <div>
          <h1>Browse &amp; order</h1>
          <p className="muted">Authentic African food {selected ? `in ${selected.name}` : 'near you'}.</p>
        </div>
      </div>

      <div className={page.toolbar}>
        <form className={page.search} role="search" onSubmit={onSearch}>
          <SearchSuggest id="explore-search" label="Search dishes" placeholder="Search dishes, e.g. jollof"
                         value={searchText} onChange={setSearchText} onSearch={searchFor} country={selected?.country} />
          <Button type="submit" small>Search</Button>
        </form>
        <label>
          <span className="visually-hidden">Sort</span>
          <select className={page.select} value={sort}
                  onChange={(e) => update({ sort: e.target.value === 'Rating' ? undefined : e.target.value })}>
            {dishSorts.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </label>
      </div>

      <div className={page.tabs} role="group" aria-label="Category">
        <button type="button" className={page.tab} aria-pressed={!category} onClick={() => update({ category: undefined })}>
          All
        </button>
        {dishCategories.map((c) => (
          <button key={c.value} type="button" className={page.tab} aria-pressed={category === c.value}
                  onClick={() => update({ category: c.value })}>
            {c.label}
          </button>
        ))}
      </div>

      {result && result.totalCount > 0 && (
        <p className={`muted ${page.count}`}>
          {result.totalCount} {result.totalCount === 1 ? 'dish' : 'dishes'}{search && ` for "${search}"`}
        </p>
      )}

      <ListStatus isLoading={selected ? query.isPending : country.isLoading}
                  error={selected ? query.error : country.error} isEmpty={dishes.length === 0}
                  onRetry={selected ? () => void query.refetch() : country.reload}
                  emptyText={search
                    ? `No dishes match "${search}" here yet. Try another word or category.`
                    : 'No dishes here yet. Check back soon, or pick another country at the top.'} />

      {dishes.length > 0 && (
        <div className={styles.grid} style={{ opacity: query.isPlaceholderData ? 0.6 : 1 }}>
          {dishes.map((dish) => <DishCard key={dish.id} dish={dish} />)}
        </div>
      )}

      <Pager page={pageNumber} totalPages={result?.totalPages ?? 0}
             onChange={(p) => { update({ page: p > 1 ? String(p) : undefined }); window.scrollTo(0, 0) }} />
    </div>
  )
}
