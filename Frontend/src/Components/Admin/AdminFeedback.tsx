import { useEffect, useId, useLayoutEffect, useRef, useState, type FormEvent, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { useAnnounce } from './adminAnnounce'
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

/* ----------------------------------------------------------------- modal */

type ModalProps = {
  labelledBy: string
  describedBy?: string
  role?: 'dialog' | 'alertdialog'
  className?: string
  /** While busy, Escape and clicks outside don't close the dialog. */
  busy?: boolean
  onCancel: () => void
  /** Renders the dialog as a form. */
  onSubmit?: (e: FormEvent<HTMLFormElement>) => void
  /** Where focus starts; defaults to the first control. */
  initialFocus?: RefObject<HTMLElement | null>
  /** Where focus goes when the dialog closes, when the control that opened it is gone. */
  returnFocus?: () => HTMLElement | null
  children: ReactNode
}

/**
 * Every admin dialog. Uses the native <dialog> in modal mode, so the page behind is inert
 * to the keyboard and screen readers. Focus comes back to the control that opened it,
 * or to `returnFocus` (then the page's main area) when that control no longer exists.
 */
export function ModalDialog({ labelledBy, describedBy, role = 'dialog', className, busy = false, onCancel, onSubmit, initialFocus, returnFocus, children }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const busyRef = useRef(busy)
  const cancelRef = useRef(onCancel)
  const returnRef = useRef(returnFocus)
  const startRef = useRef(initialFocus)

  useEffect(() => {
    busyRef.current = busy
    cancelRef.current = onCancel
    returnRef.current = returnFocus
  })

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    const previous = document.activeElement as HTMLElement | null
    if (!dialog.open) dialog.showModal()
    ;(startRef.current?.current ?? dialog.querySelector<HTMLElement>('input, select, textarea, button'))?.focus()
    return () => {
      if (dialog.open) dialog.close()
      const target =
        (previous?.isConnected && previous !== document.body ? previous : null) ??
        returnRef.current?.() ??
        document.querySelector<HTMLElement>('.ad-main')
      target?.focus({ preventScroll: true })
    }
  }, [])

  return (
    <dialog
      ref={ref}
      className={`ad-dialog${className ? ` ${className}` : ''}`}
      role={role}
      aria-modal="true"
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      aria-busy={busy || undefined}
      onCancel={(e) => {
        e.preventDefault()
        if (!busyRef.current) cancelRef.current()
      }}
      onClick={(e) => {
        // A click on the dialog element itself is a click on the backdrop.
        if (e.target === e.currentTarget && !busyRef.current) cancelRef.current()
      }}
    >
      {onSubmit ? (
        <form className="ad-dialog-form" onSubmit={onSubmit} noValidate>
          {children}
        </form>
      ) : (
        children
      )}
    </dialog>
  )
}

/* --------------------------------------------------------- confirm dialog */

type ConfirmProps = {
  title: string
  text: string
  details?: ReactNode
  confirmLabel: string
  cancelLabel: string
  busy?: boolean
  /** Defaults to the trash icon and a red button; pass tone="primary" for non-destructive actions. */
  icon?: ReactNode
  tone?: 'danger' | 'primary'
  returnFocus?: () => HTMLElement | null
  onConfirm: () => void
  onCancel: () => void
}

/** Asks before an action. Focus starts on Cancel; while busy, nothing closes it. */
export function ConfirmDialog({ title, text, details, confirmLabel, cancelLabel, busy = false, icon, tone = 'danger', returnFocus, onConfirm, onCancel }: ConfirmProps) {
  const id = useId()
  const cancelRef = useRef<HTMLButtonElement>(null)

  return (
    <ModalDialog
      labelledBy={`${id}-title`}
      describedBy={`${id}-text`}
      role="alertdialog"
      className={tone === 'primary' ? 'ad-dialog--primary' : undefined}
      busy={busy}
      onCancel={onCancel}
      initialFocus={cancelRef}
      returnFocus={returnFocus}
    >
      <div className="ad-dialog-head">
        <span className="ad-dialog-icon" aria-hidden="true">
          {icon ?? <TrashIcon size={22} />}
        </span>
        <div>
          <h2 id={`${id}-title`}>{title}</h2>
          <p id={`${id}-text`}>{text}</p>
        </div>
      </div>
      {details && <div className="ad-dialog-details">{details}</div>}
      <div className="ad-dialog-actions">
        <button ref={cancelRef} type="button" className="ad-secondary" onClick={() => !busy && onCancel()} aria-disabled={busy || undefined}>
          {cancelLabel}
        </button>
        <button
          type="button"
          className={tone === 'danger' ? 'ad-danger' : 'ad-primary'}
          onClick={() => !busy && onConfirm()}
          aria-disabled={busy || undefined}
        >
          {icon ?? <TrashIcon />}
          {confirmLabel}
        </button>
      </div>
    </ModalDialog>
  )
}

/* ------------------------------------------------------------------ toast */

type ToastProps = {
  message: string
  actionLabel?: string
  onAction?: () => void
  dismissLabel: string
  onDismiss: () => void
  tone?: 'success' | 'error' | 'info'
  /** Move focus to the action (Undo) so keyboard users can reach it at once. */
  focusAction?: boolean
}

/**
 * Status message in the top corner. It is announced through the console's live region,
 * waits while the pointer or focus is on it, and stays longer when it offers an action.
 * While a dialog is open the page behind it is inert, so the message shows inside the
 * dialog instead, as an alert. Escape or the close button dismisses it and puts focus
 * back where it was.
 */
export function Toast({ message, actionLabel, onAction, dismissLabel, onDismiss, tone = 'success', focusAction = false }: ToastProps) {
  const announce = useAnnounce()
  const dismissRef = useRef(onDismiss)
  const actionRef = useRef<HTMLButtonElement>(null)
  const toastRef = useRef<HTMLDivElement>(null)
  const returnRef = useRef<HTMLElement | null>(null)
  const [paused, setPaused] = useState(false)
  // Where the message shows: undefined until checked, null for the page, or the open dialog.
  const [host, setHost] = useState<HTMLDialogElement | null | undefined>(undefined)
  const hasAction = Boolean(actionLabel && onAction)

  useEffect(() => {
    dismissRef.current = onDismiss
  })

  // Checked after the commit, so a dialog closing in the same update doesn't count.
  useLayoutEffect(() => {
    const active = document.activeElement
    returnRef.current = active instanceof HTMLElement && active !== document.body ? active : null
    let live = true
    queueMicrotask(() => live && setHost(document.querySelector<HTMLDialogElement>('dialog[open]')))
    return () => {
      live = false
    }
  }, [])

  // Inside a dialog the message is an alert of its own; on the page it goes through the live region.
  useEffect(() => {
    if (host === null) announce(message, tone === 'error' ? 'assertive' : 'polite')
  }, [announce, message, tone, host])

  useEffect(() => {
    if (focusAction) actionRef.current?.focus()
  }, [focusAction])

  useEffect(() => {
    if (paused) return
    const timer = window.setTimeout(() => dismissRef.current(), hasAction ? 20_000 : 7000)
    return () => window.clearTimeout(timer)
  }, [message, paused, hasAction])

  function dismiss() {
    const inside = document.activeElement instanceof Node && toastRef.current?.contains(document.activeElement)
    onDismiss()
    if (!inside) return
    const back = returnRef.current?.isConnected ? returnRef.current : null
    ;(back ?? host?.querySelector<HTMLElement>('input, select, textarea, button') ?? document.querySelector<HTMLElement>('.ad-main'))?.focus({ preventScroll: true })
  }

  const toast = (
    <div
      ref={toastRef}
      className={`ad-toast ad-toast--${tone}${host ? ' ad-toast--inline' : ''}`}
      role={host ? (tone === 'error' ? 'alert' : 'status') : undefined}
      onKeyDown={(e) => {
        if (e.key !== 'Escape') return
        e.preventDefault()
        e.stopPropagation()
        dismiss()
      }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setPaused(false)}
    >
      <span className="ad-toast-icon" aria-hidden="true">
        {tone === 'success' ? (
          <Icon size={15}>
            <path d="m5 12.5 4.5 4.5L19 7.5" />
          </Icon>
        ) : tone === 'info' ? (
          <Icon size={15}>
            <path d="M12 11v5" />
            <path d="M12 8h.01" />
          </Icon>
        ) : (
          <Icon size={15}>
            <path d="M12 8v5" />
            <path d="M12 16h.01" />
          </Icon>
        )}
      </span>
      <span>{message}</span>
      {hasAction && (
        <button ref={actionRef} type="button" className="ad-toast-action" onClick={onAction}>
          {actionLabel}
        </button>
      )}
      <button type="button" className="ad-toast-close" aria-label={dismissLabel} onClick={dismiss}>
        <Icon size={16}>
          <path d="M6 6l12 12M18 6 6 18" />
        </Icon>
      </button>
    </div>
  )

  return host ? createPortal(toast, host) : toast
}
