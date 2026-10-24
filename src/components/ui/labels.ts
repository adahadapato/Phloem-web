/** Names people see for the API's values. Kept in one place so every page says the same. */
import type { DishCategory, DishSort } from '../../api/contracts/enums'

/** The category tabs, in the app's order. */
export const dishCategories: { value: DishCategory; label: string }[] = [
  { value: 'LocalMeals', label: 'Local Meals' },
  { value: 'Snacks', label: 'Snacks' },
  { value: 'Drinks', label: 'Drinks' },
]

/** The sort choices for dish lists. */
export const dishSorts: { value: DishSort; label: string }[] = [
  { value: 'Rating', label: 'Best rated' },
  { value: 'PriceLow', label: 'Price: low to high' },
  { value: 'PriceHigh', label: 'Price: high to low' },
]
