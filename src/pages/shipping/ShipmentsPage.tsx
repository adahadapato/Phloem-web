import { useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router'
import { unwrap } from '../../api/apiError'
import type { ShipmentSummaryDto } from '../../api/contracts/dtos'
import { getMyShipments } from '../../api/services/shipmentService'
import { Button, ButtonLink } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { Pager } from '../../components/ui/Pager'
import { Price } from '../../components/ui/Price'
import { StatusBanner } from '../../components/ui/StatusBanner'
import { RouteText, ShipmentChip } from './ShipmentParts'
import styles from './Shipping.module.css'
import { useShipmentActions } from './useShipmentActions'

const PAGE_SIZE = 10

/** "24 Oct 2026" */
const dayText = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

/** What the sender should do next, in one line. */
function nextStep(s: ShipmentSummaryDto): string {
  switch (s.status) {
    case 'Booked': return 'Write the tracking number on the parcel and drop it at the hub.'
    case 'ReceivedAtHub': return s.canPay ? 'Weighed: pay the final price so it can leave.' : 'Weighed at the hub.'
    case 'Paid': return 'Paid. It leaves on the next shipment.'
    case 'InTransit': return 'On its way between the two countries.'
    case 'ArrivedInDestination': return 'Arrived. Going through the local hub.'
    case 'OutForDelivery': return `With the local courier, on its way to ${s.recipientName}.`
    case 'Delivered': return `Delivered to ${s.recipientName}.`
    case 'Cancelled': return 'Cancelled.'
  }
}

/** One parcel: summary strip (booked, price, to, tracking number), the next step, and the buttons on the right. */
function ShipmentCard({ s, actions }: { s: ShipmentSummaryDto; actions: ReturnType<typeof useShipmentActions> }) {
  const link = `/shipments/${encodeURIComponent(s.trackingNumber)}`
  const busy = actions.busy
  return (
    <article className={styles.parcel} aria-label={`Parcel ${s.trackingNumber}`}>
      <header className={styles.strip}>
        <dl className={styles.facts}>
          <div><dt>Booked</dt><dd>{dayText(s.bookedAt)}</dd></div>
          <div><dt>{s.isPriceFinal ? 'Price' : 'Estimated price'}</dt><dd><Price amount={s.price} currency={s.currency} className={styles.plain} /></dd></div>
          <div><dt>To</dt><dd>{s.recipientName}</dd></div>
        </dl>
        <div className={styles.numberCol}>
          <span>Tracking # {s.trackingNumber}</span>
          <Link to={link}>View parcel details</Link>
        </div>
      </header>
      <div className={styles.parcelBody}>
        <div>
          <ShipmentChip status={s.status} />
          <p className={styles.routeLine}><RouteText from={s.fromCountry} to={s.toCountry} /></p>
          <p className="muted">{s.speed} · {s.itemCount} {s.itemCount === 1 ? 'item' : 'items'}</p>
          <p className={styles.next}>{nextStep(s)}</p>
        </div>
        <div className={styles.buttonCol}>
          {actions.confirmCancel === s.trackingNumber ? (
            <div className={styles.confirm} role="group" aria-label="Cancel this parcel?">
              <strong>Cancel this parcel?</strong>
              <span className="muted">{s.status === 'Paid' ? 'Your payment will be refunded.' : 'Nothing has been paid yet.'}</span>
              <Button variant="cta" busy={busy === `cancel:${s.trackingNumber}`} busyText="Cancelling…"
                      onClick={() => actions.cancel(s.trackingNumber, s.status === 'Paid')}>Cancel parcel</Button>
              <Button variant="outline" onClick={() => actions.setConfirmCancel(null)}>Keep it</Button>
            </div>
          ) : (
            <>
              {s.canPay && (
                <Button variant="cta" busy={busy === `pay:${s.trackingNumber}`} busyText="Paying…" disabled={!!busy}
                        onClick={() => actions.pay(s.trackingNumber)}>
                  Pay now
                </Button>
              )}
              <Link to={`/track/${encodeURIComponent(s.trackingNumber)}`}
                    className={`${styles.trackLink} ${s.canPay || s.status === 'Delivered' || s.status === 'Cancelled' ? styles.trackPlain : ''}`}>
                Track parcel
              </Link>
              {s.canCancel && (
                <Button variant="outline" disabled={!!busy} onClick={() => actions.setConfirmCancel(s.trackingNumber)}>
                  Cancel parcel
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </article>
  )
}

/**
 * My shipments, in the same style as My orders: newest first, each parcel with a summary strip, where it is and
 * what to do next, and Pay now (once weighed) / Track parcel / Cancel on the right. Page number in the address.
 */
export default function ShipmentsPage() {
  const [params, setParams] = useSearchParams()
  const page = Math.max(1, Number(params.get('page')) || 1)
  const actions = useShipmentActions()

  const query = useQuery({
    queryKey: ['shipments', 'list', page],
    queryFn: async ({ signal }) => unwrap(await getMyShipments(page, PAGE_SIZE, signal)),
    placeholderData: (previous) => previous,
    staleTime: 0,
  })
  const parcels = query.data?.items ?? []

  return (
    <div className={`container ${styles.page}`}>
      <nav className={styles.crumbs} aria-label="Breadcrumb">
        <Link to="/account">My account</Link> <span aria-hidden="true">›</span> <span>My shipments</span>
      </nav>
      <div className={styles.topRow}>
        <div>
          <h1>My shipments</h1>
          <p className="muted">Your parcels, newest first</p>
        </div>
        <ButtonLink to="/send-parcel" variant="cta" small>+ Send a parcel</ButtonLink>
      </div>

      {actions.message && <StatusBanner message={actions.message.text} isError={actions.message.isError} />}

      {query.isPending && <div className={styles.card} aria-busy="true"><p className="muted">Loading your parcels…</p></div>}
      {query.isError && (
        <div className={styles.card}>
          <StatusBanner isError message={(query.error as { displayMessage?: string }).displayMessage
            ?? "We couldn't load your parcels."} />
          <div><Button small variant="outline" onClick={() => query.refetch()}>Try again</Button></div>
        </div>
      )}
      {query.isSuccess && parcels.length === 0 && (
        <EmptyState icon="parcel" title="No parcels yet" text="Parcels you book will appear here."
                    action={<ButtonLink to="/send-parcel">Send a parcel</ButtonLink>} />
      )}

      {parcels.map((s) => <ShipmentCard key={s.trackingNumber} s={s} actions={actions} />)}

      <Pager page={page} totalPages={query.data?.totalPages ?? 1}
             onChange={(p) => { setParams(p > 1 ? { page: String(p) } : {}); globalThis.scrollTo?.({ top: 0 }) }} />
    </div>
  )
}
