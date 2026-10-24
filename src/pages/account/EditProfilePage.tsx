import { useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { Link } from 'react-router'
import { ApiError } from '../../api/apiError'
import type { Country } from '../../api/contracts/enums'
import { removePhoto, updatePersonalDetails, updateProfile, uploadPhoto } from '../../api/services/accountService'
import { ApiImage } from '../../components/ui/ApiImage'
import { Button } from '../../components/ui/Button'
import { Field } from '../../components/ui/Field'
import { StatusBanner } from '../../components/ui/StatusBanner'
import { useCountry } from '../../state/CountryContext'
import { useSession } from '../../state/SessionContext'
import styles from './Account.module.css'

/** What the API accepts for a profile photo (it checks again, and crops / converts it). */
const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
const PHOTO_MAX_BYTES = 5 * 1024 * 1024

type Message = { text: string; isError: boolean } | null

/**
 * Edit profile, like the app's: photo (Change / Remove), first and last name, phone, country, the email (shown, not
 * editable: it's the login), then "Personal details": date of birth and home address. Needed to open a shop or send a
 * parcel; all or nothing. One "Save changes".
 */
export default function EditProfilePage() {
  const { profile, refreshProfile } = useSession()
  const { countries } = useCountry()
  const fileInput = useRef<HTMLInputElement>(null)

  const home = profile?.homeAddress
  const [form, setForm] = useState({
    firstName: profile?.firstName ?? '',
    lastName: profile?.lastName ?? '',
    phone: profile?.phoneNumber ?? '',
    country: (profile?.country ?? 'Ghana') as Country,
    dateOfBirth: profile?.dateOfBirth ?? '',
    line1: home?.line1 ?? '',
    line2: home?.line2 ?? '',
    city: home?.city ?? '',
    regionOrPostcode: home?.regionOrPostcode ?? '',
  })
  const [busy, setBusy] = useState(false)
  const [photoBusy, setPhotoBusy] = useState(false)
  const [message, setMessage] = useState<Message>(null)
  const [photoMessage, setPhotoMessage] = useState<Message>(null)
  const [error, setError] = useState<ApiError | null>(null)

  if (!profile) return null

  const set = (name: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [name]: e.target.value }))

  // ── Photo: checked here first, then sent straight away (the API crops and converts it) ──
  const onPhotoChosen = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''   // the same file can be chosen again later
    if (!file) return
    if (!PHOTO_TYPES.includes(file.type) && !/\.(heic|heif)$/i.test(file.name)) {
      setPhotoMessage({ text: 'Please choose a JPEG, PNG, WebP or HEIC picture.', isError: true })
      return
    }
    if (file.size > PHOTO_MAX_BYTES) {
      setPhotoMessage({ text: 'That picture is larger than 5 MB. Please choose a smaller one.', isError: true })
      return
    }
    setPhotoBusy(true)
    setPhotoMessage({ text: 'Uploading your photo…', isError: false })
    const result = await uploadPhoto(file)
    setPhotoBusy(false)
    if (!result.ok) {
      setPhotoMessage({ text: result.error.displayMessage, isError: true })
      return
    }
    await refreshProfile()
    setPhotoMessage({ text: 'Your photo has been updated.', isError: false })
  }

  const onRemovePhoto = async () => {
    setPhotoBusy(true)
    const result = await removePhoto()
    setPhotoBusy(false)
    if (!result.ok) {
      setPhotoMessage({ text: result.error.displayMessage, isError: true })
      return
    }
    await refreshProfile()
    setPhotoMessage({ text: 'Your photo has been removed.', isError: false })
  }

  // ── Details ──
  const onSave = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)

    if (!form.firstName.trim() || !form.lastName.trim()) {
      setMessage({ text: 'Please fill in your first and last name.', isError: true })
      return
    }

    // Personal details are all or nothing (date of birth + street, town, region/postcode)
    const personal = [form.dateOfBirth, form.line1, form.city, form.regionOrPostcode].map((v) => v.trim())
    const anyPersonal = personal.some(Boolean) || !!form.line2.trim()
    const fullPersonal = personal.every(Boolean)
    if (anyPersonal && !fullPersonal) {
      setMessage({
        text: 'For personal details, please fill in your date of birth and full home address (street, town or ' +
              'city, region or postcode), or leave them all empty.',
        isError: true,
      })
      return
    }

    setBusy(true)
    setMessage(null)
    const saved = await updateProfile({
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      country: form.country,
      phoneNumber: form.phone.trim() || null,
    })
    if (saved.ok && fullPersonal) {
      const details = await updatePersonalDetails({
        dateOfBirth: personal[0],
        homeAddress: {
          line1: personal[1], line2: form.line2.trim() || null, city: personal[2], regionOrPostcode: personal[3],
          country: form.country,
        },
      })
      if (!details.ok) {
        setBusy(false)
        setError(details.error)
        setMessage({ text: details.error.displayMessage, isError: true })
        return
      }
    }
    setBusy(false)

    if (!saved.ok) {
      setError(saved.error)
      setMessage({ text: saved.error.displayMessage, isError: true })
      return
    }
    await refreshProfile()
    setMessage({ text: 'Your changes have been saved.', isError: false })
  }

  return (
    <div className={`container ${styles.page}`}>
      <div className={styles.inner}>
        <Link to="/account" className={styles.back}>‹ My account</Link>
        <div className={styles.heading}>
          <h1>Edit profile</h1>
          <p className="muted">Your personal details</p>
        </div>

        <section className={styles.card} aria-labelledby="photo-title">
          <h2 id="photo-title" className={styles.cardTitle}>Profile photo</h2>
          <div className={styles.photoRow}>
            {profile.photoUrl
              ? <ApiImage src={profile.photoUrl} alt="Your profile photo" className={styles.avatar} />
              : <span className={styles.initial} aria-hidden="true">{profile.firstName.charAt(0).toUpperCase()}</span>}
            <div className={styles.actions}>
              <input ref={fileInput} type="file" hidden onChange={onPhotoChosen}
                     accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif" />
              <Button variant="secondary" small busy={photoBusy} busyText="Please wait…"
                      onClick={() => fileInput.current?.click()}>
                Change photo
              </Button>
              {profile.photoUrl && (
                <Button variant="outline" small disabled={photoBusy} onClick={onRemovePhoto}>Remove</Button>
              )}
            </div>
          </div>
          <p className="muted">JPEG, PNG, WebP or HEIC, up to 5 MB.</p>
          <StatusBanner message={photoMessage?.text} isError={photoMessage?.isError} />
        </section>

        <form onSubmit={onSave} noValidate>
          <section className={styles.card} aria-labelledby="about-title">
            <h2 id="about-title" className={styles.cardTitle}>About you</h2>
            <div className={styles.two}>
              <Field label="First name" autoComplete="given-name" placeholder="e.g. Efua" value={form.firstName}
                     onChange={set('firstName')} error={error?.fieldError('FirstName')} />
              <Field label="Last name" autoComplete="family-name" placeholder="e.g. Owusu" value={form.lastName}
                     onChange={set('lastName')} error={error?.fieldError('LastName')} />
            </div>
            <Field label="Phone number" optional type="tel" autoComplete="tel" placeholder="+233 24 555 0192"
                   value={form.phone} onChange={set('phone')} error={error?.fieldError('PhoneNumber')} />
            <label className={styles.fieldGroup}>
              <span className={styles.label}>Country</span>
              <select className={styles.select} value={form.country}
                      onChange={(e) => setForm((f) => ({ ...f, country: e.target.value as Country }))}>
                {countries.map((c) => <option key={c.country} value={c.country}>{c.name}</option>)}
              </select>
            </label>
            <Field label="Email" type="email" value={profile.email} readOnly disabled
                   hint="Your email is your login, so it can't be changed here yet." />
          </section>

          <section className={styles.card} aria-labelledby="personal-title">
            <h2 id="personal-title" className={styles.cardTitle}>Personal details</h2>
            <p className="muted">Needed to open a shop or send a parcel. Fill in all of them, or leave them empty.</p>
            <Field label="Date of birth" type="date" value={form.dateOfBirth} onChange={set('dateOfBirth')}
                   max={new Date().toISOString().slice(0, 10)} error={error?.fieldError('DateOfBirth')} />
            <Field label="Home address" autoComplete="address-line1" placeholder="House number and street"
                   value={form.line1} onChange={set('line1')} error={error?.fieldError('HomeAddress.Line1')} />
            <Field label="Area or landmark" optional autoComplete="address-line2" placeholder="Area or landmark"
                   value={form.line2} onChange={set('line2')} />
            <div className={styles.two}>
              <Field label="City or town" autoComplete="address-level2" placeholder="City or town" value={form.city}
                     onChange={set('city')} error={error?.fieldError('HomeAddress.City')} />
              <Field label="Region or postcode" autoComplete="postal-code" placeholder="Region or postcode"
                     value={form.regionOrPostcode} onChange={set('regionOrPostcode')}
                     error={error?.fieldError('HomeAddress.RegionOrPostcode')} />
            </div>
            <p className="muted">In the country chosen above.</p>
          </section>

          <StatusBanner message={message?.text} isError={message?.isError} />
          <div style={{ marginTop: 14 }}>
            <Button type="submit" full busy={busy} busyText="Saving…">Save changes</Button>
          </div>
        </form>
      </div>
    </div>
  )
}
