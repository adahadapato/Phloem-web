import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { unwrap } from '../../api/apiError'
import { getRecentlyOrderedDishes } from '../../api/services/orderService'
import { ApiImage } from '../../components/ui/ApiImage'
import { Price } from '../../components/ui/Price'
import { QuantityStepper } from '../../components/ui/QuantityStepper'
import { useCart } from '../../state/CartContext'
import styles from './MyOrders.module.css'

/**
 * "Buy it again" beside My orders: dishes from the person's paid orders that are still on sale, newest first,
 * each with the green + (or − n +) so a favourite goes straight back in the basket. Hidden when there are none
 * (new customers) or when they can't be loaded (the orders matter more).
 */
export function BuyItAgainPanel() {
  const cart = useCart()
  const query = useQuery({
    queryKey: ['orders', 'recent-dishes'],
    queryFn: async ({ signal }) => unwrap(await getRecentlyOrderedDishes(8, signal)),
    staleTime: 60_000,
  })
  const dishes = query.data ?? []
  if (dishes.length === 0) return null

  return (
    <aside className={styles.panel} aria-labelledby="buy-again-title">
      <h2 id="buy-again-title" className={styles.panelTitle}>Buy it again</h2>
      <ul className={styles.panelList}>
        {dishes.map((dish) => (
          <li key={dish.id} className={styles.panelItem}>
            <ApiImage src={dish.imageUrl} alt="" className={styles.panelThumb} />
            <div className={styles.panelText}>
              <Link to={`/shops/${dish.vendorId}`} className={styles.panelName}>{dish.name}</Link>
              <span className="muted">{dish.vendorName}</span>
              <div className={styles.panelEnd}>
                <Price amount={dish.price} currency={dish.currency} />
                <QuantityStepper quantity={cart.quantityOf(dish.id)} label={dish.name}
                                 onAdd={() => cart.add(dish)}
                                 onChange={(q) => cart.setQuantity(dish.id, q)} />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </aside>
  )
}
