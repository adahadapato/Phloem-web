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
import styles from '../Admin.module.css'
import { AdminHead } from '../AdminParts'
import aiStyles from './Ai.module.css'
import { AiStatusBar } from './AiStatusBar'

const PAGE_SIZE = 20

const OUTCOME_TEXT: Record<AiCallOutcome, string> = {
  Succeeded: 'Worked',
  ProviderFailed: 'Service failed',
  BadAnswer: 'Unusable answer',
}

/**
 * Admin → AI (/admin/ai, permission ai.prompts.manage): status and this month's spend, then two tabs: the prompts
 * AI jobs use (open one to edit it), and the AI call log (?tab=calls). Opening a call shows its text and is audited.
 */
export default function AdminAiPage() {
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') === 'calls' ? 'calls' : 'prompts'

  return (
    <>
      <AdminHead title="AI" sub="The instructions Phloem's AI jobs follow, what each call cost, and what went in and out." />
      <AiStatusBar />
      <div className={styles.tabs} role="tablist" aria-label="AI">
        <button type="button" role="tab" aria-selected={tab === 'prompts'} className={styles.tab}
                onClick={() => setParams({})}>Prompts</button>
        <button type="button" role="tab" aria-selected={tab === 'calls'} className={styles.tab}
                onClick={() => setParams({ tab: 'calls' })}>Call log</button>
      </div>
      {tab === 'prompts' ? <PromptList /> : <CallLog />}
    </>
  )
}

function PromptList() {
  const prompts = useQuery({ queryKey: ['admin', 'ai', 'prompts'], queryFn: async ({ signal }) => unwrap(await getAiPrompts(signal)) })

  if (prompts.isPending) return <p className="muted" aria-busy="true">Loading…</p>
  if (prompts.isError) {
    return (
      <div className={styles.error}>
        <StatusBanner isError message="We couldn't load the prompts." />
        <Button small variant="outline" onClick={() => prompts.refetch()}>Try again</Button>
      </div>
    )
  }

  return (
    <>
      <p className={aiStyles.small} style={{ marginBottom: 12 }}>
        More jobs appear here as they're added (search engine text, then moderation).
      </p>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead><tr><th>Prompt</th><th>Wording in use</th><th aria-label="Open" /></tr></thead>
          <tbody>
            {prompts.data.map((p) => (
              <tr key={p.key}>
                <td>
                  <Link to={`/admin/ai/prompts/${encodeURIComponent(p.key)}`} className={styles.rowText}>
                    <strong>{p.name}</strong>
                    <span className="muted">{p.description}</span>
                  </Link>
                </td>
                <td>
                  {p.version === 0
                    ? <span className="muted">Phloem's default</span>
                    : <span className={styles.rowText}>
                        <span>Version {p.version}</span>
                        <span className="muted">{p.changedBy}{p.changedAt && ` · ${dateTimeText(p.changedAt)}`}</span>
                      </span>}
                </td>
                <td><Link to={`/admin/ai/prompts/${encodeURIComponent(p.key)}`} className={styles.rowGo}>Edit ›</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

function CallLog() {
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
    p.set('tab', 'calls')
    for (const [k, v] of Object.entries(next)) { if (v) p.set(k, v); else p.delete(k) }
    if (!('page' in next)) p.delete('page')
    setOpen(null)
    setParams(p)
  }

  return (
    <>
      <div className={styles.filters}>
        <label className={styles.select}>
          <span className="muted">Job</span>
          <select value={promptKey ?? ''} onChange={(e) => change({ job: e.target.value || null })}>
            <option value="">All jobs</option>
            {prompts.data?.map((p) => <option key={p.key} value={p.key}>{p.name}</option>)}
          </select>
        </label>
        <label className={styles.select}>
          <span className="muted">Result</span>
          <select value={outcome ?? ''} onChange={(e) => change({ outcome: e.target.value || null })}>
            <option value="">Any</option>
            {(Object.keys(OUTCOME_TEXT) as AiCallOutcome[]).map((o) => <option key={o} value={o}>{OUTCOME_TEXT[o]}</option>)}
          </select>
        </label>
      </div>

      {calls.isError && (
        <div className={styles.error}>
          <StatusBanner isError message="We couldn't load the AI calls." />
          <Button small variant="outline" onClick={() => calls.refetch()}>Try again</Button>
        </div>
      )}
      {!list && calls.isPending && <p className="muted" aria-busy="true">Loading…</p>}
      {list && (
        <>
          <p className={styles.count}>
            {list.totalCount === 0 ? 'No AI calls yet.' : `${list.totalCount} ${list.totalCount === 1 ? 'call' : 'calls'}`}
          </p>
          {list.items.length > 0 && (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr><th>When</th><th>Job</th><th>Result</th><th>Tokens</th><th>Cost</th><th aria-label="Open" /></tr>
                </thead>
                <tbody>
                  {list.items.map((c) => (
                    <Fragment key={c.id}>
                      <tr>
                        <td>{dateTimeText(c.at)}<br /><span className="muted">{(c.durationMs / 1000).toFixed(1)} s</span></td>
                        <td className={aiStyles.wrap}>
                          <span className={styles.rowText}>
                            <strong>{c.promptName}</strong>
                            <span className="muted">
                              {c.subject ?? '—'} · {c.promptVersion === 0 ? 'default wording' : `version ${c.promptVersion}`} · {c.model}
                            </span>
                          </span>
                        </td>
                        <td className={c.outcome === 'Succeeded' ? aiStyles.outcomeOk : aiStyles.outcomeBad}>
                          {OUTCOME_TEXT[c.outcome]}
                          {c.finalDecision && <><br /><span className="muted">Staff: {c.finalDecision}</span></>}
                        </td>
                        <td>{c.inputTokens.toLocaleString('en-GB')} in<br />{c.outputTokens.toLocaleString('en-GB')} out</td>
                        <td>${c.costUsd.toFixed(4)}</td>
                        <td>
                          <button type="button" className={aiStyles.link} aria-expanded={open === c.id}
                                  onClick={() => setOpen(open === c.id ? null : c.id)}>
                            {open === c.id ? 'Hide' : 'Open'}
                          </button>
                        </td>
                      </tr>
                      {open === c.id && (
                        <tr className={aiStyles.callDetails}>
                          <td colSpan={6}><CallDetails id={c.id} /></td>
                        </tr>
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

/** What went in and came back. Loaded only when opened, once (each open is written to the audit log). */
function CallDetails({ id }: { id: string }) {
  const call = useQuery({
    queryKey: ['admin', 'ai', 'call', id],
    queryFn: async ({ signal }) => unwrap(await getAiCall(id, signal)),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  })

  if (call.isPending) return <p className="muted" aria-busy="true">Loading…</p>
  if (call.isError) return <p className="muted">We couldn't load this call.</p>

  const d = call.data
  return (
    <div>
      <div>
        <p className={aiStyles.small}><strong>Sent</strong> (after the prompt's instructions)</p>
        <pre className={aiStyles.code}>{d.input}</pre>
      </div>
      <div>
        <p className={aiStyles.small}><strong>Answer</strong></p>
        <pre className={aiStyles.code}>{d.output ?? '(nothing)'}</pre>
        {d.error && <p className={aiStyles.small}>Problem: {d.error}</p>}
        {d.decidedBy && <p className={aiStyles.small}>Decided by {d.decidedBy}{d.decidedAt && ` · ${dateTimeText(d.decidedAt)}`}</p>}
        <p className={aiStyles.small}>Opening a call is recorded in the audit log.</p>
      </div>
    </div>
  )
}
