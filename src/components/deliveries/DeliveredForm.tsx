import { useEffect, useState, type FormEvent } from 'react'
import type { DeliveryKind, HandoverMethod } from '../../api/contracts/enums'
import { markDelivered } from '../../api/services/deliveryService'
import { Button } from '../ui/Button'
import { StatusBanner } from '../ui/StatusBanner'
import styles from './Deliveries.module.css'

const RECEIVED_BY_MAX = 100   // ProofOfDelivery.ReceivedByMaxLength
const NOTE_MAX = 300          // ProofOfDelivery.NoteMaxLength
const PHOTO_MAX = 10 * 1024 * 1024

/** The handover choices, in the order a courier thinks of them. */
const handovers: { value: HandoverMethod; label: string }[] = [
  { value: 'InPerson', label: '🤝 Handed to them' },
  { value: 'FrontDoor', label: '🚪 Front door' },
  { value: 'Neighbour', label: '🏠 Neighbour' },
  { value: 'SafePlace', label: '📦 Safe place' },
  { value: 'Reception', label: '🛎 Reception / gate' },
]

const asksWho = (h: HandoverMethod | null) => h === 'InPerson' || h === 'Neighbour' || h === 'Reception'

/**
 * "Delivered": a photo of where it was left (always required; on a phone the button opens the camera), how it was
 * handed over (and which neighbour), and an optional note for the customer. Sends it, then calls `onDone`.
 */
export function DeliveredForm({ kind, reference, recipient, onDone, onCancel }: {
  kind: DeliveryKind
  reference: string
  recipient?: string
  onDone: () => void
  onCancel: () => void
}) {
  const [photo, setPhoto] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [handover, setHandover] = useState<HandoverMethod | null>(null)
  const [receivedBy, setReceivedBy] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Free the preview's memory when it's replaced or the form closes
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])

  const id = (name: string) => `${name}-${reference}`

  const onPhoto = (file: File | undefined) => {
    if (!file) return
    if (file.size > PHOTO_MAX) { setError('Photos must be 10 MB or smaller.'); return }
    setPhoto(file)
    setPreview(URL.createObjectURL(file))
    setError(null)
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!photo) { setError('Please take a photo of where you left it.'); return }
    if (!handover) { setError('Please choose how you handed it over.'); return }
    if (handover === 'Neighbour' && !receivedBy.trim()) { setError('Please say which neighbour took it.'); return }

    setBusy(true)
    setError(null)
    const result = await markDelivered(kind, reference, {
      photo, handover, receivedBy: asksWho(handover) ? receivedBy : undefined, note,
    })
    setBusy(false)
    if (!result.ok) { setError(result.error.displayMessage); return }
    onDone()
  }

  return (
    <form className={styles.form} onSubmit={onSubmit} aria-label={`Delivered: ${reference}`} noValidate>
      {recipient && <p className="muted" style={{ margin: 0 }}>For <strong>{recipient}</strong></p>}

      <h3 className={styles.step}>1. Photo of where you left it</h3>
      <label className={styles.drop}>
        {preview
          ? <img src={preview} alt="The delivery photo you took" className={styles.preview} />
          : (
            <span className={styles.dropText}>
              <span className={styles.dropIcon} aria-hidden="true">📷</span>
              <strong>Take a photo</strong>
              <span>The door, the parcel on the step, or the person holding it</span>
            </span>
          )}
        <input type="file" accept="image/*" capture="environment" aria-label="Delivery photo"
               onChange={(e) => onPhoto(e.target.files?.[0])} />
      </label>
      {preview && <span className="muted" style={{ fontSize: 13 }}>Click the photo to take another.</span>}

      <fieldset className={styles.chips}>
        <legend className={styles.step} style={{ marginBottom: 8 }}>2. How did you hand it over?</legend>
        {handovers.map((h) => (
          <label key={h.value} className={styles.chip}>
            <input type="radio" name={id('handover')} value={h.value} checked={handover === h.value}
                   onChange={() => { setHandover(h.value); setError(null) }} />
            {h.label}
          </label>
        ))}
      </fieldset>

      {asksWho(handover) && (
        <label className={styles.field}>
          {handover === 'Neighbour' ? 'Which neighbour?' : 'Who took it? (optional)'}
          <input value={receivedBy} maxLength={RECEIVED_BY_MAX} onChange={(e) => setReceivedBy(e.target.value)}
                 placeholder={handover === 'Neighbour' ? 'e.g. Mrs Ade at No. 14'
                   : handover === 'Reception' ? 'e.g. Musa at the gate' : 'e.g. Ama'} />
        </label>
      )}

      <label className={styles.field}>
        Note for the customer (optional)
        <textarea value={note} maxLength={NOTE_MAX} rows={2} onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. Behind the blue gate" />
      </label>

      {error && <StatusBanner isError message={error} />}

      <div className={styles.buttons}>
        <Button type="submit" variant="cta" busy={busy} busyText="Sending…">✓ Confirm delivered</Button>
        <Button variant="outline" disabled={busy} onClick={onCancel}>Not yet</Button>
      </div>
      <span className="muted" style={{ fontSize: 12 }}>Only the customer, the shop and Phloem staff can see the photo.</span>
    </form>
  )
}
