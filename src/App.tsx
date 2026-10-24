import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router'
import { ApiError } from './api/apiError'
import { router } from './routes'
import { CartProvider } from './state/CartContext'
import { CountryProvider } from './state/CountryContext'
import { SessionProvider } from './state/SessionContext'

/**
 * API data cache (React Query). Lists are kept fresh for 30 seconds. A failed load is tried once more, except for
 * answers that won't change by trying again (wrong input, not found, not allowed).
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) =>
        failureCount < 1 && !(error instanceof ApiError && error.status >= 400 && error.status < 500),
    },
  },
})

/** The whole website: data cache → signed-in person → picked country → basket → pages. */
export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <CountryProvider>
          <CartProvider>
            <RouterProvider router={router} />
          </CartProvider>
        </CountryProvider>
      </SessionProvider>
    </QueryClientProvider>
  )
}
