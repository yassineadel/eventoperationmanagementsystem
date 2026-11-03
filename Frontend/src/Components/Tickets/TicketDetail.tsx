import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { usePreferences } from '../Auth/preferences'
import { bookingMoney, bookingNumber } from '../Booking/strings'
import { formatDate } from '../Homepage/discovery'
import Icon from '../Homepage/components/Icon'
import { events } from '../Homepage/data/events'
import { venueMapLinks } from '../Discovery/eventDetails'
import { useTickets } from './ticketsContext'
import { qrPayload, ticketEligibility, type TicketRule } from './ticketsModel'
import { TicketEmpty, TicketMeta, TicketShell, TicketStatus } from './TicketParts'
import TicketQr from './TicketQr'
import { ticketsStrings, ticketRuleText } from './strings'
import { useSession } from '../Auth/sessionContext'
import { useLiveTickets } from './liveTickets'
import TicketResendEmail from './TicketResendEmail'
import TicketTransferAction from './TicketTransferAction'
import './TicketDetail.css'

const detailCopy = {
  en: {
    eyebrow: 'TICKET DETAILS', lead: 'View your ticket, entry code and event information.',
    setting: 'VENUE', atAGlance: 'EVENT INFORMATION', personal: 'Ticket details',
    personalLead: 'Attendee and ticket information.', logistics: 'Date and time',
    logisticsLead: 'Check when the event and entry begin.', address: 'Venue address',
    map: 'Open in Google Maps', date: 'Event date', start: 'Starts', doors: 'Doors open',
    details: 'TICKET DETAILS', admission: 'YOUR SAMPLE PASS', one: 'Ticket information',
    ticketId: 'TICKET REFERENCE', order: 'Order summary', activity: 'TICKET ACTIVITY',
    price: 'ORDER BREAKDOWN', prepare: 'Entry information',
    transferTag: 'TRANSFER', refundTag: 'REFUND', resendTag: 'EMAIL',
  },
  ar: {
    eyebrow: 'تفاصيل التذكرة', lead: 'اعرض تذكرتك ورمز الدخول ومعلومات الفعالية.',
    setting: 'المكان', atAGlance: 'معلومات الفعالية', personal: 'تفاصيل التذكرة',
    personalLead: 'بيانات الحاضر والتذكرة.', logistics: 'التاريخ والوقت',
    logisticsLead: 'راجع موعد بداية الفعالية وفتح الأبواب.', address: 'عنوان المكان',
    map: 'فتح الموقع في خرائط Google', date: 'تاريخ الفعالية', start: 'تبدأ', doors: 'فتح الأبواب',
    details: 'تفاصيل التذكرة', admission: 'تذكرتك التجريبية', one: 'معلومات التذكرة',
    ticketId: 'مرجع التذكرة', order: 'ملخص الطلب', activity: 'سجل التذكرة',
    price: 'تفاصيل الطلب', prepare: 'معلومات الدخول',
    transferTag: 'التحويل', refundTag: 'الاسترداد', resendTag: 'البريد الإلكتروني',
  },
}

export default function TicketDetail() {
  const { ticketId } = useParams()
  const { lang } = usePreferences()
  const { state, now, resendTicket } = useTickets()
  const [feedback, setFeedback] = useState<{ ticketId: string; value: 'sent' | TicketRule } | null>(null)
  const t = ticketsStrings[lang]
  const c = detailCopy[lang]
  // A sample ticket from this tab, or else (when signed in) one of the user's real tickets
  const sampleTicket = state.tickets.find((item) => item.id === ticketId)
  const session = useSession()
  const live = useLiveTickets(session.status === 'authenticated' && !sampleTicket)
  const ticket = sampleTicket ?? live.tickets?.find((item) => item.id === ticketId)
  if (!ticket && session.status === 'authenticated' && !live.tickets && !live.failed) return <TicketShell title={t.liveLoading} lead="" live><p role="status">{t.liveLoading}</p></TicketShell>
  if (!ticket) return <TicketShell title={t.ticketNotFound} lead={t.ticketNotFoundLead}><TicketEmpty title={t.ticketNotFound} lead={t.ticketNotFoundLead} /></TicketShell>
  const isLive = !sampleTicket
  // Real tickets: the server's QR token, which the gate scans. Only sent while the ticket can be used.
  const qrToken = isLive ? live.qrTokens[ticket.id] ?? null : null
  const transfer = ticketEligibility(ticket, 'transfer', now)
  const refund = ticketEligibility(ticket, 'refund', now)
  const qrAvailable = isLive ? qrToken !== null : qrPayload(ticket, now) !== null
  const eventDetailsAvailable = isLive || events.some((event) => event.id === ticket.event.id && event.date === ticket.event.date)
  const maps = venueMapLinks(ticket.coordinates, lang)
  const hasMap = !isLive || ticket.coordinates[0] !== 0 || ticket.coordinates[1] !== 0
  const order = state.orders.find((item) => item.reference === ticket.orderRef)
  const message = feedback?.ticketId === ticket.id ? feedback.value : null
  const locale = lang === 'ar' ? 'ar-EG' : 'en-GB'
  const date = new Date(ticket.event.date)
  const day = new Intl.DateTimeFormat(locale, { day: '2-digit', timeZone: 'Africa/Cairo' }).format(date)
  const month = new Intl.DateTimeFormat(locale, { month: 'short', timeZone: 'Africa/Cairo' }).format(date)
  const time = (value: string) => new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit', timeZone: 'Africa/Cairo' }).format(new Date(value))
  const detailPath = `/my-tickets/${encodeURIComponent(ticket.id)}`

  return <TicketShell title={`${t.ticket}: ${ticket.event.title[lang]}`} lead={c.lead} appearance="detail" live={isLive} header={
    <header className="pass-page-heading">
      <div><p className="pass-eyebrow"><span aria-hidden="true" />{c.eyebrow}</p><h1 id="tickets-detail-event-title">{ticket.event.title[lang]}</h1><p>{c.lead}</p></div>
      <div className="pass-heading-status"><TicketStatus ticket={ticket} live={isLive} /><span>{ticket.categoryName[lang]}</span></div>
    </header>
  }>
    <div className="pass-detail-grid">
      <div className="pass-story">
        <section className="pass-event-art" aria-label={`${t.ticket}: ${ticket.event.title[lang]}`}>
          <img src={ticket.event.image} alt="" width="1000" height="650" fetchPriority="high" />
          <div className="pass-art-overlay"><div className="pass-art-top"><span>{isLive ? 'HAFLETNA' : `HAFLETNA / ${t.sampleFlow}`}</span><span className="pass-art-orbit" aria-hidden="true"><Icon name="ticket" size={23} /></span></div><div className="pass-art-bottom"><div><p>{c.setting}</p><h2>{ticket.event.venue[lang]}</h2></div><div className="pass-photo-date" aria-hidden="true"><strong>{day}</strong><span>{month}</span></div></div></div>
          <div className="pass-art-ribbon"><span><Icon name="calendar" size={16} /><time dateTime={ticket.event.date}>{formatDate(ticket.event.date, lang, true)}</time></span><span><Icon name="clock" size={16} />{c.doors} <time dateTime={ticket.doorsOpenAt}>{time(ticket.doorsOpenAt)}</time></span></div>
        </section>
        <div className="tickets-panel pass-info">
          <section className="pass-personal" aria-labelledby="tickets-personal-title">
            <header className="pass-section-heading"><span className="pass-section-number" aria-hidden="true">01</span><div><p className="pass-eyebrow">{c.details}</p><h2 id="tickets-personal-title">{c.personal}</h2><p>{c.personalLead}</p></div><Icon name="ticket" size={27} /></header>
            <TicketMeta ticket={ticket} />
          </section>
          <section className="pass-logistics" aria-labelledby="tickets-plan-title">
            <header className="pass-section-heading"><span className="pass-section-number" aria-hidden="true">02</span><div><p className="pass-eyebrow">{c.atAGlance}</p><h2 id="tickets-plan-title">{c.logistics}</h2><p>{c.logisticsLead}</p></div></header>
            <dl className="pass-logistics-times"><div><span aria-hidden="true"><Icon name="calendar" size={19} /></span><dt>{c.date}</dt><dd><time dateTime={ticket.event.date}>{formatDate(ticket.event.date, lang)}</time></dd></div><div><span aria-hidden="true"><Icon name="clock" size={19} /></span><dt>{t.doors}</dt><dd><time dateTime={ticket.doorsOpenAt}>{formatDate(ticket.doorsOpenAt, lang, true)}</time></dd></div></dl>
          </section>
          <div className="pass-venue-card"><span className="pass-venue-pin" aria-hidden="true"><Icon name="pin" size={24} /></span><div><p>{c.address}</p><h3>{ticket.event.venue[lang]}</h3><p>{ticket.venueAddress[lang]}</p>{hasMap && <a className="home-text-link" href={maps.external} target="_blank" rel="noreferrer">{c.map}<Icon name="arrow" size={16} /></a>}</div><span className="pass-venue-contours" aria-hidden="true" /></div>
          <div className="pass-logistics-footer"><p>{t.localTime}</p>{eventDetailsAvailable && <Link className="home-text-link" to={`/events/${encodeURIComponent(ticket.event.id)}`}>{t.viewEvent}<Icon name="arrow" size={16} /></Link>}</div>
        </div>
      </div>
      <aside className="tickets-pass pass-collectible" aria-labelledby="tickets-pass-title">
        <header className="pass-collectible-head"><div className="pass-brand-line"><span><Icon name="ticket" size={21} />{lang === 'ar' ? 'حفلتنا' : 'Hafletna'}</span>{!isLive && <span>{t.sampleFlow}</span>}</div><p className="pass-collectible-eyebrow">{isLive ? t.livePass : c.admission}</p><h2 id="tickets-pass-title">{ticket.event.title[lang]}</h2><TicketStatus ticket={ticket} live={isLive} /></header>
        <div className="pass-collectible-body"><p className="tickets-pass-label">{isLive ? t.liveQrLead : t.qrLead}</p>{qrAvailable ? <div className="tickets-pass-qr"><TicketQr ticket={ticket} value={qrToken ?? undefined} /></div> : <div className="tickets-qr-placeholder"><Icon name="lock" size={38} /><p>{t.qrUnavailable}</p></div>}<p className="pass-serial-label">{c.ticketId}</p><strong className="tickets-pass-code" dir="ltr">{ticket.id}</strong><p className="tickets-pass-warning">{isLive ? t.liveQrWarning : t.qrWarning}</p></div>
        <div className="pass-collectible-stub"><div className="pass-stub-date"><strong>{day}</strong><span>{month}</span></div><div className="pass-stub-holder"><span>{t.attendee}</span><strong><bdi>{ticket.attendeeName || t.sampleNames}</bdi></strong><p>{ticket.categoryName[lang]}{ticket.seat && <> · {t.row} <bdi>{ticket.seat.row}</bdi> · {t.seat} {bookingNumber(ticket.seat.number, lang)}</>}</p><time dateTime={ticket.event.date}>{formatDate(ticket.event.date, lang, true)}</time></div></div>
        <footer className="pass-collectible-footer"><Icon name="lock" size={13} /><span>{isLive ? `${t.liveQrHeading} · ${t.liveNoCharge}` : `${t.qrHeading} · ${t.noCharge}`}</span></footer>
      </aside>
    </div>
    
    {isLive && <section className="pass-action-grid pass-live-actions" aria-label={t.orderDetails}>
      <TicketTransferAction ticket={ticket} />
      <TicketResendEmail key={`${session.user?.id}:${ticket.id}`} ticketId={ticket.id} available={qrAvailable} />
      <article className="pass-action-card"><span className="pass-action-icon" aria-hidden="true"><Icon name="ticket" size={25} /></span><h3>{t.orderDetails}</h3><p>{t.liveOrderLead}</p><Link className="pass-action-link" to={`/orders/${encodeURIComponent(ticket.orderRef)}/confirmation`}>{t.orderDetails}<Icon name="arrow" size={17} /></Link></article>
    </section>}
    {/* Refund and the sample order breakdown remain separate previews. */}
    {!isLive && <><section className="pass-management" aria-labelledby="tickets-manage-title">
      <header className="pass-section-heading"><span className="pass-section-number" aria-hidden="true">03</span><div><p className="pass-eyebrow">{t.tickets}</p><h2 id="tickets-manage-title">{t.manage}</h2><p>{t.manageLead}</p></div></header>
      <div className="pass-action-grid">
        <article className={`pass-action-card${!transfer.allowed ? ' is-unavailable' : ''}`}><span className="pass-action-icon" aria-hidden="true"><Icon name="conferences" size={25} /></span><p className="pass-action-kicker">{c.transferTag}</p><h3>{t.transfer}</h3><p>{transfer.allowed ? t.transferLead : ticketRuleText(transfer.reason, lang)}</p>{transfer.allowed ? <Link className="pass-action-link" to={`${detailPath}/transfer`}>{t.transfer}<Icon name="arrow" size={17} /></Link> : <button className="pass-action-link" type="button" disabled>{t.transfer}<Icon name="lock" size={16} /></button>}</article>
        <article className={`pass-action-card${!refund.allowed ? ' is-unavailable' : ''}`}><span className="pass-action-icon" aria-hidden="true"><Icon name="ticket" size={25} /></span><p className="pass-action-kicker">{c.refundTag}</p><h3>{t.refund}</h3><p>{refund.allowed ? t.refundLead : ticketRuleText(refund.reason, lang)}</p>{refund.allowed ? <Link className="pass-action-link" to={`${detailPath}/refund`}>{t.refund}<Icon name="arrow" size={17} /></Link> : <button className="pass-action-link" type="button" disabled>{t.refund}<Icon name="lock" size={16} /></button>}</article>
        <article className={`pass-action-card${!qrAvailable ? ' is-unavailable' : ''}`}><span className="pass-action-icon" aria-hidden="true"><Icon name="mail" size={25} /></span><p className="pass-action-kicker">{c.resendTag}</p><h3>{t.resend}</h3><p>{qrAvailable ? t.resendLead : t.qrUnavailable}</p><button className="pass-action-link" type="button" disabled={!qrAvailable} onClick={() => { const result = resendTicket(ticket.id); setFeedback({ ticketId: ticket.id, value: result.ok ? 'sent' : result.error ?? 'not-found' }) }}>{t.resend}<Icon name="arrow" size={17} /></button></article>
      </div>
      {message && <p className={message === 'sent' ? 'tickets-success' : 'tickets-alert'} role={message === 'sent' ? 'status' : 'alert'}>{message === 'sent' ? t.resendDone : ticketRuleText(message, lang)}</p>}
    </section>
    <section className="tickets-panel pass-order-section" aria-labelledby="tickets-order-title">
      <div className="pass-price-block"><header><p className="pass-eyebrow">{c.price}</p><h2 id="tickets-order-title">{c.order}</h2></header><dl className="tickets-quote"><div><dt>{t.price}</dt><dd>{bookingMoney(ticket.price, lang)}</dd></div><div><dt>{t.fee}</dt><dd>{bookingMoney(ticket.serviceFee, lang)}</dd></div><div className="tickets-quote-total"><dt>{t.total}</dt><dd>{bookingMoney(ticket.paidTotal, lang)}</dd></div></dl><Link className="home-text-link" to={`/orders/${encodeURIComponent(ticket.orderRef)}/confirmation`}>{t.orderDetails}<Icon name="arrow" size={16} /></Link></div>
      <div className="pass-activity-block" aria-labelledby="tickets-activity-title"><header><p className="pass-eyebrow">{c.activity}</p><h2 id="tickets-activity-title">{t.timeline}</h2></header><ul className="tickets-history">{order && <li><span>{t.created}</span><time dateTime={order.createdAt}>{formatDate(order.createdAt, lang, true)}</time></li>}{ticket.transfers.map((transfer, index) => <li key={`${transfer.at}-${index}`}><span>{t.transferred}</span><time dateTime={transfer.at}>{formatDate(transfer.at, lang, true)}</time></li>)}{ticket.refund && <li><span>{t.refundRequested} · {bookingMoney(ticket.refund.amount, lang)}</span><time dateTime={ticket.refund.requestedAt}>{formatDate(ticket.refund.requestedAt, lang, true)}</time></li>}</ul></div>
    </section></>}
    <div className="pass-arrival-note"><span aria-hidden="true"><Icon name="clock" size={25} /></span><div><strong>{c.prepare}</strong><p>{t.arrive} {t.bringId}</p></div><span className="pass-arrival-flourish" aria-hidden="true">H /</span></div>{!isLive && <p className="tickets-session-note">{t.sessionNote}</p>}
  </TicketShell>
}
