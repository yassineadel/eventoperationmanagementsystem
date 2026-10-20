import { useEffect, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { usePreferences } from '../Auth/preferences'
import { bookingMoney, bookingNumber } from '../Booking/strings'
import { formatDate } from '../Homepage/discovery'
import Icon from '../Homepage/components/Icon'
import { useTickets } from './ticketsContext'
import { ticketIsPast, type SampleTicket } from './ticketsModel'
import { ticketsStrings } from './strings'
import './Tickets.css'

export function TicketShell({ title, lead, eyebrow, children, backTo = '/my-tickets', backLabel, header, appearance }: { title: string; lead: string; eyebrow?: string; children: ReactNode; backTo?: string; backLabel?: string; header?: ReactNode; appearance?: 'wallet' | 'detail' | 'confirmation' | 'action' }) {
  const { lang } = usePreferences()
  const t = ticketsStrings[lang]
  const { storageAvailable } = useTickets()
  useEffect(() => { document.title = `${title} | ${lang === 'ar' ? 'حفلتنا' : 'Hafletna'}` }, [title, lang])
  return <div className={`tickets-page home-container${appearance ? ` tickets-${appearance}-page` : ''}`}>
    <nav className="tickets-breadcrumb" aria-label={lang === 'ar' ? 'مسار الصفحة' : 'Page path'}><Link to={backTo}><Icon name="arrow" size={16} />{backLabel ?? t.backWallet}</Link><span>{t.sampleFlow}</span></nav>
    {header ?? <header className="tickets-heading"><p className="discovery-eyebrow">{eyebrow ?? t.wallet}</p><h1 className="discovery-title">{title}</h1><p>{lead}</p></header>}
    <div className="tickets-notice tickets-sample-notice" role="note"><Icon name="ticket" size={24} /><div><strong>{t.sample}</strong><p>{t.sampleLead}</p>{!storageAvailable && <p className="tickets-error">{t.storageNote}</p>}</div></div>
    {children}
  </div>
}

export function TicketEmpty({ title, lead }: { title: string; lead: string }) {
  const { lang } = usePreferences()
  const t = ticketsStrings[lang]
  return <section className="tickets-empty tickets-panel"><span className="tickets-empty-mark"><Icon name="ticket" size={38} /></span><h2>{title}</h2><p>{lead}</p><div className="tickets-actions"><Link className="home-button" to="/my-tickets">{t.wallet}<Icon name="arrow" size={17} /></Link><Link className="home-outline-button" to="/events">{t.browse}</Link></div></section>
}

export function TicketStatus({ ticket }: { ticket: SampleTicket }) {
  const { lang } = usePreferences()
  const { now } = useTickets()
  const t = ticketsStrings[lang]
  const state = ticket.status === 'active' && ticket.event.status === 'cancelled' ? 'cancelled' : ticket.status === 'active' && ticketIsPast(ticket, now) ? 'expired' : ticket.status
  const label = state === 'active' ? t.active : state === 'used' ? t.used : state === 'transferred' ? t.transferredStatus : state === 'refund-pending' ? t.refundStatus : state === 'refunded' ? t.refunded : state === 'cancelled' ? t.cancelled : t.expired
  return <span className={`tickets-status tickets-status--${state}`}><span aria-hidden="true" />{label}</span>
}

export function TicketMeta({ ticket }: { ticket: SampleTicket }) {
  const { lang } = usePreferences()
  const t = ticketsStrings[lang]
  return <dl className="tickets-facts"><div><dt>{t.attendee}</dt><dd><bdi>{ticket.attendeeName || t.sampleNames}</bdi></dd></div><div><dt>{t.category}</dt><dd>{ticket.categoryName[lang]}</dd></div>{ticket.seat ? <><div><dt>{t.row}</dt><dd><bdi>{ticket.seat.row}</bdi></dd></div><div><dt>{t.seat}</dt><dd>{bookingNumber(ticket.seat.number, lang)}</dd></div></> : <div><dt>{t.section}</dt><dd>{t.standing}</dd></div>}</dl>
}

export function TicketEventSummary({ ticket }: { ticket: SampleTicket }) {
  const { lang } = usePreferences()
  const t = ticketsStrings[lang]
  return <aside className="tickets-event-summary tickets-panel"><div className="tickets-summary-photo"><img src={ticket.event.image} alt="" width="640" height="360" /><span>{t.sampleFlow}</span></div><div className="tickets-summary-content"><TicketStatus ticket={ticket} /><h2>{ticket.event.title[lang]}</h2><p className="tickets-icon-line"><Icon name="calendar" size={16} /><time dateTime={ticket.event.date}>{formatDate(ticket.event.date, lang, true)}</time></p><p className="tickets-icon-line"><Icon name="pin" size={16} />{ticket.event.venue[lang]}</p><div className="tickets-perforation" aria-hidden="true" /><TicketMeta ticket={ticket} /><dl className="tickets-quote"><div><dt>{t.price}</dt><dd>{bookingMoney(ticket.price, lang)}</dd></div><div><dt>{t.fee}</dt><dd>{bookingMoney(ticket.serviceFee, lang)}</dd></div><div className="tickets-quote-total"><dt>{t.total}</dt><dd>{bookingMoney(ticket.paidTotal, lang)}</dd></div></dl><Link className="home-text-link" to={`/my-tickets/${encodeURIComponent(ticket.id)}`}>{t.viewTicket}<Icon name="arrow" size={16} /></Link></div></aside>
}

export function WalletTicketCard({ ticket }: { ticket: SampleTicket }) {
  const { lang } = usePreferences()
  const { now } = useTickets()
  const t = ticketsStrings[lang]
  const date = new Date(ticket.event.date)
  return <article className={`tickets-wallet-card${ticketIsPast(ticket, now) ? ' is-archived' : ''}`}>
    <div className="tickets-card-photo"><img src={ticket.event.image} alt="" width="700" height="500" loading="lazy" /><div className="tickets-date-stamp"><strong>{new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-GB', { day: '2-digit', timeZone: 'Africa/Cairo' }).format(date)}</strong><span>{new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-GB', { month: 'short', timeZone: 'Africa/Cairo' }).format(date)}</span></div><span className="tickets-card-sample">{t.sampleFlow}</span></div>
    <div className="tickets-card-content"><div className="tickets-card-topline"><TicketStatus ticket={ticket} /><time dateTime={ticket.event.date}>{new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-GB', { hour: 'numeric', minute: '2-digit', timeZone: 'Africa/Cairo' }).format(date)}</time></div><h2><Link to={`/my-tickets/${encodeURIComponent(ticket.id)}`}>{ticket.event.title[lang]}</Link></h2><p className="tickets-icon-line"><Icon name="pin" size={16} />{ticket.event.venue[lang]}</p><p className="tickets-card-category">{ticket.categoryName[lang]}{ticket.seat && <> · {t.row} <bdi>{ticket.seat.row}</bdi> · {t.seat} {bookingNumber(ticket.seat.number, lang)}</>}</p><div className="tickets-card-bottom"><span><small>{t.attendee}</small><bdi>{ticket.attendeeName || t.sampleNames}</bdi></span><Link className="tickets-circle-link" to={`/my-tickets/${encodeURIComponent(ticket.id)}`} aria-label={`${t.viewTicket}: ${ticket.event.title[lang]}, ${ticket.id}`}><Icon name="arrow" size={21} /></Link></div></div>
  </article>
}
