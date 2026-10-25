import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { OrderStatus, TicketStatus } from '../../lib/ordersApi'
import { Icon } from './AdminLayout'
import type { OrdersStrings } from './ordersStrings'
import './Orders.css'

type Status = OrderStatus | TicketStatus

/** Rounded status label, same palette as the customer pages. */
export function StatusBadge({ status, t }: { status: Status; t: OrdersStrings }) {
  return (
    <span className={`od-status od-status--${status}`}>
      <span aria-hidden="true" />
      {t[status]}
    </span>
  )
}

/** The same status on the dark hero banner. */
export function HeroStatus({ status, t }: { status: Status; t: OrdersStrings }) {
  return <span className={`od-hero-status od-hero-status--${status}`}>{t[status]}</span>
}

export function OrdersTabs({ active, orders, tickets, refunds, t, fmt }: { active: 'orders' | 'tickets' | 'refunds'; orders: number; tickets: number; refunds: number; t: OrdersStrings; fmt: (n: number) => string }) {
  const tab = (key: 'orders' | 'tickets' | 'refunds', to: string, label: string, count: number) => (
    <Link to={to} className="od-tab" aria-current={active === key ? 'page' : undefined}>
      {label}
      <span className="ad-pill-count">{fmt(count)}</span>
    </Link>
  )
  return (
    <nav className="od-tabs" aria-label={t.tabsLabel}>
      {tab('orders', '/admin/orders', t.tabOrders, orders)}
      {tab('tickets', '/admin/tickets', t.tabTickets, tickets)}
      {tab('refunds', '/admin/refunds', t.tabRefunds, refunds)}
    </nav>
  )
}

export type Choice<V extends string> = { value: V; label: string; count: number }

/** Segmented status filter. */
export function StatusPills<V extends string>({ id, label, value, choices, onChange, fmt }: { id: string; label: string; value: V; choices: Choice<V>[]; onChange: (v: V) => void; fmt: (n: number) => string }) {
  return (
    <div className="ad-filter">
      <span id={id} className="ad-filter-label">
        {label}
      </span>
      <div className="ad-pills" role="group" aria-labelledby={id}>
        {choices.map((c) => (
          <button key={c.value} type="button" aria-pressed={value === c.value} onClick={() => onChange(c.value)}>
            {c.label}
            <span className="ad-pill-count">{fmt(c.count)}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

/** Filter as chips, the chosen one solid purple; a calendar icon unless `icon` says otherwise. */
export function EventChips({ id, label, value, choices, onChange, fmt, icon }: { id: string; label: string; value: string; choices: Choice<string>[]; onChange: (v: string) => void; fmt: (n: number) => string; icon?: ReactNode }) {
  return (
    <div className="ad-filter" role="group" aria-labelledby={id}>
      <span id={id} className="ad-filter-label ad-filter-label--icon">
        {icon ?? (
          <Icon size={16}>
            <rect x="3" y="4" width="18" height="17" rx="2" />
            <path d="M16 2v4M8 2v4M3 10h18" />
          </Icon>
        )}
        {label}
      </span>
      <div className="ad-chips">
        {choices.map((c) => (
          <button key={c.value} type="button" className="ad-chip" aria-pressed={value === c.value} onClick={() => onChange(c.value)}>
            {c.label}
            <span className="ad-pill-count">{fmt(c.count)}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

export function SearchBox({ id, label, placeholder, value, onChange }: { id: string; label: string; placeholder: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="ad-search">
      <label htmlFor={id} className="ad-sr-only">
        {label}
      </label>
      <Icon>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </Icon>
      <input id={id} type="search" placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  )
}

/**
 * The "Showing 3 of 12" line under a list. It updates on screen at once, but screen readers
 * hear it once typing in the search pauses, not on every keystroke.
 */
export function ListCount({ text }: { text: string }) {
  const [spoken, setSpoken] = useState(text)
  useEffect(() => {
    const id = window.setTimeout(() => setSpoken(text), 700)
    return () => window.clearTimeout(id)
  }, [text])
  return (
    <span>
      <span aria-hidden="true">{text}</span>
      <span className="ad-sr-only" role="status">
        {spoken}
      </span>
    </span>
  )
}

export function Metric({ label, value, sub, dot }: { label: string; value: string; sub: string; dot: string }) {
  return (
    <article className="ad-metric" data-scroll-reveal="">
      <span className="ad-metric-label">
        {label}
        <span className="ad-metric-dot" style={{ background: dot }} />
      </span>
      <strong>{value}</strong>
      <span>{sub}</span>
    </article>
  )
}

/** Label / value rows inside a card. */
export function InfoList({ rows }: { rows: Array<{ label: string; value: ReactNode; ltr?: boolean; mono?: boolean }> }) {
  return (
    <dl className="ad-info">
      {rows.map((r) => (
        <div key={r.label}>
          <dt>{r.label}</dt>
          <dd className={r.mono ? 'ad-mono' : undefined} dir={r.ltr || r.mono ? 'ltr' : undefined}>
            {r.value}
          </dd>
        </div>
      ))}
    </dl>
  )
}

export const MailIcon = () => (
  <Icon size={17}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="m3 7 9 6 9-6" />
  </Icon>
)

export const RefundIcon = ({ size = 17 }: { size?: number }) => (
  <Icon size={size}>
    <path d="M3 12a9 9 0 1 0 3-6.7" />
    <path d="M3 4v5h5" />
  </Icon>
)

export const AlertIcon = ({ size = 18 }: { size?: number }) => (
  <Icon size={size}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8v5" />
    <path d="M12 16h.01" />
  </Icon>
)
