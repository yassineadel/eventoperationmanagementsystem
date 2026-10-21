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
import './TicketDetail.css'

const detailCopy = {
  en: {
    eyebrow: 'THE TICKET / THE MOMENT', lead: 'The place, the people, and every little detail. Keep it all close.',
    setting: 'THE EXPERIENCE', atAGlance: 'AT A GLANCE', personal: 'Made for the moment.',
    personalLead: 'Your name. Your spot. Your part of the story.', logistics: 'A plan worth keeping.',
    logisticsLead: 'Know the time, find the place, and enjoy the experience.', address: 'Venue address',
    map: 'Open in Google Maps', date: 'Event date', start: 'Starts', doors: 'Doors open',
    details: 'TICKET DETAILS', admission: 'YOUR SAMPLE PASS', one: 'One ticket. One story.',
    ticketId: 'TICKET REFERENCE', order: 'The details, together.', activity: 'THE PAPER TRAIL',
    price: 'ORDER BREAKDOWN', prepare: 'A little before you go.',
    transferTag: 'SHARE THE MOMENT', refundTag: 'WHEN PLANS CHANGE', resendTag: 'KEEP IT CLOSE',
  },
  ar: {
    eyebrow: 'التذكرة / اللحظة', lead: 'المكان والأصحاب وكل التفاصيل الصغيرة. احتفظ بها بين يديك.',
    setting: 'أجواء التجربة', atAGlance: 'في لمحة', personal: 'تفاصيل تخص لحظتك.',
    personalLead: 'اسمك، مكانك، ودورك في الحكاية.', logistics: 'خطة تستحق الاحتفاظ بها.',
    logisticsLead: 'اعرف الموعد، وحدد المكان، واستمتع بالتجربة.', address: 'عنوان المكان',
    map: 'فتح الموقع في خرائط Google', date: 'تاريخ الفعالية', start: 'تبدأ', doors: 'فتح الأبواب',
    details: 'تفاصيل التذكرة', admission: 'تذكرتك التجريبية', one: 'تذكرة واحدة. وحكاية تخصك.',
    ticketId: 'مرجع التذكرة', order: 'كل التفاصيل، معًا.', activity: 'سجل التفاصيل',
    price: 'تفاصيل الطلب', prepare: 'قبل أن تنطلق.',
    transferTag: 'شارك اللحظة', refundTag: 'عندما تتغير الخطط', resendTag: 'احتفظ بالتفاصيل',
  },
}

export default function TicketDetail() {
  const { ticketId } = useParams()
  const { lang } = usePreferences()
  const { state, now, resendTicket } = useTickets()
  const [feedback, setFeedback] = useState<{ ticketId: string; value: 'sent' | TicketRule } | null>(null)
  const t = ticketsStrings[lang]
  const c = detailCopy[lang]
  const ticket = state.tickets.find((item) => item.id === ticketId)
  if (!ticket) return <TicketShell title={t.ticketNotFound} lead={t.ticketNotFoundLead}><TicketEmpty title={t.ticketNotFound} lead={t.ticketNotFoundLead} /></TicketShell>
  const transfer = ticketEligibility(ticket, 'transfer', now)
  const refund = ticketEligibility(ticket, 'refund', now)
  const qrAvailable = qrPayload(ticket, now) !== null
  const eventDetailsAvailable = events.some((event) => event.id === ticket.event.id && event.date === ticket.event.date)
  const maps = venueMapLinks(ticket.coordinates, lang)
  const order = state.orders.find((item) => item.reference === ticket.orderRef)
  const message = feedback?.ticketId === ticket.id ? feedback.value : null
  const locale = lang === 'ar' ? 'ar-EG' : 'en-GB'
  const date = new Date(ticket.event.date)
  const day = new Intl.DateTimeFormat(locale, { day: '2-digit', timeZone: 'Africa/Cairo' }).format(date)
  const month = new Intl.DateTimeFormat(locale, { month: 'short', timeZone: 'Africa/Cairo' }).format(date)
  const time = (value: string) => new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit', timeZone: 'Africa/Cairo' }).format(new Date(value))
  const detailPath = `/my-tickets/${encodeURIComponent(ticket.id)}`

  return <TicketShell title={`${t.ticket}: ${ticket.event.title[lang]}`} lead={c.lead} appearance="detail" header={
    <header className="pass-page-heading">
      <div><p className="pass-eyebrow"><span aria-hidden="true" />{c.eyebrow}</p><h1 id="tickets-detail-event-title">{ticket.event.title[lang]}</h1><p>{c.lead}</p></div>
      <div className="pass-heading-status"><TicketStatus ticket={ticket} /><span>{ticket.categoryName[lang]}</span></div>
    </header>
  }>
    <div className="pass-detail-grid">
      <div className="pass-story">
        <section className="pass-event-art" aria-label={`${t.ticket}: ${ticket.event.title[lang]}`}>
          <img src={ticket.event.image} alt="" width="1000" height="650" fetchPriority="high" />
          <div className="pass-art-overlay"><div className="pass-art-top"><span>HAFLETNA / {t.sampleFlow}</span><span className="pass-art-orbit" aria-hidden="true"><Icon name="ticket" size={23} /></span></div><div className="pass-art-bottom"><div><p>{c.setting}</p><h2>{ticket.event.venue[lang]}</h2></div><div className="pass-photo-date" aria-hidden="true"><strong>{day}</strong><span>{month}</span></div></div></div>
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
          <div className="pass-venue-card"><span className="pass-venue-pin" aria-hidden="true"><Icon name="pin" size={24} /></span><div><p>{c.address}</p><h3>{ticket.event.venue[lang]}</h3><p>{ticket.venueAddress[lang]}</p><a className="home-text-link" href={maps.external} target="_blank" rel="noreferrer">{c.map}<Icon name="arrow" size={16} /></a></div><span className="pass-venue-contours" aria-hidden="true" /></div>
          <div className="pass-logistics-footer"><p>{t.localTime}</p>{eventDetailsAvailable && <Link className="home-text-link" to={`/events/${encodeURIComponent(ticket.event.id)}`}>{t.viewEvent}<Icon name="arrow" size={16} /></Link>}</div>
        </div>
      </div>
      <aside className="tickets-pass pass-collectible" aria-labelledby="tickets-pass-title">
        <header className="pass-collectible-head"><div className="pass-brand-line"><span><Icon name="ticket" size={21} />{lang === 'ar' ? 'حفلتنا' : 'Hafletna'}</span><span>{t.sampleFlow}</span></div><p className="pass-collectible-eyebrow">{c.admission}</p><h2 id="tickets-pass-title">{ticket.event.title[lang]}</h2><TicketStatus ticket={ticket} /></header>
        <div className="pass-collectible-body"><p className="tickets-pass-label">{t.qrLead}</p>{qrAvailable ? <div className="tickets-pass-qr"><TicketQr ticket={ticket} /></div> : <div className="tickets-qr-placeholder"><Icon name="lock" size={38} /><p>{t.qrUnavailable}</p></div>}<p className="pass-serial-label">{c.ticketId}</p><strong className="tickets-pass-code" dir="ltr">{ticket.id}</strong><p className="tickets-pass-warning">{t.qrWarning}</p></div>
        <div className="pass-collectible-stub"><div className="pass-stub-date"><strong>{day}</strong><span>{month}</span></div><div className="pass-stub-holder"><span>{t.attendee}</span><strong><bdi>{ticket.attendeeName || t.sampleNames}</bdi></strong><p>{ticket.categoryName[lang]}{ticket.seat && <> · {t.row} <bdi>{ticket.seat.row}</bdi> · {t.seat} {bookingNumber(ticket.seat.number, lang)}</>}</p><time dateTime={ticket.event.date}>{formatDate(ticket.event.date, lang, true)}</time></div></div>
        <footer className="pass-collectible-footer"><Icon name="lock" size={13} /><span>{t.qrHeading} · {t.noCharge}</span></footer>
      </aside>
    </div>
    <section className="pass-management" aria-labelledby="tickets-manage-title">
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
    </section>
    <div className="pass-arrival-note"><span aria-hidden="true"><Icon name="clock" size={25} /></span><div><strong>{c.prepare}</strong><p>{t.arrive} {t.bringId}</p></div><span className="pass-arrival-flourish" aria-hidden="true">H /</span></div><p className="tickets-session-note">{t.sessionNote}</p>
  </TicketShell>
}
