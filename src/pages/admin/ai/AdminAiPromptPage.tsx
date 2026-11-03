import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { unwrap, type ApiResult } from '../../../api/apiError'
import type { AiPromptDetailsDto, AiPromptSuggestionDto } from '../../../api/contracts/dtos'
import { getAiPrompt, resetAiPrompt, restoreAiPrompt, saveAiPrompt, suggestAiPrompt } from '../../../api/services/aiService'
import { Button } from '../../../components/ui/Button'
import { dateTimeText } from '../../../components/ui/labels'
import { StatusBanner } from '../../../components/ui/StatusBanner'
import styles from '../Admin.module.css'
import aiStyles from './Ai.module.css'
import { AiStatusBar } from './AiStatusBar'

const NOTE_MAX = 200      // AiPromptVersion.NoteMaxLength
const REQUEST_MAX = 500   // SuggestAiPromptCommandValidator.RequestMaxLength

type Message = { text: string; isError: boolean } | null

/** The required fields a wording doesn't mention (same check as the API). */
const missingIn = (p: AiPromptDetailsDto, text: string) =>
  p.requiredFields.filter((f) => !text.toLowerCase().includes(f.toLowerCase()))

/**
 * Admin → AI → one prompt (/admin/ai/prompts/:key): edit the wording (one step, logged, used at once), "Ask AI to
 * rewrite" (nothing saved until you save it yourself), the version history (restore any), and reset to Phloem's
 * default. The wording must keep asking for every required answer field, or it can't be saved.
 */
export default function AdminAiPromptPage() {
  const { key = '' } = useParams()
  const query = useQuery({ queryKey: ['admin', 'ai', 'prompt', key], queryFn: async ({ signal }) => unwrap(await getAiPrompt(key, signal)) })

  if (query.isPending) return <p className="muted" aria-busy="true">Loading…</p>
  if (query.isError) {
    return (
      <div className={styles.error}>
        <Link to="/admin/ai" className={styles.back}>‹ AI</Link>
        <StatusBanner isError message={(query.error as { status?: number }).status === 404 ? "This prompt doesn't exist." : "We couldn't load this prompt."} />
        <Button small variant="outline" onClick={() => query.refetch()}>Try again</Button>
      </div>
    )
  }
  // A fresh editor per version, so a save (or restore) elsewhere resets the draft
  return <Editor key={`${query.data.key}-${query.data.version}`} prompt={query.data} />
}

function Editor({ prompt: p }: { prompt: AiPromptDetailsDto }) {
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState(p.text)
  const [note, setNote] = useState('')
  const [request, setRequest] = useState('')
  const [suggestion, setSuggestion] = useState<AiPromptSuggestionDto | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<Message>(null)
  const [shown, setShown] = useState<number | null>(null)

  const changed = draft.trim() !== p.text.trim()
  const missing = missingIn(p, draft)
  const isDefault = p.text.trim() === p.defaultText.trim()

  const refresh = async (text: string) => {
    await queryClient.invalidateQueries({ queryKey: ['admin', 'ai'] })
    setMessage({ text, isError: false })
  }

  const run = async (name: string, action: () => Promise<ApiResult<number>>,
                     done: (version: number) => string) => {
    setBusy(name); setMessage(null)
    const result = await action()
    setBusy(null)
    if (!result.ok) { setMessage({ text: result.error.displayMessage, isError: true }); return }
    await refresh(done(result.value))
  }

  const onSave = () => run('save', () => saveAiPrompt(p.key, draft.trim(), note.trim() || null),
                           (v) => `Saved as version ${v}. AI jobs use it from now on.`)
  const onRestore = (version: number) => run(`restore:${version}`, () => restoreAiPrompt(p.key, version),
                                             (v) => `Version ${version} is back in use (saved as version ${v}).`)
  const onReset = () => run('reset', () => resetAiPrompt(p.key), (v) => `Back to Phloem's default (saved as version ${v}).`)

  const onSuggest = async () => {
    setBusy('suggest'); setMessage(null); setSuggestion(null)
    const result = await suggestAiPrompt(p.key, draft.trim(), request.trim() || null)
    setBusy(null)
    void queryClient.invalidateQueries({ queryKey: ['admin', 'ai', 'status'] })
    if (!result.ok) { setMessage({ text: result.error.displayMessage, isError: true }); return }
    setSuggestion(result.value)
  }

  return (
    <>
      <Link to="/admin/ai" className={styles.back}>‹ AI</Link>
      <h1 className={styles.title}>{p.name}</h1>
      <p className="muted" style={{ marginTop: 0 }}>{p.description}</p>
      <AiStatusBar />
      <StatusBanner message={message?.text} isError={message?.isError} />

      <div className={aiStyles.layout}>
        <div>
          {/* ── Wording ── */}
          <section className={styles.panel} aria-labelledby="wording-title">
            <h2 id="wording-title" className={styles.sectionTitle} style={{ margin: 0 }}>
              Wording <span className="muted">· {p.version === 0 ? "Phloem's default" : `version ${p.version}`}</span>
            </h2>
            <textarea className={aiStyles.editor} value={draft} maxLength={p.maxLength} spellCheck
                      aria-label="Prompt wording" onChange={(e) => setDraft(e.target.value)} />
            <div className={aiStyles.editorFoot}>
              <span>{draft.length.toLocaleString('en-GB')} / {p.maxLength.toLocaleString('en-GB')} characters</span>
              {missing.length > 0 && <span role="alert">It must still ask for: {missing.join(', ')}</span>}
            </div>
            <input className={aiStyles.note} value={note} maxLength={NOTE_MAX} onChange={(e) => setNote(e.target.value)}
                   placeholder="What changed and why (optional, shown in the history)" aria-label="Note" />
            <div className={aiStyles.buttons}>
              <Button variant="cta" busy={busy === 'save'} busyText="Saving…" disabled={!changed || missing.length > 0 || !!busy}
                      onClick={() => void onSave()}>Save and use now</Button>
              <Button variant="outline" disabled={!changed || !!busy} onClick={() => { setDraft(p.text); setNote('') }}>Undo my changes</Button>
              {!isDefault && (
                <Button variant="outline" busy={busy === 'reset'} busyText="Resetting…" disabled={!!busy}
                        onClick={() => void onReset()}>Reset to Phloem's default</Button>
              )}
            </div>
            <p className={aiStyles.small}>Saving is one step and recorded in the audit log. Every earlier wording stays below and can be brought back.</p>
          </section>

          {/* ── Ask AI to rewrite ── */}
          <section className={styles.panel} aria-labelledby="rewrite-title">
            <h2 id="rewrite-title" className={styles.sectionTitle} style={{ margin: 0 }}>Ask AI to rewrite</h2>
            <p className={aiStyles.small}>Rewrites the wording in the editor above. Nothing is saved: you check it, use it, then save.</p>
            <input className={aiStyles.note} value={request} maxLength={REQUEST_MAX} onChange={(e) => setRequest(e.target.value)}
                   placeholder="What should change? e.g. Make titles shorter (blank = just make it clearer)" aria-label="What to change" />
            <div className={aiStyles.buttons}>
              <Button variant="secondary" busy={busy === 'suggest'} busyText="Asking…" disabled={!draft.trim() || !!busy}
                      onClick={() => void onSuggest()}>✨ Suggest a wording</Button>
            </div>
            {suggestion && (
              <div className={aiStyles.suggestion}>
                {suggestion.summary && <p style={{ margin: 0 }}><strong>What changed:</strong> {suggestion.summary}</p>}
                {suggestion.missingFields.length > 0 && (
                  <p className={aiStyles.small} role="alert">
                    It forgot: {suggestion.missingFields.join(', ')}. Add them back before saving.
                  </p>
                )}
                <pre className={aiStyles.code}>{suggestion.text}</pre>
                <div className={aiStyles.buttons}>
                  <Button small variant="cta" onClick={() => { setDraft(suggestion.text); setSuggestion(null); setMessage({ text: 'Put in the editor. Check it, then save.', isError: false }) }}>
                    Put it in the editor
                  </Button>
                  <Button small variant="outline" onClick={() => setSuggestion(null)}>Discard</Button>
                </div>
              </div>
            )}
          </section>
        </div>

        <aside>
          {/* ── What the job gets and must answer ── */}
          <section className={styles.panel} aria-labelledby="job-title">
            <h2 id="job-title" className={styles.sectionTitle} style={{ margin: 0 }}>How this job works</h2>
            <p className={aiStyles.small}><strong>Phloem sends:</strong> {p.inputDescription}</p>
            <p className={aiStyles.small}><strong>The answer must have:</strong></p>
            <ul className={aiStyles.fields}>
              {p.requiredFields.map((f) => <li key={f} className={missing.includes(f) ? aiStyles.missing : undefined}>{f}</li>)}
            </ul>
            <p className={aiStyles.small}><strong>A correct answer looks like:</strong></p>
            <pre className={aiStyles.code}>{pretty(p.sampleAnswer)}</pre>
          </section>

          {/* ── History ── */}
          <section className={styles.panel} aria-labelledby="history-title">
            <h2 id="history-title" className={styles.sectionTitle} style={{ margin: 0 }}>History</h2>
            {p.versions.length === 0 ? (
              <p className={aiStyles.small}>Never changed: Phloem's default wording is in use.</p>
            ) : (
              <ul className={aiStyles.versions}>
                {p.versions.map((v) => (
                  <li key={v.version}>
                    <span className={aiStyles.versionHead}>
                      <strong>Version {v.version}{v.version === p.version && ' (in use)'}</strong>
                      <span>
                        <button type="button" className={aiStyles.link} onClick={() => setShown(shown === v.version ? null : v.version)}>
                          {shown === v.version ? 'Hide' : 'Show'}
                        </button>
                        {v.version !== p.version && (
                          <>{' · '}
                            <button type="button" className={aiStyles.link} disabled={!!busy}
                                    onClick={() => void onRestore(v.version)}>
                              {busy === `restore:${v.version}` ? 'Restoring…' : 'Restore'}
                            </button>
                          </>
                        )}
                      </span>
                    </span>
                    <span className="muted">{v.savedBy} · {dateTimeText(v.savedAt)}</span>
                    {v.note && <span>{v.note}</span>}
                    {shown === v.version && <pre className={aiStyles.code}>{v.text}</pre>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </>
  )
}

/** The sample answer, indented (as written when it isn't valid JSON). */
function pretty(json: string): string {
  try { return JSON.stringify(JSON.parse(json), null, 2) } catch { return json }
}
