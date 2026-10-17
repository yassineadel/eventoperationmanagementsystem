import { useEffect, useRef } from 'react'
import type { HomeStrings } from '../strings'
import { Link } from 'react-router-dom'
import type { Event, Language } from '../types'
import { formatDate } from '../discovery'
import Icon from './Icon'
import EventStatusBadge from '../../Discovery/EventStatusBadge'
import { eventStatusLabels, eventUiStrings } from '../../Discovery/eventUiStrings'

export default function HeroSection({ t, lang, event }: {
  t: HomeStrings; lang: Language; event: Event;
}) {
  const heroRef = useRef<HTMLElement>(null)
  const ticketRef = useRef<HTMLAnchorElement>(null)

  useEffect(() => {
    const hero = heroRef.current
    const ticket = ticketRef.current
    if (!hero || !ticket) return

    const motion = window.matchMedia('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)')
    let frame = 0
    let pointerX = 0
    let pointerY = 0
    const clamp = (value: number) => Math.min(1, Math.max(0, value))

    function reset() {
      cancelAnimationFrame(frame)
      frame = 0
      for (const name of ['--hero-spot-x', '--hero-spot-y']) hero?.style.removeProperty(name)
      for (const name of ['--ticket-tilt-x', '--ticket-tilt-y', '--ticket-shine-x', '--ticket-shine-y']) ticket?.style.removeProperty(name)
    }

    function followPointer(event: PointerEvent) {
      if (!motion.matches || event.pointerType === 'touch') return
      pointerX = event.clientX
      pointerY = event.clientY
      if (frame) return

      frame = requestAnimationFrame(() => {
        frame = 0
        const bounds = hero!.getBoundingClientRect()
        if (!bounds.width || !bounds.height) return
        hero!.style.setProperty('--hero-spot-x', `${clamp((pointerX - bounds.left) / bounds.width) * 100}%`)
        hero!.style.setProperty('--hero-spot-y', `${clamp((pointerY - bounds.top) / bounds.height) * 100}%`)

        const card = ticket!.getBoundingClientRect()
        if (!card.width || !card.height) return
        const x = clamp((pointerX - card.left) / card.width)
        const y = clamp((pointerY - card.top) / card.height)
        const overTicket = pointerX >= card.left && pointerX <= card.right && pointerY >= card.top && pointerY <= card.bottom
        ticket!.style.setProperty('--ticket-tilt-x', `${overTicket ? (0.5 - y) * 7 : 0}deg`)
        ticket!.style.setProperty('--ticket-tilt-y', `${overTicket ? (x - 0.5) * 9 : 0}deg`)
        ticket!.style.setProperty('--ticket-shine-x', `${x * 100}%`)
        ticket!.style.setProperty('--ticket-shine-y', `${y * 100}%`)
      })
    }

    hero.addEventListener('pointermove', followPointer, { passive: true })
    hero.addEventListener('pointerleave', reset)
    hero.addEventListener('pointercancel', reset)
    motion.addEventListener('change', reset)
    window.addEventListener('blur', reset)
    return () => {
      reset()
      hero.removeEventListener('pointermove', followPointer)
      hero.removeEventListener('pointerleave', reset)
      hero.removeEventListener('pointercancel', reset)
      motion.removeEventListener('change', reset)
      window.removeEventListener('blur', reset)
    }
  }, [])

  const date = new Date(event.date)
  const locale = lang === 'ar' ? 'ar-EG' : 'en-GB'
  function part(options: Intl.DateTimeFormatOptions) {
    return new Intl.DateTimeFormat(locale, { timeZone: 'Africa/Cairo', ...options }).format(date)
  }

  return (
    <section ref={heroRef} className="home-hero home-container" aria-labelledby="hero-title">
      <div className="home-hero-atmosphere" aria-hidden="true"><span className="home-stage-beam home-stage-beam--one" /><span className="home-stage-beam home-stage-beam--two" /><span className="home-stage-orbit" /></div>
      <div className="home-hero-copy">
        <p className="home-hero-eyebrow"><span aria-hidden="true" />{t.eyebrow}</p>
        <h1 id="hero-title"><span>{t.heroTitle}</span>{t.heroLineTwo && <span>{t.heroLineTwo}</span>}<span className="home-hero-emphasis">{t.heroAccent}</span></h1>
        <p className="home-hero-lead">{t.heroLead}</p>
        <Link className="home-button home-hero-cta" to="/events">{t.explore}<Icon name="arrow" /></Link>
      </div>
      <Link ref={ticketRef} className="home-hero-ticket" to={`/events/${event.id}`} state={{ from: '/' }} aria-label={`${t.details}: ${event.title[lang]}. ${eventUiStrings[lang].sampleStatus}: ${eventStatusLabels[event.status][lang]}`}>
        <img src="/event-images/hero-ticket.png" alt={t.heroAlt} fetchPriority="high" width="1536" height="768" />
        <span className="home-ticket-sheen" aria-hidden="true" />
        <span className="home-hero-ticket-copy"><strong>{t.heroTag}</strong><span>{t.heroCaption}</span></span>
        <EventStatusBadge status={event.status} lang={lang} />
        <time dateTime={event.date} className="home-ticket-date" aria-label={formatDate(event.date, lang)}>
          <span>{part({ weekday: 'short' })}</span><span>{part({ month: 'short' })}</span><strong>{part({ day: '2-digit' })}</strong><span>{part({ year: 'numeric' })}</span>
        </time>
      </Link>
    </section>
  )
}
