import { useEffect, type KeyboardEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { usePreferences } from '../Auth/preferences'
import { bookingNumber } from '../Booking/strings'
import Icon from '../Homepage/components/Icon'
import { useTickets } from './ticketsContext'
import { ticketIsPast } from './ticketsModel'
import { TicketShell, TicketStatus, WalletTicketCard } from './TicketParts'
import { ticketsStrings } from './strings'
import { formatDate } from '../Homepage/discovery'
import { useSession } from '../Auth/sessionContext'
import { useLiveTickets } from './liveTickets'
import type { SampleTicket } from './ticketsModel'
import './Wallet.css'

export default function MyTickets() {
  const { lang } = usePreferences()
  const t = ticketsStrings[lang]
  const session = useSession()
  useEffect(() => { document.title = `${t.wallet} | ${lang === 'ar' ? 'حفلتنا' : 'Hafletna'}` }, [t.wallet, lang])
  if (session.status === 'authenticated' && session.user) return <AccountWallet key={session.user.id} />
  const checking = session.status === 'loading'
  const unavailable = session.status === 'unavailable'
  return <section className="tickets-page home-container wallet-access" aria-labelledby="wallet-access-title">
    <span className="tickets-empty-mark" aria-hidden="true"><Icon name="ticket" size={38} /></span>
    <p className="discovery-eyebrow">{t.wallet}</p><h1 className="discovery-title" id="wallet-access-title">{checking ? t.wallet : t.signInTitle}</h1>
    <p role="status">{checking ? t.sessionLoading : unavailable ? t.sessionUnavailable : t.signInLead}</p>
    <div className="tickets-actions">{!checking && <Link className="home-button" to="/login?returnTo=%2Fmy-tickets">{t.signIn}<Icon name="arrow" size={17} /></Link>}
      {unavailable && <button className="home-outline-button" type="button" onClick={() => void session.refresh()}>{t.tryAgain}</button>}
      <Link className="home-outline-button" to="/events">{t.browse}</Link>
    </div>
  </section>
}

function AccountWallet() {
  const { lang } = usePreferences()
  const t = ticketsStrings[lang]
  const live = useLiveTickets(true)
  if (!live.tickets) return <TicketShell title={t.wallet} lead={t.walletLead} backTo="/events" backLabel={t.browse} live>
    <section className="tickets-empty tickets-panel" role={live.failed ? 'alert' : 'status'}><p>{live.failed ? t.liveError : t.liveLoading}</p>{live.failed && <button className="home-outline-button" type="button" onClick={live.retry}>{t.tryAgain}</button>}</section>
  </TicketShell>
  return <WalletContents tickets={live.tickets} />
}

export function WalletContents({ tickets }: { tickets: SampleTicket[] }) {
  const { lang } = usePreferences()
  const { now } = useTickets()
  const [params, setParams] = useSearchParams()
  const t = ticketsStrings[lang]
  const tab = params.get('view') === 'past' ? 'past' : 'upcoming'
  const upcoming = tickets.filter((ticket) => !ticketIsPast(ticket, now)).sort((a, b) => a.event.date.localeCompare(b.event.date))
  const past = tickets.filter((ticket) => ticketIsPast(ticket, now)).sort((a, b) => b.event.date.localeCompare(a.event.date))
  const shown = tab === 'upcoming' ? upcoming : past
  const spotlight = tab === 'past' ? past[0] : upcoming.find((ticket) => ticket.status === 'active' && ticket.event.status !== 'cancelled') ?? upcoming[0]
  const ar = lang === 'ar'
  const dateFormatter = (value: string, part: 'day' | 'month') => new Intl.DateTimeFormat(ar ? 'ar-EG' : 'en-GB', { [part]: part === 'day' ? '2-digit' : 'short', timeZone: 'Africa/Cairo' }).format(new Date(value))
  const stats = [{ label: t.upcomingCount, count: upcoming.length }, { label: t.pastCount, count: past.length }, { label: t.experiences, count: new Set(tickets.map((ticket) => `${ticket.event.id}-${ticket.event.date}`)).size }]
  const selectTab = (value: 'upcoming' | 'past') => {
    const next = new URLSearchParams(params)
    if (value === 'past') next.set('view', 'past'); else next.delete('view')
    setParams(next, { replace: true })
  }
  const onTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const next = event.key === 'Home' ? 'upcoming' : event.key === 'End' ? 'past' : tab === 'past' ? 'upcoming' : 'past'
    selectTab(next)
    document.getElementById(`tickets-tab-${next}`)?.focus()
  }
  return <TicketShell title={t.wallet} lead={t.walletLead} backTo="/events" backLabel={t.browse} appearance="wallet" live header={
    <header className={`wallet-hero${!spotlight ? ' wallet-hero--empty' : ''}`}>
      <div className="wallet-hero-copy"><p className="wallet-eyebrow"><span aria-hidden="true" />{t.wallet}<span className="wallet-edition">{ar ? 'حجوزاتك' : 'YOUR BOOKINGS'}</span></p><h1>{t.wallet}</h1><p className="wallet-hero-lead">{ar ? 'اعرض تذاكرك القادمة والسابقة ومعلومات الدخول.' : 'View your upcoming and past tickets, with entry information for each event.'}</p><Link className="home-text-link wallet-discover" to="/events">{t.browse}<Icon name="arrow" size={18} /></Link>
        <dl className="wallet-stats">{stats.map((stat, index) => <div key={stat.label}><dt>{stat.label}</dt><dd>{bookingNumber(stat.count, lang)}<span aria-hidden="true">{['/', '+', '·'][index]}</span></dd></div>)}</dl>
      </div>
      {spotlight ? <div className="wallet-spotlight-wrap"><p className="wallet-spotlight-label"><Icon name={tab === 'past' ? 'bookmark' : 'ticket'} size={15} />{tab === 'past' ? ar ? 'من سجل ذكرياتك' : 'FROM YOUR ARCHIVE' : ar ? 'تذكرتك القادمة' : 'NEXT TICKET'}</p><article className="wallet-spotlight" aria-label={ar ? 'تذكرة مميزة من مجموعتك' : 'Ticket spotlight'}>
        <div className="wallet-spotlight-photo"><img src={spotlight.event.image} alt="" width="720" height="600" fetchPriority="high" /><div className="wallet-spotlight-overlay"><span className="wallet-photo-kicker">HAFLETNA</span><div><p>{spotlight.categoryName[lang]}</p><h2>{spotlight.event.title[lang]}</h2><span><Icon name="pin" size={15} />{spotlight.event.venue[lang]}</span></div></div></div>
        <div className="wallet-spotlight-stub"><span className="wallet-stub-label">{ar ? 'تذكرتك' : 'YOUR PASS'}</span><div className="wallet-stub-date"><strong>{dateFormatter(spotlight.event.date, 'day')}</strong><span>{dateFormatter(spotlight.event.date, 'month')}</span></div><TicketStatus ticket={spotlight} live /><time dateTime={spotlight.event.date}>{formatDate(spotlight.event.date, lang, true)}</time><span className="wallet-stub-perforation" aria-hidden="true" /><Link className="wallet-open-pass" to={`/my-tickets/${encodeURIComponent(spotlight.id)}`}><Icon name="arrow" size={20} /><span>{t.viewTicket}</span></Link></div>
      </article><p className="wallet-spotlight-caption"><span aria-hidden="true">01 —</span>{ar ? 'افتح التذكرة لعرض رمز الدخول والتفاصيل.' : 'Open your ticket to view entry information.'}</p></div> : <div className="wallet-empty-art" aria-hidden="true"><Icon name="ticket" size={100} /><span>HAFLETNA / {ar ? 'لحظتك القادمة' : 'YOUR NEXT MOMENT'}</span></div>}
    </header>
  }>
    <div className="wallet-collection-heading"><div><p className="wallet-eyebrow">{ar ? 'التذاكر' : 'TICKETS'}</p><h2>{tab === 'past' ? ar ? 'التذاكر السابقة' : 'Past tickets' : ar ? 'التذاكر القادمة' : 'Upcoming tickets'}</h2></div><div className="tickets-tabs" role="tablist" aria-label={t.wallet}>{(['upcoming', 'past'] as const).map((value) => <button id={`tickets-tab-${value}`} key={value} role="tab" type="button" aria-selected={tab === value} aria-controls={`tickets-panel-${value}`} tabIndex={tab === value ? 0 : -1} onClick={() => selectTab(value)} onKeyDown={onTabKeyDown}>{value === 'past' ? t.past : t.upcoming}<span>{bookingNumber(value === 'past' ? past.length : upcoming.length, lang)}</span></button>)}</div></div>
    <div role="tabpanel" id={`tickets-panel-${tab}`} aria-labelledby={`tickets-tab-${tab}`} tabIndex={0}>{shown.length ? <div className="tickets-wallet-grid">{shown.map((ticket) => <WalletTicketCard key={ticket.id} ticket={ticket} live />)}</div> : <section className="tickets-empty tickets-panel"><span className="tickets-empty-mark"><Icon name="ticket" size={38} /></span><h2>{tab === 'past' ? t.noPast : t.noUpcoming}</h2><p>{tab === 'past' ? t.liveNoPastLead : t.liveNoUpcomingLead}</p><div className="tickets-actions"><Link className="home-button" to="/events">{t.browse}<Icon name="arrow" size={17} /></Link></div></section>}</div>
  </TicketShell>
}
