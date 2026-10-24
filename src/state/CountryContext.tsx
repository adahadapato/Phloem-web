/**
 * The country picked with the flag at the top: decides currency, shops and dishes shown, and the country of a new
 * account. Same job as the app's CartService.SelectedCountry.
 *
 * - The list comes from the API (GET /api/countries); nothing is typed in here.
 * - First visit: guessed from the browser's language region (e.g. "en-GB" → United Kingdom), else the first country.
 * - The choice is remembered in this browser.
 */
import { useQuery } from '@tanstack/react-query'
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { unwrap } from '../api/apiError'
import type { CountryDto } from '../api/contracts/dtos'
import type { Country } from '../api/contracts/enums'
import { getCountries } from '../api/services/countryService'

const STORAGE_KEY = 'phloem.country'

interface CountryState {
  /** Every country, from the API (empty while loading or when the API can't be reached). */
  countries: CountryDto[]
  /** The picked country, or undefined until the list has loaded. */
  selected: CountryDto | undefined
  /** Picks another country (remembered in this browser). */
  select: (country: Country) => void
  /** True while the list is loading for the first time. */
  isLoading: boolean
  /** Set when the list couldn't be loaded. */
  error: Error | null
  /** Tries to load the list again (after an error). */
  reload: () => void
}

const CountryContext = createContext<CountryState | null>(null)

/** Reads the remembered choice, if any. */
function readSaved(): Country | null {
  try {
    return localStorage.getItem(STORAGE_KEY) as Country | null
  } catch {
    return null
  }
}

/** First visit: the browser language's region, e.g. "en-GB" → GB. */
function guessFromBrowser(countries: CountryDto[]): CountryDto | undefined {
  const regions = navigator.languages.map((language) => language.split('-')[1]?.toUpperCase()).filter(Boolean)
  return countries.find((c) => regions.includes(c.isoCode.toUpperCase()))
}

export function CountryProvider({ children }: { children: ReactNode }) {
  const query = useQuery({
    queryKey: ['countries'],
    queryFn: ({ signal }) => getCountries(signal).then(unwrap),
    staleTime: 60 * 60 * 1000,   // countries change rarely: one load an hour is plenty
  })

  const { refetch } = query
  const [picked, setPicked] = useState<Country | null>(readSaved)

  const value = useMemo<CountryState>(() => {
    const countries = query.data ?? []
    const selected =
      countries.find((c) => c.country === picked) ?? guessFromBrowser(countries) ?? countries[0]

    return {
      countries,
      selected,
      select: (country) => {
        setPicked(country)
        try {
          localStorage.setItem(STORAGE_KEY, country)
        } catch {
          // Storage blocked: the choice lasts until the page closes
        }
      },
      isLoading: query.isPending,
      error: query.error,
      reload: () => void refetch(),
    }
  }, [query.data, query.isPending, query.error, refetch, picked])

  return <CountryContext.Provider value={value}>{children}</CountryContext.Provider>
}

/** The picked country and the list. Use inside {@link CountryProvider}. */
// eslint-disable-next-line react-refresh/only-export-components
export function useCountry(): CountryState {
  const state = useContext(CountryContext)
  if (!state) throw new Error('useCountry must be used inside <CountryProvider>.')
  return state
}
