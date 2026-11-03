import { useEffect, useRef } from 'react'
import { Button } from './Button'
import styles from './ConfirmDialog.module.css'

/**
 * "Are you sure?" in a small window over the page (the browser's own dialog element: Esc or Cancel closes it).
 * @param open Shown when true.
 * @param title The question, e.g. "Reset to Phloem's default?".
 * @param message What will happen.
 * @param confirmText The button that goes ahead, e.g. "Reset".
 * @param danger Orange "go ahead" button for things that discard work.
 */
export function ConfirmDialog({ open, title, message, confirmText, danger, onConfirm, onCancel }: {
  open: boolean
  title: string
  message: string
  confirmText: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog ref={ref} className={styles.dialog} aria-labelledby="confirm-title"
            onCancel={(e) => { e.preventDefault(); onCancel() }}>
      <h2 id="confirm-title">{title}</h2>
      <p>{message}</p>
      <div className={styles.buttons}>
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button variant={danger ? 'cta' : 'primary'} onClick={onConfirm}>{confirmText}</Button>
      </div>
    </dialog>
  )
}
