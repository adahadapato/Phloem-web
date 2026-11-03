import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { unwrap } from '../../../api/apiError'
import type { SeoPageDetailsDto } from '../../../api/contracts/dtos'
import type { SeoPageKind, SeoPageStatus } from '../../../api/contracts/enums'
import { getSeoOverview, getSeoPage, getSeoPages, saveSeoPage, writeMissingSeo, writeSeoPage } from '../../../api/services/seoService'
import { Button } from '../../../components/ui/Button'
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog'
import { CountryFlag } from '../../../components/ui/CountryFlag'
import { dateTimeText } from '../../../components/ui/labels'
import { Pager } from '../../../components/ui/Pager'
import { useCountry } from '../../../state/CountryContext'
import styles from './Seo.module.css'

const PAGE_SIZE = 12
const TITLE_MAX = 70          // SeoPages.TitleMaxLength (Google shows about 60)
const DESCRIPTION_MAX = 170   // SeoPages.DescriptionMaxLength (Google shows about 160)

const STATUS_TEXT: Record<SeoPageStatus, string> = {
  NotWritten: 'Not written yet',
  WrittenByAi: 'Written by AI',
  EditedByStaff: 'Edited by staff',
}

const statusTone = (s: SeoPageStatus) => (s === 'NotWritten' ? styles.warn : s === 'EditedByStaff' ? styles.neutral : styles.good)

type Message = { text: string; ok: boolean } | null

/**
 * Admin → Smart SEO (/admin/seo, permission seo.manage): how Phloem appears on Google and in shared links.
 * 1. Website health: robots.txt, the sitemap, how many pages have text, whether the AI writer is on.
 * 2. Pages: the fixed pages and every live shop. Pick one to see the text Google gets, a search-result preview,
 *    the AI's score, keywords and tips; change the wording yourself, or let the AI write it again.
 * Tab, filters and the chosen page live in the address (?tab=shops&page=shop-…).
 */
export default function AdminSeoPage() {
  return (
    <>
      <header className={styles.hero}>
        <div>
          <span className={styles.eyebrow}>Phloem · Administration</span>
          <h1>Smart SEO</h1>
          <p>
            How Phloem appears on Google, and when someone shares a shop on WhatsApp or Facebook. The AI writes the
            text for every page; you check it here and change anything you like.
          </p>
        </div>
        <div className={styles.mark} aria-hidden="true">SEO<span>✦</span></div>
      </header>

      <ol className={styles.how}>
        <li><b>1</b><span><strong>The AI writes</strong> a Google title, description and keywords for every page. New shops get theirs within 30 minutes of approval.</span></li>
        <li><b>2</b><span><strong>You check it</strong> below: see how it looks on Google, read the AI's tips, change the wording if you want.</span></li>
        <li><b>3</b><span><strong>Google and chat apps show it.</strong> Your wording is never overwritten by the AI unless you press "Write with AI".</span></li>
      </ol>

      <Health />
      <Pages />
    </>
  )
}

// ═════════════════════════════ Website health ═════════════════════════════

function Health() {
  const queryClient = useQueryClient()
  const overview = useQuery({ queryKey: ['admin', 'seo', 'overview'], queryFn: async ({ signal }) => unwrap(await getSeoOverview(signal)) })
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<Message>(null)
  const o = overview.data

  const onWriteMissing = async () => {
    setBusy(true); setMessage(null)
    const result = await writeMissingSeo()
    setBusy(false)
    if (!result.ok) { setMessage({ text: result.error.displayMessage, ok: false }); return }
    await queryClient.invalidateQueries({ queryKey: ['admin', 'seo'] })
    setMessage({ text: result.value === 0 ? 'Nothing needed writing.' : `The AI wrote ${result.value} ${result.value === 1 ? 'page' : 'pages'}.`, ok: true })
  }

  const missing = o ? (o.mainPages - o.mainPagesWritten) + (o.shops - o.shopsWritten) + o.pagesChanged : 0

  return (
    <section className={styles.panel} aria-labelledby="health-title">
      <div>
        <span className={styles.kicker}>Website health</span>
        <h2 id="health-title">What search engines can see</h2>
        <p className={styles.muted}>Checked live each time you open this page.</p>
      </div>

      {overview.isPending && <p className={styles.muted} aria-busy="true">Loading…</p>}
      {overview.isError && <p className={`${styles.message} ${styles.bad}`}>We couldn't load the website health.</p>}
      {o && (
        <div className={styles.checks}>
          <Check title="Instructions for search engines (robots.txt)"
                 detail="Tells Google to skip private pages: checkout, orders, seller and admin."
                 pill="Available" tone="good" href={o.robotsUrl} />
          <Check title="Sitemap"
                 detail={`The list of ${o.pagesInSitemap} public addresses Google reads: main pages, every live shop, Terms and Privacy.`}
                 pill="Live" tone="good" href={o.sitemapUrl} />
          <Check title="Main pages with search text"
                 detail="Home, Explore, Shops, Send a parcel, Track, Help, Contact."
                 pill={`${o.mainPagesWritten} of ${o.mainPages}`} tone={o.mainPagesWritten === o.mainPages ? 'good' : 'warn'} />
          <Check title="Shops with search text"
                 detail={o.shops === 0 ? 'No live shops yet.' : `${o.shopsByStaff} edited by staff, the rest written by the AI.`}
                 pill={`${o.shopsWritten} of ${o.shops}`} tone={o.shopsWritten === o.shops ? 'good' : 'warn'} />
          <Check title="AI writer"
                 detail={o.aiIsOn
                   ? `Writes new and changed pages every 30 minutes.${o.pagesChanged > 0 ? ` ${o.pagesChanged} changed ${o.pagesChanged === 1 ? 'page is' : 'pages are'} waiting.` : ''}`
                   : `${o.aiNotReadyReason ?? 'Off.'} Until then pages use Phloem's simple default text.`}
                 pill={o.aiIsOn ? 'On' : 'Off'} tone={o.aiIsOn ? 'good' : 'neutral'} />
        </div>
      )}

      <div className={styles.actions}>
        <Button variant="primary" busy={busy} busyText="Writing… (up to a minute)"
                disabled={!o?.aiIsOn || missing === 0 || busy} onClick={() => void onWriteMissing()}>
          ✨ Write missing pages now
        </Button>
        <span className={styles.muted}>
          {missing === 0 ? 'Every page has text.' : `${missing} ${missing === 1 ? 'page needs' : 'pages need'} writing (up to 25 at a time).`}
        </span>
      </div>
      {message && <p className={`${styles.message} ${message.ok ? styles.ok : styles.bad}`} role="status">{message.text}</p>}
    </section>
  )
}

function Check({ title, detail, pill, tone, href }: {
  title: string; detail: string; pill: string; tone: 'good' | 'warn' | 'neutral'; href?: string
}) {
  return (
    <article className={styles.check}>
      <div>
        <h3>{title}</h3>
        <p>{detail}</p>
      </div>
      <div className={styles.checkEnd}>
        <span className={`${styles.pill} ${styles[tone]}`}>{pill}</span>
        {href && <a href={href} target="_blank" rel="noopener noreferrer" aria-label={`Open ${title} in a new tab`}>Open ↗</a>}
      </div>
    </article>
  )
}

// ═════════════════════════════ Pages ═════════════════════════════

function Pages() {
  const { countries } = useCountry()
  const [params, setParams] = useSearchParams()
  const kind: SeoPageKind = params.get('tab') === 'shops' ? 'Shop' : 'Main'
  const show = params.get('show') ?? ''
  const search = params.get('q') ?? ''
  const page = Math.max(1, Number(params.get('p')) || 1)
  const [typed, setTyped] = useState(search)

  const status = (['NotWritten', 'WrittenByAi', 'EditedByStaff'] as const).find((s) => s === show)
  const list = useQuery({
    queryKey: ['admin', 'seo', 'pages', kind, show, search, page],
    queryFn: async ({ signal }) => unwrap(await getSeoPages({
      kind, status, changedOnly: show === 'changed' || undefined, search: search || undefined, page, pageSize: PAGE_SIZE,
    }, signal)),
    placeholderData: (previous) => previous,
  })
  const rows = list.data?.items ?? []
  const selected = params.get('page') ?? rows[0]?.key ?? null

  const change = (next: Record<string, string | null>) => {
    const p = new URLSearchParams(params)
    for (const [k, v] of Object.entries(next)) { if (v) p.set(k, v); else p.delete(k) }
    if (!('p' in next)) p.delete('p')
    if (!('page' in next)) p.delete('page')
    setParams(p)
  }

  return (
    <section className={styles.panel} aria-labelledby="pages-title">
      <div>
        <span className={styles.kicker}>Pages</span>
        <h2 id="pages-title">Search text, page by page</h2>
        <p className={styles.muted}>Pick a page to see what Google gets, the AI's score and tips, and to change the wording.</p>
      </div>

      <div role="tablist" aria-label="Kind of page" className={styles.filters}>
        <Button small variant={kind === 'Main' ? 'primary' : 'outline'} role="tab" aria-selected={kind === 'Main'}
                onClick={() => { setTyped(''); change({ tab: null, q: null }) }}>Main pages</Button>
        <Button small variant={kind === 'Shop' ? 'primary' : 'outline'} role="tab" aria-selected={kind === 'Shop'}
                onClick={() => change({ tab: 'shops' })}>Shops</Button>
      </div>

      <div className={styles.filters}>
        <select value={show} aria-label="Show" onChange={(e) => change({ show: e.target.value || null })}>
          <option value="">All</option>
          <option value="NotWritten">Not written yet</option>
          <option value="WrittenByAi">Written by AI</option>
          <option value="EditedByStaff">Edited by staff</option>
          <option value="changed">Page changed since (AI rewrites soon)</option>
        </select>
        {kind === 'Shop' && (
          <form role="search" style={{ display: 'flex', flex: '1 1 220px', gap: 8 }}
                onSubmit={(e) => { e.preventDefault(); change({ q: typed.trim() || null }) }}>
            <input type="search" value={typed} placeholder="Search shops" aria-label="Search shops" maxLength={100}
                   onChange={(e) => setTyped(e.target.value)} />
            <Button small type="submit" variant="secondary">Search</Button>
          </form>
        )}
      </div>

      {list.isError && <p className={`${styles.message} ${styles.bad}`}>We couldn't load the pages.</p>}
      {list.data && rows.length === 0 && <p className={styles.muted}>No pages here.</p>}
      {rows.length > 0 && (
        <div className={styles.layout}>
          <div>
            <nav className={styles.list} aria-label="Pages">
              {rows.map((r) => {
                const c = r.country ? countries.find((x) => x.country === r.country) : null
                return (
                  <button key={r.key} type="button" className={`${styles.item} ${r.key === selected ? styles.active : ''}`}
                          aria-current={r.key === selected ? 'true' : undefined} onClick={() => change({ page: r.key, p: params.get('p') })}>
                    <span className={styles.itemName}>{r.name}</span>
                    <span className={styles.itemTitle}>{r.title}</span>
                    <span className={styles.itemFoot}>
                      <span className={`${styles.pill} ${statusTone(r.status)}`}>{STATUS_TEXT[r.status]}</span>
                      {r.pageChanged && <span className={`${styles.pill} ${styles.warn}`}>Page changed</span>}
                      {r.score !== null && <span className="muted">Score {r.score}</span>}
                      {c && <span className="muted"><CountryFlag country={c} /> {c.name}</span>}
                    </span>
                  </button>
                )
              })}
            </nav>
            {list.data && list.data.totalPages > 1 && (
              <Pager page={list.data.page} totalPages={list.data.totalPages} onChange={(p) => change({ p: String(p) })} />
            )}
          </div>
          {selected && <PageEditor key={selected} pageKey={selected} />}
        </div>
      )}
    </section>
  )
}

function PageEditor({ pageKey }: { pageKey: string }) {
  const query = useQuery({ queryKey: ['admin', 'seo', 'page', pageKey], queryFn: async ({ signal }) => unwrap(await getSeoPage(pageKey, signal)) })
  if (query.isPending) return <p className={styles.muted} aria-busy="true">Loading…</p>
  if (query.isError) return <p className={`${styles.message} ${styles.bad}`}>We couldn't load this page.</p>
  return <PageForm key={`${query.data.key}-${query.data.changedAt ?? 'new'}`} page={query.data} />
}

function PageForm({ page: s }: { page: SeoPageDetailsDto }) {
  const queryClient = useQueryClient()
  const [title, setTitle] = useState(s.title)
  const [description, setDescription] = useState(s.description)
  const [keywords, setKeywords] = useState(s.keywords.join(', '))
  const [busy, setBusy] = useState<'save' | 'write' | null>(null)
  const [message, setMessage] = useState<Message>(null)
  const [confirmWrite, setConfirmWrite] = useState(false)

  const keywordList = keywords.split(',').map((k) => k.trim()).filter(Boolean)
  const dirty = title.trim() !== s.title || description.trim() !== s.description || keywordList.join(',') !== s.keywords.join(',')

  const refresh = async (text: string) => {
    await queryClient.invalidateQueries({ queryKey: ['admin', 'seo'] })
    setMessage({ text, ok: true })
  }

  const onSave = async () => {
    setBusy('save'); setMessage(null)
    const result = await saveSeoPage(s.key, title.trim(), description.trim(), keywordList)
    setBusy(null)
    if (!result.ok) { setMessage({ text: result.error.displayMessage, ok: false }); return }
    await refresh('Saved. Phloem uses your wording now, and the AI will leave it alone.')
  }

  const onWrite = async () => {
    setConfirmWrite(false); setBusy('write'); setMessage(null)
    const result = await writeSeoPage(s.key)
    setBusy(null)
    if (!result.ok) { setMessage({ text: result.error.displayMessage, ok: false }); return }
    await refresh('The AI has written new text for this page. It is used now.')
  }

  const copyShare = async () => {
    if (!s.shareUrl) return
    try { await navigator.clipboard.writeText(s.shareUrl); setMessage({ text: 'Share link copied.', ok: true }) }
    catch { setMessage({ text: 'Copy the link from the box.', ok: false }) }
  }

  return (
    <article className={styles.editor} aria-label={`Search text for ${s.name}`}>
      <div className={styles.editorHead}>
        <div>
          <h2>{s.name}</h2>
          <a href={s.url} target="_blank" rel="noopener noreferrer">{s.url.replace(/^https?:\/\//, '')} ↗</a>
        </div>
        <span className={`${styles.pill} ${statusTone(s.status)}`}>{STATUS_TEXT[s.status]}</span>
      </div>

      {message && <p className={`${styles.message} ${message.ok ? styles.ok : styles.bad}`} role="status">{message.text}</p>}

      {s.status === 'NotWritten' && (
        <p className={styles.notice}>Nothing written yet: Google gets the simple default text below. Press "Write with AI", or write your own and save.</p>
      )}
      {s.pageChanged && (
        <p className={styles.notice}>This page has changed since the AI wrote its text. The AI rewrites it within 30 minutes, or press "Write with AI" now.</p>
      )}

      <div className={styles.info}>
        <strong>What the AI receives for this page</strong>
        {s.whatTheAiGets}
      </div>

      {s.score !== null && (
        <div className={styles.score}>
          <div className={styles.scoreNumber}><strong>{s.score}</strong><span>out of 100</span></div>
          <div>
            <p>{s.scoreExplanation}</p>
            <small>The AI's estimate of how ready the page is, not a Google ranking.</small>
          </div>
        </div>
      )}

      <div className={styles.grid}>
        <div className={styles.fields}>
          <div className={styles.field}>
            <label htmlFor="seo-title">SEO title</label>
            <input id="seo-title" value={title} maxLength={TITLE_MAX} onChange={(e) => setTitle(e.target.value)} />
            <span className={`${styles.hint} ${title.length > 60 ? styles.over : ''}`}>{title.length} / 60 characters (Google cuts longer titles)</span>
          </div>
          <div className={styles.field}>
            <label htmlFor="seo-description">Meta description</label>
            <textarea id="seo-description" rows={4} value={description} maxLength={DESCRIPTION_MAX}
                      onChange={(e) => setDescription(e.target.value)} />
            <span className={`${styles.hint} ${description.length > 160 ? styles.over : ''}`}>{description.length} / 160 characters</span>
          </div>
          <div className={styles.field}>
            <label htmlFor="seo-keywords">Keywords <span className="muted">(separate with commas)</span></label>
            <input id="seo-keywords" value={keywords} onChange={(e) => setKeywords(e.target.value)}
                   placeholder="e.g. jollof rice delivery London, Ghanaian food" />
          </div>
        </div>

        <aside className={styles.preview} aria-label="How it may look on Google">
          <span className={styles.previewLabel}>Search result preview</span>
          <span className={styles.previewSite}>Phloem</span>
          <span className={styles.previewUrl}>{s.url}</span>
          <strong>{title || 'Your SEO title will appear here'}</strong>
          <p>{description || 'Your meta description will appear here.'}</p>
          <small>Illustrative preview. Google may show different text.</small>
        </aside>
      </div>

      {s.keywords.length > 0 && (
        <div className={styles.fields}>
          <h3>Keywords the AI suggested</h3>
          <div className={styles.chips}>{s.keywords.map((k) => <span key={k}>{k}</span>)}</div>
        </div>
      )}

      {s.improvements.length > 0 && (
        <div className={styles.fields}>
          <h3>How to make this page better</h3>
          <ul className={styles.tips}>{s.improvements.map((t, i) => <li key={i}>{t}</li>)}</ul>
        </div>
      )}

      {s.shareUrl && (
        <div className={styles.fields}>
          <h3>Share link with preview</h3>
          <p className={styles.muted}>Shared on WhatsApp or Facebook, this link shows the shop's name, picture and description, then opens the shop.</p>
          <div className={styles.share}>
            <input readOnly value={s.shareUrl} aria-label="Share link" onFocus={(e) => e.target.select()} />
            <Button small variant="outline" onClick={() => void copyShare()}>Copy</Button>
          </div>
        </div>
      )}

      <div className={styles.actions}>
        <Button variant="primary" busy={busy === 'save'} busyText="Saving…"
                disabled={!dirty || !title.trim() || !description.trim() || !!busy} onClick={() => void onSave()}>
          Save my wording
        </Button>
        <Button variant="outline" disabled={!dirty || !!busy}
                onClick={() => { setTitle(s.title); setDescription(s.description); setKeywords(s.keywords.join(', ')) }}>
          Discard changes
        </Button>
        <span className={styles.pushRight}>
          <Button variant="secondary" busy={busy === 'write'} busyText="Writing…" disabled={!!busy}
                  onClick={() => (s.status === 'EditedByStaff' || dirty ? setConfirmWrite(true) : void onWrite())}>
            ✨ {s.status === 'NotWritten' ? 'Write with AI' : 'Write again with AI'}
          </Button>
        </span>
      </div>

      {s.changedAt && (
        <p className={styles.muted}>Last written {dateTimeText(s.changedAt)}{s.changedBy ? ` · ${s.changedBy}` : ''}.</p>
      )}

      <ConfirmDialog
        open={confirmWrite}
        title="Replace this wording with the AI's?"
        message={s.status === 'EditedByStaff'
          ? 'This page has wording written by staff. The AI will replace it, and from then on rewrite it when the page changes.'
          : 'Your unsaved changes will be lost.'}
        confirmText="Write with AI"
        danger
        onConfirm={() => void onWrite()}
        onCancel={() => setConfirmWrite(false)}
      />
    </article>
  )
}
