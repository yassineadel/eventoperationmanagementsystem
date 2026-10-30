import { Link } from 'react-router-dom'
import { usePreferences } from '../Auth/preferences'
import { bookingMoney } from '../Booking/strings'
import { formatDate } from '../Homepage/discovery'
import Icon from '../Homepage/components/Icon'
import { TicketMeta, TicketStatus } from './TicketParts'
import type { SampleTicket } from './ticketsModel'
import { ticketsStrings } from './strings'
import './TicketActions.css'

export function TicketActionHeader({ title, lead, eyebrow, kind }: { title: string; lead: string; eyebrow: string; kind: 'transfer' | 'refund' }) {
  return <header className="ta-heading"><span className="ta-heading-icon" aria-hidden="true"><Icon name={kind === 'transfer' ? 'conferences' : 'ticket'} size={25} /></span><div><p className="ta-eyebrow">{eyebrow}</p><h1>{title}</h1><p className="ta-lead">{lead}</p></div></header>
}

export function TicketActionSummary({ ticket, live = false }: { ticket: SampleTicket; live?: boolean }) {
  const { lang } = usePreferences()
  const t = ticketsStrings[lang]
  return <aside className="ta-summary" aria-labelledby="ta-summary-title">
    <header className="ta-summary-brand"><span><Icon name="ticket" size={21} />{lang === 'ar' ? 'حفلتنا' : 'Hafletna'}</span><span>{live ? t.liveTitle : t.sampleFlow}</span></header>
    <div className="ta-summary-photo"><img src={ticket.event.image} alt="" width="640" height="360" /><div><p>{t.ticket}</p><h2 id="ta-summary-title">{ticket.event.title[lang]}</h2></div></div>
    <div className="ta-summary-body"><TicketStatus ticket={ticket} live={live} /><p className="ta-summary-line"><Icon name="calendar" size={16} /><time dateTime={ticket.event.date}>{formatDate(ticket.event.date, lang, true)}</time></p><p className="ta-summary-line"><Icon name="pin" size={16} />{ticket.event.venue[lang]}</p><div className="ta-summary-facts"><TicketMeta ticket={ticket} /></div></div>
    {!live && <div className="ta-summary-total"><dl><div><dt>{t.price}</dt><dd>{bookingMoney(ticket.price, lang)}</dd></div><div><dt>{t.fee}</dt><dd>{bookingMoney(ticket.serviceFee, lang)}</dd></div><div className="ta-summary-grand"><dt>{t.total}</dt><dd>{bookingMoney(ticket.paidTotal, lang)}</dd></div></dl></div>}
    <footer className="ta-summary-footer"><Link className="home-text-link" to={live && ticket.status === 'transferred' ? '/my-tickets' : `/my-tickets/${encodeURIComponent(ticket.id)}`}>{live && ticket.status === 'transferred' ? t.wallet : t.viewTicket}<Icon name="arrow" size={17} /></Link></footer>
  </aside>
}
