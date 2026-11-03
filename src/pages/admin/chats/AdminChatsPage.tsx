import { useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router'
import { unwrap } from '../../../api/apiError'
import { getAdminChats } from '../../../api/services/chatService'
import { Button } from '../../../components/ui/Button'
import { CountryFlag } from '../../../components/ui/CountryFlag'
import { dateTimeText } from '../../../components/ui/labels'
import { Pager } from '../../../components/ui/Pager'
import { StatusBanner } from '../../../components/ui/StatusBanner'
import { useCountry } from '../../../state/CountryContext'
import adminStyles from '../Admin.module.css'
import modStyles from '../moderation/Moderation.module.css'
import styles from './Chats.module.css'

const PAGE_SIZE = 20

const TABS = [
  { key: 'reported', label: 'Reported', reportedOnly: true },
  { key: 'all', label: 'All chats', reportedOnly: false },
] as const

/**
 * Admin → Order chats (/admin/chats, permission chats.read, your countries): the conversations between customers
 * and shops. "Reported" (the first tab) is where the work is: chats someone sent to Phloem with "Report a problem".
 * Opening a chat is written to the audit log. Tab and page in the address (?show=all&page=2).
 */
export default function AdminChatsPage() {
  const [params, setParams] = useSearchParams()
  const { countries } = useCountry()
  const tab = TABS.find((t) => t.key === params.get('show')) ?? TABS[0]
  const page = Math.max(1, Number(params.get('page')) || 1)

  const query = useQuery({
    queryKey: ['admin', 'chats', tab.key, page],
    queryFn: async ({ signal }) => unwrap(await getAdminChats(tab.reportedOnly, page, PAGE_SIZE, signal)),
    placeholderData: (previous) => previous,
  })
  const list = query.data

  return (
    <>
      <header className={modStyles.header}>
        <span className={modStyles.eyebrow}>Customers and shops</span>
        <h1>Order chats</h1>
        <p>
          Every paid order has a chat between the customer and the shop. You only need to read one when someone
          reports a problem, or when an order goes wrong. Each chat you open is recorded in the audit log.
        </p>
      </header>

      <ol className={modStyles.how}>
        <li><b>1</b><span><strong>Someone reports a chat.</strong> The customer or the shop presses "Report a problem" and says why. The team inbox gets an email.</span></li>
        <li><b>2</b><span><strong>You read it.</strong> You see everything, even messages someone deleted for themselves, and which ones had contact or payment details.</span></li>
        <li><b>3</b><span><strong>You deal with it, then close it.</strong> Email the people involved, block a shop or refund an order, then press "Mark as dealt with".</span></li>
      </ol>

      <div className={adminStyles.tabs} role="tablist" aria-label="What to show">
        {TABS.map((t) => (
          <button key={t.key} type="button" role="tab" aria-selected={t === tab} className={adminStyles.tab}
                  onClick={() => setParams(t.key === 'reported' ? {} : { show: t.key }, { preventScrollReset: true })}>
            {t.label}
          </button>
        ))}
      </div>

      {query.isError && (
        <div className={adminStyles.error}>
          <StatusBanner isError message="We couldn't load the chats." />
          <Button small variant="outline" onClick={() => query.refetch()}>Try again</Button>
        </div>
      )}
      {!list && query.isPending && <p className="muted" aria-busy="true">Loading…</p>}
      {list && list.items.length === 0 && (
        <div className={modStyles.empty}>
          <strong>{tab.reportedOnly ? 'No reports waiting 🎉' : 'No chats yet'}</strong>
          <p>{tab.reportedOnly
            ? 'When a customer or a shop reports a chat, it appears here.'
            : 'Chats start when a customer or a shop writes about a paid order.'}</p>
        </div>
      )}
      {list && list.items.length > 0 && (
        <>
          <p className={adminStyles.count}>
            {list.totalCount} {tab.reportedOnly ? 'waiting' : list.totalCount === 1 ? 'chat' : 'chats'}, latest first
          </p>
          <div className={styles.rows}>
            {list.items.map((c) => {
              const country = countries.find((x) => x.country === c.country)
              return (
                <Link key={c.orderNumber} to={`/admin/chats/${encodeURIComponent(c.orderNumber)}`}
                      className={`${styles.row} ${c.reportWaiting ? styles.waiting : ''}`}>
                  <span className={styles.rowTop}>
                    <strong>{c.customerName} ⇄ {c.shopName}</strong>
                    {c.lastMessageAt && <span className="muted">{dateTimeText(c.lastMessageAt)}</span>}
                  </span>
                  <span className={styles.rowMeta}>
                    <span>Order {c.orderNumber}</span>
                    {country && <span><CountryFlag country={country} /> {country.name}</span>}
                    {c.reportWaiting && <span className={styles.flag}>🚩 Reported by {c.reportedBy}</span>}
                    {c.isReported && !c.reportWaiting && <span className="muted">Report dealt with</span>}
                  </span>
                  {c.reportWaiting && c.reportReason && <span className={styles.reason}>"{c.reportReason}"</span>}
                </Link>
              )
            })}
          </div>
          <Pager page={list.page} totalPages={list.totalPages}
                 onChange={(p) => setParams({ ...(tab.key === 'reported' ? {} : { show: tab.key }), page: String(p) })} />
        </>
      )}
    </>
  )
}
