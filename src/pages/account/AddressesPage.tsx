import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import type { ApiResult } from '../../api/apiError'
import type { AddressDto } from '../../api/contracts/dtos'
import type { Country } from '../../api/contracts/enums'
import { addAddress, deleteAddress, makeDefaultAddress, updateAddress } from '../../api/services/accountService'
import { Button } from '../../components/ui/Button'
import { StatusBanner } from '../../components/ui/StatusBanner'
import { useCountry } from '../../state/CountryContext'
import { useSession } from '../../state/SessionContext'
import { safeReturnTo } from '../auth/returnTo'
import styles from './Account.module.css'
import page from './Addresses.module.css'

/** The app's label choices; "Other" lets the person type their own (e.g. "Mum's house"). */
const LABELS = ['Home', 'Work', 'Other'] as const
/** Same limits as the API (DeliveryAddress). */
const LABEL_MAX = 40
const ADDRESS_MAX = 300
const NAME_MAX = 100

type Message = { text: string; isError: boolean } | null

interface Draft {
  /** Set when editing an existing address. */
  id?: string
  label: string
  customLabel: string
  recipientName: string
  phoneNumber: string
  fullAddress: string
  country: Country
  makeDefault: boolean
}

/**
 * Delivery addresses, laid out for a big screen: the primary address on its own, then the other addresses, each
 * showing who receives it, the address, the country and the phone the seller calls, with Make primary / Edit /
 * Delete on the right (under the address on a phone). Editing opens the form in place; "Add a new address" opens it
 * at the end. Name and phone start as the account holder's and can be changed (e.g. food for Mum, at her number).
 * Checkout uses these addresses; opened from Checkout (`?returnTo=/checkout`), the back link goes back there.
 */
export default function AddressesPage() {
  const { profile, refreshProfile } = useSession()
  const { countries, selected } = useCountry()
  const [draft, setDraft] = useState<Draft | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<Message>(null)
  const [params] = useSearchParams()
  const returnTo = params.get('returnTo') ? safeReturnTo(params.get('returnTo')) : null

  if (!profile) return null
  const primary = profile.addresses.find((a) => a.isDefault)
  const others = profile.addresses.filter((a) => !a.isDefault)
  const countryName = (c: Country) => countries.find((x) => x.country === c)?.name ?? c

  /** Runs one change, then reloads the profile (the addresses live in it). */
  const run = async (action: () => Promise<ApiResult<unknown>>, done: string) => {
    setBusy(true)
    setMessage(null)
    const result = await action()
    if (result.ok) await refreshProfile()
    setBusy(false)
    setMessage(result.ok ? { text: done, isError: false } : { text: result.error.displayMessage, isError: true })
    return result.ok
  }

  const startAdd = () => {
    setDraft({
      label: 'Home', customLabel: '', recipientName: profile.fullName, phoneNumber: profile.phoneNumber ?? '',
      fullAddress: '', country: selected?.country ?? profile.country, makeDefault: profile.addresses.length === 0,
    })
    setMessage(null)
  }

  const startEdit = (a: AddressDto) => {
    const known = (LABELS as readonly string[]).includes(a.label) && a.label !== 'Other'
    setDraft({
      id: a.id, label: known ? a.label : 'Other', customLabel: known ? '' : a.label,
      recipientName: a.recipientName ?? profile.fullName, phoneNumber: a.phoneNumber ?? profile.phoneNumber ?? '',
      fullAddress: a.fullAddress, country: a.country, makeDefault: a.isDefault,
    })
    setConfirmDelete(null)
    setMessage(null)
  }

  const onSave = async (event: FormEvent) => {
    event.preventDefault()
    if (!draft) return
    const label = (draft.label === 'Other' ? draft.customLabel.trim() || 'Other' : draft.label).slice(0, LABEL_MAX)
    const fullAddress = draft.fullAddress.trim()
    if (!draft.recipientName.trim()) {
      setMessage({ text: 'Please type the name of the person who will receive the food.', isError: true })
      return
    }
    if (!fullAddress) {
      setMessage({ text: 'Please type the address: street, town or city, and region or postcode.', isError: true })
      return
    }
    // The account holder's own name / phone are saved as "use mine" (empty), so they follow profile changes
    const name = draft.recipientName.trim()
    const phone = draft.phoneNumber.trim()
    const body = {
      label, fullAddress, country: draft.country,
      recipientName: name === profile.fullName ? null : name,
      phoneNumber: !phone || phone === profile.phoneNumber ? null : phone,
    }

    const ok = draft.id
      ? await run(async () => {
          const saved = await updateAddress(draft.id!, body)
          if (saved.ok && draft.makeDefault && !profile.addresses.find((a) => a.id === draft.id)?.isDefault)
            return makeDefaultAddress(draft.id!)
          return saved
        }, 'Address saved.')
      : await run(() => addAddress({ ...body, makeDefault: draft.makeDefault }), 'Address added.')
    if (ok) setDraft(null)
  }

  /** The add / edit form (shown in place of the address being edited, or at the end for a new one). */
  const form = (d: Draft) => (
    <form className={page.form} onSubmit={onSave} noValidate aria-labelledby="draft-title">
      <h3 id="draft-title" className={page.formTitle}>{d.id ? 'Edit address' : 'New address'}</h3>

      <div className={styles.fieldGroup}>
        <span className={styles.label}>Save as</span>
        <div className={styles.labels} role="group" aria-label="Save as">
          {LABELS.map((l) => (
            <button key={l} type="button" className={styles.labelChoice} aria-pressed={d.label === l}
                    onClick={() => setDraft({ ...d, label: l })}>
              {l}
            </button>
          ))}
        </div>
        {d.label === 'Other' && (
          <input className={styles.select} placeholder="e.g. Mum's house" maxLength={LABEL_MAX}
                 aria-label="Name for this address" value={d.customLabel}
                 onChange={(e) => setDraft({ ...d, customLabel: e.target.value })} />
        )}
      </div>

      <div className={page.two}>
        <label className={styles.fieldGroup}>
          <span className={styles.label}>Full name</span>
          <input className={styles.select} maxLength={NAME_MAX} autoComplete="name" value={d.recipientName}
                 onChange={(e) => setDraft({ ...d, recipientName: e.target.value })} />
        </label>
        <label className={styles.fieldGroup}>
          <span className={styles.label}>Phone number</span>
          <input className={styles.select} type="tel" autoComplete="tel" placeholder="+44 7700 900123"
                 value={d.phoneNumber} onChange={(e) => setDraft({ ...d, phoneNumber: e.target.value })} />
        </label>
      </div>
      <p className={page.hint}>Who receives the food, and the number the seller calls about the delivery.</p>

      <label className={styles.fieldGroup}>
        <span className={styles.label}>Address</span>
        <textarea className={styles.textarea} placeholder="Street, city and postcode" maxLength={ADDRESS_MAX}
                  autoComplete="street-address" value={d.fullAddress}
                  onChange={(e) => setDraft({ ...d, fullAddress: e.target.value })} />
      </label>

      <label className={styles.fieldGroup}>
        <span className={styles.label}>Country</span>
        <select className={styles.select} value={d.country}
                onChange={(e) => setDraft({ ...d, country: e.target.value as Country })}>
          {countries.map((c) => <option key={c.country} value={c.country}>{c.name}</option>)}
        </select>
      </label>

      {!(d.id && profile.addresses.find((a) => a.id === d.id)?.isDefault) && (
        <label className={styles.check}>
          <input type="checkbox" checked={d.makeDefault}
                 onChange={(e) => setDraft({ ...d, makeDefault: e.target.checked })} />
          Make this my primary address
        </label>
      )}

      <div className={styles.actions}>
        <Button type="submit" busy={busy} busyText="Saving…">Save address</Button>
        <Button variant="outline" onClick={() => { setDraft(null); setMessage(null) }}>Cancel</Button>
      </div>
    </form>
  )

  /** One address: who, where, phone on the left; its buttons on the right. */
  const entry = (a: AddressDto) => {
    if (draft?.id === a.id) return <div key={a.id} className={page.entry}>{form(draft)}</div>
    const phone = a.phoneNumber ?? profile.phoneNumber
    return (
      <div key={a.id} className={page.entry}>
        <div className={page.text}>
          <span className={page.tag}>{a.label}</span>
          <strong className={page.name}>{a.recipientName ?? profile.fullName}</strong>
          <span className={page.lines}>{a.fullAddress}</span>
          <span>{countryName(a.country)}</span>
          {phone ? <span>{phone}</span> : <span className="muted">No phone number</span>}
        </div>
        {confirmDelete === a.id ? (
          <div className={page.buttons} role="group" aria-label="Delete this address?">
            <span className={page.confirm}>Delete this address?</span>
            <Button small variant="cta" disabled={busy}
                    onClick={async () => { await run(() => deleteAddress(a.id), 'Address deleted.'); setConfirmDelete(null) }}>
              Delete
            </Button>
            <Button small variant="outline" onClick={() => setConfirmDelete(null)}>Keep it</Button>
          </div>
        ) : (
          <div className={page.buttons}>
            {!a.isDefault && (
              <Button small variant="outline" disabled={busy}
                      onClick={() => run(() => makeDefaultAddress(a.id), `${a.label} is now your primary address.`)}>
                Make primary
              </Button>
            )}
            <Button small variant="outline" disabled={busy || !!draft} onClick={() => startEdit(a)}>Edit</Button>
            {!a.isDefault && (
              <Button small variant="outline" className={page.delete} disabled={busy}
                      onClick={() => { setConfirmDelete(a.id); setMessage(null) }}>
                Delete
              </Button>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={`container ${styles.page}`}>
      <div className={page.inner}>
        {returnTo === '/checkout'
          ? <Link to="/checkout" className={styles.back}>‹ Back to checkout</Link>
          : <Link to="/account" className={styles.back}>‹ My account</Link>}
        <div className={styles.heading}>
          <h1>Delivery addresses</h1>
          <p className="muted">Where your food should go. Each order goes to an address in the shop's country.</p>
        </div>

        <StatusBanner message={message?.text} isError={message?.isError} />

        <div className={page.card}>
          {profile.addresses.length === 0 && !draft && (
            <p className="muted">You haven't saved an address yet. Add one to check out.</p>
          )}

          {primary && (
            <section aria-labelledby="primary-title" className={page.section}>
              <h2 id="primary-title" className={page.sectionTitle}>Primary delivery address</h2>
              {entry(primary)}
              <p className={page.hint}>Checkout picks this one first. To delete it, make another address primary.</p>
            </section>
          )}

          {others.length > 0 && (
            <section aria-labelledby="others-title" className={page.section}>
              <h2 id="others-title" className={page.sectionTitle}>
                Other delivery {others.length === 1 ? 'address' : 'addresses'}
              </h2>
              {others.map(entry)}
            </section>
          )}

          {draft && !draft.id
            ? <div className={page.section}>{form(draft)}</div>
            : !draft && (
              <div className={page.add}>
                <Button variant="secondary" onClick={startAdd}>+ Add a new address</Button>
              </div>
            )}
        </div>
      </div>
    </div>
  )
}
