import type { Currency } from '../../api/contracts/enums'
import { useCountry } from '../../state/CountryContext'

/**
 * A price in the app's orange, with the currency symbol the API gives for that currency (GH₵, ₦, £), so the website
 * shows money exactly like the app. Falls back to the currency code before the countries have loaded.
 */
export function Price({ amount, currency, className }: { amount: number; currency: Currency; className?: string }) {
  const { countries } = useCountry()
  const symbol = countries.find((c) => c.currency === currency)?.currencySymbol ?? `${currency} `
  const number = amount.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  return <span className={['price', className].filter(Boolean).join(' ')}>{symbol}{number}</span>
}
