import { useQuery } from '@tanstack/react-query'
import { Fragment, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { unwrap } from '../../../api/apiError'
import type { AiCallOutcome } from '../../../api/contracts/enums'
import { getAiCall, getAiCalls, getAiPrompts } from '../../../api/services/aiService'
import { Button } from '../../../components/ui/Button'
import { dateTimeText } from '../../../components/ui/labels'
import { Pager } from '../../../components/ui/Pager'
import { StatusBanner } from '../../../components/ui/StatusBanner'
import adminStyles from '../Admin.module.css'
import styles from './Ai.module.css'
import { AiStatusBar } from './AiStatusBar'

const PAGE_SIZE = 20

const OUTCOME_TEXT: Record<AiCallOutcome, string> = {
  Succeeded: 'Worked',
  ProviderFailed: 'AI service failed',
  BadAnswer: 'Answer not usable',
}

/**
 * Admin → AI → AI request log (/admin/ai/calls): every time Phloem asked the AI something, newest first: which
 * feature, what it cost, and whether it worked. "Open" shows what was sent and what came back (recorded in the audit
 * log, because it can hold people's text). Kept 12 months.
 */
export default function AdminAiCallsPage() {
  const [params, setParams] = useSearchParams()
  const promptKey = params.get('job') ?? undefined
  const outcome = (params.get('outcome') as AiCallOutcome | null) ?? undefined
  const page = Math.max(1, Number(params.get('page')) || 1)
  const [open, setOpen] = useState<string | null>(null)

  const prompts = useQuery({ queryKey: ['admin', 'ai', 'prompts'], queryFn: async ({ signal }) => unwrap(await getAiPrompts(signal)) })
  const calls = useQuery({
    queryKey: ['admin', 'ai', 'calls', promptKey, outcome, page],
    queryFn: async ({ signal }) => unwrap(await getAiCalls({ promptKey, outcome, page, pageSize: PAGE_SIZE }, signal)),
    placeholderData: (previous) => previous,
  })
  const list = calls.data

  const change = (next: Record<string, string | null>) => {
    const p = new URLSearchParams(params)
    for (const [k, v] of Object.entries(next)) { if (v) p.set(k, v); else p.delete(k) }
    if (!('page' in next)) p.delete('page')
    setOpen(null)
    setParams(p)
  }

  return (
    <>
      <Link to="/admin/ai" className={adminStyles.back}>‹ AI Prompts</Link>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>AI</span>
          <h1>AI request log</h1>
          <p>
            Every time Phloem asked the AI something: which feature, what it cost and whether it worked. Open a request
            to see what was sent and what came back. Kept for 12 months.
          </p>
        </div>
      </header>

      <AiStatusBar />

      <div className={adminStyles.filters}>
        <label className={adminStyles.select}>
          <span className="muted">Feature</span>
          <select value={promptKey ?? ''} onChange={(e) => change({ job: e.target.value || null })}>
            <option value="">All features</option>
            {prompts.data?.map((p) => <option key={p.key} value={p.key}>{p.name}</option>)}
            <option value="prompt.rewrite">Ask AI to improve a prompt</option>
          </select>
        </label>
        <label className={adminStyles.select}>
          <span className="muted">Result</span>
          <select value={outcome ?? ''} onChange={(e) => change({ outcome: e.target.value || null })}>
            <option value="">Any</option>
            {(Object.keys(OUTCOME_TEXT) as AiCallOutcome[]).map((o) => <option key={o} value={o}>{OUTCOME_TEXT[o]}</option>)}
          </select>
        </label>
      </div>

      {calls.isError && (
        <div className={adminStyles.error}>
          <StatusBanner isError message="We couldn't load the AI requests." />
          <Button small variant="outline" onClick={() => calls.refetch()}>Try again</Button>
        </div>
      )}
      {!list && calls.isPending && <p className="muted" aria-busy="true">Loading…</p>}
      {list && (
        <>
          <p className={adminStyles.count}>
            {list.totalCount === 0 ? 'No AI requests yet.' : `${list.totalCount} ${list.totalCount === 1 ? 'request' : 'requests'}`}
          </p>
          {list.items.length > 0 && (
            <div className={adminStyles.tableWrap}>
              <table className={adminStyles.table}>
                <thead>
                  <tr><th>When</th><th>Feature</th><th>Result</th><th>Tokens</th><th>Cost</th><th aria-label="Open" /></tr>
                </thead>
                <tbody>
                  {list.items.map((c) => (
                    <Fragment key={c.id}>
                      <tr>
                        <td>{dateTimeText(c.at)}<br /><span className="muted">{(c.durationMs / 1000).toFixed(1)} s</span></td>
                        <td className={styles.wrap}>
                          <span className={adminStyles.rowText}>
                            <strong>{c.promptName}</strong>
                            <span className="muted">{c.subject ?? '—'} · {c.promptVersion === 0 ? 'built-in prompt' : `prompt v${c.promptVersion}`}</span>
                          </span>
                        </td>
                        <td className={c.outcome === 'Succeeded' ? styles.outcomeOk : styles.outcomeBad}>
                          {OUTCOME_TEXT[c.outcome]}
                          {c.finalDecision && <><br /><span className="muted">Staff: {c.finalDecision}</span></>}
                        </td>
                        <td>{c.inputTokens.toLocaleString('en-GB')} in<br />{c.outputTokens.toLocaleString('en-GB')} out</td>
                        <td>${c.costUsd.toFixed(4)}</td>
                        <td>
                          <button type="button" className={styles.link} aria-expanded={open === c.id}
                                  onClick={() => setOpen(open === c.id ? null : c.id)}>
                            {open === c.id ? 'Hide' : 'Open'}
                          </button>
                        </td>
                      </tr>
                      {open === c.id && (
                        <tr className={styles.callDetails}><td colSpan={6}><CallDetails id={c.id} /></td></tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Pager page={list.page} totalPages={list.totalPages} onChange={(p) => change({ page: String(p) })} />
        </>
      )}
    </>
  )
}

/** What was sent and what came back. Loaded once when opened (each open is recorded in the audit log). */
function CallDetails({ id }: { id: string }) {
  const call = useQuery({
    queryKey: ['admin', 'ai', 'call', id],
    queryFn: async ({ signal }) => unwrap(await getAiCall(id, signal)),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  })

  if (call.isPending) return <p className="muted" aria-busy="true">Loading…</p>
  if (call.isError) return <p className="muted">We couldn't load this request.</p>

  const d = call.data
  return (
    <div>
      <div>
        <p className={styles.muted}><strong>Sent to the AI</strong> (with the prompt)</p>
        <pre className={styles.code}>{d.input}</pre>
      </div>
      <div>
        <p className={styles.muted}><strong>The AI's answer</strong></p>
        <pre className={styles.code}>{d.output ?? '(nothing)'}</pre>
        {d.error && <p className={styles.muted}>Problem: {d.error}</p>}
        {d.decidedBy && <p className={styles.muted}>Then: {d.call.finalDecision} by {d.decidedBy}{d.decidedAt && ` · ${dateTimeText(d.decidedAt)}`}</p>}
        <p className={styles.muted}>Opening a request is recorded in the audit log.</p>
      </div>
    </div>
  )
}
