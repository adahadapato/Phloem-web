import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { unwrap, type ApiResult } from '../../../api/apiError'
import type { AiPromptDetailsDto, AiPromptSuggestionDto, AiPromptVersionDto } from '../../../api/contracts/dtos'
import {
  getAiPrompt, getAiPrompts, resetAiPrompt, restoreAiPrompt, saveAiPrompt, suggestAiPrompt,
} from '../../../api/services/aiService'
import { Button } from '../../../components/ui/Button'
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog'
import { dateTimeText } from '../../../components/ui/labels'
import { StatusBanner } from '../../../components/ui/StatusBanner'
import styles from './Ai.module.css'
import { AiStatusBar } from './AiStatusBar'

const NOTE_MAX = 200      // AiPromptVersion.NoteMaxLength
const REQUEST_MAX = 500   // SuggestAiPromptCommandValidator.RequestMaxLength

/** Ready-made requests for "Ask AI to improve this prompt" (one click fills the box). */
const IDEAS = [
  'Make it shorter and clearer without losing any rules',
  'Use British English spelling throughout',
  'Keep titles under 55 characters',
  'Sound friendlier, like a local food guide',
]

type Confirm =
  | { kind: 'reset' }
  | { kind: 'restore'; version: AiPromptVersionDto }
  | { kind: 'switch'; key: string }
  | null

type Message = { text: string; isError: boolean } | null

/** The answer fields a wording doesn't mention (same check as the API). */
const missingIn = (fields: string[], text: string) => fields.filter((f) => !text.toLowerCase().includes(f.toLowerCase()))

/**
 * Admin → AI Prompts (/admin/ai, permission ai.prompts.manage). The instructions behind every AI feature: pick one on
 * the left; on the right see what the AI receives, which answer fields the code reads, and the wording itself. Save
 * (used straight away), discard, or reset to Phloem's default; ask the AI to improve it (nothing saved until you
 * save); every saved version is kept and can be restored. The chosen prompt is in the address (?prompt=…).
 */
export default function AdminAiPage() {
  const [params, setParams] = useSearchParams()
  const prompts = useQuery({ queryKey: ['admin', 'ai', 'prompts'], queryFn: async ({ signal }) => unwrap(await getAiPrompts(signal)) })
  const [dirty, setDirty] = useState(false)
  const [confirmSwitch, setConfirmSwitch] = useState<string | null>(null)

  const selectedKey = params.get('prompt') ?? prompts.data?.[0]?.key ?? null
  const select = (key: string) => {
    if (key === selectedKey) return
    if (dirty) { setConfirmSwitch(key); return }
    setParams({ prompt: key })
  }

  return (
    <>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>AI</span>
          <h1>AI Prompts</h1>
          <p>
            The instructions behind every AI feature on Phloem. Edit them yourself or ask the AI to improve them.
            Saved changes are used straight away, and every version is kept so you can restore it.
          </p>
        </div>
        <Link to="/admin/ai/calls">AI request log ›</Link>
      </header>

      <AiStatusBar />

      {prompts.isPending && <p className="muted" aria-busy="true">Loading AI prompts…</p>}
      {prompts.isError && (
        <div className={`${styles.message} ${styles.error}`} role="alert">
          <span>We couldn't load the AI prompts.</span>
          <Button small variant="outline" onClick={() => prompts.refetch()}>Try again</Button>
        </div>
      )}
      {prompts.data && (
        <div className={styles.layout}>
          <nav className={styles.list} aria-label="AI prompts">
            {prompts.data.map((p) => (
              <button key={p.key} type="button" className={`${styles.listItem} ${p.key === selectedKey ? styles.active : ''}`}
                      aria-current={p.key === selectedKey ? 'true' : undefined} onClick={() => select(p.key)}>
                <span className={styles.listName}>{p.name}</span>
                <span className={styles.listDescription}>{p.description}</span>
                <span className={`${styles.badge} ${p.version > 0 ? styles.custom : ''}`}>
                  {p.version > 0 ? `Custom · v${p.version}` : 'Built-in default'}
                </span>
              </button>
            ))}
          </nav>

          <div className={styles.editor}>
            {selectedKey && <PromptEditor key={selectedKey} promptKey={selectedKey} onDirtyChange={setDirty} />}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmSwitch !== null}
        title="Discard unsaved changes?"
        message="You have edited this prompt without saving. Switching prompts will lose those changes."
        confirmText="Discard changes"
        danger
        onConfirm={() => { const key = confirmSwitch!; setConfirmSwitch(null); setDirty(false); setParams({ prompt: key }) }}
        onCancel={() => setConfirmSwitch(null)}
      />
    </>
  )
}

/** The right-hand side for one prompt: details, wording, Ask AI, history. */
function PromptEditor({ promptKey, onDirtyChange }: { promptKey: string; onDirtyChange: (dirty: boolean) => void }) {
  const query = useQuery({
    queryKey: ['admin', 'ai', 'prompt', promptKey],
    queryFn: async ({ signal }) => unwrap(await getAiPrompt(promptKey, signal)),
  })

  if (query.isPending) return <section className={styles.panel}><p className={styles.muted} aria-busy="true">Loading prompt…</p></section>
  if (query.isError) {
    return (
      <section className={styles.panel}>
        <StatusBanner isError message="This prompt could not be loaded." />
        <Button small variant="outline" onClick={() => query.refetch()}>Try again</Button>
      </section>
    )
  }
  // A fresh form for each saved version, so a save or restore resets the draft
  return <EditorForm key={`${query.data.key}-${query.data.version}`} prompt={query.data} onDirtyChange={onDirtyChange} />
}

function EditorForm({ prompt: p, onDirtyChange }: { prompt: AiPromptDetailsDto; onDirtyChange: (dirty: boolean) => void }) {
  const queryClient = useQueryClient()
  const [draft, setDraftState] = useState(p.text)
  const [note, setNote] = useState('')
  const [request, setRequest] = useState('')
  const [suggestion, setSuggestion] = useState<AiPromptSuggestionDto | null>(null)
  const [busy, setBusy] = useState<'save' | 'reset' | 'restore' | 'suggest' | null>(null)
  const [message, setMessage] = useState<Message>(null)
  const [open, setOpen] = useState<number | null>(null)
  const [confirm, setConfirm] = useState<Confirm>(null)

  const setDraft = (text: string) => { setDraftState(text); onDirtyChange(text.trim() !== p.text.trim()) }
  const isDirty = draft.trim() !== p.text.trim()
  const missing = missingIn(p.requiredFields, draft)
  const isCustom = p.version > 0
  const isDefault = p.text.trim() === p.defaultText.trim()

  const run = async (kind: 'save' | 'reset' | 'restore', action: () => Promise<ApiResult<number>>, done: string) => {
    setBusy(kind); setMessage(null)
    const result = await action()
    setBusy(null)
    if (!result.ok) { setMessage({ text: result.error.displayMessage, isError: true }); return }
    onDirtyChange(false)
    await queryClient.invalidateQueries({ queryKey: ['admin', 'ai'] })
    setMessage({ text: done.replace('{v}', String(result.value)), isError: false })
  }

  const onSuggest = async () => {
    setBusy('suggest'); setMessage(null); setSuggestion(null)
    const result = await suggestAiPrompt(p.key, draft.trim(), request.trim())
    setBusy(null)
    void queryClient.invalidateQueries({ queryKey: ['admin', 'ai', 'status'] })
    if (!result.ok) { setMessage({ text: result.error.displayMessage, isError: true }); return }
    setSuggestion(result.value)
  }

  const useSuggestion = () => {
    if (!suggestion) return
    setDraft(suggestion.text)
    if (!note.trim()) setNote(`AI: ${request.trim()}`.slice(0, NOTE_MAX))
    setSuggestion(null)
    setMessage({ text: 'Suggestion copied into the editor. Review it, then press Save and use.', isError: false })
  }

  const runConfirmed = () => {
    const c = confirm
    setConfirm(null)
    if (c?.kind === 'reset') void run('reset', () => resetAiPrompt(p.key), "Back to the built-in default (saved as version {v}). The AI uses it from now on.")
    if (c?.kind === 'restore') void run('restore', () => restoreAiPrompt(p.key, c.version.version), `Version ${c.version.version} restored (saved as version {v}). The AI uses it from now on.`)
  }

  return (
    <>
      {message && (
        <div className={`${styles.message} ${message.isError ? styles.error : styles.success}`} role={message.isError ? 'alert' : 'status'}>
          <div>{message.isError && <strong>Something went wrong</strong>}<p>{message.text}</p></div>
          <button type="button" aria-label="Dismiss" onClick={() => setMessage(null)}>×</button>
        </div>
      )}

      {/* ═══════════ The prompt ═══════════ */}
      <article className={styles.panel}>
        <div className={styles.panelHeading}>
          <div>
            <h2>{p.name}</h2>
            <p>{p.description}</p>
          </div>
          <span className={`${styles.badge} ${isCustom ? styles.custom : ''}`}>{isCustom ? `Custom · v${p.version}` : 'Built-in default'}</span>
        </div>

        <div className={styles.info}>
          <strong>What the AI receives with this prompt</strong>
          <p>{p.inputDescription}</p>
        </div>

        <div className={styles.info}>
          <strong>Answer format the code reads</strong>
          <div className={styles.terms}>
            {p.requiredFields.map((f) => {
              const gone = missing.includes(f)
              return (
                <span key={f} className={`${styles.term} ${gone ? styles.missing : ''}`}
                      title={gone ? 'Not in the prompt: this feature would break' : 'In the prompt'}>
                  {gone ? '✗' : '✓'} {f}
                </span>
              )
            })}
          </div>
        </div>

        <label className={styles.label} htmlFor="prompt-text">
          Prompt
          <small className={draft.length > p.maxLength ? styles.over : undefined}>
            {draft.length.toLocaleString('en-GB')} / {p.maxLength.toLocaleString('en-GB')}
          </small>
        </label>
        <textarea id="prompt-text" className={styles.textarea} value={draft} spellCheck rows={22}
                  onChange={(e) => setDraft(e.target.value)} />
        {missing.length > 0 && (
          <p className={styles.warning}>
            The code reads {missing.join(', ')} from the AI's answer. Put {missing.length === 1 ? 'it' : 'them'} back in the
            prompt before saving, or this feature would stop working.
          </p>
        )}

        <label className={styles.label} htmlFor="prompt-note">Change note <small>optional</small></label>
        <input id="prompt-note" className={styles.input} value={note} maxLength={NOTE_MAX}
               placeholder="e.g. Shorter titles for shops" onChange={(e) => setNote(e.target.value)} />

        <div className={styles.actions}>
          <Button variant="primary" busy={busy === 'save'} busyText="Saving…"
                  disabled={!isDirty || !!busy || !draft.trim() || draft.length > p.maxLength || missing.length > 0}
                  onClick={() => void run('save', () => saveAiPrompt(p.key, draft.trim(), note.trim() || null),
                                          'Saved as version {v}. The AI uses it from now on.')}>
            Save and use
          </Button>
          <Button variant="outline" disabled={!isDirty || !!busy} onClick={() => { setDraft(p.text); setNote('') }}>
            Discard changes
          </Button>
          <span className={styles.pushRight}>
            <Button variant="outline" busy={busy === 'reset'} busyText="Resetting…" disabled={isDefault || !!busy}
                    onClick={() => setConfirm({ kind: 'reset' })}>
              Reset to default
            </Button>
          </span>
        </div>
      </article>

      {/* ═══════════ Ask AI ═══════════ */}
      <article className={`${styles.panel} ${styles.assistant}`}>
        <h3>✨ Ask AI to improve this prompt</h3>
        <p className={styles.muted}>
          Describe what you want changed. The AI rewrites the prompt in the editor above and keeps the answer format.
          Nothing is saved until you press Save and use.
        </p>
        <div className={styles.ideas}>
          {IDEAS.map((idea) => <button key={idea} type="button" onClick={() => setRequest(idea)}>{idea}</button>)}
        </div>
        <textarea className={styles.input} rows={3} value={request} maxLength={REQUEST_MAX}
                  aria-label="What should change"
                  placeholder="e.g. Mention the city when the shop gives one, and never use the word 'authentic'."
                  onChange={(e) => setRequest(e.target.value)} />
        <div className={styles.actions}>
          <Button variant="primary" busy={busy === 'suggest'} busyText="Thinking…" disabled={!request.trim() || !!busy}
                  onClick={() => void onSuggest()}>Suggest a rewrite</Button>
        </div>

        {suggestion && (
          <div className={styles.suggestion}>
            <strong>What the AI changed</strong>
            <p>{suggestion.summary || 'No summary given.'}</p>
            {suggestion.missingFields.length > 0 && (
              <p className={styles.warning}>⚠ The suggestion is missing: {suggestion.missingFields.join(', ')}. Check it carefully or ask again.</p>
            )}
            <pre className={styles.code}>{suggestion.text}</pre>
            <div className={styles.actions}>
              <Button variant="primary" onClick={useSuggestion}>Put in editor</Button>
              <Button variant="outline" onClick={() => setSuggestion(null)}>Discard</Button>
            </div>
          </div>
        )}
      </article>

      {/* ═══════════ History ═══════════ */}
      <article className={styles.panel}>
        <h3>History</h3>
        {p.versions.length === 0 ? (
          <p className={styles.muted}>No saved versions yet: the AI is using the built-in default.</p>
        ) : (
          <ul className={styles.history}>
            {p.versions.map((v) => {
              const inUse = v.version === p.version
              return (
                <li key={v.version} className={inUse ? styles.active : undefined}>
                  <div className={styles.historyRow}>
                    <div>
                      <strong>Version {v.version}</strong>
                      {inUse && <span className={`${styles.badge} ${styles.custom}`}>In use</span>}
                      <span className={styles.muted}>{dateTimeText(v.savedAt)} · {v.savedBy}</span>
                      {v.note && <p>{v.note}</p>}
                    </div>
                    <div className={styles.historyActions}>
                      <Button small variant="outline" onClick={() => setOpen(open === v.version ? null : v.version)}>
                        {open === v.version ? 'Hide' : 'View'}
                      </Button>
                      {!inUse && (
                        <Button small variant="outline" disabled={!!busy} onClick={() => setConfirm({ kind: 'restore', version: v })}>
                          Restore
                        </Button>
                      )}
                    </div>
                  </div>
                  {open === v.version && <pre className={styles.code}>{v.text}</pre>}
                </li>
              )
            })}
          </ul>
        )}
      </article>

      <ConfirmDialog
        open={confirm !== null}
        title={confirm?.kind === 'restore' ? `Restore version ${confirm.version.version}?` : 'Reset to built-in default?'}
        message={confirm?.kind === 'restore'
          ? 'This version becomes the one the AI uses, saved as a new version. Nothing is deleted.'
          : 'The AI goes back to the original prompt. Your current version stays in the history, so you can restore it later.'}
        confirmText={confirm?.kind === 'restore' ? 'Restore' : 'Reset'}
        onConfirm={runConfirmed}
        onCancel={() => setConfirm(null)}
      />
    </>
  )
}
