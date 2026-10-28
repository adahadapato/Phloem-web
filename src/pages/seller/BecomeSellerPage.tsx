import { useQueryClient } from '@tanstack/react-query'
import { useState, type ChangeEvent, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import type { ApiError } from '../../api/apiError'
import { openShop, uploadMyShopLogo } from '../../api/services/shopService'
import { Button, ButtonLink } from '../../components/ui/Button'
import { Field } from '../../components/ui/Field'
import { StatusBanner } from '../../components/ui/StatusBanner'
import { useCountry } from '../../state/CountryContext'
import { useSession } from '../../state/SessionContext'
import styles from './Seller.module.css'

/** Same as the API (Vendor.NameMaxLength; logos up to 5 MB). */
const NAME_MAX = 80
const LOGO_MAX_BYTES = 5 * 1024 * 1024
const LOGO_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']

/**
 * Become a seller (/sell), like the app's seller setup: why sell on Phloem, then the shop form (name, optional
 * business email and phone, optional logo). Selling needs an account with date of birth and home address (18 or
 * over), as the API requires, so those come first. A new shop waits for Phloem's approval; the seller can get ready
 * in the dashboard meanwhile. People who already have a shop are pointed to their dashboard.
 */
export default function BecomeSellerPage() {
  const { status, profile, refreshProfile } = useSession()
  const { countries } = useCountry()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [logo, setLogo] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)
  const [localError, setLocalError] = useState<string | null>(null)

  const country = countries.find((c) => c.country === profile?.country)

  const onLogo = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    setLocalError(null)
    if (!file) return
    if (!LOGO_TYPES.includes(file.type) && !/\.(heic|heif)$/i.test(file.name)) {
      return setLocalError('Please choose a JPEG, PNG, WebP or HEIC picture.')
    }
    if (file.size > LOGO_MAX_BYTES) return setLocalError('That picture is larger than 5 MB. Please choose a smaller one.')
    if (preview) URL.revokeObjectURL(preview)
    setLogo(file)
    setPreview(URL.createObjectURL(file))
  }

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    setLocalError(null)
    if (!name.trim()) return setLocalError('Please give your shop a name.')
    if (!agreed) return setLocalError('Please read and agree to the Seller terms to open your shop.')

    setBusy(true)
    const opened = await openShop({
      shopName: name.trim(), businessEmail: email.trim() || null, businessPhone: phone.trim() || null,
      agreedToSellerTerms: agreed,
    })
    if (!opened.ok) {
      setBusy(false)
      setError(opened.error)
      return
    }
    // The shop exists now; a logo that fails can be added again in Shop settings
    const logoResult = logo ? await uploadMyShopLogo(logo) : null
    await refreshProfile()   // hasShop → the menu shows Seller dashboard
    await queryClient.invalidateQueries({ queryKey: ['seller'] })
    setBusy(false)
    await navigate('/seller', {
      state: { notice: logoResult && !logoResult.ok
        ? `Your shop is open and waiting for approval. The logo didn't upload (${logoResult.error.displayMessage}): add it in Shop settings.`
        : 'Your shop is open and waiting for approval.' },
    })
  }

  return (
    <div className={`container ${styles.page}`}>
      <div className={styles.sellHero}>
        <div>
          <p className="eyebrow">Sell on Phloem</p>
          <h1>Turn your cooking into a business</h1>
          <p className="muted">
            Home cooks and food businesses in Ghana, Nigeria and the UK sell their dishes on Phloem. You set your
            prices and delivery fee; we bring the customers.
          </p>
          <ul className={styles.benefits}>
            <li><span aria-hidden="true">🍲</span> Add your dishes with photos and your own prices</li>
            <li><span aria-hidden="true">🛵</span> Accept orders, cook, and deliver in your area</li>
            <li><span aria-hidden="true">💰</span> Earnings go to your balance after each delivery</li>
          </ul>
        </div>
        <img src="/images/sell-food.webp" alt="" className={styles.heroImage} width="640" height="536" />
      </div>

      <div className={styles.sellBox}>
        {status === 'loading' && <p className="muted" aria-busy="true">Loading…</p>}

        {status === 'signedOut' && (
          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Sign in before creating a shop</h2>
            <p className="muted">Your shop belongs to your Phloem account.</p>
            <div className={styles.row}>
              <ButtonLink to="/login?returnTo=%2Fsell">Log in</ButtonLink>
              <ButtonLink to="/register?returnTo=%2Fsell" variant="secondary">Create an account</ButtonLink>
            </div>
          </section>
        )}

        {status === 'signedIn' && profile?.hasShop && (
          <section className={styles.card}>
            <h2 className={styles.cardTitle}>You already have a shop</h2>
            <p className="muted">Manage your dishes, orders and shop details in your seller dashboard.</p>
            <div><ButtonLink to="/seller">Open seller dashboard</ButtonLink></div>
          </section>
        )}

        {status === 'signedIn' && profile && !profile.hasShop && (
          <>
            <ol className={styles.setupSteps}>
              <li className={profile.hasPersonalDetails ? styles.stepDone : styles.stepNow}>
                <span className={styles.stepMark} aria-hidden="true">{profile.hasPersonalDetails ? '✓' : '1'}</span>
                <div>
                  <strong>Your personal details</strong>
                  <span className="muted">Your date of birth and home address. Sellers must be 18 or over.</span>
                  {!profile.hasPersonalDetails && (
                    <Link to="/account/edit?returnTo=/sell" className={styles.stepLink}>Add your personal details first ›</Link>
                  )}
                </div>
              </li>
              <li className={profile.hasPersonalDetails ? styles.stepNow : ''}>
                <span className={styles.stepMark} aria-hidden="true">2</span>
                <div>
                  <strong>Your shop</strong>
                  <span className="muted">Name, contact and logo.</span>
                </div>
              </li>
              <li>
                <span className={styles.stepMark} aria-hidden="true">3</span>
                <div>
                  <strong>Approval</strong>
                  <span className="muted">Phloem reviews new shops. Then upload your documents in Shop settings.</span>
                </div>
              </li>
            </ol>

            <form className={styles.card} onSubmit={onSubmit} noValidate aria-labelledby="shop-form-title">
              <h2 id="shop-form-title" className={styles.cardTitle}>Your shop</h2>
              <fieldset disabled={!profile.hasPersonalDetails || busy} className={styles.fieldset}>
                <div className={styles.logoRow}>
                  {preview
                    ? <img src={preview} alt="Your new logo" className={styles.logoPreview} />
                    : <span className={styles.logoEmpty} aria-hidden="true">🏪</span>}
                  <div>
                    <label className={styles.fileButton}>
                      {logo ? 'Change logo' : 'Upload shop logo'}
                      <input type="file" accept="image/jpeg,image/png,image/webp,image/heic,.heic" onChange={onLogo} />
                    </label>
                    <p className="muted" style={{ fontSize: 13 }}>Optional. JPEG, PNG, WebP or HEIC, up to 5 MB.</p>
                  </div>
                </div>
                <Field label="Business name" value={name} maxLength={NAME_MAX} onChange={(e) => setName(e.target.value)}
                       placeholder="e.g. Auntie Ama's Kitchen" error={error?.fieldError('ShopName')} />
                <div className={styles.two}>
                  <Field label="Business email" optional type="email" autoComplete="email" value={email}
                         onChange={(e) => setEmail(e.target.value)} error={error?.fieldError('BusinessEmail')} />
                  <Field label="Business phone" optional type="tel" autoComplete="tel" value={phone}
                         onChange={(e) => setPhone(e.target.value)} error={error?.fieldError('BusinessPhone')} />
                </div>
                <p className="muted" style={{ fontSize: 13 }}>
                  Leave email and phone blank to use your account details.
                  {country && ` Your shop will sell in ${country.name}, your account's country.`}
                </p>
                <label className={styles.agree}>
                  <input type="checkbox" checked={agreed} onChange={(e) => { setAgreed(e.target.checked); setLocalError(null) }} />
                  <span>
                    I agree to the <a href="/terms#sellers" target="_blank" rel="noopener">Seller terms</a>, including
                    food safety, pricing within the allowed range and Phloem's commission.
                  </span>
                </label>
              </fieldset>
              <StatusBanner isError message={localError ?? (error && !error.fieldError('ShopName') ? error.displayMessage : null)} />
              <div>
                <Button type="submit" variant="cta" busy={busy} busyText="Opening your shop…"
                        disabled={!profile.hasPersonalDetails}>
                  Submit seller profile
                </Button>
              </div>
              <p className="muted" style={{ fontSize: 13 }}>Your store goes live after approval.</p>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
