import { useQuery } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ApiError, unwrap } from '../../api/apiError'
import { trackShipment } from '../../api/services/shipmentService'
import { Button } from '../../components/ui/Button'
import { arrivalText } from '../../components/ui/labels'
import { StatusBanner } from '../../components/ui/StatusBanner'
import { RouteText, ShipmentChip, ShipmentTimeline } from './ShipmentParts'
import styles from './Shipping.module.css'

/** Tracking numbers look like "PHS-261024-482193": capitals, no spaces. */
const tidy = (text: string) => text.trim().toUpperCase().replace(/\s+/g, '')

/**
 * Track a parcel, open to everyone (e.g. the person receiving it): type the tracking number and see where the parcel
 * is, the route, the speed, the expected arrival and every step so far. Like the API, it never shows names,
 * addresses, what's inside or prices. The number is in the address (/track/PHS-…), so a tracking link can be shared.
 */
export default function TrackPage() {
  const { trackingNumber = '' } = useParams()
  const navigate = useNavigate()
  const [text, setText] = useState(trackingNumber)

  const number = tidy(trackingNumber)
  const query = useQuery({
    queryKey: ['track', number],
    queryFn: async ({ signal }) => unwrap(await trackShipment(number, signal)),
    enabled: number.length > 0,
    retry: false,
    staleTime: 30_000,
  })

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    const typed = tidy(text)
    if (typed) void navigate(`/track/${encodeURIComponent(typed)}`)
  }

  const error = query.error as ApiError | null
  const notFound = error?.status === 404
  const p = query.data

  return (
    <div className={`container ${styles.page}`}>
      <div className={styles.narrow}>
        <p className="eyebrow">Parcels</p>
        <h1>Track a parcel</h1>
        <p className="muted">Type the tracking number from the booking, e.g. PHS-261024-482193.</p>

        <form className={styles.trackForm} onSubmit={onSubmit} role="search">
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="PHS-261024-482193"
                 aria-label="Tracking number" autoCapitalize="characters" spellCheck={false} maxLength={30} />
          <Button type="submit" variant="cta" busy={query.isFetching} busyText="Tracking…">Track</Button>
        </form>

        {number && query.isError && (
          <StatusBanner isError message={notFound
            ? `We couldn't find a parcel with the tracking number ${number}. Check it's typed exactly as on the ` +
              'booking (letters, numbers and dashes).'
            : error?.displayMessage ?? "We couldn't check this parcel. Please try again."} />
        )}

        {p && (
          <section className={styles.card} aria-labelledby="track-title">
            <div className={styles.cardHead}>
              <div>
                <h2 id="track-title" className={styles.number}>{p.trackingNumber}</h2>
                <RouteText from={p.fromCountry} to={p.toCountry} />
                <p className="muted">{p.speed} shipping</p>
              </div>
              <ShipmentChip status={p.status} />
            </div>
            {p.status !== 'Cancelled' && p.status !== 'Delivered' && (
              <p className={styles.arrival}>
                {arrivalText(p.estimatedArrivalFrom, p.estimatedArrivalTo) ?? 'The expected date is set once it leaves.'}
              </p>
            )}
            <ShipmentTimeline status={p.status} timeline={p.timeline} />
          </section>
        )}

        {!number && (
          <div className={styles.howItWorks}>
            <h2>Sending one?</h2>
            <p className="muted">
              Book it on Phloem, drop it at our hub, we weigh it and you pay the final price, then we deliver it.
            </p>
            <Link to="/send-parcel" className={styles.strongLink}>Send a parcel ›</Link>
          </div>
        )}
      </div>
    </div>
  )
}
