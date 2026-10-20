import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { minutesAfter, OrderNotFoundError, SAMPLE_NOW, ticketsApi, type TicketDetail } from '../../lib/ordersApi'
import { Toast } from './AdminFeedback'
import { AdminHero, AdminLayout, BackArrowIcon, LoadingPanel, MessagePanel, RetryButton, TicketIcon } from './AdminLayout'
import { HeroStatus, InfoList, MailIcon, StatusBadge } from './OrdersParts'
import { fillIn, useOrdersFormat, useOrdersStrings } from './ordersStrings'

type LoadState = { status: 'loading' } | { status: 'error' } | { status: 'not-found' } | { status: 'ready'; detail: TicketDetail }

/** 7 × 7 code-like pattern: solid squares in three corners, the rest seeded by the ticket code. */
function qrCells(code: string) {
  let seed = 0
  for (const ch of code) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0
  const next = () => {
    seed = (seed * 1103515245 + 12345) >>> 0
    return seed / 2 ** 32
  }
  return Array.from({ length: 49 }, (_, i) => {
    const r = Math.floor(i / 7)
    const c = i % 7
    const corner = (r < 3 || r > 3) && (c < 3 || c > 3) && !(r > 3 && c > 3)
    return corner || next() < 0.5
  })
}

// Keyed by the ticket code so moving to another ticket starts from a fresh loading state.
export default function TicketDetailPage() {
  const { code = '' } = useParams()
  return <TicketDetailView key={code} code={code} />
}

function TicketDetailView({ code }: { code: string }) {
  const t = useOrdersStrings()
  const f = useOrdersFormat()
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)
  const cells = useMemo(() => qrCells(code), [code])

  useEffect(() => {
    let cancelled = false
    ticketsApi
      .get(code)
      .then((detail) => !cancelled && setState({ status: 'ready', detail }))
      .catch((err) => !cancelled && setState({ status: err instanceof OrderNotFoundError ? 'not-found' : 'error' }))
    return () => {
      cancelled = true
    }
  }, [code, attempt])

  const crumbs = [
    { label: t.ordersTitle, to: '/admin/orders' },
    { label: t.tabTickets, to: '/admin/tickets' },
  ]
  const backLink = (
    <Link className="ad-back" to="/admin/tickets">
      <BackArrowIcon />
      {t.backTickets}
    </Link>
  )

  if (state.status !== 'ready') {
    return (
      <AdminLayout title={t.ticketEyebrow} crumbs={[...crumbs, { label: t.ticketEyebrow }]}>
        {backLink}
        {state.status === 'loading' && <LoadingPanel label={t.loadingTicket} rows={3} />}
        {state.status === 'error' && (
          <MessagePanel
            tone="error"
            title={t.errorTickets}
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
        {state.status === 'not-found' && <MessagePanel tone="empty" title={t.ticketNotFound} text={t.notFoundText} />}
      </AdminLayout>
    )
  }

  const { ticket, event, order } = state.detail
  const past = event.startsAt < SAMPLE_NOW
  const lastScan = ticket.scans[ticket.scans.length - 1]
  const checkRows =
    ticket.status === 'checked'
      ? [
          { label: t.checkin, value: `${f.date(ticket.scans[0])} · ${t.gate} ${f.digits('2')}` },
          { label: t.scans, value: f.num(ticket.scans.length) },
          { label: t.lastScan, value: f.time(lastScan) },
        ]
      : [
          { label: t.checkin, value: ticket.status === 'cancelled' ? t.refundedTicket : past ? t.noShow : t.notChecked },
          { label: t.scans, value: f.num(0) },
          { label: t.lastScan, value: t.none },
        ]

  async function resend() {
    setBusy(true)
    try {
      await ticketsApi.resend(ticket.code)
      setNotice({ tone: 'success', text: fillIn(t.sentTicket, { email: order.customer.email }) })
    } catch {
      setNotice({ tone: 'error', text: t.failed })
    } finally {
      setBusy(false)
    }
  }

  return (
    <AdminLayout title={ticket.code} crumbs={[...crumbs, { label: ticket.code }]} revealCount={2}>
      {backLink}

      <AdminHero eyebrow={t.ticketEyebrow} title={<span dir="ltr">{ticket.code}</span>}>
        <div className="ad-hero-chips">
          <span className="ad-glass-chip">{ticket.holder}</span>
          <span className="ad-glass-chip">{event.name}</span>
          <span className="ad-glass-chip">{ticket.seat}</span>
          <HeroStatus status={ticket.status} t={t} />
        </div>
      </AdminHero>

      <div className="ad-detail-grid od-detail-grid">
        <div className="od-main">
          <div className={`od-ticket${ticket.status === 'cancelled' ? ' is-void' : ''}`} role="img" aria-label={`${t.admitOne} · ${event.name} · ${ticket.seat}`} data-scroll-reveal="">
            <div className="od-ticket-main">
              <span className="od-ticket-kicker">Hafletna · {t.admitOne}</span>
              <strong className="od-ticket-event">{event.name}</strong>
              <div className="od-ticket-facts">
                <span>
                  {t.date}
                  <strong>{f.date(event.startsAt)}</strong>
                </span>
                <span>
                  {t.venue}
                  <strong>{event.venue}</strong>
                </span>
                <span>
                  {t.cSeat}
                  <strong>{ticket.seat}</strong>
                </span>
              </div>
              <span className="od-ticket-cat">{ticket.category}</span>
            </div>
            <div className="od-ticket-stub">
              <div className="od-qr" aria-hidden="true">
                {cells.map((on, i) => (
                  <span key={i} className={on ? 'is-on' : undefined} />
                ))}
              </div>
              <span className="ad-mono" dir="ltr">
                {ticket.code}
              </span>
              <span className="od-ticket-hint">{t.scanAt}</span>
            </div>
          </div>
          <div className="od-actions">
            {ticket.status === 'valid' && !past && (
              <button type="button" className="ad-secondary" onClick={resend} disabled={busy}>
                <MailIcon />
                {t.resendTicket}
              </button>
            )}
            <Link className="ad-secondary" to={`/admin/orders/${order.id}`}>
              <TicketIcon />
              {t.viewOrder}
            </Link>
          </div>
        </div>

        <aside className="ad-detail-side">
          <section className="ad-card" aria-labelledby="holder-title" data-scroll-reveal="">
            <h2 id="holder-title" className="ad-card-h ad-card-h--bar">
              {t.ticketHolder}
            </h2>
            <InfoList
              rows={[
                { label: t.holder, value: ticket.holder },
                { label: t.email, value: order.customer.email, ltr: true },
                { label: t.purchased, value: f.date(order.placedAt) },
                {
                  label: t.orderRef,
                  value: (
                    <Link className="ad-mono" to={`/admin/orders/${order.id}`}>
                      {order.id}
                    </Link>
                  ),
                  ltr: true,
                },
              ]}
            />
          </section>
          <section className="ad-card" aria-labelledby="checkin-title">
            <div className="ad-card-head ad-card-head--tight">
              <h2 id="checkin-title" className="ad-card-h">
                {t.checkin}
              </h2>
              <StatusBadge status={ticket.status} t={t} />
            </div>
            <InfoList rows={[...checkRows, { label: t.doorsOpen, value: f.time(minutesAfter(event.startsAt, -60)) }]} />
          </section>
        </aside>
      </div>

      {notice && (
        <Toast key={notice.text} tone={notice.tone} message={notice.text} dismissLabel={t.dismiss} onDismiss={() => setNotice(null)} />
      )}
    </AdminLayout>
  )
}
