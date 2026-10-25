import { useQuery } from '@tanstack/react-query'
import { unwrap } from '../../api/apiError'
import { getMyShop } from '../../api/services/shopService'

/** The signed-in seller's shop (GET /api/shops/mine), shared by every seller page. */
export function useMyShop() {
  return useQuery({
    queryKey: ['seller', 'shop'],
    queryFn: async ({ signal }) => unwrap(await getMyShop(signal)),
    staleTime: 30_000,
  })
}
