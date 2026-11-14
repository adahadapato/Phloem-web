import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router'
import { unwrap } from '../../api/apiError'
import { getMyShipment } from '../../api/services/shipmentService'
import { DeliveryProofCard } from '../../components/deliveries/DeliveryProofCard'
import { Button } from '../../components/ui/Button'
import { arrivalText, dateTimeText, shipmentCategories } from '../../components/ui/labels'
import { Price } from '../../components/ui/Price'
import { StatusBanner } from '../../components/ui/StatusBanner'
import { RouteText, ShipmentChip, ShipmentTimeline } from './ShipmentParts'
import styles from './Shipping.module.css'
import { useShipmentActions } from './useShipmentActions'
import { NeedHelp } from '../../components/ui/NeedHelp'

const categoryText = (c: string) => shipmentCategories.find((x) => x.value === c)?.label ?? c

/**
 * One of my parcels, like the app's Shipment details: status and route; where to drop it off (until it's at the
 * hub); the journey with times and notes ("Weighed: 7.40 kg"); recipient, sender, what's inside, weight and price;
 * then Pay now (once weighed), Track (shareable public page) and Cancel (before it leaves).
 */
export default function ShipmentDetailsPage() {
  const { trackingNumber = '' } = useParams()
  const actions = useShipmentActions()
  const query = useQuery({
    queryKey: ['shipments', 'detail', trackingNumber],
    queryFn: async ({ signal }) => unwrap(await getMyShipment(trackingNumber, signal)),
    staleTime: 0,
  })
  const s = query.data

  if (!s) {
    return (
      <div className={`container ${styles.page}`}>
        <div className={styles.narrow}>
          <Link to="/shipments" className={styles.strongLink}>‹ My shipments</Link>
          <div className={styles.card} style={{ marginTop: 12 }} aria-busy={query.isPending}>
            {query.isPending ? <p className="muted">Loading the parcel…</p> : (
              <>
                <StatusBanner isError message={(query.error as { displayMessage?: string } | null)?.displayMessage
                  ?? "We couldn't load this parcel."} />
                <div><Button small variant="outline" onClick={() => query.refetch()}>Try again</Button></div>
              </>
            )}
          </div>
        </div>
      </div>
    )
  }

  const busy = actions.busy
  const weighed = s.weighedWeightKg !== null
  const boxes = (s.measuredBoxes?.length ?? 0) > 0 ? s.measuredBoxes! : s.declaredBoxes ?? []
  const arrival = s.deliveredAt ? `Delivered ${dateTimeText(s.deliveredAt)}` : arrivalText(s.estimatedArrivalFrom, s.estimatedArrivalTo)

  return (
    <div className={`container ${styles.page}`}>
      <div className={styles.narrow}>
        <Link to="/shipments" className={styles.strongLink}>‹ My shipments</Link>
        <div className={styles.cardHead} style={{ marginTop: 8 }}>
          <div>
            <h1 style={{ marginBottom: 2 }}>Parcel details</h1>
            <p className={styles.number}>{s.trackingNumber}</p>
            <RouteText from={s.fromCountry} to={s.toCountry} />
          </div>
          <ShipmentChip status={s.status} />
        </div>

        {actions.message && <StatusBanner message={actions.message.text} isError={actions.message.isError} />}

        {s.status === 'Cancelled' && (
          <p className={styles.note}>This parcel was cancelled{s.needsRefund ? ' · your payment will be refunded.' : '.'}</p>
        )}

        {s.status === 'Booked' && s.handOver === 'HomePickup' && (
          <section className={`${styles.card} ${styles.highlight}`} aria-label="Pickup">
            <strong>We'll collect it from</strong>
            <span>{s.pickupAddressLine}, {s.pickupCity}, {s.pickupRegionOrPostcode}</span>
            <span className="muted">We'll call you to arrange a time. Write the tracking number on every box. We'll weigh and measure them, then you can pay here.</span>
          </section>
        )}
        {s.status === 'Booked' && s.handOver !== 'HomePickup' && s.dropOffAddress && (
          <section className={`${styles.card} ${styles.highlight}`} aria-label="Drop-off">
            <strong>Drop your parcel at</strong>
            <span style={{ whiteSpace: 'pre-line' }}>{s.dropOffAddress}</span>
            {s.dropOffHours && <span className="muted">{s.dropOffHours}</span>}
            <span className="muted">Write the tracking number on every box. We'll weigh and measure them, then you can pay here.</span>
          </section>
        )}
        {s.isReadyToCollect && (
          <section className={`${styles.card} ${styles.highlight}`} aria-label="Ready to collect">
            <strong>Ready to collect</strong>
            <span style={{ whiteSpace: 'pre-line' }}>{s.collectionHubAddress}</span>
            {s.collectionHubHours && <span className="muted">{s.collectionHubHours}</span>}
            <span className="muted">{s.recipientName} can collect it with photo ID and the tracking number.</span>
          </section>
        )}

        {/* ── Pay / Track / Cancel ── */}
        <div className={styles.detailButtons}>
          {actions.confirmCancel === s.trackingNumber ? (
            <div className={styles.confirm} role="group" aria-label="Cancel this parcel?">
              <strong>Cancel this parcel?</strong>
              <span className="muted">{s.status === 'Paid' ? 'Your payment will be refunded.' : 'Nothing has been paid yet.'}</span>
              <div className={styles.row}>
                <Button variant="cta" busy={busy === `cancel:${s.trackingNumber}`} busyText="Cancelling…"
                        onClick={() => actions.cancel(s.trackingNumber, s.status === 'Paid')}>Cancel parcel</Button>
                <Button variant="outline" onClick={() => actions.setConfirmCancel(null)}>Keep it</Button>
              </div>
            </div>
          ) : (
            <div className={styles.row}>
              {s.canPay && s.finalPrice !== null && (
                <Button variant="cta" busy={busy === `pay:${s.trackingNumber}`} busyText="Paying…" disabled={!!busy}
                        onClick={() => actions.pay(s.trackingNumber)}>
                  Pay <Price amount={s.finalPrice} currency={s.currency} className={styles.plain} />
                </Button>
              )}
              <Link to={`/track/${encodeURIComponent(s.trackingNumber)}`} className={`${styles.trackLink} ${styles.trackPlain}`}>
                Public tracking page
              </Link>
              {s.canCancel && (
                <Button variant="outline" disabled={!!busy} onClick={() => actions.setConfirmCancel(s.trackingNumber)}>
                  Cancel this parcel
                </Button>
              )}
            </div>
          )}
          <NeedHelp text="Questions about your parcel?" section="parcels" />
        </div>

        <div className={styles.detailGrid}>
          <section className={styles.card} aria-labelledby="timeline-title">
            <h2 id="timeline-title" className={styles.sectionTitle}>Timeline</h2>
            {s.status !== 'Cancelled' && <p className={styles.arrival}>{arrival ?? 'The expected date is set once it leaves.'}</p>}
            {s.status === 'OutForDelivery' && s.courierName && !s.isReadyToCollect && <p className="muted">🛵 {s.courierName} is delivering it.</p>}
            <ShipmentTimeline status={s.status} timeline={s.timeline} />
          </section>

          <DeliveryProofCard proof={s.deliveryProof} />

          <section className={styles.card} aria-label="Parcel">
            <dl className={styles.factsList}>
              <dt>Speed</dt><dd>{s.speed}</dd>
              <dt>Weight</dt>
              <dd>{weighed ? `${s.weighedWeightKg} kg (weighed)` : `${s.estimatedWeightKg} kg (estimated)`}</dd>
              {(s.chargeableWeightKg ?? s.estimatedChargeableWeightKg ?? 0) > 0 && (
                <><dt>Charged as</dt><dd>{s.chargeableWeightKg ?? s.estimatedChargeableWeightKg} kg <span className="muted">(weight or size, whichever is higher)</span></dd></>
              )}
              {boxes.length > 0 && (
                <><dt>Boxes</dt>
                  <dd>{boxes.map((b, i) => (
                    <span key={i} className={styles.block}>
                      {b.quantity} × {b.weightKg} kg{b.lengthCm !== null ? `, ${b.lengthCm} × ${b.widthCm} × ${b.heightCm} cm` : ''}
                    </span>
                  ))}</dd></>
              )}
              {s.isFragile && <><dt>Handling</dt><dd>Fragile</dd></>}
              {(s.fragileCharge ?? 0) + (s.homePickupCharge ?? 0) + (s.doorDeliveryCharge ?? 0) > 0 && (
                <><dt>Shipping</dt><dd><Price amount={s.freightCharge ?? 0} currency={s.currency} /></dd></>
              )}
              {(s.fragileCharge ?? 0) > 0 && <><dt>Fragile handling</dt><dd><Price amount={s.fragileCharge!} currency={s.currency} /></dd></>}
              {(s.homePickupCharge ?? 0) > 0 && <><dt>Home pickup</dt><dd><Price amount={s.homePickupCharge!} currency={s.currency} /></dd></>}
              {(s.doorDeliveryCharge ?? 0) > 0 && <><dt>Door delivery</dt><dd><Price amount={s.doorDeliveryCharge!} currency={s.currency} /></dd></>}
              <dt>{s.finalPrice !== null ? 'Price' : 'Estimated price'}</dt>
              <dd><Price amount={s.finalPrice ?? s.estimatedPrice} currency={s.currency} /></dd>
              <dt>Recipient</dt>
              <dd>
                {s.recipientName} · {s.recipientPhone}
                <span className={styles.block}>
                  {[s.recipientAddressLine, s.recipientCity, s.recipientDistrictName && `${s.recipientDistrictName} LGA`, s.recipientRegionOrPostcode]
                    .filter(Boolean).join(', ')}
                </span>
                {s.delivery === 'CollectFromHub' && <span className={styles.block}>Collects from our hub</span>}
              </dd>
              <dt>Sender</dt><dd>{s.senderName} · {s.senderPhone}</dd>
            </dl>
            <h3 className={styles.smallTitle}>What's inside</h3>
            <ul className={styles.itemsList}>
              {s.items.map((item, i) => (
                <li key={i}>
                  <span><strong>{item.quantity} × {item.description}</strong> <span className="muted">· {categoryText(item.category)}</span></span>
                  <Price amount={item.totalDeclaredValue} currency={s.currency} className={styles.plain} />
                </li>
              ))}
            </ul>
            <p className="muted" style={{ fontSize: 13 }}>
              Declared value: <Price amount={s.totalDeclaredValue} currency={s.currency} className={styles.plain} />
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
