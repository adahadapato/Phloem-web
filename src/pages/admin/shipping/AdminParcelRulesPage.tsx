import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { unwrap, type ApiResult } from '../../../api/apiError'
import type { ParcelItemRuleDto } from '../../../api/contracts/dtos'
import type { ParcelItemRuleKind } from '../../../api/contracts/enums'
import {
  addParcelRule, deleteParcelRule, getParcelRules, reorderParcelRules, updateParcelRule,
} from '../../../api/services/adminService'
import { Button } from '../../../components/ui/Button'
import { StatusBanner } from '../../../components/ui/StatusBanner'
import styles from '../Admin.module.css'
import { AdminHead } from '../AdminParts'
import { ShippingTabs } from './ShippingTabs'

const NAME_MAX = 100     // ParcelItemRule.NameMaxLength
const DETAIL_MAX = 300   // ParcelItemRule.DetailMaxLength

type Message = { text: string; isError: boolean } | null
type Draft = { id?: string; kind: ParcelItemRuleKind; name: string; detail: string }

/**
 * Admin → Shipping → What can be sent: the list customers see before booking a parcel (website and app). Add an
 * item (not allowed, or only with a condition), change it, move it up or down, or remove it. Changes show at once.
 */
export default function AdminParcelRulesPage() {
  const queryClient = useQueryClient()
  const query = useQuery({ queryKey: ['admin', 'parcel-rules'], queryFn: async ({ signal }) => unwrap(await getParcelRules(signal)) })
  const [draft, setDraft] = useState<Draft | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<Message>(null)
  const list = query.data ?? []

  const run = async (action: () => Promise<ApiResult<unknown>>, done: string) => {
    setBusy(true); setMessage(null)
    const result = await action()
    setBusy(false)
    if (!result.ok) { setMessage({ text: result.error.displayMessage, isError: true }); return false }
    await queryClient.invalidateQueries({ queryKey: ['admin', 'parcel-rules'] })
    await queryClient.invalidateQueries({ queryKey: ['parcel-rules'] })
    setMessage({ text: done, isError: false })
    return true
  }

  const onSave = async (e: FormEvent) => {
    e.preventDefault()
    if (!draft) return
    const name = draft.name.trim(), detail = draft.detail.trim()
    if (!name) { setMessage({ text: 'Enter the item, e.g. "Fresh or frozen meat and fish".', isError: true }); return }
    if (draft.kind === 'Restricted' && !detail) { setMessage({ text: 'Say when it\'s allowed, e.g. "Sealed bottles, 1 litre or less each".', isError: true }); return }
    const ok = draft.id
      ? await run(() => updateParcelRule(draft.id!, draft.kind, name, detail || null), 'Saved.')
      : await run(() => addParcelRule(draft.kind, name, detail || null), `"${name}" added at the end of the list.`)
    if (ok) setDraft(null)
  }

  const move = (r: ParcelItemRuleDto, step: -1 | 1) => {
    const ids = list.map((x) => x.id)
    const i = ids.indexOf(r.id), j = i + step
    if (j < 0 || j >= ids.length) return
    ;[ids[i], ids[j]] = [ids[j], ids[i]]
    void run(() => reorderParcelRules(ids), `"${r.name}" moved ${step < 0 ? 'up' : 'down'}.`)
  }

  const form = (d: Draft) => (
    <form className={`${styles.stackForm} ${styles.ruleForm}`} onSubmit={onSave}>
      <div className={styles.lengths} role="radiogroup" aria-label="Rule">
        <label className={styles.lengthChoice}>
          <input type="radio" name="kind" checked={d.kind === 'NotAllowed'} onChange={() => setDraft({ ...d, kind: 'NotAllowed' })} /> Not allowed
        </label>
        <label className={styles.lengthChoice}>
          <input type="radio" name="kind" checked={d.kind === 'Restricted'} onChange={() => setDraft({ ...d, kind: 'Restricted' })} /> Only if… (with a condition)
        </label>
      </div>
      <label><span>Item</span>
        <input value={d.name} maxLength={NAME_MAX} autoFocus onChange={(e) => setDraft({ ...d, name: e.target.value })} placeholder="e.g. Palm oil and other oils" />
      </label>
      <label><span>{d.kind === 'Restricted' ? 'Condition' : 'Detail (optional)'}</span>
        <input value={d.detail} maxLength={DETAIL_MAX} onChange={(e) => setDraft({ ...d, detail: e.target.value })}
               placeholder={d.kind === 'Restricted' ? 'e.g. Sealed bottles, 1 litre or less each' : 'e.g. Including knives'} />
      </label>
      <div className={styles.row}>
        <Button type="submit" small variant="secondary" busy={busy} busyText="Saving…">{d.id ? 'Save' : 'Add item'}</Button>
        <Button small variant="plain" onClick={() => setDraft(null)}>Cancel</Button>
      </div>
    </form>
  )

  return (
    <>
      <AdminHead title="Shipping" sub="Parcels between countries: routes and prices, parcels at the hub, and what can be sent.">
        {!draft && <Button small variant="cta" onClick={() => { setDraft({ kind: 'NotAllowed', name: '', detail: '' }); setMessage(null) }}>+ Add item</Button>}
      </AdminHead>
      <ShippingTabs />
      <p className="muted" style={{ margin: '0 0 12px' }}>Customers see this list on Send a parcel (website) and Send food to the UK (app), in this order.</p>
      <StatusBanner message={message?.text} isError={message?.isError} />
      {draft && !draft.id && <div className={styles.panel}>{form(draft)}</div>}

      {query.isPending && <p className="muted" aria-busy="true">Loading…</p>}
      {query.isError && (
        <div className={styles.error}>
          <StatusBanner isError message="We couldn't load the list." />
          <Button small variant="outline" onClick={() => query.refetch()}>Try again</Button>
        </div>
      )}
      {query.isSuccess && list.length === 0 && <p className="muted">The list is empty. Use "Add item" to add the first one.</p>}
      {list.length > 0 && (
        <ol className={styles.ruleList}>
          {list.map((r, i) => (
            <li key={r.id} className={styles.ruleRow}>
              {draft?.id === r.id ? form(draft) : (
                <>
                  <span className={`${styles.ruleMark} ${r.kind === 'Restricted' ? styles.ruleMaybe : styles.ruleNo}`} aria-hidden="true">
                    {r.kind === 'Restricted' ? '!' : '✕'}
                  </span>
                  <span className={styles.rowText}>
                    <span className={`${styles.ruleKind} ${r.kind === 'Restricted' ? styles.ruleKindMaybe : ''}`}>{r.kind === 'Restricted' ? 'Only if' : 'Not allowed'}</span>
                    <strong>{r.name}</strong>
                    {r.detail && <span className="muted">{r.detail}</span>}
                  </span>
                  {confirmDelete === r.id ? (
                    <span className={styles.rowButtons}>
                      <span className={styles.confirmText}>Remove it?</span>
                      <Button small variant="cta" disabled={busy}
                              onClick={async () => { await run(() => deleteParcelRule(r.id), `"${r.name}" removed.`); setConfirmDelete(null) }}>Remove</Button>
                      <Button small variant="outline" onClick={() => setConfirmDelete(null)}>Keep</Button>
                    </span>
                  ) : (
                    <span className={styles.rowButtons}>
                      <button type="button" className={styles.moveButton} disabled={busy || i === 0} aria-label={`Move ${r.name} up`} onClick={() => move(r, -1)}>↑</button>
                      <button type="button" className={styles.moveButton} disabled={busy || i === list.length - 1} aria-label={`Move ${r.name} down`} onClick={() => move(r, 1)}>↓</button>
                      <Button small variant="secondary" disabled={busy || !!draft}
                              onClick={() => { setDraft({ id: r.id, kind: r.kind, name: r.name, detail: r.detail ?? '' }); setMessage(null) }}>Edit</Button>
                      <Button small variant="outline" className={styles.danger} disabled={busy} onClick={() => setConfirmDelete(r.id)}>Remove</Button>
                    </span>
                  )}
                </>
              )}
            </li>
          ))}
        </ol>
      )}
    </>
  )
}
