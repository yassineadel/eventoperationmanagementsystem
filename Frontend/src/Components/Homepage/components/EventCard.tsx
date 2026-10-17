import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { categoryNames, cityNames, type HomeStrings } from '../strings'
import { formatDate, formatPrice } from '../discovery'
import type { Event, Language } from '../types'
import Icon from './Icon'
import SaveEventButton from '../../Discovery/SaveEventButton'
import EventStatusBadge from '../../Discovery/EventStatusBadge'
import { eventStatusLabels, eventUiStrings } from '../../Discovery/eventUiStrings'

export default function EventCard({ event, lang, t, rank }: { event: Event; lang: Language; t: HomeStrings; rank?: number }) {
  const [imageFailed, setImageFailed] = useState(false)
  const location = useLocation()
  const to = `/events/${event.id}`
  const state = { from: `${location.pathname}${location.search}` }
  const number = new Intl.NumberFormat(lang === 'ar' ? 'ar-EG' : 'en', { minimumIntegerDigits: 2 })
  return (
    <article className="home-event-card">
      <Link to={to} state={state} className="home-event-image" aria-label={`${t.details}: ${event.title[lang]}. ${eventUiStrings[lang].sampleStatus}: ${eventStatusLabels[event.status][lang]}`}>
        {!imageFailed ? <img src={event.image} alt="" loading="lazy" width="720" height="300" onError={() => setImageFailed(true)} /> : <div className="home-image-fallback"><Icon name={event.category} size={54} /></div>}
        {rank && <span className="home-event-rank" aria-label={`${t.trendingRank} ${number.format(rank)}`}>{number.format(rank)}</span>}
        <EventStatusBadge status={event.status} lang={lang} />
      </Link>
      <SaveEventButton event={event} lang={lang} />
      <div className="home-event-body">
        <h3><Link to={to} state={state}>{event.title[lang]}</Link></h3>
        <p className="home-event-location"><Icon name="pin" size={14} />{cityNames[event.city][lang]}<span className="home-sr-only"> · {event.venue[lang]} · {categoryNames[event.category][lang]}</span></p>
        <time className="home-event-date" dateTime={event.date}>{formatDate(event.date, lang)}</time>
        <strong className={`home-event-price${event.price === 0 ? ' home-free' : ''}`}>{event.price === 0 ? t.free : formatPrice(event.price, lang)}</strong>
        <Link className="home-round-action" to={to} state={state} aria-label={`${t.details}: ${event.title[lang]}`}><Icon name="arrow" size={21} /></Link>
      </div>
    </article>
  )
}
