import type { ShipmentEventDto } from '../../api/contracts/dtos'
import type { Country, ShipmentStatus } from '../../api/contracts/enums'
import { CountryFlag } from '../../components/ui/CountryFlag'
import { dateTimeText, shipmentJourney, shipmentStatusText, shipmentStepText } from '../../components/ui/labels'
import { useCountry } from '../../state/CountryContext'
import styles from './Shipping.module.css'

/** "🇬🇭 Ghana → 🇬🇧 United Kingdom", with real flag pictures (names from the API's country list). */
export function RouteText({ from, to }: { from: Country; to: Country }) {
  const { countries } = useCountry()
  const one = (c: Country) => {
    const info = countries.find((x) => x.country === c)
    return (
      <span className={styles.place}>
        {info && <CountryFlag country={info} />} {info?.name ?? c}
      </span>
    )
  }
  return <span className={styles.route}>{one(from)} <span aria-label="to">→</span> {one(to)}</span>
}

/** The coloured status label: orange when the sender must act (drop off, pay), green on the way, grey cancelled. */
export function ShipmentChip({ status }: { status: ShipmentStatus }) {
  const tone = status === 'Booked' || status === 'ReceivedAtHub' ? styles.chipAct
    : status === 'Cancelled' ? styles.chipCancelled
    : status === 'Delivered' ? styles.chipDone
    : styles.chipMoving
  return <span className={`${styles.chip} ${tone}`}>{shipmentStatusText[status]}</span>
}

/**
 * The parcel's journey: every step from Booked to Delivered, ticked with its time when reached (and the staff note,
 * e.g. "Weighed: 7.40 kg", for the sender; public tracking has no notes). A cancelled parcel shows what happened,
 * ending with "Cancelled".
 */
export function ShipmentTimeline({ status, timeline }: { status: ShipmentStatus; timeline: ShipmentEventDto[] }) {
  const reached = new Map(timeline.map((e) => [e.status, e]))

  // Cancelled: only the steps that happened, in order
  if (status === 'Cancelled') {
    return (
      <ol className={styles.steps}>
        {timeline.map((e, i) => (
          <li key={`${e.status}-${i}`} className={e.status === 'Cancelled' ? styles.stepCancelled : styles.stepDone}>
            <span className={styles.stepDot} aria-hidden="true">{e.status === 'Cancelled' ? '×' : '✓'}</span>
            <span>
              <strong>{shipmentStepText[e.status]}</strong>
              <span className="muted">{dateTimeText(e.occurredAt)}{e.note ? ` · ${e.note}` : ''}</span>
            </span>
          </li>
        ))}
      </ol>
    )
  }

  const current = shipmentJourney.indexOf(status)
  return (
    <ol className={styles.steps}>
      {shipmentJourney.map((step, i) => {
        const event = reached.get(step)
        const done = i <= current
        return (
          <li key={step} className={done ? styles.stepDone : i === current + 1 ? styles.stepNext : ''}
              aria-current={i === current ? 'step' : undefined}>
            <span className={styles.stepDot} aria-hidden="true">{done ? '✓' : ''}</span>
            <span>
              <strong>{shipmentStepText[step]}</strong>
              {event && (
                <span className="muted">{dateTimeText(event.occurredAt)}{event.note ? ` · ${event.note}` : ''}</span>
              )}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
