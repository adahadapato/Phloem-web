import { useQuery } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { ApiError, unwrap } from '../../api/apiError'
import type { ContactTopic } from '../../api/contracts/enums'
import { getContactDetails, sendContactMessage } from '../../api/services/contactService'
import { Button } from '../../components/ui/Button'
import { Field } from '../../components/ui/Field'
import fieldStyles from '../../components/ui/Field.module.css'
import { contactTopics } from '../../components/ui/labels'
import { StatusBanner } from '../../components/ui/StatusBanner'
import { useSession } from '../../state/SessionContext'
import styles from './ContactPage.module.css'

const MESSAGE_MIN = 10
const MESSAGE_MAX = 2000

/** Quick answers on the Help page, by section. */
const QUICK_ANSWERS = [
  { to: '/help#orders', label: 'Orders, delivery and refunds' },
  { to: '/help#parcels', label: 'Sending parcels' },
  { to: '/help#selling', label: 'Selling on Phloem' },
  { to: '/help#account', label: 'Your account' },
]

/** "+44 7700 900000" → "447700900000" for a wa.me link. */
const whatsAppLink = (number: string) => `https://wa.me/${number.replace(/[^\d]/g, '')}`

/**
 * Contact us: a short form (name, email, topic, order or tracking number when it helps, message) next to the ways to
 * reach the team (email, phone, WhatsApp, hours, address, from the API, so they change without a new website).
 * Signed-in people get their name and email filled in. A hidden "website" field catches robots. After sending: a
 * thank-you with when to expect a reply.
 */
export default function ContactPage() {
  const { profile } = useSession()
  const details = useQuery({
    queryKey: ['contact', 'details'],
    queryFn: async ({ signal }) => unwrap(await getContactDetails(signal)),
    staleTime: 10 * 60_000,
  })
  const d = details.data

  const [name, setName] = useState(profile?.fullName ?? '')
  const [email, setEmail] = useState(profile?.email ?? '')
  const [topic, setTopic] = useState<ContactTopic | ''>('')
  const [reference, setReference] = useState('')
  const [message, setMessage] = useState('')
  const [website, setWebsite] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)
  const [localError, setLocalError] = useState<Record<string, string>>({})
  const [sentTo, setSentTo] = useState<{ name: string; email: string } | null>(null)

  // Filled in once the profile arrives (a kept sign-in is restored after the page opens)
  const [filled, setFilled] = useState(false)
  if (profile && !filled) {
    setFilled(true)
    if (!name) setName(profile.fullName)
    if (!email) setEmail(profile.email)
  }

  const chosen = contactTopics.find((t) => t.value === topic)
  const fieldError = (field: string) => localError[field] ?? error?.fieldError(field)
  /** Editing a field clears its error (from this page or from the API). */
  const edited = (field: string) => {
    if (localError[field]) {
      setLocalError((errors) => Object.fromEntries(Object.entries(errors).filter(([key]) => key !== field)))
    }
    if (error?.fieldError(field)) setError(null)
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const problems: Record<string, string> = {}
    if (!name.trim()) problems.name = 'Please enter your name.'
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) problems.email = 'Please enter a valid email address so we can reply.'
    if (!topic) problems.topic = 'Please choose what your message is about.'
    if (message.trim().length < MESSAGE_MIN) problems.message = `Please tell us a little more (at least ${MESSAGE_MIN} characters).`
    setLocalError(problems)
    setError(null)
    if (Object.keys(problems).length > 0 || !topic) return

    setBusy(true)
    const result = await sendContactMessage({
      name: name.trim(),
      email: email.trim(),
      topic,
      reference: chosen?.reference && reference.trim() ? reference.trim() : null,
      message: message.trim(),
      website: website || null,
    })
    setBusy(false)
    if (!result.ok) { setError(result.error); return }
    setSentTo({ name: name.trim().split(' ')[0], email: email.trim() })
    setTopic(''); setReference(''); setMessage('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <>
      <section className={styles.hero}>
        <div className="container">
          <p className="eyebrow">We’re here to help</p>
          <h1>Contact us</h1>
          <p>
            A question about an order, a parcel or selling on Phloem? Send us a message
            {d?.replyTime ? ` and we’ll reply ${d.replyTime}.` : ' and we’ll get back to you.'}
          </p>
        </div>
      </section>

      <div className={`container ${styles.layout}`}>
        <section className={`card ${styles.formCard}`} aria-labelledby="contact-form-title">
          {sentTo ? (
            <div className={styles.thanks} role="status">
              <span className={styles.thanksIcon} aria-hidden="true">✓</span>
              <h2 id="contact-form-title">Thanks, {sentTo.name}!</h2>
              <p>
                We’ve got your message{d?.replyTime ? ` and we’ll reply ${d.replyTime}` : ''}. A copy is on its way
                to <strong>{sentTo.email}</strong>. If it doesn’t arrive, check your spam folder.
              </p>
              <div className={styles.thanksActions}>
                <Button variant="outline" onClick={() => setSentTo(null)}>Send another message</Button>
                <Link to="/" className={styles.homeLink}>Back to Home ›</Link>
              </div>
            </div>
          ) : (
            <form className={styles.form} onSubmit={submit} noValidate>
              <h2 id="contact-form-title" className={styles.formTitle}>Send us a message</h2>

              <div className={styles.twoCols}>
                <Field label="Your name" autoComplete="name" value={name} maxLength={100}
                       onChange={(e) => { setName(e.target.value); edited('name') }} error={fieldError('name')} />
                <Field label="Email" type="email" autoComplete="email" value={email} maxLength={256}
                       onChange={(e) => { setEmail(e.target.value); edited('email') }} error={fieldError('email')}
                       hint="We’ll reply to this address." />
              </div>

              <fieldset className={styles.topics} aria-describedby={fieldError('topic') ? 'topic-error' : undefined}>
                <legend className={fieldStyles.label}>What’s it about?</legend>
                <div className={styles.topicGrid}>
                  {contactTopics.map((t) => (
                    <label key={t.value} className={`${styles.topic} ${topic === t.value ? styles.topicOn : ''}`}>
                      <input type="radio" name="topic" value={t.value} checked={topic === t.value}
                             onChange={() => { setTopic(t.value); edited('topic') }} />
                      <strong>{t.label}</strong>
                      <span>{t.hint}</span>
                    </label>
                  ))}
                </div>
                {fieldError('topic') && <p id="topic-error" className={fieldStyles.error}>{fieldError('topic')}</p>}
              </fieldset>

              {chosen?.reference && (
                <Field label={chosen.reference} optional value={reference} maxLength={40}
                       placeholder={topic === 'Order' ? 'e.g. PH-261027-004821' : 'e.g. PHS-261027-001234'}
                       onChange={(e) => { setReference(e.target.value); edited('reference') }} error={fieldError('reference')}
                       hint="It helps us find it quickly." />
              )}

              <div className={`${fieldStyles.field} ${fieldError('message') ? fieldStyles.invalid : ''}`}>
                <label htmlFor="contact-message" className={fieldStyles.label}>Your message</label>
                <div className={`${fieldStyles.box} ${styles.messageBox}`}>
                  <textarea id="contact-message" className={styles.textarea} rows={6} value={message}
                            maxLength={MESSAGE_MAX} onChange={(e) => { setMessage(e.target.value); edited('message') }}
                            aria-invalid={!!fieldError('message') || undefined}
                            aria-describedby="contact-message-note" />
                </div>
                <p id="contact-message-note" className={fieldError('message') ? fieldStyles.error : fieldStyles.hint}>
                  {fieldError('message') ?? `${message.length.toLocaleString('en-GB')} / ${MESSAGE_MAX.toLocaleString('en-GB')}`}
                </p>
              </div>

              {/* Robots fill every field; people never see this one */}
              <div className={styles.trap} aria-hidden="true">
                <label htmlFor="contact-website">Website</label>
                <input id="contact-website" tabIndex={-1} autoComplete="off" value={website}
                       onChange={(e) => setWebsite(e.target.value)} />
              </div>

              {error && Object.keys(error.fieldErrors).length === 0 && <StatusBanner isError message={error.displayMessage} />}

              <div className={styles.submitRow}>
                <Button type="submit" variant="cta" busy={busy} busyText="Sending…">Send message</Button>
                <p className="muted">
                  We use your details only to answer you. See our <Link to="/privacy">Privacy Policy</Link>.
                </p>
              </div>
            </form>
          )}
        </section>

        <aside className={styles.side} aria-label="Other ways to reach us">
          <section className={`card ${styles.ways}`}>
            <h2 className={styles.sideTitle}>Other ways to reach us</h2>
            {details.isPending && <p className="muted" aria-busy="true">Loading…</p>}
            {details.isError && <p className="muted">Email us at the address in our Help page.</p>}
            {d && (
              <ul className={styles.wayList}>
                <li>
                  <span className={styles.wayIcon} aria-hidden="true">✉</span>
                  <span><strong>Email</strong><a href={`mailto:${d.email}`}>{d.email}</a></span>
                </li>
                {d.whatsApp && (
                  <li>
                    <span className={styles.wayIcon} aria-hidden="true">💬</span>
                    <span><strong>WhatsApp</strong>
                      <a href={whatsAppLink(d.whatsApp)} target="_blank" rel="noreferrer">{d.whatsApp}</a></span>
                  </li>
                )}
                {d.phone && (
                  <li>
                    <span className={styles.wayIcon} aria-hidden="true">☎</span>
                    <span><strong>Phone</strong><a href={`tel:${d.phone.replace(/\s/g, '')}`}>{d.phone}</a></span>
                  </li>
                )}
                {d.openingHours && (
                  <li>
                    <span className={styles.wayIcon} aria-hidden="true">🕘</span>
                    <span><strong>Opening hours</strong>{d.openingHours}</span>
                  </li>
                )}
                {d.address && (
                  <li>
                    <span className={styles.wayIcon} aria-hidden="true">📍</span>
                    <span><strong>Address</strong>{d.address}</span>
                  </li>
                )}
              </ul>
            )}
          </section>

          <section className={`card ${styles.ways}`}>
            <h2 className={styles.sideTitle}>Quick answers</h2>
            <p className="muted">Most questions are answered in Help &amp; support.</p>
            <ul className={styles.quick}>
              {QUICK_ANSWERS.map((q) => <li key={q.to}><Link to={q.to}>{q.label} ›</Link></li>)}
            </ul>
          </section>
        </aside>
      </div>
    </>
  )
}
