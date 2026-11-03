import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { HomeStrings } from '../strings'
import type { Event, Language } from '../types'
import { formatDate } from '../discovery'
import Icon from './Icon'
import EventStatusBadge from '../../Discovery/EventStatusBadge'

export default function HeroSection({ t, lang, event, loading, failed, onRetry }: {
  t: HomeStrings; lang: Language; event: Event | null; loading?: boolean; failed?: boolean; onRetry?: () => void
}) {
  const [imageFailure, setImageFailure] = useState<string | null>(null)
  return <aside className="board-feature" aria-label={t.featuredEvent}>
    {event ? <>
      <Link className="board-feature-photo" to={`/events/${event.id}`} state={{ from: '/' }} aria-label={`${t.details}: ${event.title[lang]}`}>
        {imageFailure !== event.image ? <img src={event.image} alt="" fetchPriority="high" width="720" height="900" onError={() => setImageFailure(event.image)} /> : <span className="board-photo-fallback"><Icon name={event.category} size={60} /></span>}
        <span className="board-feature-label">{t.featuredEvent}</span>
      </Link>
      <div className="board-feature-copy"><h2><Link to={`/events/${event.id}`} state={{ from: '/' }}>{event.title[lang]}</Link></h2><p className="board-feature-performer"><span className="home-sr-only">{t.performer}: </span><bdi>{event.performer?.[lang] || t.performerPending}</bdi></p>
        <p className="board-feature-fact"><Icon name="clock" size={19} /><time dateTime={event.date}>{formatDate(event.date, lang, true)}</time></p>
        <p className="board-feature-fact"><Icon name="pin" size={19} /><span>{event.venue[lang]}</span></p>
        {event.status !== 'available' && <EventStatusBadge status={event.status} lang={lang} sample={event.source !== 'api'} />}
        <Link className="home-button" to={`/events/${event.id}`} state={{ from: '/' }}>{t.viewEvent}<Icon name="arrow" size={19} /></Link>
      </div>
    </> : <div className="board-feature-placeholder" role={failed ? 'alert' : 'status'}><Icon name="ticket" size={46} /><h2>{t.featuredEvent}</h2><p>{loading ? t.loadingEvents : failed ? t.eventsError : t.catalogueEmpty}</p>{failed && <button type="button" className="home-outline-button" onClick={onRetry}>{t.retry}</button>}</div>}
  </aside>
}
