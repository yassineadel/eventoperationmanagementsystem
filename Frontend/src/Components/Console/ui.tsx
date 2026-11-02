// Small building blocks shared by every console page.
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ToastContext, type ToastKind } from './hooks'
import { num, title } from './format'

type Toast = { id: number; text: string; kind: ToastKind }
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const show = useCallback((text: string, kind: ToastKind = 'ok') => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t, { id, text, kind }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200)
  }, [])
  return <ToastContext.Provider value={show}>{children}
    <div className="cx-toasts" role="status" aria-live="polite">{toasts.map((t) => <div key={t.id} className={`cx-toast is-${t.kind}`}>{t.kind === 'ok' ? '✓' : '!'} {t.text}</div>)}</div>
  </ToastContext.Provider>
}


// ── layout pieces ──
export function PageHeader({ title, sub, back, actions }: { title: ReactNode; sub?: ReactNode; back?: { to: string; label: string }; actions?: ReactNode }) {
  return <header className="cx-page-head">
    <div>
      {back && <Link className="cx-back" to={back.to}>← {back.label}</Link>}
      <h1>{title}</h1>
      {sub && <p className="cx-sub">{sub}</p>}
    </div>
    {actions && <div className="cx-actions">{actions}</div>}
  </header>
}

export const Card = ({ title, actions, children, className = '' }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) =>
  <section className={`cx-card ${className}`}>{(title || actions) && <div className="cx-card-head">{title && <h2>{title}</h2>}{actions}</div>}{children}</section>

export const Stat = ({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: 'purple' | 'green' | 'amber' | 'red' | 'blue' }) =>
  <div className={`cx-stat${tone ? ` is-${tone}` : ''}`}><span>{label}</span><strong>{value}</strong>{hint && <small>{hint}</small>}</div>

const TONES: Record<string, string> = {
  PUBLISHED: 'green', PAID: 'green', VALID: 'green', SETTLED: 'green', APPROVED: 'blue', ACTIVE: 'green', ADMIN: 'purple',
  DRAFT: 'amber', PENDING: 'amber', SUBMITTED: 'amber', USED: 'blue', SUCCEEDED: 'green',
  CANCELLED: 'red', FAILED: 'red', REJECTED: 'red', REFUNDED: 'grey', VOID: 'grey', BLOCKED: 'red', USER: 'grey', SCANNER: 'grey', APP_ADMIN: 'purple',
}
export const Badge = ({ value, label }: { value: string; label?: string }) => <span className={`cx-badge is-${TONES[value] ?? 'grey'}`}>{label ?? title(value)}</span>

export const Progress = ({ value, max }: { value: number; max: number }) => {
  const pct = max ? Math.min(100, Math.round((value / max) * 100)) : 0
  return <div className="cx-progress" title={`${value} of ${max}`}><div style={{ width: `${pct}%` }} /><span>{num(value)} / {num(max)}</span></div>
}

export function Empty({ children = 'Nothing here yet.' }: { children?: ReactNode }) {
  return <div className="cx-empty">{children}</div>
}

export function Loading() {
  return <div className="cx-loading"><span /><span /><span /></div>
}

export function ErrorBox({ error, retry }: { error: string; retry?: () => void }) {
  return <div className="cx-error">{error}{retry && <button className="cx-btn" onClick={retry}>Try again</button>}</div>
}

export function Pager({ page, pageCount, total, onPage }: { page: number; pageCount: number; total: number; onPage: (p: number) => void }) {
  if (pageCount <= 1) return <div className="cx-pager"><span>{num(total)} result{total === 1 ? '' : 's'}</span></div>
  return <div className="cx-pager">
    <span>{num(total)} results · page {page} of {pageCount}</span>
    <div><button className="cx-btn is-ghost" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</button><button className="cx-btn is-ghost" disabled={page >= pageCount} onClick={() => onPage(page + 1)}>Next</button></div>
  </div>
}

/** Search box that waits until typing pauses */
export function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  const [text, setText] = useState(value)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  return <input className="cx-input cx-search" type="search" value={text} placeholder={placeholder}
    onChange={(e) => { setText(e.target.value); if (timer.current) clearTimeout(timer.current); const v = e.target.value; timer.current = setTimeout(() => onChange(v), 350) }} />
}

export function Tabs<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string; count?: number }[]; onChange: (v: T) => void }) {
  return <div className="cx-tabs" role="tablist">{options.map((o) =>
    <button key={o.value} role="tab" aria-selected={value === o.value} className={value === o.value ? 'is-active' : ''} onClick={() => onChange(o.value)}>
      {o.label}{o.count !== undefined && <span>{num(o.count)}</span>}
    </button>)}</div>
}

// ── dialogs ──
export function Modal({ title, children, onClose, footer, wide }: { title: string; children: ReactNode; onClose: () => void; footer?: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', esc)
    return () => document.removeEventListener('keydown', esc)
  }, [onClose])
  return <div className="cx-modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
    <div className={`cx-modal${wide ? ' is-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
      <div className="cx-modal-head"><h2>{title}</h2><button className="cx-icon-btn" onClick={onClose} aria-label="Close">✕</button></div>
      <div className="cx-modal-body">{children}</div>
      {footer && <div className="cx-modal-foot">{footer}</div>}
    </div>
  </div>
}

/** A confirm dialog; with `reason` it asks for a message (required) and passes it to onConfirm */
export function Confirm({ title, message, confirm, danger, reason, suggestions, onConfirm, onClose }: {
  title: string; message: ReactNode; confirm: string; danger?: boolean
  reason?: { label: string; placeholder?: string }; suggestions?: string[]
  onConfirm: (reason: string) => Promise<boolean | void>; onClose: () => void
}) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const go = async () => {
    setBusy(true)
    const ok = await onConfirm(text.trim())
    setBusy(false)
    if (ok !== false) onClose()
  }
  return <Modal title={title} onClose={onClose} footer={<>
    <button className="cx-btn is-ghost" onClick={onClose}>Back</button>
    <button className={`cx-btn ${danger ? 'is-danger' : 'is-primary'}`} disabled={busy || (!!reason && !text.trim())} onClick={go}>{busy ? 'Working…' : confirm}</button>
  </>}>
    <div className="cx-confirm-text">{message}</div>
    {reason && <label className="cx-field"><span>{reason.label}</span>
      <textarea className="cx-input" rows={3} value={text} placeholder={reason.placeholder} onChange={(e) => setText(e.target.value)} autoFocus />
    </label>}
    {suggestions && <div className="cx-chips">{suggestions.map((s) => <button key={s} type="button" className="cx-chip" onClick={() => setText(s)}>{s}</button>)}</div>}
  </Modal>
}

export const Field = ({ label, hint, children, wide }: { label: string; hint?: ReactNode; children: ReactNode; wide?: boolean }) =>
  <label className={`cx-field${wide ? ' is-wide' : ''}`}><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>

export const KeyValue = ({ items }: { items: [ReactNode, ReactNode][] }) =>
  <dl className="cx-kv">{items.map(([k, v], i) => <div key={i}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
