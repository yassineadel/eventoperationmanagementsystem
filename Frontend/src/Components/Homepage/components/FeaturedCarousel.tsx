import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { HomeStrings } from '../strings'
import type { Event, Language } from '../types'
import { formatDate, formatPrice } from '../discovery'
import Icon from './Icon'

const SLIDE_SECONDS = 6
const RADIUS = 28
const STROKE = 5

/**
 * Featured events, one at a time. A saffron line traces the carousel's edge from the
 * top corner all the way round; when it closes, the next event slides in.
 * Hovering or focusing inside pauses it.
 */
export default function FeaturedCarousel({ t, lang, events, loading, failed, onRetry }: {
  t: HomeStrings; lang: Language; events: Event[]; loading?: boolean; failed?: boolean; onRetry?: () => void
}) {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const frame = useRef<HTMLElement>(null)
  const count = events.length
  const current = count ? events[index % count] : null

  useEffect(() => {
    const el = frame.current
    if (!el) return
    const update = () => setSize({ w: el.clientWidth, h: el.clientHeight })
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [count])

  function go(next: number) {
    if (count) setIndex((next + count) % count)
  }

  if (!current) {
    return <section className="board-carousel board-carousel--empty" aria-label={t.featuredEvent} role={failed ? 'alert' : 'status'}>
      <Icon name="ticket" size={46} /><h2>{t.featuredEvent}</h2>
      <p>{loading ? t.loadingEvents : failed ? t.eventsError : t.catalogueEmpty}</p>
      {failed && <button type="button" className="home-outline-button" onClick={onRetry}>{t.retry}</button>}
    </section>
  }

  const inset = STROKE / 2
  const ar = lang === 'ar'
  return <section
    ref={frame}
    className={`board-carousel${paused ? ' is-paused' : ''}`}
    aria-roledescription="carousel"
    aria-label={t.featuredEvent}
    onMouseEnter={() => setPaused(true)}
    onMouseLeave={() => setPaused(false)}
    onFocus={() => setPaused(true)}
    onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setPaused(false) }}
  >
    {events.map((event, i) => <img
      key={event.id}
      className={`board-carousel-photo${i === index ? ' is-active' : ''}`}
      src={event.image}
      alt=""
      aria-hidden="true"
      fetchPriority={i === 0 ? 'high' : undefined}
      loading={i === 0 ? undefined : 'lazy'}
    />)}

    <div className="board-carousel-card" aria-live={paused ? 'polite' : 'off'}>
      <span className="board-carousel-kicker">{t.featuredEvent} · <time dateTime={current.date}>{formatDate(current.date, lang)}</time></span>
      <h2><Link to={`/events/${current.id}`} state={{ from: '/' }}>{current.title[lang]}</Link></h2>
      <p className="board-carousel-venue"><Icon name="pin" size={17} /><span>{current.venue[lang]}</span></p>
      <div className="board-carousel-actions">
        <strong>{current.price === null ? t.priceUnavailable : current.price === 0 ? t.free : `${t.from} ${formatPrice(current.price, lang)}`}</strong>
        <Link className="home-button" to={`/events/${current.id}`} state={{ from: '/' }}>{t.viewEvent}<Icon name="arrow" size={18} /></Link>
      </div>
    </div>

    {count > 1 && <>
      <div className="board-carousel-arrows">
        <button type="button" onClick={() => go(index - 1)} aria-label={ar ? 'الفعالية السابقة' : 'Previous event'}><Icon name="arrow" size={20} /></button>
        <button type="button" onClick={() => go(index + 1)} aria-label={ar ? 'الفعالية التالية' : 'Next event'}><Icon name="arrow" size={20} /></button>
      </div>
      <div className="board-carousel-dots">
        {events.map((event, i) => <button
          key={event.id}
          type="button"
          className={i === index ? 'is-active' : ''}
          aria-label={`${ar ? 'عرض' : 'Show'} ${event.title[lang]}`}
          aria-current={i === index ? 'true' : undefined}
          onClick={() => go(i)}
        ><span /></button>)}
      </div>
      {size.w > 0 && <svg className="board-carousel-ring" width={size.w} height={size.h} aria-hidden="true">
        <rect x={inset} y={inset} width={size.w - STROKE} height={size.h - STROKE} rx={RADIUS - inset} className="board-carousel-track" />
        <rect
          key={index}
          x={inset} y={inset} width={size.w - STROKE} height={size.h - STROKE} rx={RADIUS - inset}
          pathLength={100}
          className="board-carousel-progress"
          style={{ animationDuration: `${SLIDE_SECONDS}s` }}
          onAnimationEnd={() => go(index + 1)}
        />
      </svg>}
    </>}
  </section>
}
