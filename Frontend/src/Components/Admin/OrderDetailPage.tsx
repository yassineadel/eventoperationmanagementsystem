import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  minutesAfter,
  OrderNotFoundError,
  ordersApi,
  SAMPLE_NOW,
  type OrderDetail,
  type RefundReason,
} from '../../lib/ordersApi'
import { Toast } from './AdminFeedback'
import { AdminHero, AdminLayout, BackArrowIcon, ForwardArrowIcon, Icon, LoadingPanel, MessagePanel, RetryButton, TicketIcon } from './AdminLayout'
import { AlertIcon, HeroStatus, InfoList, MailIcon, RefundIcon, StatusBadge } from './OrdersParts'
import { fillIn, useOrdersFormat, useOrdersStrings, type OrdersStrings } from './ordersStrings'

type LoadState = { status: 'loading' } | { status: 'error' } | { status: 'not-found' } | { status: 'ready'; detail: OrderDetail }
type Notice = { tone: 'success' | 'error'; text: string }
type Step = { label: string; at: string; kind: 'done' | 'now' | 'todo' | 'fail' }

// Keyed by the order ID so moving to another order starts from a fresh loading state.
export default function OrderDetailPage() {
  const { orderId = '' } = useParams()
  return <OrderDetailView key={orderId} orderId={orderId} />
}

function OrderDetailView({ orderId }: { orderId: string }) {
  const t = useOrdersStrings()
  const f = useOrdersFormat()
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const [refunding, setRefunding] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<Notice | null>(null)

  useEffect(() => {
    let cancelled = false
    ordersApi
      .get(orderId)
      .then((detail) => !cancelled && setState({ status: 'ready', detail }))
      .catch((err) => !cancelled && setState({ status: err instanceof OrderNotFoundError ? 'not-found' : 'error' }))
    return () => {
      cancelled = true
    }
  }, [orderId, attempt])

  const backLink = (
    <Link className="ad-back" to="/admin/orders">
      <BackArrowIcon />
      {t.backOrders}
    </Link>
  )

  if (state.status !== 'ready') {
    return (
      <AdminLayout title={t.orderEyebrow} crumbs={[{ label: t.ordersTitle, to: '/admin/orders' }, { label: t.orderEyebrow }]}>
        {backLink}
        {state.status === 'loading' && <LoadingPanel label={t.loadingOrder} rows={4} />}
        {state.status === 'error' && (
          <MessagePanel
            tone="error"
            title={t.errorOrders}
            text={t.errorText}
            action={
              <RetryButton
                label={t.tryAgain}
                onClick={() => {
                  setState({ status: 'loading' })
                  setAttempt((n) => n + 1)
                }}
              />
            }
          />
        )}
        {state.status === 'not-found' && <MessagePanel tone="empty" title={t.orderNotFound} text={t.notFoundText} />}
      </AdminLayout>
    )
  }

  const { order, event, tickets } = state.detail
  const pay = order.payment

  async function run(action: () => Promise<void>, success: string) {
    setBusy(true)
    try {
      await action()
      setNotice({ tone: 'success', text: success })
    } catch {
      setNotice({ tone: 'error', text: t.failed })
    } finally {
      setBusy(false)
    }
  }

  async function refund(reason: RefundReason, note: string) {
    setBusy(true)
    try {
      const detail = await ordersApi.refund(order.id, { reason, note })
      setState({ status: 'ready', detail })
      setRefunding(false)
      setNotice({ tone: 'success', text: fillIn(t.refundDone, { id: order.id }) })
    } catch {
      setNotice({ tone: 'error', text: t.failed })
    } finally {
      setBusy(false)
    }
  }

  const payRows = [
    { label: t.method, value: pay.fawry ? `${t.fawry} ${f.digits(pay.reference)}` : pay.method },
    ...(order.reason ? [{ label: t.reason, value: t.reasons[order.reason.key] }] : []),
    ...(!pay.fawry && order.status !== 'cancelled' ? [{ label: t.transaction, value: pay.reference, mono: true }] : []),
    ...(order.status === 'cancelled' && pay.declined ? [{ label: t.payment, value: t.declined }] : []),
    ...(pay.paidAt ? [{ label: t.paidOn, value: f.date(pay.paidAt) }] : []),
    ...(pay.dueBy && order.status === 'pending' ? [{ label: t.payBy, value: f.date(pay.dueBy) }] : []),
    ...(pay.refundedAt ? [{ label: t.refundedOn, value: f.date(pay.refundedAt) }] : []),
    ...(pay.cancelledAt ? [{ label: t.cancelledOn, value: f.date(pay.cancelledAt) }] : []),
    { label: order.status === 'refunded' ? t.refundAmount : t.total, value: f.money(order.total) },
  ]

  return (
    <AdminLayout title={order.id} crumbs={[{ label: t.ordersTitle, to: '/admin/orders' }, { label: order.id }]} revealCount={4}>
      {backLink}

      <AdminHero
        eyebrow={t.orderEyebrow}
        title={<span dir="ltr">{order.id}</span>}
        action={
          <>
            {order.status === 'paid' && (
              <>
                <button
                  type="button"
                  className="ad-glass-btn"
                  disabled={busy}
                  onClick={() => run(() => ordersApi.resendTickets(order.id), fillIn(t.sentTickets, { email: order.customer.email }))}
                >
                  <MailIcon />
                  {t.resend}
                </button>
                <button type="button" className="ad-glass-btn ad-glass-btn--danger" onClick={() => setRefunding(true)}>
                  <RefundIcon />
                  {t.refund}
                </button>
              </>
            )}
            {order.status === 'pending' && (
              <button
                type="button"
                className="ad-glass-btn"
                disabled={busy}
                onClick={() => run(() => ordersApi.remindPayment(order.id), fillIn(t.sentReminder, { email: order.customer.email }))}
              >
                <MailIcon />
                {t.remind}
              </button>
            )}
          </>
        }
      >
        <div className="ad-hero-chips">
          <span className="ad-glass-chip">
            {t.placedOn} · {f.date(order.placedAt)}
          </span>
          <span className="ad-glass-chip">{order.customer.name}</span>
          <span className="ad-glass-chip">{event.name}</span>
          <HeroStatus status={order.status} t={t} />
        </div>
      </AdminHero>

      <div className="ad-detail-grid od-detail-grid">
        <div className="od-main">
          {order.reason && (
            <section className={`od-reason od-reason--${order.status}`} aria-labelledby="reason-title" data-scroll-reveal="">
              <span className="od-reason-icon" aria-hidden="true">
                <AlertIcon size={22} />
              </span>
              <div>
                <p id="reason-title" className="od-reason-kicker">
                  {order.status === 'refunded' ? t.refundDetails : t.cancelDetails}
                </p>
                <p className="od-reason-title">
                  {t.reason}: {t.reasons[order.reason.key]}
                </p>
                {order.reason.note && (
                  <p className="od-reason-note">
                    <strong>{t.note}:</strong> {f.text(order.reason.note)}
                  </p>
                )}
                <p className="od-reason-meta">
                  {t.by} {f.text(order.reason.by)} · {f.date(order.reason.at)}
                </p>
              </div>
            </section>
          )}

          <section className="ad-card" aria-labelledby="items-title" data-scroll-reveal="">
            <h2 id="items-title" className="ad-card-h ad-card-h--bar">
              {t.items}
            </h2>
            <div className="ad-table-wrap">
              <table className="ad-table">
                <thead>
                  <tr>
                    <th scope="col">{t.cCategory}</th>
                    <th scope="col" className="ad-num">
                      {t.unitPrice}
                    </th>
                    <th scope="col" className="ad-num">
                      {t.qty}
                    </th>
                    <th scope="col" className="ad-num">
                      {t.subtotal}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((it) => (
                    <tr key={it.category}>
                      <td>
                        <strong>{it.category}</strong>
                      </td>
                      <td className="ad-num">{f.money(it.unitPrice)}</td>
                      <td className="ad-num">{f.num(it.qty)}</td>
                      <td className="ad-num ad-strong">{f.money(it.unitPrice * it.qty)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <dl className="od-totals">
              <div>
                <dt>{t.subtotal}</dt>
                <dd>{f.money(order.subtotal)}</dd>
              </div>
              <div>
                <dt>{t.serviceFee}</dt>
                <dd>{f.money(order.fee)}</dd>
              </div>
              <div className="od-totals-grand">
                <dt>{t.total}</dt>
                <dd>{f.money(order.total)}</dd>
              </div>
            </dl>
          </section>

          <section className="ad-card" aria-labelledby="tickets-title" data-scroll-reveal="">
            <div className="ad-card-head ad-card-head--tight">
              <h2 id="tickets-title" className="ad-card-h">
                {t.orderTickets}
              </h2>
              <span className="ad-muted">
                {f.num(tickets.length)} {tickets.length === 1 ? t.ticketWord : t.ticketsWord}
              </span>
            </div>
            {tickets.length > 0 ? (
              <div className="ad-table-wrap">
                <table className="ad-table od-table">
                  <thead>
                    <tr>
                      <th scope="col">{t.cCode}</th>
                      <th scope="col">{t.cCategory}</th>
                      <th scope="col">{t.cSeat}</th>
                      <th scope="col">{t.cStatus}</th>
                      <th scope="col" className="ad-end">
                        {t.cActions}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {tickets.map((k) => (
                      <tr key={k.code}>
                        <td className="ad-mono" dir="ltr">
                          {k.code}
                        </td>
                        <td>{k.category}</td>
                        <td className="ad-muted">{k.seat}</td>
                        <td>
                          <StatusBadge status={k.status} t={t} />
                        </td>
                        <td className="ad-end">
                          <Link className="od-link" to={`/admin/tickets/${k.code}`} aria-label={`${t.viewTicket} ${k.code}`}>
                            {t.viewTicket}
                            <ForwardArrowIcon />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="od-empty-note">
                <span aria-hidden="true">
                  <TicketIcon size={20} />
                </span>
                {order.status === 'pending' ? t.noTicketsPending : t.noTicketsCancelled}
              </p>
            )}
          </section>
        </div>

        <aside className="ad-detail-side">
          <section className="ad-card" aria-labelledby="payment-title">
            <div className="ad-card-head ad-card-head--tight">
              <h2 id="payment-title" className="ad-card-h">
                {t.payment}
              </h2>
              <StatusBadge status={order.status} t={t} />
            </div>
            <InfoList rows={payRows} />
          </section>

          <section className="ad-card" aria-labelledby="customer-title">
            <h2 id="customer-title" className="ad-card-h ad-card-h--bar">
              {t.customer}
            </h2>
            <InfoList
              rows={[
                { label: t.cCustomer, value: order.customer.name },
                { label: t.email, value: order.customer.email, ltr: true },
                { label: t.phone, value: f.phone(order.customer.phone), ltr: true },
              ]}
            />
          </section>

          <section className="ad-card" aria-labelledby="event-title">
            <h2 id="event-title" className="ad-card-h ad-card-h--bar">
              {t.event}
            </h2>
            <InfoList
              rows={[
                { label: t.cEvent, value: event.name },
                { label: t.venue, value: event.venueId ? <Link to={`/admin/venues/${event.venueId}`}>{event.venue}</Link> : event.venue },
                { label: t.date, value: f.date(event.startsAt) },
              ]}
            />
          </section>

          <section className="ad-card" aria-labelledby="timeline-title">
            <h2 id="timeline-title" className="ad-card-h ad-card-h--bar">
              {t.timeline}
            </h2>
            <ol className="od-timeline">
              {timeline(state.detail, t, f.date).map((s) => (
                <li key={s.label} className={`od-step od-step--${s.kind}`}>
                  <span className="od-step-dot" aria-hidden="true">
                    {s.kind === 'done' && (
                      <Icon size={15}>
                        <path d="m5 12.5 4.5 4.5L19 7.5" />
                      </Icon>
                    )}
                    {(s.kind === 'now' || s.kind === 'todo') && (
                      <Icon size={15}>
                        <circle cx="12" cy="12" r="9" />
                        <path d="M12 7v5l3 2" />
                      </Icon>
                    )}
                    {s.kind === 'fail' && (
                      <Icon size={15}>
                        <path d="M6 6l12 12M18 6 6 18" />
                      </Icon>
                    )}
                  </span>
                  <span>
                    <strong>{s.label}</strong>
                    <span>{s.at}</span>
                  </span>
                </li>
              ))}
            </ol>
          </section>
        </aside>
      </div>

      {refunding && (
        <RefundDialog
          t={t}
          orderId={order.id}
          customer={order.customer.name}
          tickets={tickets.length}
          amount={f.money(order.total)}
          count={f.num(tickets.length)}
          busy={busy}
          onCancel={() => setRefunding(false)}
          onConfirm={refund}
        />
      )}

      {notice && (
        <Toast key={notice.text} tone={notice.tone} message={notice.text} dismissLabel={t.dismiss} onDismiss={() => setNotice(null)} />
      )}
    </AdminLayout>
  )
}

function timeline({ order, event }: OrderDetail, t: OrdersStrings, date: (iso: string) => string): Step[] {
  const pay = order.payment
  const placed: Step = { label: t.tPlaced, at: date(order.placedAt), kind: 'done' }
  switch (order.status) {
    case 'paid':
      return [
        placed,
        { label: t.tPaid, at: date(pay.paidAt!), kind: 'done' },
        { label: t.tIssued, at: date(pay.paidAt!), kind: 'done' },
        { label: t.tEvent, at: date(event.startsAt), kind: event.startsAt < SAMPLE_NOW ? 'done' : 'todo' },
      ]
    case 'pending':
      return [placed, { label: t.tWaiting, at: date(pay.dueBy!), kind: 'now' }, { label: t.tIssueAfter, at: '—', kind: 'todo' }]
    case 'refunded':
      return [
        placed,
        { label: t.tPaid, at: date(pay.paidAt!), kind: 'done' },
        { label: t.tIssued, at: date(pay.paidAt!), kind: 'done' },
        { label: t.tRefunded, at: date(pay.refundedAt!), kind: 'done' },
      ]
    case 'cancelled':
      return [
        placed,
        { label: t.tNotPaid, at: date(minutesAfter(order.placedAt, 2)), kind: 'fail' },
        { label: t.tCancelled, at: date(pay.cancelledAt!), kind: 'fail' },
      ]
  }
}

/* --------------------------------------------------------------- refund */

type RefundProps = {
  t: OrdersStrings
  orderId: string
  customer: string
  tickets: number
  count: string
  amount: string
  busy: boolean
  onCancel: () => void
  onConfirm: (reason: RefundReason, note: string) => void
}

function RefundDialog({ t, orderId, customer, tickets, count, amount, busy, onCancel, onConfirm }: RefundProps) {
  const id = useId()
  const boxRef = useRef<HTMLFormElement>(null)
  const firstRef = useRef<HTMLSelectElement>(null)
  const [reason, setReason] = useState<RefundReason>('customer')
  const [note, setNote] = useState('')

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    firstRef.current?.focus()
    return () => previous?.focus()
  }, [])

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape' && !busy) {
      e.stopPropagation()
      onCancel()
      return
    }
    if (e.key !== 'Tab') return
    const items = boxRef.current?.querySelectorAll<HTMLElement>('select, textarea, button:not([disabled])')
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

  function submit(e: FormEvent) {
    e.preventDefault()
    onConfirm(reason, note)
  }

  return (
    <div className="ad-overlay" onMouseDown={(e) => e.target === e.currentTarget && !busy && onCancel()}>
      <form
        ref={boxRef}
        className="ad-dialog od-refund"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        onKeyDown={onKeyDown}
        onSubmit={submit}
      >
        <div className="ad-dialog-head">
          <span className="ad-dialog-icon" aria-hidden="true">
            <RefundIcon size={22} />
          </span>
          <div>
            <h2 id={`${id}-title`}>{t.refundTitle}</h2>
            <p>
              {t.refundLead}{' '}
              <span className="ad-mono" dir="ltr">
                {orderId}
              </span>{' '}
              · {customer}
            </p>
          </div>
        </div>
        <div className="od-refund-body">
          <p className="od-refund-scope">{tickets === 1 ? t.refundOne : fillIn(t.refundAll, { n: count })}</p>
          <div className="ad-field">
            <label htmlFor={`${id}-reason`}>{t.reasonLabel}</label>
            <div className="ad-select">
              <select ref={firstRef} id={`${id}-reason`} value={reason} onChange={(e) => setReason(e.target.value as RefundReason)}>
                {(['customer', 'eventChanged', 'duplicate', 'other'] as RefundReason[]).map((r) => (
                  <option key={r} value={r}>
                    {t.reasons[r]}
                  </option>
                ))}
              </select>
              <Icon size={16}>
                <path d="m6 9 6 6 6-6" />
              </Icon>
            </div>
          </div>
          <div className="ad-field">
            <label htmlFor={`${id}-note`}>{t.noteLabel}</label>
            <textarea id={`${id}-note`} rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <div className="od-refund-amount">
            <span>{t.refundAmount}</span>
            <strong>{amount}</strong>
          </div>
          <p className="od-refund-warning" role="note">
            <AlertIcon />
            <span>{t.refundNote}</span>
          </p>
        </div>
        <div className="ad-dialog-actions">
          <button type="button" className="ad-secondary" onClick={onCancel} disabled={busy}>
            {t.cancel}
          </button>
          <button type="submit" className="ad-danger" disabled={busy}>
            <RefundIcon />
            {busy ? t.refunding : fillIn(t.confirmRefund, { amount })}
          </button>
        </div>
      </form>
    </div>
  )
}
