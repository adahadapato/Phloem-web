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

/** The app's label choices; "Other" lets the person type their own (e.g. "Mum's house"). */
const LABELS = ['Home', 'Work', 'Other'] as const
/** Same limits as the API (DeliveryAddress). */
const LABEL_MAX = 40
const ADDRESS_MAX = 300

type Message = { text: string; isError: boolean } | null

interface Draft {
  /** Set when editing an existing address. */
  id?: string
  label: string
  customLabel: string
  fullAddress: string
  country: Country
  makeDefault: boolean
}

/**
 * Delivery addresses, like the app's: saved addresses (the default marked), each with Make default / Edit / Delete,
 * and "Add a new address" (Home / Work / Other, the address, the country, "Set as my default address").
 * Checkout uses these; an order's address must be in the shop's country. Opened from Checkout
 * (`?returnTo=/checkout`), the back link goes back there.
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
  const addresses = [...profile.addresses].sort((a, b) => Number(b.isDefault) - Number(a.isDefault))
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

  const startAdd = () => setDraft({
    label: 'Home', customLabel: '', fullAddress: '', country: selected?.country ?? profile.country,
    makeDefault: addresses.length === 0,
  })

  const startEdit = (a: AddressDto) => {
    const known = (LABELS as readonly string[]).includes(a.label) && a.label !== 'Other'
    setDraft({
      id: a.id, label: known ? a.label : 'Other', customLabel: known ? '' : a.label,
      fullAddress: a.fullAddress, country: a.country, makeDefault: a.isDefault,
    })
    setMessage(null)
  }

  const onSave = async (event: FormEvent) => {
    event.preventDefault()
    if (!draft) return
    const label = (draft.label === 'Other' ? draft.customLabel.trim() || 'Other' : draft.label).slice(0, LABEL_MAX)
    const fullAddress = draft.fullAddress.trim()
    if (!fullAddress) {
      setMessage({ text: 'Please type the address: street, town or city, and region or postcode.', isError: true })
      return
    }

    const ok = draft.id
      ? await run(async () => {
          const saved = await updateAddress(draft.id!, { label, fullAddress, country: draft.country })
          if (saved.ok && draft.makeDefault) return makeDefaultAddress(draft.id!)
          return saved
        }, 'Address saved.')
      : await run(() => addAddress({ label, fullAddress, country: draft.country, makeDefault: draft.makeDefault }),
                  'Address added.')
    if (ok) setDraft(null)
  }

  return (
    <div className={`container ${styles.page}`}>
      <div className={styles.inner}>
        {returnTo === '/checkout'
          ? <Link to="/checkout" className={styles.back}>‹ Back to checkout</Link>
          : <Link to="/account" className={styles.back}>‹ My account</Link>}
        <div className={styles.heading}>
          <h1>Delivery addresses</h1>
          <p className="muted">Where your food should go. Each order goes to an address in the shop's country.</p>
        </div>

        <section className={styles.card} aria-labelledby="saved-title">
          <h2 id="saved-title" className={styles.cardTitle}>Saved addresses</h2>
          {addresses.length === 0 && <p className="muted">You haven't saved an address yet.</p>}
          {addresses.map((a) => (
            <div key={a.id} className={styles.address}>
              <span aria-hidden="true">📍</span>
              <div className={styles.addressText}>
                <strong>{a.label}</strong>{a.isDefault && <span className={styles.pill}>Default</span>}
                <p className="muted" style={{ whiteSpace: 'pre-line' }}>{a.fullAddress}</p>
                <p className="muted">{countryName(a.country)}</p>
                {confirmDelete === a.id ? (
                  <div className={styles.actions} style={{ marginTop: 8 }}>
                    <span>Delete this address?</span>
                    <Button small variant="cta" disabled={busy}
                            onClick={async () => { await run(() => deleteAddress(a.id), 'Address deleted.'); setConfirmDelete(null) }}>
                      Delete
                    </Button>
                    <Button small variant="outline" onClick={() => setConfirmDelete(null)}>Keep it</Button>
                  </div>
                ) : (
                  <div className={styles.actions} style={{ marginTop: 8 }}>
                    {!a.isDefault && (
                      <Button small variant="outline" disabled={busy}
                              onClick={() => run(() => makeDefaultAddress(a.id), `${a.label} is now your default address.`)}>
                        Make default
                      </Button>
                    )}
                    <Button small variant="outline" disabled={busy} onClick={() => startEdit(a)}>Edit</Button>
                    <Button small variant="outline" disabled={busy} onClick={() => setConfirmDelete(a.id)}>Delete</Button>
                  </div>
                )}
              </div>
            </div>
          ))}
          {!draft && <Button variant="secondary" onClick={startAdd}>+ Add a new address</Button>}
        </section>

        {draft && (
          <form className={styles.card} onSubmit={onSave} noValidate aria-labelledby="draft-title">
            <h2 id="draft-title" className={styles.cardTitle}>{draft.id ? 'Edit address' : 'New address'}</h2>

            <div className={styles.fieldGroup}>
              <span className={styles.label}>Save as</span>
              <div className={styles.labels} role="group" aria-label="Save as">
                {LABELS.map((l) => (
                  <button key={l} type="button" className={styles.labelChoice} aria-pressed={draft.label === l}
                          onClick={() => setDraft({ ...draft, label: l })}>
                    {l}
                  </button>
                ))}
              </div>
              {draft.label === 'Other' && (
                <input className={styles.select} placeholder="e.g. Mum's house" maxLength={LABEL_MAX}
                       aria-label="Name for this address" value={draft.customLabel}
                       onChange={(e) => setDraft({ ...draft, customLabel: e.target.value })} />
              )}
            </div>

            <label className={styles.fieldGroup}>
              <span className={styles.label}>Address</span>
              <textarea className={styles.textarea} placeholder="Street, city and postcode" maxLength={ADDRESS_MAX}
                        autoComplete="street-address" value={draft.fullAddress}
                        onChange={(e) => setDraft({ ...draft, fullAddress: e.target.value })} />
            </label>

            <label className={styles.fieldGroup}>
              <span className={styles.label}>Country</span>
              <select className={styles.select} value={draft.country}
                      onChange={(e) => setDraft({ ...draft, country: e.target.value as Country })}>
                {countries.map((c) => <option key={c.country} value={c.country}>{c.name}</option>)}
              </select>
            </label>

            <label className={styles.check}>
              <input type="checkbox" checked={draft.makeDefault}
                     onChange={(e) => setDraft({ ...draft, makeDefault: e.target.checked })} />
              Set as my default address
            </label>

            <div className={styles.actions}>
              <Button type="submit" busy={busy} busyText="Saving…">Save address</Button>
              <Button variant="outline" onClick={() => { setDraft(null); setMessage(null) }}>Cancel</Button>
            </div>
          </form>
        )}

        <StatusBanner message={message?.text} isError={message?.isError} />
      </div>
    </div>
  )
}
