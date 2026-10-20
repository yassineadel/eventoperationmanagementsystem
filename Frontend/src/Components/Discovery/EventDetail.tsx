import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { usePreferences } from '../Auth/preferences'
import { events } from '../Homepage/data/events'
import { categoryNames, cityNames, homeStrings } from '../Homepage/strings'
import { formatDate, formatPrice } from '../Homepage/discovery'
import type { Event } from '../Homepage/types'
import Icon from '../Homepage/components/Icon'
import { discoveryStrings } from './strings'
import { getEventDetails, venueMapLinks } from './eventDetails'
import NotFound from './NotFound'
import SaveEventButton from './SaveEventButton'
import EventStatusBadge from './EventStatusBadge'
import { eventStatusLabels, eventUiStrings } from './eventUiStrings'
import { getBookingCatalogue, selectionPath } from '../Booking/catalogue'
import { bookingStrings } from '../Booking/strings'

function EventDetailContent({ event }: { event: Event }) {
  const { lang } = usePreferences()
  const t = discoveryStrings[lang]
  const home = homeStrings[lang]
  const eventText = eventUiStrings[lang]
  const location = useLocation()
  const [photo, setPhoto] = useState(0)
  const details = getEventDetails(event)
  const map = venueMapLinks(details.coordinates, lang)
  const locale = lang === 'ar' ? 'ar-EG' : 'en-GB'
  const number = (value: number) => new Intl.NumberFormat(locale).format(value)
  const time = (date: string) => new Intl.DateTimeFormat(locale, { timeZone: 'Africa/Cairo', hour: 'numeric', minute: '2-digit' }).format(new Date(date))
  const hours = Math.floor(details.duration / 60)
  const minutes = details.duration % 60
  const duration = [hours ? new Intl.NumberFormat(locale, { style: 'unit', unit: 'hour', unitDisplay: 'long' }).format(hours) : '', minutes ? new Intl.NumberFormat(locale, { style: 'unit', unit: 'minute', unitDisplay: 'long' }).format(minutes) : ''].filter(Boolean).join(' ')
  const from = typeof location.state?.from === 'string' && (location.state.from === '/' || /^\/events(?:\?|$)/.test(location.state.from)) ? location.state.from : '/events'
  useEffect(() => { document.title = `${event.title[lang]} | ${home.brand}` }, [event, lang, home.brand])
  const factItems = [
    { label: t.starts, value: time(event.date), date: event.date, icon: 'calendar' as const },
    { label: t.doors, value: time(details.doorsOpen), date: details.doorsOpen, icon: 'ticket' as const },
    { label: t.duration, value: duration, icon: 'clock' as const },
    { label: t.capacity, value: `${number(details.capacity)} ${t.attendees}`, icon: 'conferences' as const },
  ]

  return <article className="detail-page home-container">
    <nav className="discovery-breadcrumbs" aria-label={lang === 'ar' ? 'مسار التنقل' : 'Breadcrumb'}><Link to="/">{t.home}</Link><span aria-hidden="true">/</span><Link to="/events">{t.eventsLabel}</Link><span aria-hidden="true">/</span><span aria-current="page">{event.title[lang]}</span></nav>
    <Link className="home-text-link detail-back" to={from}><span className="discovery-back-arrow"><Icon name="arrow" size={17} /></span>{t.backToResults}</Link>
    <header className="detail-heading">
      <div className="detail-tags"><Link to={`/events?category=${event.category}`}><Icon name={event.category} size={16} />{categoryNames[event.category][lang]}</Link><span><Icon name="pin" size={16} />{cityNames[event.city][lang]}</span><EventStatusBadge status={event.status} lang={lang} /><span className="detail-sample-tag">{t.sample}</span></div>
      <div className="detail-title-row"><h1 className="discovery-title">{event.title[lang]}</h1><SaveEventButton event={event} lang={lang} labelled /></div>
      <p>{t.organisedBy} <strong>{details.organiser[lang]}</strong></p>
    </header>
    <div className="detail-layout">
      <div className="detail-content">
        <section className="detail-gallery" aria-label={t.gallery}>
          <div className="detail-gallery-main"><img id="event-gallery-image" src={details.gallery[photo]} alt={`${event.title[lang]} — ${t.photo} ${number(photo + 1)}`} width="1200" height="680" fetchPriority="high" />
            <div className="detail-gallery-controls"><button onClick={() => setPhoto((photo + details.gallery.length - 1) % details.gallery.length)} aria-label={t.previousPhoto} aria-controls="event-gallery-image"><span className="discovery-back-arrow"><Icon name="arrow" /></span></button><span aria-live="polite">{number(photo + 1)} / {number(details.gallery.length)}</span><button onClick={() => setPhoto((photo + 1) % details.gallery.length)} aria-label={t.nextPhoto} aria-controls="event-gallery-image"><Icon name="arrow" /></button></div>
          </div>
          <div className="detail-thumbnails" role="group" aria-label={t.gallery}>{details.gallery.map((src, index) => <button key={src} aria-label={`${t.photo} ${number(index + 1)}`} aria-pressed={photo === index} aria-controls="event-gallery-image" onClick={() => setPhoto(index)}><img src={src} alt="" width="180" height="100" loading="lazy" /></button>)}</div>
        </section>
        <nav className="detail-section-nav" aria-label={t.about}><a href="#event-about">{t.about}</a><a href="#event-venue">{t.venue}</a><a href="#event-policies">{t.policies}</a><a href="#event-faq">{t.faq}</a></nav>
        <section id="event-about" className="detail-section" aria-labelledby="event-about-title"><h2 id="event-about-title">{t.about}</h2><p>{event.description[lang]}</p><dl className="detail-facts">{factItems.map((fact) => <div key={fact.label}><dt><Icon name={fact.icon} size={19} />{fact.label}</dt><dd>{fact.date ? <time dateTime={fact.date}>{fact.value}</time> : fact.value}</dd></div>)}</dl><p className="detail-local-time">{t.localTime}</p></section>
        <section id="event-venue" className="detail-section" aria-labelledby="event-venue-title"><h2 id="event-venue-title">{t.venue}</h2><h3>{event.venue[lang]}</h3><p className="detail-address"><Icon name="pin" size={18} />{details.address[lang]}</p><iframe className="detail-map" title={`Google Maps — ${t.venue}: ${event.venue[lang]}`} src={map.embed} loading="lazy" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" /><div className="detail-map-caption"><p>{t.locationNote}</p><a className="home-text-link" href={map.external} target="_blank" rel="noopener noreferrer">{t.openMap}<Icon name="arrow" size={16} /></a></div></section>
        <section id="event-policies" className="detail-section" aria-labelledby="event-policies-title"><h2 id="event-policies-title">{t.policies}</h2><div className="detail-policy-list">{details.policies.map((policy) => <div key={policy.title.en}><h3>{policy.title[lang]}</h3><p>{policy.body[lang]}</p></div>)}</div></section>
        <section id="event-faq" className="detail-section" aria-labelledby="event-faq-title"><h2 id="event-faq-title">{t.faq}</h2>{details.faqs.map((faq) => <details className="detail-faq" key={faq.question.en}><summary>{faq.question[lang]}</summary><p>{faq.answer[lang]}</p></details>)}</section>
      </div>
      <aside className="detail-ticket" aria-labelledby="event-ticket-title"><div className="detail-ticket-top"><Icon name="ticket" size={27} /><span>{getBookingCatalogue(event.id)?.mode === 'seated' ? bookingStrings[lang].seated : bookingStrings[lang].standing}</span></div><h2 id="event-ticket-title">{t.tickets}</h2><p className="detail-ticket-price">{event.price === 0 ? home.free : formatPrice(event.price, lang)}</p><dl><div><dt>{home.date}</dt><dd><time dateTime={event.date}>{formatDate(event.date, lang, true)}</time></dd></div><div><dt>{home.location}</dt><dd>{event.venue[lang]}<span>{cityNames[event.city][lang]}</span></dd></div></dl>
        {event.status !== 'available' && <p className="detail-status-note">{event.status === 'cancelled' ? eventText.cancelledNote : eventText.soldOutNote}</p>}
        {event.status === 'available' ? <Link className="home-button" to={selectionPath(event.id)}>{bookingStrings[lang].stepSelection}<Icon name="arrow" size={18} /></Link> : <button className="home-button" disabled>{event.status === 'cancelled' ? eventText.cancelledBooking : eventStatusLabels['sold-out'][lang]}</button>}
        <p className="detail-booking-note">{t.bookingNote}</p><Link className="home-text-link" to="/events">{t.exploreEvents}<Icon name="arrow" size={17} /></Link>
      </aside>
    </div>
  </article>
}

export default function EventDetail() {
  const { eventId } = useParams()
  const event = events.find((event) => event.id === eventId)
  return event ? <EventDetailContent key={event.id} event={event} /> : <NotFound event />
}
