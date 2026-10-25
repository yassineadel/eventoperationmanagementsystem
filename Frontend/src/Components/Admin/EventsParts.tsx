import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react'
import type { UserRole } from '../../lib/usersApi'
import { ModalDialog } from './AdminFeedback'
import { Icon } from './AdminLayout'
import type { Tone } from './eventRules'
import { AlertIcon } from './OrdersParts'
import './Orders.css'
import './Events.css'

/* --------------------------------------------------------------- badges */

export function Badge({ tone, label }: { tone: Tone; label: string }) {
  return (
    <span className={`od-status od-status--${tone}`}>
      <span aria-hidden="true" />
      {label}
    </span>
  )
}

/** The same badge on the dark hero banner. */
export function HeroBadge({ tone, label }: { tone: Tone; label: string }) {
  return <span className={`od-hero-status od-hero-status--${tone}`}>{label}</span>
}

export function RoleBadge({ role, label }: { role: UserRole; label: string }) {
  return <span className={`ad-kind ${role === 'admin' ? 'ad-kind--seated' : 'ev-role--user'}`}>{label}</span>
}

/* ------------------------------------------------------------- progress */

/** Sold / capacity bar. Decorative: the numbers are always shown next to it. */
export function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
  return (
    <span className="ev-progress" aria-hidden="true">
      <span style={{ width: `${pct}%` }} className={pct >= 100 ? 'is-full' : undefined} />
    </span>
  )
}

/* ---------------------------------------------------------------- icons */

export const SendIcon = ({ size = 17 }: { size?: number }) => (
  <Icon size={size}>
    <path d="m22 2-7 20-4-9-9-4z" />
    <path d="M22 2 11 13" />
  </Icon>
)

export const BlockIcon = ({ size = 17 }: { size?: number }) => (
  <Icon size={size}>
    <circle cx="12" cy="12" r="9" />
    <path d="m5.6 5.6 12.8 12.8" />
  </Icon>
)

export const ShieldIcon = ({ size = 17 }: { size?: number }) => (
  <Icon size={size}>
    <path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z" />
  </Icon>
)

export const CheckIcon = ({ size = 17 }: { size?: number }) => (
  <Icon size={size}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </Icon>
)

export const ArrowUpIcon = () => (
  <Icon size={16}>
    <path d="M12 19V5" />
    <path d="m6 11 6-6 6 6" />
  </Icon>
)

export const ArrowDownIcon = () => (
  <Icon size={16}>
    <path d="M12 5v14" />
    <path d="m6 13 6 6 6-6" />
  </Icon>
)

/* --------------------------------------------------------- reason dialog */

type ReasonProps = {
  title: string
  lead: ReactNode
  label: string
  errorText: string
  warning?: string
  icon: ReactNode
  confirmLabel: string
  busyLabel: string
  cancelLabel: string
  busy: boolean
  /** Where focus goes when the dialog closes and the control that opened it is gone. */
  returnFocus?: () => HTMLElement | null
  onCancel: () => void
  onConfirm: (reason: string) => void
}

/** Destructive action that needs a written reason: cancelling an event, blocking a user, rejecting a refund. */
export function ReasonDialog({ title, lead, label, errorText, warning, icon, confirmLabel, busyLabel, cancelLabel, busy, returnFocus, onCancel, onConfirm }: ReasonProps) {
  const id = useId()
  const fieldRef = useRef<HTMLTextAreaElement>(null)
  const [reason, setReason] = useState('')
  const [tried, setTried] = useState(0)
  const missing = !reason.trim()
  const showError = tried > 0 && missing

  // Focus after the error is on screen, so screen readers hear it with the field.
  useEffect(() => {
    if (tried) fieldRef.current?.focus()
  }, [tried])

  function submit(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    if (missing) {
      setTried((n) => n + 1)
      return
    }
    onConfirm(reason)
  }

  return (
    <ModalDialog labelledBy={`${id}-title`} describedBy={`${id}-lead`} className="od-refund" busy={busy} onCancel={onCancel} onSubmit={submit} initialFocus={fieldRef} returnFocus={returnFocus}>
      <div className="ad-dialog-head">
        <span className="ad-dialog-icon" aria-hidden="true">
          {icon}
        </span>
        <div>
          <h2 id={`${id}-title`}>{title}</h2>
          <p id={`${id}-lead`}>{lead}</p>
        </div>
      </div>
      <div className="od-refund-body">
        <div className="ad-field">
          <label htmlFor={`${id}-reason`}>
            {label}
            <span className="ad-required" aria-hidden="true">
              {' '}
              *
            </span>
          </label>
          <textarea
            ref={fieldRef}
            id={`${id}-reason`}
            rows={3}
            value={reason}
            required
            aria-invalid={showError}
            aria-describedby={showError ? `${id}-error` : undefined}
            onChange={(e) => setReason(e.target.value)}
          />
          {showError && (
            <p id={`${id}-error`} className="ad-field-error">
              {errorText}
            </p>
          )}
        </div>
        {warning && (
          <p className="od-refund-warning" role="note">
            <AlertIcon />
            <span>{warning}</span>
          </p>
        )}
      </div>
      <div className="ad-dialog-actions">
        <button type="button" className="ad-secondary" onClick={() => !busy && onCancel()} aria-disabled={busy || undefined}>
          {cancelLabel}
        </button>
        <button type="submit" className="ad-danger" aria-disabled={busy || undefined}>
          {icon}
          {busy ? busyLabel : confirmLabel}
        </button>
      </div>
    </ModalDialog>
  )
}
