import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type ChangeEvent, type FormEvent } from 'react'
import { Link } from 'react-router'
import { unwrap, type ApiError, type ApiResult } from '../../api/apiError'
import type { MyShopDto } from '../../api/contracts/dtos'
import type { VendorDocumentType } from '../../api/contracts/enums'
import {
  getMyDeliveryFee, removeMyShopCover, removeMyShopLogo, setMyDeliveryFee, setMyOrderCutoff, updateMyShop,
  uploadMyShopCover, uploadMyShopDocument, uploadMyShopLogo,
} from '../../api/services/shopService'
import { ApiImage } from '../../components/ui/ApiImage'
import { Button } from '../../components/ui/Button'
import { CountryFlag } from '../../components/ui/CountryFlag'
import { Field } from '../../components/ui/Field'
import { documentText } from '../../components/ui/labels'
import { Price } from '../../components/ui/Price'
import { StatusBanner } from '../../components/ui/StatusBanner'
import { useCountry } from '../../state/CountryContext'
import { SellerHeader } from './SellerParts'
import styles from './Seller.module.css'
import { useMyShop } from './useMyShop'

const NAME_MAX = 80
const IMAGE_MAX_BYTES = 5 * 1024 * 1024
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
const DOC_MAX_BYTES = 10 * 1024 * 1024
const DOC_TYPES = ['application/pdf', 'image/jpeg', 'image/png']
const DOCUMENTS: VendorDocumentType[] = ['BusinessRegistration', 'FoodHygieneCertificate', 'OwnerId', 'Other']

type Message = { text: string; isError: boolean } | null

/** "24 Oct 2026" */
const dayText = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

/** A section's own save message. */
function SectionMessage({ m }: { m: Message }) {
  return m ? <StatusBanner message={m.text} isError={m.isError} /> : null
}

/** Every section of the page; starts from the shop as loaded (remounted when another shop loads). */
function Settings({ shop }: { shop: MyShopDto }) {
  const queryClient = useQueryClient()
  const { countries } = useCountry()
  const country = countries.find((c) => c.country === shop.country)
  const reload = () => queryClient.invalidateQueries({ queryKey: ['seller'] })

  const [busy, setBusy] = useState<string | null>(null)
  const [messages, setMessages] = useState<Record<string, Message>>({})
  const say = (section: string, m: Message) => setMessages((all) => ({ ...all, [section]: m }))

  /** Runs one change for a section, shows its result there, then reloads the shop. */
  const run = async (section: string, action: () => Promise<ApiResult<unknown>>, done: string) => {
    setBusy(section)
    say(section, null)
    const result = await action()
    await reload()
    setBusy(null)
    say(section, result.ok ? { text: done, isError: false } : { text: result.error.displayMessage, isError: true })
    return result
  }

  // ── 1. Details ──
  const [name, setName] = useState(shop.name)
  const [email, setEmail] = useState(shop.businessEmail)
  const [phone, setPhone] = useState(shop.businessPhone ?? '')
  const [detailsError, setDetailsError] = useState<ApiError | null>(null)
  const saveDetails = async (event: FormEvent) => {
    event.preventDefault()
    if (!name.trim()) return say('details', { text: 'Please give your shop a name.', isError: true })
    setDetailsError(null)
    const result = await run('details', () => updateMyShop({
      shopName: name.trim(), businessEmail: email.trim() || null, businessPhone: phone.trim() || null,
    }), shop.status === 'Rejected' ? 'Saved. Your shop goes back to Phloem for review.' : 'Shop details saved.')
    if (!result.ok) setDetailsError(result.error)
  }

  // ── 2. Pictures ──
  const onPicture = (kind: 'logo' | 'cover') => async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!IMAGE_TYPES.includes(file.type) && !/\.(heic|heif)$/i.test(file.name)) {
      return say(kind, { text: 'Please choose a JPEG, PNG, WebP or HEIC picture.', isError: true })
    }
    if (file.size > IMAGE_MAX_BYTES) return say(kind, { text: 'That picture is larger than 5 MB.', isError: true })
    await run(kind, () => (kind === 'logo' ? uploadMyShopLogo(file) : uploadMyShopCover(file)),
              kind === 'logo' ? 'Logo updated.' : 'Cover photo updated.')
  }

  // ── 3. Delivery fee ──
  const feeQuery = useQuery({
    queryKey: ['seller', 'fee'],
    queryFn: async ({ signal }) => unwrap(await getMyDeliveryFee(signal)),
    staleTime: 60_000,
  })
  const fee = feeQuery.data
  const [feeText, setFeeText] = useState<string | null>(null)
  const feeValue = feeText ?? (fee ? String(fee.currentFee) : '')
  const saveFee = async (event: FormEvent) => {
    event.preventDefault()
    if (!fee) return
    const amount = Number(feeValue.replace(',', '.'))
    if (!(amount >= fee.minAllowed && amount <= fee.maxAllowed)) {
      return say('fee', { text: `Please choose a fee between ${fee.minAllowed.toFixed(2)} and ${fee.maxAllowed.toFixed(2)}.`, isError: true })
    }
    const result = await run('fee', () => setMyDeliveryFee(amount), 'Delivery fee saved.')
    if (result.ok) setFeeText(null)
  }

  // ── 4. Cut-off ──
  const [cutoff, setCutoff] = useState(shop.orderCutoffTime.slice(0, 5))
  const saveCutoff = async (event: FormEvent) => {
    event.preventDefault()
    if (!/^\d{2}:\d{2}$/.test(cutoff)) return say('cutoff', { text: 'Please choose a time.', isError: true })
    await run('cutoff', () => setMyOrderCutoff(cutoff), `Orders for today now close at ${cutoff}.`)
  }

  // ── 5. Documents ──
  const [expiries, setExpiries] = useState<Partial<Record<VendorDocumentType, string>>>({})
  const onDocument = (type: VendorDocumentType) => async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!DOC_TYPES.includes(file.type)) return say(`doc:${type}`, { text: 'Please choose a PDF, JPEG or PNG file.', isError: true })
    if (file.size > DOC_MAX_BYTES) return say(`doc:${type}`, { text: 'The file is too large. The maximum is 10 MB.', isError: true })
    await run(`doc:${type}`, () => uploadMyShopDocument(type, file, expiries[type] || null),
              `${documentText[type]} uploaded. Phloem will review it.`)
  }
  const required = new Set([...shop.missingDocuments, ...shop.documents.filter((d) => d.status === 'Accepted').map((d) => d.type)])

  return (
    <div className={styles.settingsGrid}>
      {/* 1. Details */}
      <form className={styles.card} onSubmit={saveDetails} noValidate aria-labelledby="details-title">
        <h2 id="details-title" className={styles.cardTitle}>Shop details</h2>
        <Field label="Shop name" value={name} maxLength={NAME_MAX} onChange={(e) => setName(e.target.value)}
               error={detailsError?.fieldError('ShopName')} />
        <div className={styles.two}>
          <Field label="Business email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                 error={detailsError?.fieldError('BusinessEmail')} />
          <Field label="Business phone" type="tel" value={phone} placeholder="+233 24 555 0192"
                 onChange={(e) => setPhone(e.target.value)} error={detailsError?.fieldError('BusinessPhone')} />
        </div>
        <p className="muted" style={{ fontSize: 13 }}>
          Leave email or phone empty to use your personal ones. Your name and personal phone are
          in <Link to="/account/edit">My account</Link>.
        </p>
        <p className={styles.countryLine}>
          <span className="muted">Shop country</span> {country && <CountryFlag country={country} />} <strong>{country?.name ?? shop.country}</strong>
        </p>
        <SectionMessage m={messages.details} />
        <div><Button type="submit" busy={busy === 'details'} busyText="Saving…">Save shop details</Button></div>
      </form>

      {/* 2. Pictures */}
      <section className={styles.card} aria-labelledby="pictures-title">
        <h2 id="pictures-title" className={styles.cardTitle}>Logo and cover photo</h2>
        <p className="muted" style={{ fontSize: 13 }}>Shops with a logo and cover photo get more orders. JPEG, PNG, WebP or HEIC, up to 5 MB.</p>
        <div className={styles.coverBox}>
          {shop.coverPhotoUrl
            ? <ApiImage src={shop.coverPhotoUrl} alt="Your cover photo" className={styles.coverImg} />
            : <div className={styles.coverEmpty}>No cover photo yet</div>}
          {shop.logoUrl
            ? <ApiImage src={shop.logoUrl} alt="Your logo" className={`${styles.logo} ${styles.logoOnCover}`} />
            : <span className={`${styles.logoEmpty} ${styles.logoOnCover}`} aria-hidden="true">🏪</span>}
        </div>
        <div className={styles.pictureRows}>
          <div className={styles.pictureRow}>
            <strong>Logo</strong>
            <span className="muted">The round picture on your shop's cards.</span>
            <div className={styles.row}>
              <label className={styles.fileButton}>
                {busy === 'logo' ? 'Uploading…' : shop.logoUrl ? 'Change' : 'Upload'}
                <input type="file" accept="image/jpeg,image/png,image/webp,image/heic,.heic" onChange={onPicture('logo')}
                       disabled={!!busy} aria-label="Upload logo" />
              </label>
              {shop.logoUrl && <Button small variant="outline" disabled={!!busy}
                                       onClick={() => run('logo', removeMyShopLogo, 'Logo removed.')}>Remove</Button>}
            </div>
            <SectionMessage m={messages.logo} />
          </div>
          <div className={styles.pictureRow}>
            <strong>Cover photo</strong>
            <span className="muted">The wide banner on your shop's page.</span>
            <div className={styles.row}>
              <label className={styles.fileButton}>
                {busy === 'cover' ? 'Uploading…' : shop.coverPhotoUrl ? 'Change' : 'Upload'}
                <input type="file" accept="image/jpeg,image/png,image/webp,image/heic,.heic" onChange={onPicture('cover')}
                       disabled={!!busy} aria-label="Upload cover photo" />
              </label>
              {shop.coverPhotoUrl && <Button small variant="outline" disabled={!!busy}
                                             onClick={() => run('cover', removeMyShopCover, 'Cover photo removed.')}>Remove</Button>}
            </div>
            <SectionMessage m={messages.cover} />
          </div>
        </div>
      </section>

      {/* 3. Delivery fee + 4. Cut-off */}
      <div className={styles.settingsPair}>
        <form className={styles.card} onSubmit={saveFee} noValidate aria-labelledby="fee-title">
          <h2 id="fee-title" className={styles.cardTitle}>Delivery fee</h2>
          <p className="muted" style={{ fontSize: 13 }}>Shown on every one of your dishes. All of it goes to you.</p>
          {fee ? (
            <>
              <Field label={`Fee (${fee.currency})`} type="number" inputMode="decimal" min={fee.minAllowed} max={fee.maxAllowed}
                     step="0.5" value={feeValue} onChange={(e) => setFeeText(e.target.value)}
                     hint={`Allowed in ${country?.name ?? 'your country'}: ${fee.minAllowed.toFixed(2)} – ${fee.maxAllowed.toFixed(2)}`} />
              {fee.usesCountryMinimum && (
                <p className="muted" style={{ fontSize: 13 }}>
                  You haven't set one, so customers pay the minimum: <Price amount={fee.minAllowed} currency={fee.currency} />.
                </p>
              )}
            </>
          ) : feeQuery.isError
            ? <StatusBanner isError message={(feeQuery.error as { displayMessage?: string }).displayMessage ?? "We couldn't load your fee."} />
            : <p className="muted">Loading…</p>}
          <SectionMessage m={messages.fee} />
          <div><Button type="submit" busy={busy === 'fee'} busyText="Saving…" disabled={!fee}>Save fee</Button></div>
        </form>

        <form className={styles.card} onSubmit={saveCutoff} noValidate aria-labelledby="cutoff-title">
          <h2 id="cutoff-title" className={styles.cardTitle}>Orders for today close at</h2>
          <p className="muted" style={{ fontSize: 13 }}>
            Your shop's local time. After it, customers can only choose Tomorrow.
          </p>
          <label className={styles.inline}>
            <span className={styles.label}>Closing time</span>
            <input type="time" className={styles.select} value={cutoff} onChange={(e) => setCutoff(e.target.value)} />
          </label>
          <SectionMessage m={messages.cutoff} />
          <div><Button type="submit" busy={busy === 'cutoff'} busyText="Saving…">Save time</Button></div>
        </form>
      </div>

      {/* 5. Documents */}
      <section className={styles.card} aria-labelledby="docs-title">
        <h2 id="docs-title" className={styles.cardTitle}>Documents</h2>
        <p className="muted" style={{ fontSize: 13 }}>
          Phloem checks these before giving your shop the ✓ badge. PDF, JPEG or PNG, up to 10 MB. Uploading again
          replaces the one before. Only Phloem's team can open them.
        </p>
        <ul className={styles.docList}>
          {DOCUMENTS.map((type) => {
            const doc = shop.documents.find((d) => d.type === type)
            const status = !doc ? 'Missing' : doc.isExpired ? 'Expired' : doc.status
            const tone = status === 'Accepted' ? styles.chipOn : status === 'Pending' ? styles.chipNew
              : status === 'Missing' ? styles.chipOff : styles.chipBad
            const statusText = { Missing: 'Not uploaded', Pending: 'Waiting for review', Accepted: 'Accepted',
                                 Rejected: 'Rejected', Expired: 'Expired' }[status]
            return (
              <li key={type} className={styles.docRow} aria-label={documentText[type]}>
                <div className={styles.docText}>
                  <strong>{documentText[type]} {required.has(type) && <span className="muted">· needed for ✓</span>}</strong>
                  <span className={`${styles.chip} ${tone}`}>{statusText}</span>
                  {doc && (
                    <span className="muted" style={{ fontSize: 13 }}>
                      {doc.originalFileName} · uploaded {dayText(doc.uploadedAt)}
                      {doc.expiresAt && ` · expires ${dayText(doc.expiresAt)}`}
                    </span>
                  )}
                  {doc?.status === 'Rejected' && doc.rejectionReason && (
                    <span className={styles.warn}>Phloem said: "{doc.rejectionReason}". Please upload a new one.</span>
                  )}
                  <SectionMessage m={messages[`doc:${type}`]} />
                </div>
                <div className={styles.docActions}>
                  <label className={styles.inline}>
                    <span className={styles.label}>Expires on <span className="muted">(if it does)</span></span>
                    <input type="date" className={styles.select} value={expiries[type] ?? ''}
                           onChange={(e) => setExpiries((x) => ({ ...x, [type]: e.target.value }))} />
                  </label>
                  <label className={styles.fileButton}>
                    {busy === `doc:${type}` ? 'Uploading…' : doc ? 'Upload a new one' : 'Upload'}
                    <input type="file" accept="application/pdf,image/jpeg,image/png" onChange={onDocument(type)}
                           disabled={!!busy} aria-label={`Upload ${documentText[type]}`} />
                  </label>
                </div>
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}

/**
 * Shop settings (/seller/settings), like the app's: shop name, business email and phone; logo and cover photo;
 * delivery fee inside the country's range; when today's orders close; and the documents for the ✓ badge with
 * their review status. Each section saves on its own and says how it went right there.
 */
export default function ShopSettingsPage() {
  const query = useMyShop()
  const shop = query.data
  return (
    <div className={`container ${styles.page}`}>
      <SellerHeader shop={shop} />
      {query.isPending && <div className={styles.card} aria-busy="true"><p className="muted">Loading your shop…</p></div>}
      {query.isError && <StatusBanner isError message="We couldn't load your shop." />}
      {shop && <Settings key={shop.id} shop={shop} />}
    </div>
  )
}
