import type { ShipmentQuoteDto } from '../../../api/contracts/dtos'
import { Price } from '../../../components/ui/Price'
import { kg } from './parcelMath'
import styles from './Parcel.module.css'

/** The price, part by part: freight (with the weights), fragile, pickup, door delivery. */
export function PriceBreakdown({ quote }: { quote: ShipmentQuoteDto }) {
  const boxes = quote.boxes.reduce((n, b) => n + b.quantity, 0)
  const bySize = quote.boxes.some((b) => b.chargedBySize)
  return (
    <dl className={styles.breakdown}>
      <dt>{boxes} box{boxes === 1 ? '' : 'es'} · {kg(quote.estimatedWeightKg)}</dt>
      <dd>charged as {kg(quote.chargeableWeightKg)}</dd>
      {bySize && <dd className={styles.breakdownSmall}>Some boxes are charged by their size (see "This box counts as").</dd>}
      <dt>Shipping</dt>
      <dd><Price amount={quote.freightCharge} currency={quote.currency} /></dd>
      <dd className={styles.breakdownSmall}>
        <Price amount={quote.baseCharge} currency={quote.currency} className={styles.plainPrice} /> +{' '}
        <Price amount={quote.pricePerKg} currency={quote.currency} className={styles.plainPrice} /> × {kg(quote.chargeableWeightKg)}
      </dd>
      {quote.fragileCharge > 0 && <><dt>Fragile handling</dt><dd><Price amount={quote.fragileCharge} currency={quote.currency} /></dd></>}
      {quote.homePickupCharge > 0 && <><dt>Home pickup</dt><dd><Price amount={quote.homePickupCharge} currency={quote.currency} /></dd></>}
      {quote.doorDeliveryCharge > 0 && (
        <><dt>Door delivery{quote.deliveryZoneName ? ` (${quote.deliveryZoneName})` : ''}</dt>
          <dd><Price amount={quote.doorDeliveryCharge} currency={quote.currency} /></dd></>
      )}
    </dl>
  )
}
