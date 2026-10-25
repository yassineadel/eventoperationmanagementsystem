import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { minutesAfter, now } from '../../lib/adminTime'
import { OrderNotFoundError, ticketsApi } from '../../lib/ordersApi'
import { Toast } from './AdminFeedback'
import { AdminHero, AdminLayout, BackArrowIcon, ResourceStatus, TicketIcon } from './AdminLayout'
import { isolate } from './adminText'
import { useErrorText } from './errorStrings'
import { HeroStatus, InfoList, MailIcon, StatusBadge } from './OrdersParts'
import { fillIn, useOrdersFormat, useOrdersStrings } from './ordersStrings'
import { useAdminResource } from './useAdminResource'

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
  const errorText = useErrorText()
  const { state, retry } = useAdminResource(code, () => ticketsApi.get(code), (e) => e instanceof OrderNotFoundError)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string; n: number } | null>(null)
  const say = (tone: 'success' | 'error', text: string) => setNotice((prev) => ({ tone, text, n: (prev?.n ?? 0) + 1 }))
  const cells = useMemo(() => qrCells(code), [code])

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
        <ResourceStatus
          state={state}
          loading={t.loadingTicket}
          rows={3}
          errorTitle={t.errorTickets}
          errorText={t.errorText}
          retryLabel={t.tryAgain}
          onRetry={retry}
          notFoundTitle={t.ticketNotFound}
          notFoundIcon={<TicketIcon size={34} />}
          notFoundText={t.notFoundText}
        />
      </AdminLayout>
    )
  }

  const { ticket, event, order } = state.data
  const past = event.startsAt < now()
  const lastScan = ticket.scans[ticket.scans.length - 1]
  const checkRows =
    ticket.status === 'checked'
      ? [
          { label: t.checkin, value: f.date(ticket.scans[0]) },
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
      say('success', fillIn(t.sentTicket, { email: isolate(order.customer.email) }))
    } catch (error) {
      say('error', errorText(error, t.failed))
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
          <section className={`od-ticket${ticket.status === 'cancelled' ? ' is-void' : ''}`} aria-label={t.ticketCard} data-scroll-reveal="">
            <div className="od-ticket-main">
              {ticket.status === 'cancelled' && <span className="ad-sr-only">{t.refundedTicket}</span>}
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
          </section>
          <div className="od-actions">
            {ticket.status === 'valid' && !past && (
              <button type="button" className="ad-secondary" onClick={() => !busy && resend()} aria-disabled={busy || undefined}>
                <MailIcon />
                {t.resendTicket}
              </button>
            )}
            <Link className="ad-secondary" to={`/admin/orders/${order.id}`}>
              <TicketIcon />
              {t.viewOrder}
            </Link>
            <Link className="ad-secondary" to={`/admin/events/${event.eventId}`}>
              {t.viewEvent}
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
                { label: t.holder, value: <Link to={`/admin/users/${order.customer.userId}`}>{ticket.holder}</Link> },
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
        <Toast key={notice.n} tone={notice.tone} message={notice.text} dismissLabel={t.dismiss} onDismiss={() => setNotice(null)} />
      )}
    </AdminLayout>
  )
}
