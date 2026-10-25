import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { unwrap, type ApiResult } from '../../../api/apiError'
import { fileUrl } from '../../../api/config'
import type { AdminShopDocumentDto } from '../../../api/contracts/dtos'
import {
  approveShop, getDocumentLink, getShop, rejectShop, reviewDocument, setShopBlocked, setShopVerified,
} from '../../../api/services/adminService'
import { ApiImage } from '../../../components/ui/ApiImage'
import { Button } from '../../../components/ui/Button'
import { CountryFlag } from '../../../components/ui/CountryFlag'
import { documentText } from '../../../components/ui/labels'
import { StatusBanner } from '../../../components/ui/StatusBanner'
import { useCountry } from '../../../state/CountryContext'
import styles from '../Admin.module.css'
import { DocumentStatusChip, ShopStatusChip } from '../AdminParts'

const REASON_MAX = 500   // Vendor.RejectionReasonMaxLength

type Message = { text: string; isError: boolean } | null

/** "2.4 MB", "830 KB". */
function sizeText(bytes: number): string {
  return bytes >= 1_048_576 ? `${(bytes / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`
}

const day = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

/** One document row: what it is, its file, its state, and Open / Accept / Reject (with a reason). */
function DocumentRow({ shopId, doc, busy, onReview, onOpen }: {
  shopId: string
  doc: AdminShopDocumentDto
  busy: boolean
  onReview: (doc: AdminShopDocumentDto, accept: boolean, reason?: string) => Promise<boolean>
  onOpen: (shopId: string, doc: AdminShopDocumentDto) => void
}) {
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')
  return (
    <li className={styles.doc}>
      <div className={styles.docText}>
        <strong>{documentText[doc.type]}</strong>
        <span className="muted">
          {doc.originalFileName} · {sizeText(doc.fileSizeBytes)} · uploaded {day(doc.uploadedAt)}
          {doc.expiresAt && ` · expires ${day(doc.expiresAt)}`}
        </span>
        {doc.status === 'Rejected' && doc.rejectionReason && (
          <span className={styles.docReason}>Rejected: "{doc.rejectionReason}"</span>
        )}
      </div>
      <DocumentStatusChip status={doc.status} expired={doc.isExpired} />
      <div className={styles.docButtons}>
        <Button small variant="outline" onClick={() => onOpen(shopId, doc)}>Open</Button>
        {doc.status !== 'Accepted' && !rejecting && (
          <Button small variant="secondary" disabled={busy} onClick={() => onReview(doc, true)}>Accept</Button>
        )}
        {doc.status !== 'Rejected' && !rejecting && (
          <Button small variant="outline" disabled={busy} onClick={() => setRejecting(true)}>Reject</Button>
        )}
      </div>
      {rejecting && (
        <div className={styles.reasonBox}>
          <label>
            <span>Why? The seller sees this and can upload a new file.</span>
            <textarea value={reason} maxLength={REASON_MAX} onChange={(e) => setReason(e.target.value)}
                      placeholder="e.g. The certificate has expired. Please upload the current one." />
          </label>
          <div className={styles.row}>
            <Button small variant="cta" disabled={busy || !reason.trim()}
                    onClick={async () => { if (await onReview(doc, false, reason.trim())) setRejecting(false) }}>
              Reject document
            </Button>
            <Button small variant="outline" onClick={() => setRejecting(false)}>Cancel</Button>
          </div>
        </div>
      )}
    </li>
  )
}

/**
 * Admin → one shop (/admin/shops/:shopId): the shop's cover, logo, owner and contacts, its documents (open the
 * private file in a new tab, accept, or reject with a reason), and on the right what can be done now: Approve or
 * Reject (with a reason the seller sees) while it waits, the ✓ badge (once the required documents are accepted),
 * and Block / Unblock. Every action asks first when it can't be undone easily.
 */
export default function AdminShopPage() {
  const { shopId = '' } = useParams()
  const { countries } = useCountry()
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: ['admin', 'shop', shopId],
    queryFn: async ({ signal }) => unwrap(await getShop(shopId, signal)),
  })
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<Message>(null)
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')
  const [confirmBlock, setConfirmBlock] = useState(false)

  /** Runs one decision, then reloads this shop and the lists / counts. */
  const run = async (action: () => Promise<ApiResult<unknown>>, done: string) => {
    setBusy(true)
    setMessage(null)
    const result = await action()
    setBusy(false)
    if (result.ok) await queryClient.invalidateQueries({ queryKey: ['admin'] })
    setMessage(result.ok ? { text: done, isError: false } : { text: result.error.displayMessage, isError: true })
    window.scrollTo({ top: 0, behavior: 'smooth' })
    return result.ok
  }

  /** Private files open through a 10-minute link; the tab is opened first so browsers don't block it. */
  const openDocument = async (id: string, doc: AdminShopDocumentDto) => {
    const tab = window.open('', '_blank')
    const link = await getDocumentLink(id, doc.id)
    if (link.ok && tab) { tab.location.href = fileUrl(link.value) ?? link.value; return }
    tab?.close()
    setMessage({ text: link.ok ? 'Your browser blocked the new tab. Please allow pop-ups for Phloem.' : link.error.displayMessage, isError: true })
  }

  if (query.isPending) return <p className="muted" aria-busy="true">Loading…</p>
  if (query.isError) {
    return (
      <div className={styles.error}>
        <Link to="/admin/shops" className={styles.back}>‹ Shops</Link>
        <StatusBanner isError message={(query.error as { status?: number }).status === 404 ? "This shop doesn't exist." : "We couldn't load this shop."} />
        <Button small variant="outline" onClick={() => query.refetch()}>Try again</Button>
      </div>
    )
  }

  const { shop, documents, missingDocuments, coverPhotoUrl } = query.data
  const country = countries.find((c) => c.country === shop.country)
  const waiting = shop.status === 'PendingApproval'
  const canApprove = waiting || shop.status === 'Rejected'
  const blocked = shop.status === 'Blocked'
  const toCheck = documents.filter((d) => d.status === 'Pending').length

  return (
    <>
      <Link to="/admin/shops" className={styles.back}>‹ Shops</Link>
      <StatusBanner message={message?.text} isError={message?.isError} />

      <div className={styles.shopLayout}>
        <div>
          {/* ── The shop ── */}
          <section className={styles.panel} aria-label="Shop">
            {coverPhotoUrl && <ApiImage src={coverPhotoUrl} alt="" className={styles.cover} />}
            <div className={styles.shopTop}>
              <ApiImage src={shop.logoUrl} alt="" className={styles.bigLogo} />
              <div>
                <h1 className={styles.title}>
                  {shop.name} {shop.isVerified && <span className={styles.tick} title="Verified">✓</span>}
                </h1>
                <p className={styles.metaRow}>
                  <ShopStatusChip status={shop.status} />
                  {country && <span className={styles.place}><CountryFlag country={country} /> {country.name}</span>}
                  <span className="muted">Opened {day(shop.openedAt)}</span>
                  {shop.ratingCount > 0 && <span>★ {shop.rating.toFixed(1)} ({shop.ratingCount})</span>}
                </p>
              </div>
            </div>
            {shop.status === 'Rejected' && shop.rejectionReason && (
              <p className={styles.noteStop}><strong>Rejected:</strong> "{shop.rejectionReason}"</p>
            )}
            {shop.isOwnerSuspended && (
              <p className={styles.noteStop}>The owner is suspended, so this shop is hidden until the suspension ends.</p>
            )}
            <dl className={styles.facts}>
              <dt>Owner</dt><dd>{shop.ownerName}</dd>
              <dt>Business email</dt><dd><a href={`mailto:${shop.businessEmail}`}>{shop.businessEmail}</a></dd>
              <dt>Business phone</dt><dd>{shop.businessPhone ? <a href={`tel:${shop.businessPhone}`}>{shop.businessPhone}</a> : <span className="muted">Not given</span>}</dd>
            </dl>
            {shop.status === 'Approved' && <Link to={`/shops/${shop.id}`}>See the shop as buyers do ›</Link>}
          </section>

          {/* ── Documents ── */}
          <section className={styles.panel} aria-labelledby="docs-title">
            <div className={styles.panelHead}>
              <h2 id="docs-title">Documents {toCheck > 0 && <span className={styles.navCount}>{toCheck} to check</span>}</h2>
            </div>
            {documents.length === 0 && <p className="muted">No documents uploaded yet.</p>}
            <ul className={styles.docs}>
              {documents.map((d) => (
                <DocumentRow key={d.id} shopId={shop.id} doc={d} busy={busy} onOpen={openDocument}
                             onReview={(doc, accept, why) => run(() => reviewDocument(shop.id, doc.id, accept, why),
                               `${documentText[doc.type]} ${accept ? 'accepted' : 'rejected; the seller can upload a new one'}.`)} />
              ))}
            </ul>
            {missingDocuments.length > 0 && (
              <p className={styles.missing}>
                Still needed for the ✓ badge: {missingDocuments.map((d) => documentText[d]).join(', ')}.
              </p>
            )}
          </section>
        </div>

        {/* ── What can be done now ── */}
        <aside className={styles.actionsPanel} aria-label="Decisions">
          {waiting && <p className={styles.waitNote}>This shop is waiting for your decision.</p>}

          {canApprove && !rejecting && (
            <Button variant="cta" full busy={busy} busyText="Approving…"
                    onClick={() => run(() => approveShop(shop.id), `${shop.name} is live. ${shop.ownerName} is now a seller.`)}>
              ✓ Approve shop
            </Button>
          )}
          {waiting && !rejecting && (
            <Button variant="outline" full disabled={busy} onClick={() => setRejecting(true)}>Reject…</Button>
          )}
          {rejecting && (
            <div className={styles.reasonBox}>
              <label>
                <span>Why? {shop.ownerName} sees this and can fix it.</span>
                <textarea value={reason} maxLength={REASON_MAX} onChange={(e) => setReason(e.target.value)}
                          placeholder="e.g. Please upload your food hygiene certificate." />
              </label>
              <Button variant="cta" full disabled={busy || !reason.trim()}
                      onClick={async () => { if (await run(() => rejectShop(shop.id, reason.trim()), `${shop.name} was rejected. The seller has been told why.`)) { setRejecting(false); setReason('') } }}>
                Reject shop
              </Button>
              <Button variant="outline" full onClick={() => setRejecting(false)}>Cancel</Button>
            </div>
          )}

          {shop.status === 'Approved' && (
            <div className={styles.actionGroup}>
              <strong>✓ Verified badge</strong>
              <span className="muted">
                {shop.isVerified ? 'Buyers see this shop is checked by Phloem.'
                  : missingDocuments.length > 0 ? 'Accept the required documents first.'
                  : 'All required documents are accepted.'}
              </span>
              <Button small variant={shop.isVerified ? 'outline' : 'secondary'} full
                      disabled={busy || (!shop.isVerified && missingDocuments.length > 0)}
                      onClick={() => run(() => setShopVerified(shop.id, !shop.isVerified),
                        shop.isVerified ? 'The ✓ badge was removed.' : `${shop.name} now has the ✓ badge.`)}>
                {shop.isVerified ? 'Remove the badge' : 'Give the ✓ badge'}
              </Button>
            </div>
          )}

          <div className={styles.actionGroup}>
            <strong>{blocked ? 'Blocked' : 'Block this shop'}</strong>
            <span className="muted">
              {blocked ? "Buyers can't see it and the owner isn't a seller." : 'Hides it from buyers and removes the Seller role.'}
            </span>
            {blocked ? (
              <Button small variant="secondary" full disabled={busy}
                      onClick={() => run(() => setShopBlocked(shop.id, false), `${shop.name} is unblocked.`)}>
                Unblock
              </Button>
            ) : confirmBlock ? (
              <>
                <span className={styles.confirmText}>Block {shop.name}?</span>
                <Button small variant="cta" full disabled={busy}
                        onClick={async () => { await run(() => setShopBlocked(shop.id, true), `${shop.name} is blocked.`); setConfirmBlock(false) }}>
                  Yes, block it
                </Button>
                <Button small variant="outline" full onClick={() => setConfirmBlock(false)}>Cancel</Button>
              </>
            ) : (
              <Button small variant="outline" full className={styles.danger} disabled={busy} onClick={() => setConfirmBlock(true)}>
                Block shop
              </Button>
            )}
          </div>
        </aside>
      </div>
    </>
  )
}
