import type { DeliveryProofDto } from '../../api/contracts/dtos'
import { fileUrl } from '../../api/config'
import { dateTimeText } from '../ui/labels'
import styles from './Deliveries.module.css'

/**
 * "Proof of delivery": the photo the courier took, how it was handed over, their note, and who delivered it when.
 * On the customer's order and parcel pages, the seller's orders and the admin parcel page. Click the photo to open it
 * full size. The link works for about 15 minutes; the page loads a fresh one each time.
 */
export function DeliveryProofCard({ proof }: { proof: DeliveryProofDto | null | undefined }) {
  if (!proof) return null
  const url = fileUrl(proof.photoUrl)

  return (
    <section className={styles.proof} aria-labelledby="proof-title">
      <h2 id="proof-title" className={styles.proofTitle}>
        <span className={styles.tick} aria-hidden="true">✓</span> Proof of delivery
      </h2>
      <a href={url} target="_blank" rel="noreferrer" className={styles.photoLink}
         aria-label="Open the delivery photo full size">
        <img src={url} alt={`Delivery photo: ${proof.summary}`} className={styles.photo} loading="lazy" />
      </a>
      <p className={styles.summary}>{proof.summary}</p>
      {proof.note && <p className={styles.note}>“{proof.note}”</p>}
      <p className={styles.meta}>
        Delivered {dateTimeText(proof.deliveredAt)}{proof.courierName && ` by ${proof.courierName}`}
      </p>
    </section>
  )
}
