import { useEffect, useId, useRef, type ReactNode } from 'react'
import { Icon } from './AdminLayout'

export const TrashIcon = ({ size = 17 }: { size?: number }) => (
  <Icon size={size}>
    <path d="M3 6h18" />
    <path d="M8 6V4h8v2" />
    <path d="M19 6l-1 14H6L5 6" />
    <path d="M10 11v6M14 11v6" />
  </Icon>
)

export const PencilIcon = ({ size = 17 }: { size?: number }) => (
  <Icon size={size}>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
  </Icon>
)

export const PlusIcon = ({ size = 18 }: { size?: number }) => (
  <Icon size={size}>
    <path d="M12 5v14M5 12h14" />
  </Icon>
)

/* --------------------------------------------------------- confirm dialog */

type ConfirmProps = {
  title: string
  text: string
  details?: ReactNode
  confirmLabel: string
  cancelLabel: string
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/** Destructive confirmation: focus starts on Cancel, Escape closes, Tab stays inside. */
export function ConfirmDialog({ title, text, details, confirmLabel, cancelLabel, busy, onConfirm, onCancel }: ConfirmProps) {
  const id = useId()
  const boxRef = useRef<HTMLDivElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    cancelRef.current?.focus()
    return () => previous?.focus()
  }, [])

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.stopPropagation()
      onCancel()
      return
    }
    if (e.key !== 'Tab') return
    const items = boxRef.current?.querySelectorAll<HTMLElement>('button:not([disabled])')
    if (!items?.length) return
    const first = items[0]
    const last = items[items.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

  return (
    <div className="ad-overlay" onMouseDown={(e) => e.target === e.currentTarget && !busy && onCancel()}>
      <div
        ref={boxRef}
        className="ad-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-text`}
        onKeyDown={onKeyDown}
      >
        <div className="ad-dialog-head">
          <span className="ad-dialog-icon" aria-hidden="true">
            <TrashIcon size={22} />
          </span>
          <div>
            <h2 id={`${id}-title`}>{title}</h2>
            <p id={`${id}-text`}>{text}</p>
          </div>
        </div>
        {details && <div className="ad-dialog-details">{details}</div>}
        <div className="ad-dialog-actions">
          <button ref={cancelRef} type="button" className="ad-secondary" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </button>
          <button type="button" className="ad-danger" onClick={onConfirm} disabled={busy}>
            <TrashIcon />
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ toast */

type ToastProps = {
  message: string
  actionLabel?: string
  onAction?: () => void
  dismissLabel: string
  onDismiss: () => void
  tone?: 'success' | 'error'
}

/** Status message in the top corner; closes itself after a few seconds. */
export function Toast({ message, actionLabel, onAction, dismissLabel, onDismiss, tone = 'success' }: ToastProps) {
  const dismissRef = useRef(onDismiss)
  useEffect(() => {
    dismissRef.current = onDismiss
  })
  useEffect(() => {
    const timer = window.setTimeout(() => dismissRef.current(), 7000)
    return () => window.clearTimeout(timer)
  }, [message])

  return (
    <div className={`ad-toast ad-toast--${tone}`} role="status">
      <span className="ad-toast-icon" aria-hidden="true">
        {tone === 'success' ? (
          <Icon size={15}>
            <path d="m5 12.5 4.5 4.5L19 7.5" />
          </Icon>
        ) : (
          <Icon size={15}>
            <path d="M12 8v5" />
            <path d="M12 16h.01" />
          </Icon>
        )}
      </span>
      <span>{message}</span>
      {actionLabel && onAction && (
        <button type="button" className="ad-toast-action" onClick={onAction}>
          {actionLabel}
        </button>
      )}
      <button type="button" className="ad-toast-close" aria-label={dismissLabel} onClick={onDismiss}>
        <Icon size={16}>
          <path d="M6 6l12 12M18 6 6 18" />
        </Icon>
      </button>
    </div>
  )
}
