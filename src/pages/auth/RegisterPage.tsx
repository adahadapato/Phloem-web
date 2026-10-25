import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { ApiError } from '../../api/apiError'
import { register } from '../../api/services/authService'
import { Button } from '../../components/ui/Button'
import { Field } from '../../components/ui/Field'
import { StatusBanner } from '../../components/ui/StatusBanner'
import { useCountry } from '../../state/CountryContext'
import { useSession } from '../../state/SessionContext'
import styles from './Auth.module.css'
import { safeReturnTo } from './returnTo'

/**
 * Sign up, like the app's: "I want to buy | I want to sell", names, email, password, optional phone, optional home
 * address (all or nothing: needed later to open a shop or send a parcel), and the Terms. The country is the one in
 * the flag pill at the top. Signs straight in; sellers then go to "Sell food", buyers back where they were (or Home).
 */
export default function RegisterPage() {
  const { selected } = useCountry()
  const { signedIn } = useSession()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const returnTo = safeReturnTo(params.get('returnTo'))

  const [isSeller, setIsSeller] = useState(false)
  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', password: '', phone: '', line1: '', city: '', regionOrPostcode: '',
  })
  const [agreed, setAgreed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<ApiError | null>(null)

  const set = (name: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [name]: e.target.value }))

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)

    if (!form.firstName.trim() || !form.lastName.trim() || !form.email.trim() || !form.password) {
      setMessage('Please fill in your first name, last name, email and password.')
      return
    }
    if (!agreed) {
      setMessage('Please accept the Terms & Conditions.')
      return
    }
    if (!selected) {
      setMessage("The countries haven't loaded yet. Please try again in a moment.")
      return
    }

    // The home address is all or nothing: a half address can't be used to open a shop or send a parcel
    const address = [form.line1, form.city, form.regionOrPostcode].map((v) => v.trim())
    const anyAddress = address.some(Boolean)
    const fullAddress = address.every(Boolean)
    if (anyAddress && !fullAddress) {
      setMessage('Please complete your home address (street, town or city, and region or postcode), ' +
                 'or leave it empty and add it later.')
      return
    }

    setBusy(true)
    setMessage(null)
    const result = await register({
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      email: form.email.trim(),
      phoneNumber: form.phone.trim() || null,
      country: selected.country,
      dateOfBirth: null,
      homeAddress: fullAddress
        ? { line1: address[0], line2: null, city: address[1], regionOrPostcode: address[2], country: selected.country }
        : null,
      password: form.password,
      agreedToTerms: agreed,
    })
    setBusy(false)

    if (!result.ok) {
      setError(result.error)
      setMessage(result.error.displayMessage)
      return
    }
    if (result.value.kind === 'signedIn') {
      signedIn(result.value.profile)
      navigate(isSeller ? '/sell' : returnTo, { replace: true })
    }
  }

  return (
    <div className={`container ${styles.page}`}>
      <div className={styles.inner}>
        <div className={styles.heading}>
          <h1>Create your account</h1>
          <p className="muted">Join food lovers across Africa and the UK</p>
        </div>

        <form className={styles.card} onSubmit={onSubmit} noValidate>
          <div className={styles.toggle} role="group" aria-label="What would you like to do?">
            <button type="button" aria-pressed={!isSeller} onClick={() => setIsSeller(false)}>🧺 I want to buy</button>
            <button type="button" aria-pressed={isSeller} onClick={() => setIsSeller(true)}>🏪 I want to sell</button>
          </div>
          {isSeller && (
            <p className="muted">
              After creating your account you'll set up your shop: logo, business name and contact details.
            </p>
          )}

          <div className={styles.two}>
            <Field label="First name" autoComplete="given-name" placeholder="Ama" value={form.firstName}
                   onChange={set('firstName')} error={error?.fieldError('FirstName')} />
            <Field label="Last name" autoComplete="family-name" placeholder="Mensah" value={form.lastName}
                   onChange={set('lastName')} error={error?.fieldError('LastName')} />
          </div>
          <Field label="Email address" type="email" autoComplete="email" placeholder="you@example.com"
                 value={form.email} onChange={set('email')} error={error?.fieldError('Email')} />
          <Field label="Password" type="password" autoComplete="new-password" placeholder="Create a strong password"
                 hint="At least 8 characters, with upper and lower case letters and a number."
                 value={form.password} onChange={set('password')} error={error?.fieldError('Password')} />
          <Field label="Phone number" optional type="tel" autoComplete="tel" placeholder="+44 7xxx xxx xxx"
                 value={form.phone} onChange={set('phone')} error={error?.fieldError('PhoneNumber')} />

          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Home address <span className="muted">(optional)</span></h2>
            <p className="muted">You can add it later. It's needed to open a shop or send a parcel.</p>
            <Field label="Street" autoComplete="address-line1" placeholder="House number and street"
                   value={form.line1} onChange={set('line1')} error={error?.fieldError('HomeAddress.Line1')} />
            <div className={styles.two}>
              <Field label="Town or city" autoComplete="address-level2" placeholder="Town or city"
                     value={form.city} onChange={set('city')} error={error?.fieldError('HomeAddress.City')} />
              <Field label="Region or postcode" autoComplete="postal-code" placeholder="Region or postcode"
                     value={form.regionOrPostcode} onChange={set('regionOrPostcode')}
                     error={error?.fieldError('HomeAddress.RegionOrPostcode')} />
            </div>
          </div>

          <label className={styles.check}>
            <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
            <span>
              I agree to the <a href="/terms" target="_blank" rel="noopener">Terms &amp; Conditions</a> and have read
              the <a href="/privacy" target="_blank" rel="noopener">Privacy Policy</a>
            </span>
          </label>

          {/* Next to the button, so the message is seen on this long form */}
          <StatusBanner message={message} isError />

          <Button type="submit" full busy={busy} busyText="Creating your account…">
            {isSeller ? 'Create account & set up shop' : 'Create account'}
          </Button>
        </form>

        <p className={`muted ${styles.footer}`}>
          Already have an account?{' '}
          <Link to={`/login${returnTo !== '/' ? `?returnTo=${encodeURIComponent(returnTo)}` : ''}`}>Log in</Link>
        </p>
      </div>
    </div>
  )
}
