import { useState, type KeyboardEvent } from 'react'
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
import './Wallet.css'

export default function MyTickets() {
  const { lang } = usePreferences()
  const { state, now, resetSamples } = useTickets()
  const [params, setParams] = useSearchParams()
  const [message, setMessage] = useState(false)
  const t = ticketsStrings[lang]
    // Signed in: the real tickets from the server. Signed out: the sample wallet, as before.
  const session = useSession()
  const signedIn = session.status === 'authenticated'
  const live = useLiveTickets(signedIn)
  const tickets = signedIn ? live.tickets ?? [] : state.tickets
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
  return <TicketShell title={t.wallet} lead={t.walletLead} backTo="/events" backLabel={t.browse} appearance="wallet" live={signedIn} header={
    <header className={`wallet-hero${!spotlight ? ' wallet-hero--empty' : ''}`}>
      <div className="wallet-hero-copy"><p className="wallet-eyebrow"><span aria-hidden="true" />{t.wallet}<span className="wallet-edition">{ar ? 'لحظات تستحق الاحتفاظ بها' : 'MOMENTS WORTH KEEPING'}</span></p><h1>{ar ? <>خطط مميزة.<br /><em>لحظات لا تُنسى.</em></> : <>Good plans.<br /><em>Great memories.</em></>}</h1><p className="wallet-hero-lead">{ar ? 'كل تذكرة بداية حكاية. احتفظ بخططك القادمة وذكرياتك المفضّلة في مكان واحد.' : 'Every ticket is a story waiting to happen. Your next big night and your favourite memories, all together.'}</p><Link className="home-text-link wallet-discover" to="/events">{t.browse}<Icon name="arrow" size={18} /></Link>
        <dl className="wallet-stats">{stats.map((stat, index) => <div key={stat.label}><dt>{stat.label}</dt><dd>{bookingNumber(stat.count, lang)}<span aria-hidden="true">{['/', '+', '·'][index]}</span></dd></div>)}</dl>
      </div>
      {spotlight ? <div className="wallet-spotlight-wrap"><p className="wallet-spotlight-label"><Icon name={tab === 'past' ? 'bookmark' : 'ticket'} size={15} />{tab === 'past' ? ar ? 'من سجل ذكرياتك' : 'FROM YOUR ARCHIVE' : ar ? 'في مجموعتك القادمة' : 'IN YOUR UPCOMING COLLECTION'}</p><article className="wallet-spotlight" aria-label={ar ? 'تذكرة مميزة من مجموعتك' : 'Ticket spotlight'}>
        <div className="wallet-spotlight-photo"><img src={spotlight.event.image} alt="" width="720" height="600" fetchPriority="high" /><div className="wallet-spotlight-overlay"><span className="wallet-photo-kicker">{signedIn ? 'HAFLETNA' : <>HAFLETNA / {ar ? 'تجريبي' : 'SAMPLE'}</>}</span><div><p>{spotlight.categoryName[lang]}</p><h2>{spotlight.event.title[lang]}</h2><span><Icon name="pin" size={15} />{spotlight.event.venue[lang]}</span></div></div></div>
        <div className="wallet-spotlight-stub"><span className="wallet-stub-label">{ar ? 'تذكرتك' : 'YOUR PASS'}</span><div className="wallet-stub-date"><strong>{dateFormatter(spotlight.event.date, 'day')}</strong><span>{dateFormatter(spotlight.event.date, 'month')}</span></div><TicketStatus ticket={spotlight} /><time dateTime={spotlight.event.date}>{formatDate(spotlight.event.date, lang, true)}</time><span className="wallet-stub-perforation" aria-hidden="true" /><Link className="wallet-open-pass" to={`/my-tickets/${encodeURIComponent(spotlight.id)}`}><Icon name="arrow" size={20} /><span>{t.viewTicket}</span></Link></div>
      </article><p className="wallet-spotlight-caption"><span aria-hidden="true">01 —</span>{ar ? 'اختر لحظتك. واترك الباقي للتجربة.' : 'Make the plan. Live the moment.'}</p></div> : <div className="wallet-empty-art" aria-hidden="true"><Icon name="ticket" size={100} /><span>HAFLETNA / {ar ? 'لحظتك القادمة' : 'YOUR NEXT MOMENT'}</span></div>}
    </header>
  }>
    <div className="wallet-collection-heading"><div><p className="wallet-eyebrow">{ar ? 'مجموعة تستحق الاحتفاظ بها' : 'THE COLLECTION'}</p><h2>{tab === 'past' ? ar ? 'لحظات عشتها.' : 'The moments you made.' : ar ? 'خططك القادمة.' : 'On your calendar.'}</h2></div><div className="tickets-tabs" role="tablist" aria-label={t.wallet}>{(['upcoming', 'past'] as const).map((value) => <button id={`tickets-tab-${value}`} key={value} role="tab" type="button" aria-selected={tab === value} aria-controls={`tickets-panel-${value}`} tabIndex={tab === value ? 0 : -1} onClick={() => selectTab(value)} onKeyDown={onTabKeyDown}>{value === 'past' ? t.past : t.upcoming}<span>{bookingNumber(value === 'past' ? past.length : upcoming.length, lang)}</span></button>)}</div></div>
    <div role="tabpanel" id={`tickets-panel-${tab}`} aria-labelledby={`tickets-tab-${tab}`} tabIndex={0}>{shown.length ? <div className="tickets-wallet-grid">{shown.map((ticket) => <WalletTicketCard key={ticket.id} ticket={ticket} live={signedIn} />)}</div> : <section className="tickets-empty tickets-panel"><span className="tickets-empty-mark"><Icon name="ticket" size={38} /></span><h2>{tab === 'past' ? t.noPast : t.noUpcoming}</h2><p>{tab === 'past' ? t.noPastLead : t.noUpcomingLead}</p><div className="tickets-actions"><Link className="home-button" to="/events">{t.browse}<Icon name="arrow" size={17} /></Link>{!signedIn && <button className="home-outline-button" type="button" onClick={() => { resetSamples(); setMessage(true) }}>{t.loadSamples}</button>}</div></section>}</div>
        <p className="tickets-wallet-message" role="status">{message && t.sampleAdded}{signedIn && !live.tickets && !live.failed && t.liveLoading}{signedIn && live.failed && t.liveError}</p>{!signedIn && <p className="tickets-session-note">{t.sessionNote}</p>}
  </TicketShell>
}
