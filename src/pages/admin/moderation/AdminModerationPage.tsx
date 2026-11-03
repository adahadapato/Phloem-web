import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { unwrap } from '../../../api/apiError'
import type { ModerationItemDto } from '../../../api/contracts/dtos'
import type { ModerationKind, ModerationVerdict } from '../../../api/contracts/enums'
import { approveModeration, getModerationQueue, rejectModeration } from '../../../api/services/moderationService'
import { Button } from '../../../components/ui/Button'
import { CountryFlag } from '../../../components/ui/CountryFlag'
import { dateTimeText } from '../../../components/ui/labels'
import { Pager } from '../../../components/ui/Pager'
import { StatusBanner } from '../../../components/ui/StatusBanner'
import { useCountry } from '../../../state/CountryContext'
import adminStyles from '../Admin.module.css'
import styles from './Moderation.module.css'

const PAGE_SIZE = 10
const REASON_MAX = 300   // Dish.ReviewNoteMaxLength

const TABS: { kind?: ModerationKind; key: string; label: string }[] = [
  { key: 'all', label: 'All' },
  { kind: 'Dish', key: 'dishes', label: 'Dishes' },
  { kind: 'ShopName', key: 'shops', label: 'Shop names' },
]

const VERDICT: Record<ModerationVerdict, { text: string; tone: string }> = {
  Ok: { text: '✅ AI: looks fine', tone: styles.ok },
  NeedsLook: { text: '🟠 AI: needs a look', tone: styles.look },
  NotAllowed: { text: '⛔ AI: not allowed', tone: styles.no },
}

/**
 * Admin → Moderation (/admin/moderation, permission shops.manage, your countries): dishes and shop names the AI
 * flagged or couldn't check. Each card shows the exact text, what the AI thought and why; Approve makes a dish
 * visible, Reject keeps it hidden and the seller sees your reason. Tabs in the address (?show=dishes).
 */
export default function AdminModerationPage() {
  const [params, setParams] = useSearchParams()
  const tab = TABS.find((t) => t.key === params.get('show')) ?? TABS[0]
  const page = Math.max(1, Number(params.get('page')) || 1)

  const queue = useQuery({
    queryKey: ['admin', 'moderation', 'queue', tab.key, page],
    queryFn: async ({ signal }) => unwrap(await getModerationQueue(tab.kind, page, PAGE_SIZE, signal)),
    placeholderData: (previous) => previous,
  })
  const list = queue.data

  return (
    <>
      <header className={styles.header}>
        <span className={styles.eyebrow}>Keeping Phloem safe</span>
        <h1>Moderation</h1>
        <p>
          The AI checks every new or changed dish, every shop name, suggested dish names and Contact messages. Anything
          it isn't sure about, or couldn't check, waits here for a person.
        </p>
      </header>

      <ol className={styles.how}>
        <li><b>1</b><span><strong>A seller saves a dish.</strong> It's hidden from buyers while the AI reads it (usually under a minute).</span></li>
        <li><b>2</b><span><strong>The AI decides.</strong> Fine → buyers see it. Not sure, or against the rules → it comes here.</span></li>
        <li><b>3</b><span><strong>You decide.</strong> Approve to show it, or Reject with a reason: the seller sees it and can edit the dish.</span></li>
      </ol>

      <div className={adminStyles.tabs} role="tablist" aria-label="What to show">
        {TABS.map((t) => (
          <button key={t.key} type="button" role="tab" aria-selected={t === tab} className={adminStyles.tab}
                  onClick={() => setParams(t.key === 'all' ? {} : { show: t.key }, { preventScrollReset: true })}>
            {t.label}
          </button>
        ))}
      </div>

      {queue.isError && <StatusBanner isError message="We couldn't load the Moderation queue." />}
      {!list && queue.isPending && <p className="muted" aria-busy="true">Loading…</p>}
      {list && list.items.length === 0 && (
        <div className={styles.empty}>
          <strong>Nothing waiting 🎉</strong>
          <p>The AI checks new dishes and shop names within a minute. Anything it's unsure about appears here.</p>
        </div>
      )}
      {list && list.items.length > 0 && (
        <>
          <p className={adminStyles.count}>{list.totalCount} waiting, oldest first</p>
          <div className={styles.list}>
            {list.items.map((item) => <ItemCard key={item.id} item={item} />)}
          </div>
          <Pager page={list.page} totalPages={list.totalPages}
                 onChange={(p) => setParams({ ...(tab.key === 'all' ? {} : { show: tab.key }), page: String(p) })} />
        </>
      )}
    </>
  )
}

function ItemCard({ item }: { item: ModerationItemDto }) {
  const { countries } = useCountry()
  const queryClient = useQueryClient()
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState(item.aiReason ?? '')
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const country = item.country ? countries.find((c) => c.country === item.country) : null
  const isDish = item.kind === 'Dish'
  const verdict = item.aiVerdict ? VERDICT[item.aiVerdict] : { text: '⚪ Not checked by the AI', tone: styles.none }

  const decide = async (approve: boolean) => {
    setBusy(approve ? 'approve' : 'reject'); setError(null)
    const result = approve ? await approveModeration(item.id) : await rejectModeration(item.id, reason.trim())
    setBusy(null)
    if (!result.ok) { setError(result.error.displayMessage); return }
    await queryClient.invalidateQueries({ queryKey: ['admin', 'moderation'] })
  }

  return (
    <article className={styles.card} aria-label={`${isDish ? 'Dish' : 'Shop name'}: ${item.title}`}>
      <div className={styles.cardHead}>
        <div>
          <span className={`${styles.pill} ${styles.kind}`}>{isDish ? 'Dish' : 'Shop name'}</span>
          <h2>{item.title}</h2>
          <div className={styles.meta}>
            {isDish && item.shopName && <span>from {item.shopName}</span>}
            {country && <span><CountryFlag country={country} /> {country.name}</span>}
            <span>waiting since {dateTimeText(item.waitingSince)}</span>
            {item.shopId && <Link to={`/admin/shops/${item.shopId}`}>Open the shop ›</Link>}
          </div>
        </div>
      </div>

      <p className={styles.visibility}>
        {isDish
          ? item.isLive ? 'Still visible to buyers (it was on Phloem before checks began).' : 'Hidden from buyers until you decide.'
          : item.isLive ? 'This shop is live.' : 'This shop is not live yet.'}
      </p>

      <pre className={styles.text}>{item.text}</pre>

      <div className={styles.ai}>
        <div className={styles.aiHead}>
          <span className={`${styles.pill} ${verdict.tone}`}>{verdict.text}</span>
          {item.aiRule && <span className="muted">Rule: {item.aiRule}</span>}
        </div>
        {item.aiReason && <p>{item.aiReason}</p>}
        <p className="muted">{item.whyHere}</p>
      </div>

      {error && <p className={`${styles.message} ${styles.no}`} role="alert">{error}</p>}

      {!rejecting ? (
        <div className={styles.actions}>
          <Button variant="primary" busy={busy === 'approve'} busyText="Saving…" disabled={!!busy} onClick={() => void decide(true)}>
            {isDish ? '✓ Approve: show it to buyers' : '✓ Looks fine'}
          </Button>
          <Button variant="outline" disabled={!!busy} onClick={() => setRejecting(true)}>
            {isDish ? 'Reject…' : 'Not OK…'}
          </Button>
        </div>
      ) : (
        <div className={styles.reject}>
          <label htmlFor={`reason-${item.id}`}>
            <strong>{isDish ? 'Why isn\'t it allowed? The seller will see this.' : 'Why isn\'t the name OK? (for the record)'}</strong>
          </label>
          <textarea id={`reason-${item.id}`} rows={3} value={reason} maxLength={REASON_MAX}
                    placeholder={isDish ? 'e.g. Please remove the phone number: orders and payments go through Phloem.' : 'e.g. Uses a well-known brand name.'}
                    onChange={(e) => setReason(e.target.value)} />
          {!isDish && (
            <p className="muted" style={{ margin: 0 }}>
              This only records your decision. To ask them to rename, or to block the shop, open the shop.
            </p>
          )}
          <div className={styles.actions}>
            <Button variant="cta" busy={busy === 'reject'} busyText="Saving…" disabled={!reason.trim() || !!busy}
                    onClick={() => void decide(false)}>
              {isDish ? 'Reject: keep it hidden' : 'Save: not OK'}
            </Button>
            <Button variant="outline" disabled={!!busy} onClick={() => setRejecting(false)}>Cancel</Button>
          </div>
        </div>
      )}
    </article>
  )
}
