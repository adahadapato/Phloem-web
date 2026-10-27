import { useQuery } from '@tanstack/react-query'
import { unwrap } from '../../api/apiError'
import { searchDishes } from '../../api/services/dishService'
import { ListStatus } from '../../components/ui/ListStatus'
import { useCountry } from '../../state/CountryContext'
import { HomeDishRow } from './HomeDishRow'

const COUNT = 12

/**
 * "Top rated near you": the best-rated dishes in the chosen country in a row that slides sideways (arrows on a big
 * screen, swipe on a phone), each with the usual green "+" to put it in the basket.
 */
export function HomeDishes() {
  const country = useCountry()
  const { selected } = country
  const dishes = useQuery({
    queryKey: ['dishes', 'home', selected?.country, undefined],
    queryFn: async ({ signal }) => unwrap(await searchDishes({ country: selected?.country, sort: 'Rating', pageSize: COUNT }, signal)),
    enabled: !!selected,
  })
  const items = (dishes.data?.items ?? []).map((dish) => ({ dish }))

  return (
    <HomeDishRow id="dishes-title" eyebrow="Chef’s picks" title={`Top rated ${selected ? `in ${selected.name}` : 'near you'}`}
                 items={items} link={{ to: '/explore', label: 'See the full menu ›' }}
                 status={
                   <ListStatus isLoading={!selected ? country.isLoading : dishes.isPending}
                               error={!selected ? country.error : dishes.error}
                               onRetry={!selected ? country.reload : () => void dishes.refetch()}
                               isEmpty={items.length === 0} placeholders={4}
                               emptyText="No dishes here yet. Check back soon, or pick another country at the top." />
                 } />
  )
}
