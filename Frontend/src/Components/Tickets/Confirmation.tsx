import { Link, useParams } from 'react-router-dom'
import { usePreferences } from '../Auth/preferences'
import { bookingMoney, bookingNumber, bookingStrings } from '../Booking/strings'
import { paymentMethodName } from '../Booking/paymentOptions'
import { formatDate } from '../Homepage/discovery'
import Icon from '../Homepage/components/Icon'
import { useTickets } from './ticketsContext'
import { TicketEmpty, TicketShell, TicketStatus } from './TicketParts'
import { ticketsStrings } from './strings'
import './Confirmation.css'

const confirmationCopy = {
  en: {
    eyebrow: 'ORDER CONFIRMATION', heading: 'Order confirmation',
    receipt: 'YOUR BOOKING RECEIPT', receiptTitle: 'Order summary',
    preview: 'Sample booking complete', experience: 'EVENT',
    tickets: 'TICKETS', next: 'NEXT STEPS',
    wallet: 'Find your tickets', pass: 'Open ticket details', manage: 'Manage your tickets',
  },
  ar: {
    eyebrow: 'تأكيد الطلب', heading: 'تأكيد الطلب',
    receipt: 'إيصال الحجز', receiptTitle: 'ملخص الطلب',
    preview: 'اكتمل الحجز التجريبي', experience: 'الفعالية',
    tickets: 'مجموعة تذاكرك', next: 'الخطوات التالية',
    wallet: 'اعثر على تذاكرك', pass: 'افتح تفاصيل التذكرة', manage: 'إدارة تذاكرك',
  },
}

export default function Confirmation() {
  const { orderRef } = useParams()
  const { lang } = usePreferences()
  const { state } = useTickets()
  const t = ticketsStrings[lang]
  const c = confirmationCopy[lang]
  const order = state.orders.find((item) => item.reference === orderRef)
  if (!order) return <TicketShell title={t.orderNotFound} lead={t.orderNotFoundLead}><TicketEmpty title={t.orderNotFound} lead={t.orderNotFoundLead} /></TicketShell>
  const tickets = order.ticketIds.flatMap((id) => state.tickets.find((ticket) => ticket.id === id) ?? [])
  const locale = lang === 'ar' ? 'ar-EG' : 'en-GB'
  const eventDate = new Date(order.event.date)
  const day = new Intl.DateTimeFormat(locale, { day: '2-digit', timeZone: 'Africa/Cairo' }).format(eventDate)
  const month = new Intl.DateTimeFormat(locale, { month: 'short', timeZone: 'Africa/Cairo' }).format(eventDate)

  return <TicketShell title={t.confirmedTitle} lead={t.confirmedLead} appearance="confirmation" header={
    <header className="oc-heading">
      <span className="oc-check" aria-hidden="true"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 4 4L19 6" /></svg></span>
      <div><p className="oc-eyebrow">{c.eyebrow}</p><h1>{c.heading}</h1><p className="oc-lead">{t.confirmedLead}</p></div>
    </header>
  }>
    <div className="oc-layout">
      <div className="oc-story">
        <section className="tickets-confirm-hero oc-event" aria-labelledby="tickets-confirm-title">
          <img src={order.event.image} alt="" width="1000" height="650" fetchPriority="high" />
          <div className="oc-event-top"><span>HAFLETNA / {c.experience}</span><span className="oc-photo-date" aria-hidden="true"><strong>{day}</strong><span>{month}</span></span></div>
          <div className="oc-event-copy"><p>{t.sampleFlow}</p><h2 id="tickets-confirm-title">{order.event.title[lang]}</h2><div className="oc-event-meta"><span><Icon name="calendar" size={16} /><time dateTime={order.event.date}>{formatDate(order.event.date, lang, true)}</time></span><span><Icon name="pin" size={16} />{order.event.venue[lang]}</span></div></div>
        </section>
        <section className="oc-tickets" aria-labelledby="tickets-order-list-title">
          <header className="oc-section-heading"><div><p className="oc-eyebrow">{c.tickets}</p><h2 id="tickets-order-list-title">{t.orderTickets}</h2></div><span className="oc-ticket-count" aria-label={`${t.quantity}: ${bookingNumber(order.ticketIds.length, lang)}`}><Icon name="ticket" size={20} />{bookingNumber(order.ticketIds.length, lang)}</span></header>
          <ul className="oc-ticket-list">{tickets.map((ticket, index) => <li key={ticket.id}>
            <span className="oc-ticket-number" aria-hidden="true">{bookingNumber(index + 1, lang)}</span>
            <div className="oc-ticket-info"><strong>{ticket.categoryName[lang]}</strong><p><bdi>{ticket.attendeeName || t.sampleNames}</bdi>{ticket.seat && <> · {t.row} <bdi>{ticket.seat.row}</bdi> · {t.seat} {bookingNumber(ticket.seat.number, lang)}</>}</p><TicketStatus ticket={ticket} /></div>
            <Link className="oc-open-ticket" to={`/my-tickets/${encodeURIComponent(ticket.id)}`} aria-label={`${t.viewTicket}: ${ticket.categoryName[lang]}, ${ticket.id}`}>{t.viewTicket}<Icon name="arrow" size={17} /></Link>
          </li>)}</ul>
        </section>
      </div>
      <aside className="oc-receipt" aria-labelledby="tickets-order-summary-title">
        <header className="oc-receipt-head"><div className="oc-brand"><span><Icon name="ticket" size={22} />{lang === 'ar' ? 'حفلتنا' : 'Hafletna'}</span><span className="oc-receipt-seal" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 4 4L19 6" /></svg></span></div><p className="oc-eyebrow">{c.receipt}</p><h2 id="tickets-order-summary-title">{c.receiptTitle}</h2><span className="oc-complete"><span aria-hidden="true" />{c.preview}</span></header>
        <div className="oc-receipt-body">
          <div className="oc-reference"><span>{t.orderReference}</span><strong dir="ltr">{order.reference}</strong></div>
          <dl className="oc-receipt-facts">
            <div><dt>{t.bookedOn}</dt><dd><time dateTime={order.createdAt}>{formatDate(order.createdAt, lang, true)}</time></dd></div>
            <div><dt>{t.paymentLabel}</dt><dd>{order.total === 0 ? paymentMethodName('free', lang) : t.paymentStatus}</dd></div>
            {order.paymentMethod && <div><dt>{bookingStrings[lang].paymentMethod}</dt><dd>{paymentMethodName(order.paymentMethod, lang)}</dd></div>}
            <div><dt>{t.quantity}</dt><dd>{bookingNumber(order.ticketIds.length, lang)}</dd></div>
          </dl>
        </div>
        <div className="oc-receipt-total"><dl><div><dt>{t.subtotal}</dt><dd>{bookingMoney(order.subtotal, lang)}</dd></div><div><dt>{t.serviceFees}</dt><dd>{bookingMoney(order.fees, lang)}</dd></div><div className="oc-grand-total"><dt>{t.total}</dt><dd>{bookingMoney(order.total, lang)}</dd></div></dl><p><Icon name="lock" size={14} />{t.noCharge}</p></div>
        <footer className="oc-receipt-footer"><Link className="home-button" to="/my-tickets">{t.openWallet}<Icon name="arrow" size={18} /></Link></footer>
      </aside>
    </div>
    <section className="oc-next" aria-labelledby="tickets-next-title">
      <header className="oc-section-heading"><div><p className="oc-eyebrow">{c.next}</p><h2 id="tickets-next-title">{t.nextTitle}</h2></div><Link className="home-text-link" to="/events">{t.browse}<Icon name="arrow" size={17} /></Link></header>
      <ol className="oc-next-list"><li><span aria-hidden="true">01</span><div><h3>{c.wallet}</h3><p>{t.nextWallet}</p></div></li><li><span aria-hidden="true">02</span><div><h3>{c.pass}</h3><p>{t.nextQr}</p></div></li><li><span aria-hidden="true">03</span><div><h3>{c.manage}</h3><p>{t.nextManage}</p></div></li></ol>
    </section>
    <p className="tickets-session-note">{t.sessionNote}</p>
  </TicketShell>
}
