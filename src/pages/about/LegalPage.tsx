import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { Link, useLocation, useMatches } from 'react-router'
import { unwrap } from '../../api/apiError'
import type { LegalDocumentType } from '../../api/contracts/enums'
import { getLegalDocument } from '../../api/services/legalService'
import { Button } from '../../components/ui/Button'
import { Markdown } from '../../components/ui/Markdown'
import { sections } from '../../components/ui/markdownParts'
import { StatusBanner } from '../../components/ui/StatusBanner'
import styles from './LegalPage.module.css'

/** The other two pages, linked under "On this page". */
const OTHERS: Record<LegalDocumentType, { to: string; label: string }[]> = {
  Terms: [{ to: '/privacy', label: 'Privacy Policy' }, { to: '/help', label: 'Help & support' }],
  Privacy: [{ to: '/terms', label: 'Terms & Conditions' }, { to: '/help', label: 'Help & support' }],
  Help: [{ to: '/terms', label: 'Terms & Conditions' }, { to: '/privacy', label: 'Privacy Policy' }],
}

/**
 * Terms & Conditions (/terms), Privacy Policy (/privacy) and Help & support (/help), shown from the API's database
 * (the same text the app shows): title, version and date ("Updated …" for Help), a "Draft" note while the wording
 * is temporary, an "On this page" list of sections on the left (big screens), and the text. A link like
 * /terms#sellers opens at that section.
 */
export default function LegalPage() {
  const matches = useMatches()
  const type = ((matches[matches.length - 1]?.handle as { legal?: LegalDocumentType } | undefined)?.legal) ?? 'Terms'
  const { hash } = useLocation()
  const query = useQuery({
    queryKey: ['legal', type],
    queryFn: async ({ signal }) => unwrap(await getLegalDocument(type, signal)),
    staleTime: 10 * 60_000,
  })
  const doc = query.data

  // Opened at a section (/terms#sellers): scroll to it once the text is on the page
  useEffect(() => {
    if (!doc || !hash) return
    document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView({ block: 'start' })
  }, [doc, hash])

  const others = OTHERS[type]
  const date = doc ? new Date(doc.publishedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : ''
  const toc = doc ? sections(doc.content) : []

  return (
    <div className={`container ${styles.page}`}>
      {query.isPending && <p className="muted" aria-busy="true">Loading…</p>}
      {query.isError && (
        <div className={styles.error}>
          <StatusBanner isError message={(query.error as { status?: number }).status === 404
            ? "This document isn't available yet." : "We couldn't load this page right now."} />
          <Button small variant="outline" onClick={() => query.refetch()}>Try again</Button>
        </div>
      )}

      {doc && (
        <div className={styles.layout}>
          <aside className={styles.toc} aria-label="On this page">
            <p className={styles.tocTitle}>On this page</p>
            <ul>
              {toc.map((s) => <li key={s.id}><a href={`#${s.id}`}>{s.text}</a></li>)}
            </ul>
            {others.map((o) => <Link key={o.to} to={o.to} className={styles.other}>{o.label} ›</Link>)}
          </aside>

          <article className={styles.doc}>
            <p className="eyebrow">Phloem</p>
            <h1>{doc.title}</h1>
            <p className="muted">{type === 'Help' ? `Updated ${date}` : `Version ${doc.version} · in effect from ${date}`}</p>
            {doc.isDraft && (
              <p className={styles.draft} role="note">
                <strong>Draft.</strong> This is a temporary wording while the final version is prepared.
              </p>
            )}
            <Markdown text={doc.content.replace(/^>.*\n?/m, doc.isDraft ? '' : '$&')} className={styles.text} />
          </article>
        </div>
      )}
    </div>
  )
}
