import { useQuery } from '@tanstack/react-query'
import { unwrap } from '../../api/apiError'
import { getMySuggestions, getPopularDishes } from '../../api/services/suggestionService'
import { ListStatus } from '../../components/ui/ListStatus'
import { useCountry } from '../../state/CountryContext'
import { useSession } from '../../state/SessionContext'
import { HomeDishRow } from './HomeDishRow'

const COUNT = 12

/** Grey placeholder cards while a row loads. */
const loading = <ListStatus isLoading error={null} isEmpty={false} emptyText="" onRetry={() => undefined} placeholders={4} />

/**
 * Suggestions on Home (no AI yet: counted from orders, see the API's SuggestionRanker):
 * - **Signed in:** "Order again" (dishes they've bought, on sale now), then "You might like" with the reason on each
 *   card ("Often ordered with Jollof Rice"). With no orders yet that row is "Popular in Ghana".
 * - **Signed out:** "Popular in Ghana".
 * Only dishes that can be ordered now in the chosen country. A row with nothing to show, or that failed to load,
 * is simply left out: "Top rated" below is always there.
 */
export function HomeForYou() {
  const { selected } = useCountry()
  const { status } = useSession()
  const country = selected?.country
  const place = selected?.name ?? 'your country'

  // Under 'orders' so placing, paying or cancelling an order refreshes it
  const mine = useQuery({
    queryKey: ['orders', 'suggestions', country],
    queryFn: async ({ signal }) => unwrap(await getMySuggestions(country!, COUNT, signal)),
    enabled: status === 'signedIn' && !!country,
  })
  const popular = useQuery({
    queryKey: ['dishes', 'popular', country],
    queryFn: async ({ signal }) => unwrap(await getPopularDishes(country!, COUNT, signal)),
    enabled: status === 'signedOut' && !!country,
  })

  if (status === 'loading' || !country) return null

  if (status === 'signedOut') {
    if (popular.isError || (popular.data && popular.data.length === 0)) return null
    return (
      <HomeDishRow id="popular-title" eyebrow="What people are ordering" title={`Popular in ${place}`}
                   items={popular.data ?? []} status={loading} />
    )
  }

  if (mine.isError) return null
  if (mine.isPending) {
    return <HomeDishRow id="for-you-title" eyebrow="Picked for you" title="You might like" items={[]} status={loading} />
  }

  const { orderAgain, forYou, isPersonal } = mine.data
  return (
    <>
      {orderAgain.length > 0 && (
        <HomeDishRow id="order-again-title" eyebrow="Your favourites" title="Order again"
                     items={orderAgain.map((dish) => ({ dish }))}
                     link={{ to: '/orders', label: 'My orders ›' }} />
      )}
      {forYou.length > 0 && (
        <HomeDishRow id="for-you-title"
                     eyebrow={isPersonal ? 'Picked for you' : 'What people are ordering'}
                     title={isPersonal ? 'You might like' : `Popular in ${place}`}
                     items={forYou} />
      )}
    </>
  )
}
