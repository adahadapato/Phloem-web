import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { unwrap } from '../../api/apiError'
import type { DeliveryJobDto } from '../../api/contracts/dtos'
import { getMyDeliveries } from '../../api/services/deliveryService'
import { DeliveredForm } from '../../components/deliveries/DeliveredForm'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { dateTimeText, deliveryWindows } from '../../components/ui/labels'
import { StatusBanner } from '../../components/ui/StatusBanner'
import styles from './MyDeliveries.module.css'

/** A link that opens the address in the person's maps (Google Maps works on every phone and computer). */
const mapLink = (address: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`

/** One delivery: where to collect it, who it's for, where, and "Delivered" (the photo form opens in place). */
function DeliveryCard({ job, onDelivered }: { job: DeliveryJobDto; onDelivered: (job: DeliveryJobDto) => void }) {
  const [delivering, setDelivering] = useState(false)
  const when = job.deliveryWindow ? deliveryWindows.find((w) => w.value === job.deliveryWindow)?.label : null

  return (
    <article className={styles.card} aria-label={`${job.kind === 'Parcel' ? 'Parcel' : 'Order'} ${job.reference}`}>
      <div className={styles.cardTop}>
        <h2>{job.kind === 'Parcel' ? '📦 Parcel' : '🍲 Food order'} · {job.reference}</h2>
        <span className="muted">
          {job.deliveredAt
            ? `Delivered ${dateTimeText(job.deliveredAt)}`
            : <>{when ? `Deliver: ${when}` : 'Deliver today'}{job.assignedAt && ` · given to you ${dateTimeText(job.assignedAt)}`}</>}
        </span>
      </div>

      <p style={{ margin: 0 }}>
        Collect from <strong>{job.collectFrom}</strong>
        {job.collectPhone && <> · <a href={`tel:${job.collectPhone}`}>📞 {job.collectPhone}</a></>}
      </p>

      <div className={styles.where}>
        <p><strong>{job.recipientName}</strong></p>
        {job.recipientPhone && <p><a href={`tel:${job.recipientPhone}`}>📞 {job.recipientPhone}</a></p>}
        <p><a href={mapLink(job.address)} target="_blank" rel="noreferrer">📍 {job.address}</a></p>
      </div>

      <p className="muted" style={{ margin: 0 }}>{job.itemsSummary}</p>

      {job.deliveredAt && <p className={styles.done}>✓ {job.handoverSummary ?? 'Delivered'}</p>}

      {!job.deliveredAt && !delivering && (
        <div className={styles.buttons}>
          <Button variant="cta" onClick={() => setDelivering(true)}>📷 Delivered · take a photo</Button>
        </div>
      )}
      {!job.deliveredAt && delivering && (
        <DeliveredForm kind={job.kind} reference={job.reference} recipient={job.recipientName}
                       onDone={() => onDelivered(job)} onCancel={() => setDelivering(false)} />
      )}
    </article>
  )
}

/**
 * My deliveries (/deliveries): the food orders and parcels given to the signed-in courier (or to a seller who
 * delivers their own orders). To deliver (oldest first) / Delivered (last 7 days). "Delivered" asks for a photo of
 * where it was left; the customer sees it on their order page.
 */
export default function MyDeliveriesPage() {
  const queryClient = useQueryClient()
  const [done, setDone] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const query = useQuery({
    queryKey: ['deliveries', done],
    queryFn: async ({ signal }) => unwrap(await getMyDeliveries(done, signal)),
    staleTime: 0,
  })
  const jobs = query.data ?? []

  const onDelivered = async (job: DeliveryJobDto) => {
    setMessage(`${job.reference} delivered. ${job.kind === 'Parcel' ? 'The sender' : 'The customer'} has been told, with your photo.`)
    await queryClient.invalidateQueries({ queryKey: ['deliveries'] })
    await queryClient.invalidateQueries({ queryKey: ['seller'] })
  }

  const show = (showDone: boolean) => { setDone(showDone); setMessage(null) }

  return (
    <div className={`container ${styles.page}`}>
      <div className={styles.heading}>
        <h1>My deliveries</h1>
        <p className="muted">Take a photo of where you leave each one: the customer sees it.</p>
      </div>

      <div className={styles.tabs} role="tablist" aria-label="Which deliveries">
        <button type="button" role="tab" className={styles.tab} aria-selected={!done} onClick={() => show(false)}>To deliver</button>
        <button type="button" role="tab" className={styles.tab} aria-selected={done} onClick={() => show(true)}>Delivered</button>
      </div>

      {message && <StatusBanner message={message} />}

      {query.isPending && <p className="muted" aria-busy="true">Loading your deliveries…</p>}
      {query.isError && (
        <div className={styles.card}>
          <StatusBanner isError message={(query.error as { displayMessage?: string }).displayMessage
            ?? "We couldn't load your deliveries."} />
          <div><Button small variant="outline" onClick={() => query.refetch()}>Try again</Button></div>
        </div>
      )}
      {query.isSuccess && jobs.length === 0 && (
        <EmptyState icon="receipt"
                    title={done ? 'Nothing delivered in the last 7 days' : 'Nothing to deliver right now'}
                    text={done ? 'Deliveries you complete appear here for a week.'
                      : 'New deliveries appear here, and we email you too.'} />
      )}

      {jobs.map((job) => <DeliveryCard key={`${job.kind}:${job.reference}`} job={job} onDelivered={onDelivered} />)}
    </div>
  )
}
