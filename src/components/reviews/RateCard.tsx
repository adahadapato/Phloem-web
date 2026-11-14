import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { unwrap } from '../../api/apiError'
import type { MyReviewDto, ReviewStateDto } from '../../api/contracts/dtos'
import type { ReviewStatus } from '../../api/contracts/enums'
import { getReviewState, submitReview, type ReviewTarget } from '../../api/services/reviewService'
import { Button } from '../ui/Button'
import { StarPicker } from './StarPicker'
import { STAR_WORDS } from './starWords'
import { StarText } from './StarText'
import styles from './Reviews.module.css'

const COMMENT_MAX = 500   // Review.CommentMaxLength

/** What happens to my comment, in plain words (the stars always count straight away). */
function statusText(r: MyReviewDto): { text: string; waiting: boolean } {
  if (!r.comment) return { text: 'Thank you! Your rating has been added.', waiting: false }
  if (!r.showPublicly) return { text: 'Thank you! Your rating counts, and your comment is just for us.', waiting: false }
  const byStatus: Record<ReviewStatus, { text: string; waiting: boolean }> = {
    Checking: { text: 'Thank you! Your rating counts. Your comment will appear on Phloem in a moment.', waiting: true },
    WaitingForStaff: { text: 'Thank you! Your rating counts. Our team is taking a quick look at your comment before it goes on Phloem.', waiting: true },
    Published: { text: `Thank you! Your review is on Phloem as ${r.displayName}.`, waiting: false },
    Rejected: { text: 'Thank you! Your rating counts. Your comment won\'t be shown on Phloem, but our team has read it.', waiting: false },
    Hidden: { text: 'Thank you! Your rating counts. Your comment is no longer shown on Phloem.', waiting: false },
  }
  return byStatus[r.status]
}

/**
 * "How was it?": rate a delivered order or parcel with 1–5 stars and an optional comment (once, within 60 days).
 * Shows nothing until it's delivered; afterwards, my review and what happens to it. `?review=1` in the address
 * (the link in the "How did we do?" email) scrolls here and highlights it.
 * @param target The order or parcel.
 * @param title "How was your food?" / "How did we do?"
 * @param enabled Only ask the API once it's delivered.
 * @param highlight Came from the email: scroll here.
 */
export function RateCard({ target, title, enabled, highlight }: {
  target: ReviewTarget; title: string; enabled: boolean; highlight: boolean
}) {
  const queryClient = useQueryClient()
  const queryKey = ['review', target.kind, target.reference]
  const state = useQuery({
    queryKey,
    queryFn: async ({ signal }) => unwrap(await getReviewState(target, signal)),
    enabled,
  })
  const [stars, setStars] = useState(0)
  const [comment, setComment] = useState('')
  const [showPublicly, setShowPublicly] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const scrolled = useRef(false)

  const scrollHere = (el: HTMLElement | null) => {
    if (!el || !highlight || scrolled.current) return
    scrolled.current = true
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  const data = state.data
  if (!enabled || !data || (!data.canReview && !data.review)) return null

  const send = async () => {
    setBusy(true); setError(null)
    const result = await submitReview(target, { stars, comment: comment.trim() || null, showPublicly })
    setBusy(false)
    if (!result.ok) { setError(result.error.displayMessage); return }
    queryClient.setQueryData<ReviewStateDto>(queryKey, { ...data, canReview: false, review: result.value })
    // The shop's rating and the public reviews have changed
    void queryClient.invalidateQueries({ queryKey: ['reviews'] })
  }

  if (data.review) {
    const r = data.review
    const status = statusText(r)
    return (
      <section ref={scrollHere} className={`${styles.card} ${highlight ? styles.highlight : ''}`} aria-labelledby="rate-title">
        <h2 id="rate-title">Your review</h2>
        <div className={styles.mine}>
          <span><StarText stars={r.stars} /> <strong>{STAR_WORDS[r.stars]}</strong></span>
          {r.comment && <p style={{ margin: 0 }}>"{r.comment}"</p>}
        </div>
        <p className={`${styles.status} ${status.waiting ? styles.statusWait : ''}`}>{status.text}</p>
      </section>
    )
  }

  return (
    <section ref={scrollHere} className={`${styles.card} ${highlight ? styles.highlight : ''}`} aria-labelledby="rate-title">
      <h2 id="rate-title">{title}</h2>
      <StarPicker value={stars} onChange={setStars} legend="Tap a star to rate it" />

      {stars > 0 && (
        <div className={styles.form}>
          <label htmlFor="review-comment"><strong>Tell others about it</strong> <span className="muted">(optional)</span></label>
          <textarea id="review-comment" value={comment} maxLength={COMMENT_MAX}
                    placeholder={target.kind === 'Order' ? 'e.g. The jollof was spot on and still warm when it arrived.'
                                                         : 'e.g. Picked up on time and arrived safely in Lagos.'}
                    onChange={(e) => setComment(e.target.value)} />
          <span className={styles.counter}>{comment.length}/{COMMENT_MAX}</span>
          {comment.trim() && (
            <label className={styles.check}>
              <input type="checkbox" checked={showPublicly} onChange={(e) => setShowPublicly(e.target.checked)} />
              <span>Show my comment on Phloem as <strong>{data.showAs}</strong></span>
            </label>
          )}
          {error && <p className={styles.error} role="alert">{error}</p>}
          <div className={styles.actions}>
            <Button variant="primary" busy={busy} busyText="Sending…" onClick={() => void send()}>Send review</Button>
          </div>
          <p className={styles.muted}>Please don't include phone numbers or addresses. Comments are checked before they go on the site.</p>
        </div>
      )}
    </section>
  )
}
