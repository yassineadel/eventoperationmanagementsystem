import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import type { Event, Language } from '../types'
import type { HomeStrings } from '../strings'
import { formatDate, formatPrice } from '../discovery'
import SaveEventButton from '../../Discovery/SaveEventButton'
import EventStatusBadge from '../../Discovery/EventStatusBadge'
import Icon from './Icon'

export default function EventRow({ event, lang, t }: { event: Event; lang: Language; t: HomeStrings }) {
  const [failedImage, setFailedImage] = useState<string | null>(null)
  const location = useLocation()
  const to = `/events/${event.id}`
  const state = { from: `${location.pathname}${location.search}` }
  const part = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-GB', { timeZone: 'Africa/Cairo', ...options }).format(new Date(event.date))
  return <article className="board-event-row" data-scroll-reveal="">
    <time className="board-event-date" dateTime={event.date} aria-label={formatDate(event.date, lang)}><strong>{part({ day: '2-digit' })}</strong><span>{part({ month: 'short' })}</span><small>{part({ year: 'numeric' })}</small></time>
    <Link className="board-event-photo" to={to} state={state} aria-label={`${t.details}: ${event.title[lang]}`}>
      {failedImage !== event.image ? <img src={event.image} alt="" width="360" height="280" loading="lazy" onError={() => setFailedImage(event.image)} /> : <span className="board-photo-fallback"><Icon name={event.category} size={34} /></span>}
    </Link>
    <div className="board-event-copy"><h3><Link to={to} state={state}>{event.title[lang]}</Link></h3>
      <p className="board-event-performer"><span className="home-sr-only">{t.performer}: </span><bdi>{event.performer?.[lang] || t.performerPending}</bdi></p>
      <p className="board-event-fact"><Icon name="pin" size={17} /><span>{event.venue[lang]}</span></p>
      <p className="board-event-fact"><Icon name="clock" size={17} /><time dateTime={event.date}>{formatDate(event.date, lang, true)}</time></p>
      {event.status !== 'available' && <EventStatusBadge status={event.status} lang={lang} sample={event.source !== 'api'} />}
    </div>
    <div className="board-event-actions"><strong className="board-event-price">{event.price === null ? t.priceUnavailable : event.price === 0 ? t.free : formatPrice(event.price, lang)}</strong><SaveEventButton event={event} lang={lang} /></div>
  </article>
}
