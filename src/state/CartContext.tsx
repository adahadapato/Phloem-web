/**
 * The basket, kept in this browser (no server basket, like the app). Same job as the app's CartService.
 *
 * - Each line remembers what the card showed (name, photo, price, shop), so the basket page can show it without
 *   calling the API. Prices and stock are checked again by the API at checkout (POST /api/basket/check), which
 *   is what the order uses.
 * - One order per shop: the basket can hold several shops; checkout splits them.
 * - At most 99 of one dish (the API's limit).
 * - Saved in localStorage, so it survives a refresh and closing the browser; another tab sees changes too.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { DishCardDto } from '../api/contracts/dtos'
import type { Country, Currency } from '../api/contracts/enums'

/** The API's limit for one dish in one order. */
export const MAX_QUANTITY = 99

const STORAGE_KEY = 'phloem.basket'

/** One dish in the basket. */
export interface CartLine {
  dishId: string
  name: string
  imageUrl: string | null
  /** The price when it was added (checkout shows today's price). */
  price: number
  currency: Currency
  country: Country
  shopId: string
  shopName: string
  quantity: number
}

/** The basket's lines for one shop (one order each). */
export interface CartShop {
  shopId: string
  shopName: string
  currency: Currency
  lines: CartLine[]
  /** At the prices when added. */
  subtotal: number
}

interface CartState {
  lines: CartLine[]
  /** All the lines grouped by shop, in the order the shops were first added. */
  shops: CartShop[]
  /** Total number of dishes (2 × jollof + 1 × waakye = 3). */
  count: number
  /** How many of this dish are in the basket (0 = none). */
  quantityOf: (dishId: string) => number
  /** Adds one (or puts it in with 1). */
  add: (dish: DishCardDto) => void
  /** Sets the number of one dish; 0 removes it. Kept between 0 and 99. */
  setQuantity: (dishId: string, quantity: number) => void
  remove: (dishId: string) => void
  /** Empties the basket (after placing the order), or only some dishes. */
  clear: (dishIds?: string[]) => void
}

const CartContext = createContext<CartState | null>(null)

function read(): CartLine[] {
  try {
    const json = localStorage.getItem(STORAGE_KEY)
    const parsed = json ? (JSON.parse(json) as CartLine[]) : []
    return Array.isArray(parsed) ? parsed.filter((l) => l && l.dishId && l.quantity > 0) : []
  } catch {
    return []
  }
}

function write(lines: CartLine[]): void {
  try {
    if (lines.length) localStorage.setItem(STORAGE_KEY, JSON.stringify(lines))
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Storage blocked: the basket lasts until the page closes
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>(read)

  /** Changes the basket and saves it. */
  const update = useCallback((change: (current: CartLine[]) => CartLine[]) => {
    setLines((current) => {
      const next = change(current)
      write(next)
      return next
    })
  }, [])

  // Another tab changed the basket: show the same
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) setLines(read())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const value = useMemo<CartState>(() => {
    const shops: CartShop[] = []
    for (const line of lines) {
      let shop = shops.find((s) => s.shopId === line.shopId)
      if (!shop) {
        shop = { shopId: line.shopId, shopName: line.shopName, currency: line.currency, lines: [], subtotal: 0 }
        shops.push(shop)
      }
      shop.lines.push(line)
      shop.subtotal += line.price * line.quantity
    }

    const setQuantity = (dishId: string, quantity: number) => {
      const wanted = Math.max(0, Math.min(MAX_QUANTITY, Math.round(quantity)))
      update((current) => wanted === 0
        ? current.filter((l) => l.dishId !== dishId)
        : current.map((l) => (l.dishId === dishId ? { ...l, quantity: wanted } : l)))
    }

    return {
      lines,
      shops,
      count: lines.reduce((sum, l) => sum + l.quantity, 0),
      quantityOf: (dishId) => lines.find((l) => l.dishId === dishId)?.quantity ?? 0,
      add: (dish) => update((current) => {
        const existing = current.find((l) => l.dishId === dish.id)
        if (existing) {
          return current.map((l) => (l.dishId === dish.id
            ? { ...l, quantity: Math.min(MAX_QUANTITY, l.quantity + 1) }
            : l))
        }
        return [...current, {
          dishId: dish.id, name: dish.name, imageUrl: dish.imageUrl, price: dish.price, currency: dish.currency,
          country: dish.country, shopId: dish.vendorId, shopName: dish.vendorName, quantity: 1,
        }]
      }),
      setQuantity,
      remove: (dishId) => setQuantity(dishId, 0),
      clear: (dishIds) => update((current) => (dishIds ? current.filter((l) => !dishIds.includes(l.dishId)) : [])),
    }
  }, [lines, update])

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

/** The basket. Use inside {@link CartProvider}. */
// eslint-disable-next-line react-refresh/only-export-components
export function useCart(): CartState {
  const state = useContext(CartContext)
  if (!state) throw new Error('useCart must be used inside <CartProvider>.')
  return state
}
