import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router'
import { unwrap } from '../../../api/apiError'
import type { LegalDocumentDto } from '../../../api/contracts/dtos'
import type { LegalDocumentType } from '../../../api/contracts/enums'
import { getTermsAcceptanceStats } from '../../../api/services/adminService'
import { getLegalDocument, publishLegalDocument } from '../../../api/services/legalService'
import { Button } from '../../../components/ui/Button'
import { Markdown } from '../../../components/ui/Markdown'
import { sections } from '../../../components/ui/markdownParts'
import { StatusBanner } from '../../../components/ui/StatusBanner'
import legal from '../../about/LegalPage.module.css'
import styles from '../Admin.module.css'
import { AdminHead } from '../AdminParts'

const TITLE_MAX = 150        // LegalDocument.TitleMaxLength
const CONTENT_MAX = 200_000  // LegalDocument.ContentMaxLength

/** The three texts, where each lives on the website, and the sections the website and the app link to. */
const TEXTS: { type: LegalDocumentType; label: string; path: string; anchors: string[] }[] = [
  { type: 'Terms', label: 'Terms & Conditions', path: '/terms', anchors: ['buyers', 'sellers', 'parcels', 'payments'] },
  { type: 'Privacy', label: 'Privacy Policy', path: '/privacy', anchors: ['what', 'who', 'rights'] },
  { type: 'Help', label: 'Help & support', path: '/help', anchors: [] },
]

type Message = { text: string; isError: boolean } | null
type Draft = { title: string; content: string; isDraft: boolean }

const day = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

/**
 * The editor for one text: title, the Markdown on the left and a live preview on the right (Write / Preview tabs on a
 * phone), the "still temporary" switch, a warning when a section the website or app links to is missing, and
 * Publish, which asks first and makes a NEW version (the old ones are kept, unchanged).
 */
function TextEditor({ text, current, onDone }: {
  text: (typeof TEXTS)[number]
  current: LegalDocumentDto | null
  /** Says what happened (shown above the editor, which starts afresh after publishing). */
  onDone: (message: Message) => void
}) {
  const queryClient = useQueryClient()
  const start: Draft = { title: current?.title ?? text.label, content: current?.content ?? '', isDraft: current?.isDraft ?? true }
  const [draft, setDraft] = useState<Draft>(start)
  const [view, setView] = useState<'write' | 'preview'>('write')
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const changed = draft.title !== start.title || draft.content !== start.content || draft.isDraft !== start.isDraft
  const ids = new Set(sections(draft.content).map((s) => s.id))
  const missingAnchors = text.anchors.filter((a) => !ids.has(a))
  const nextVersion = (current?.version ?? 0) + 1
  const canPublish = !!draft.title.trim() && !!draft.content.trim()

  const onPublish = async () => {
    setBusy(true); setError(null); onDone(null)
    const result = await publishLegalDocument(text.type, draft.title.trim(), draft.content.trim(), draft.isDraft)
    setBusy(false); setConfirm(false)
    if (!result.ok) { setError(result.error.displayMessage); return }
    void queryClient.invalidateQueries({ queryKey: ['admin', 'terms-acceptance'] })
    await queryClient.invalidateQueries({ queryKey: ['legal', text.type] })
    await queryClient.invalidateQueries({ queryKey: ['admin', 'text', text.type] })
    onDone({ text: `Version ${result.value} of the ${text.label} is live on the website and in the app.`, isError: false })
  }

  return (
    <>
      <StatusBanner message={error} isError />
      <div className={styles.textBar}>
        <span>
          {current
            ? <>Live now: <strong>version {current.version}</strong>, in effect since {day(current.publishedAt)}{current.isDraft && <span className={`${styles.chip} ${styles.chipWait}`}>Draft</span>}</>
            : <>Nothing published yet.</>}
        </span>
        <Link to={text.path} target="_blank" rel="noopener">See the live page ↗</Link>
      </div>

      <div className={styles.panel}>
        <label className={styles.textTitle}>
          <span>Title</span>
          <input value={draft.title} maxLength={TITLE_MAX} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
        </label>

        <div className={styles.writeTabs} role="tablist" aria-label="View">
          <button type="button" role="tab" aria-selected={view === 'write'} onClick={() => setView('write')}>Write</button>
          <button type="button" role="tab" aria-selected={view === 'preview'} onClick={() => setView('preview')}>Preview</button>
        </div>
        <div className={`${styles.editor} ${view === 'preview' ? styles.showPreview : styles.showWrite}`}>
          <label className={styles.editorWrite}>
            <span className="visually-hidden">Text (Markdown)</span>
            <textarea value={draft.content} maxLength={CONTENT_MAX} spellCheck
                      onChange={(e) => setDraft({ ...draft, content: e.target.value })} />
          </label>
          <div className={styles.editorPreview} aria-label="Preview">
            <h1 className={styles.previewTitle}>{draft.title || text.label}</h1>
            <Markdown text={draft.content} className={legal.text} />
          </div>
        </div>
        <p className={styles.cheat}>
          <code>## Section {'{#anchor}'}</code> heading · <code>### Question</code> · <code>**bold**</code> ·
          <code> - </code> list · <code>&gt; </code> note · <code>[Privacy Policy](/privacy)</code> link
        </p>

        {missingAnchors.length > 0 && (
          <p className={styles.setupNote}>
            ⚠ The website and the app link to these sections, so keep them as headings:{' '}
            {missingAnchors.map((a, i) => <span key={a}>{i > 0 && ', '}<code>{`{#${a}}`}</code></span>)}
          </p>
        )}

        <label className={styles.toggle}>
          <input type="checkbox" checked={draft.isDraft} onChange={(e) => setDraft({ ...draft, isDraft: e.target.checked })} />
          This wording is still temporary (show a "Draft" note)
        </label>

        {confirm ? (
          <div className={styles.inlinePanel}>
            <strong>Publish version {nextVersion}?</strong>
            <span className={styles.panelHint}>
              It replaces the current {text.label} for everyone, on the website and in the app, straight away. Older
              versions are kept unchanged.
              {text.type === 'Terms' && ` Everyone will be asked to accept version ${nextVersion}; until they do, they can browse but not order, send parcels or sell.`}
              {text.type === 'Privacy' && ' Everyone will see a short notice that it has changed.'}
            </span>
            <div className={styles.row}>
              <Button small variant="cta" busy={busy} busyText="Publishing…" onClick={onPublish}>Yes, publish</Button>
              <Button small variant="outline" onClick={() => setConfirm(false)}>Not yet</Button>
            </div>
          </div>
        ) : (
          <div className={styles.row}>
            <Button variant="cta" disabled={!changed || !canPublish} onClick={() => { setConfirm(true); setError(null); onDone(null) }}>
              Publish as version {nextVersion}
            </Button>
            {changed && <Button variant="outline" onClick={() => setDraft(start)}>Discard changes</Button>}
            {!changed && <span className={styles.panelHint}>Make a change to publish a new version.</span>}
          </div>
        )}
      </div>
    </>
  )
}

/**
 * Terms tab: "84 of 120 people have accepted version 3", with a bar. People who haven't are asked when they next
 * sign in, and can't order, send parcels or sell until they accept.
 */
function AcceptanceLine() {
  const stats = useQuery({
    queryKey: ['admin', 'terms-acceptance'],
    queryFn: async ({ signal }) => unwrap(await getTermsAcceptanceStats(signal)),
  })
  const s = stats.data
  if (!s || s.currentTermsVersion === 0) return null
  const share = s.peopleCount === 0 ? 0 : Math.round((s.acceptedCount / s.peopleCount) * 100)
  return (
    <div className={styles.acceptance} role="status">
      <p>
        <strong>{s.acceptedCount} of {s.peopleCount}</strong> {s.peopleCount === 1 ? 'person has' : 'people have'} accepted
        version {s.currentTermsVersion}. The others are asked when they next sign in, and can browse but not order,
        send parcels or sell until they accept.
      </p>
      <div className={styles.acceptanceBar} role="img" aria-label={`${share}% have accepted`}>
        <span style={{ width: `${share}%` }} />
      </div>
    </div>
  )
}

/**
 * Admin → Terms & Help: publish new versions of the Terms & Conditions, the Privacy Policy and the Help page. The
 * text is stored in the database, so the website and the app show the new wording straight away (no app update).
 */
export default function AdminTextsPage() {
  const [type, setType] = useState<LegalDocumentType>('Terms')
  const [message, setMessage] = useState<Message>(null)
  const text = TEXTS.find((t) => t.type === type)!
  const query = useQuery({
    queryKey: ['admin', 'text', type],
    queryFn: async ({ signal }) => {
      const result = await getLegalDocument(type, signal)
      if (!result.ok && result.error.status === 404) return null   // nothing published yet
      return unwrap(result)
    },
  })

  return (
    <>
      <AdminHead title="Terms & Help" sub="Publish new wording for the Terms, the Privacy Policy and the Help page. Shown on the website and in the app at once." />
      <div className={styles.tabs} role="tablist" aria-label="Text">
        {TEXTS.map((t) => (
          <button key={t.type} type="button" role="tab" aria-selected={t.type === type} className={styles.tab} onClick={() => { setType(t.type); setMessage(null) }}>
            {t.label}
          </button>
        ))}
      </div>
      <StatusBanner message={message?.text} isError={message?.isError} />
      {query.isPending && <p className="muted" aria-busy="true">Loading…</p>}
      {query.isError && (
        <div className={styles.error}>
          <StatusBanner isError message="We couldn't load this text." />
          <Button small variant="outline" onClick={() => query.refetch()}>Try again</Button>
        </div>
      )}
      {type === 'Terms' && <AcceptanceLine />}
      {query.isSuccess && <TextEditor key={`${type}-${query.data?.version ?? 0}`} text={text} current={query.data} onDone={setMessage} />}
    </>
  )
}
