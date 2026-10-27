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
import { useApiEvent } from '../../lib/useEventsApi'
import { fallbackImages, type CatalogDetails } from '../../lib/eventsModel'
import { apiStrings } from './apiStrings'

function EventPhoto({ src, fallback, alt, priority = false, id }: { src: string; fallback: string; alt: string; priority?: boolean; id?: string }) {
  const [failed, setFailed] = useState(0)
  return failed > 1 ? <span id={id} className="catalog-photo-fallback"><Icon name="ticket" size={45} /></span> : <img id={id} src={failed ? fallback : src} alt={alt} width="1200" height="680" loading={priority ? 'eager' : 'lazy'} fetchPriority={priority ? 'high' : 'auto'} onError={() => setFailed((value) => value + 1)} />
}

export function EventDetailContent({ event, details }: { event: Event; details: CatalogDetails }) {
  const { lang } = usePreferences()
  const t = discoveryStrings[lang], home = homeStrings[lang], eventText = eventUiStrings[lang], a = apiStrings[lang]
  const sample = event.source !== 'api'
  const location = useLocation()
  const [photo, setPhoto] = useState(0)
  const [now, setNow] = useState(Date.now)
  useEffect(() => { if (sample) return; const timer = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(timer) }, [sample])
  const map = details.coordinates ? venueMapLinks(details.coordinates, lang) : null
  const locale = lang === 'ar' ? 'ar-EG' : 'en-GB'
  const number = (value: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value)
  const time = (date: string) => new Intl.DateTimeFormat(locale, { timeZone: 'Africa/Cairo', hour: 'numeric', minute: '2-digit' }).format(new Date(date))
  const hours = Math.floor((details.duration ?? 0) / 60), minutes = (details.duration ?? 0) % 60
  const duration = details.duration ? [hours ? new Intl.NumberFormat(locale, { style: 'unit', unit: 'hour', unitDisplay: 'long' }).format(hours) : '', minutes ? new Intl.NumberFormat(locale, { style: 'unit', unit: 'minute', unitDisplay: 'long' }).format(minutes) : ''].filter(Boolean).join(' ') : a.notProvided
  const from = typeof location.state?.from === 'string' && (location.state.from === '/' || /^\/events(?:\?|$)/.test(location.state.from)) ? location.state.from : '/events'
  useEffect(() => { document.title = `${event.title[lang]} | ${home.brand}` }, [event, lang, home.brand])
  const factItems = [
    { label: t.starts, value: time(event.date), date: event.date, icon: 'calendar' as const },
    { label: t.doors, value: details.doorsOpen ? time(details.doorsOpen) : a.notProvided, date: details.doorsOpen, icon: 'ticket' as const },
    { label: t.duration, value: duration, icon: 'clock' as const },
    { label: t.capacity, value: details.capacity === null ? a.notProvided : `${number(details.capacity)} ${t.attendees}`, icon: 'conferences' as const },
  ]
  const price = (value: number | null) => value === null ? a.priceUnavailable : value === 0 ? home.free : formatPrice(value, lang)

  return <article className="detail-page home-container">
    <nav className="discovery-breadcrumbs" aria-label={lang === 'ar' ? 'مسار التنقل' : 'Breadcrumb'}><Link to="/">{t.home}</Link><span aria-hidden="true">/</span><Link to="/events">{t.eventsLabel}</Link><span aria-hidden="true">/</span><span aria-current="page">{event.title[lang]}</span></nav>
    <Link className="home-text-link detail-back" to={from}><span className="discovery-back-arrow"><Icon name="arrow" size={17} /></span>{t.backToResults}</Link>
    <header className="detail-heading">
      <div className="detail-tags"><Link to={`/events?category=${event.category}`}><Icon name={event.category} size={16} />{categoryNames[event.category][lang]}</Link><span><Icon name="pin" size={16} />{cityNames[event.city][lang]}</span><EventStatusBadge status={event.status} lang={lang} sample={sample} />{sample ? <span className="detail-sample-tag">{t.sample}</span> : details.synthetic && <span className="detail-sample-tag">{a.testEvent}</span>}</div>
      <div className="detail-title-row"><h1 className="discovery-title">{event.title[lang]}</h1><SaveEventButton event={event} lang={lang} labelled /></div>
      {details.organiser && <p>{t.organisedBy} <strong>{details.organiser[lang]}</strong></p>}
      {!!event.performer?.[lang] && <p>{a.performer} <strong>{event.performer[lang]}</strong></p>}
    </header>
    <div className="detail-layout">
      <div className="detail-content">
        <section className="detail-gallery" aria-label={t.gallery}>
          <div className="detail-gallery-main"><EventPhoto id="event-gallery-image" key={details.gallery[photo]} src={details.gallery[photo]} fallback={fallbackImages[event.category]} alt={`${event.title[lang]} — ${t.photo} ${number(photo + 1)}`} priority />
            {details.gallery.length > 1 && <div className="detail-gallery-controls"><button onClick={() => setPhoto((photo + details.gallery.length - 1) % details.gallery.length)} aria-label={t.previousPhoto} aria-controls="event-gallery-image"><span className="discovery-back-arrow"><Icon name="arrow" /></span></button><span aria-live="polite">{number(photo + 1)} / {number(details.gallery.length)}</span><button onClick={() => setPhoto((photo + 1) % details.gallery.length)} aria-label={t.nextPhoto} aria-controls="event-gallery-image"><Icon name="arrow" /></button></div>}
          </div>
          {details.gallery.length > 1 && <div className="detail-thumbnails" role="group" aria-label={t.gallery}>{details.gallery.map((src, index) => <button key={src} aria-label={`${t.photo} ${number(index + 1)}`} aria-pressed={photo === index} aria-controls="event-gallery-image" onClick={() => setPhoto(index)}><EventPhoto src={src} fallback={fallbackImages[event.category]} alt="" /></button>)}</div>}
          {details.fallbackImage && <p className="catalog-muted-note">{a.imageFallback}</p>}
        </section>
        <nav className="detail-section-nav" aria-label={t.about}><a href="#event-about">{t.about}</a><a href="#event-venue">{t.venue}</a><a href="#event-policies">{t.policies}</a><a href="#event-faq">{t.faq}</a></nav>
        <section id="event-about" className="detail-section" aria-labelledby="event-about-title"><h2 id="event-about-title">{t.about}</h2><p className="catalog-description">{event.description[lang] || a.noDescription}</p><dl className="detail-facts">{factItems.map((fact) => <div key={fact.label}><dt><Icon name={fact.icon} size={19} />{fact.label}</dt><dd>{fact.date ? <time dateTime={fact.date}>{fact.value}</time> : fact.value}</dd></div>)}</dl><p className="detail-local-time">{t.localTime}</p></section>
        <section id="event-venue" className="detail-section" aria-labelledby="event-venue-title"><h2 id="event-venue-title">{t.venue}</h2><h3>{event.venue[lang]}</h3><p className="detail-address"><Icon name="pin" size={18} />{details.address?.[lang] || a.notProvided}</p>{map ? <><iframe className="detail-map" title={`Google Maps — ${t.venue}: ${event.venue[lang]}`} src={map.embed} loading="lazy" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" /><div className="detail-map-caption"><p>{sample ? t.locationNote : a.mapNote}</p><a className="home-text-link" href={map.external} target="_blank" rel="noopener noreferrer">{t.openMap}<Icon name="arrow" size={16} /></a></div></> : <p className="catalog-muted-note">{a.noMap}</p>}</section>
        <section id="event-policies" className="detail-section" aria-labelledby="event-policies-title"><h2 id="event-policies-title">{t.policies}</h2>{details.policies.length ? <div className="detail-policy-list">{details.policies.map((policy, index) => <div key={index}><h3>{policy.title[lang]}</h3><p>{policy.body[lang]}</p></div>)}</div> : <p>{a.noPolicies}</p>}</section>
        <section id="event-faq" className="detail-section" aria-labelledby="event-faq-title"><h2 id="event-faq-title">{t.faq}</h2>{details.faqs.length ? details.faqs.map((faq, index) => <details className="detail-faq" key={index}><summary>{faq.question[lang]}</summary><p>{faq.answer[lang]}</p></details>) : <p>{a.noFaqs}</p>}</section>
      </div>
      <aside className="detail-ticket" aria-labelledby="event-ticket-title"><div className="detail-ticket-top"><Icon name="ticket" size={27} /><span>{(sample ? getBookingCatalogue(event.id)?.mode === 'seated' : details.venueType === 'SEATED') ? bookingStrings[lang].seated : details.venueType === 'STANDING' || sample ? bookingStrings[lang].standing : t.generalAdmission}</span></div><h2 id="event-ticket-title">{t.tickets}</h2><p className="detail-ticket-price">{price(event.price)}</p><dl><div><dt>{home.date}</dt><dd><time dateTime={event.date}>{formatDate(event.date, lang, true)}</time></dd></div><div><dt>{home.location}</dt><dd>{event.venue[lang]}<span>{cityNames[event.city][lang]}</span></dd></div></dl>
        {!sample && !!details.ticketCategories?.length && <div className="catalog-ticket-categories" aria-label={a.categories}>{details.ticketCategories.map((category) => <div key={category.id}><strong>{category.name[lang]}</strong><span>{price(category.price)}</span><small>{number(category.remaining)} {a.remaining}{category.feePercent !== null && <> · {a.serviceFee}: {number(category.feePercent)}%</>}</small></div>)}</div>}
        {event.status !== 'available' && <p className="detail-status-note">{sample ? event.status === 'cancelled' ? eventText.cancelledNote : eventText.soldOutNote : event.status === 'cancelled' ? a.cancelled : a.soldOut}</p>}
        {/* Bookable when we know how to sell it: sample events, and real seated or standing venues */}
        {(sample || details.venueType === 'STANDING' || details.venueType === 'SEATED') && event.status === 'available' ? <Link className="home-button" to={selectionPath(event.id)}>{bookingStrings[lang].stepSelection}<Icon name="arrow" size={18} /></Link> : <button className="home-button" disabled>{event.status === 'cancelled' ? eventText.cancelledBooking : event.status === 'sold-out' ? eventStatusLabels['sold-out'][lang] : a.bookingUnavailable}</button>}
        <p className="detail-booking-note">{sample ? t.bookingNote : a.bookingNote}</p>{!sample && Date.parse(event.date) <= now && <p className="detail-status-note">{a.started}</p>}{details.synthetic && <p className="detail-booking-note">{a.testNote}</p>}<Link className="home-text-link" to="/events">{t.exploreEvents}<Icon name="arrow" size={17} /></Link>
      </aside>
    </div>
  </article>
}

export default function EventDetail() {
  const { eventId = '' } = useParams()
  const sample = events.find((event) => event.id === eventId)
  const api = useApiEvent(eventId, !sample)
  const { lang } = usePreferences()
  const t = discoveryStrings[lang], a = apiStrings[lang]
  if (sample) return <EventDetailContent key={sample.id} event={sample} details={{ ...getEventDetails(sample), fallbackImage: false }} />
  if (api.data) return <EventDetailContent key={api.data.event.id} {...api.data} />
  if (api.status === 'loading') return <section className="home-container catalog-detail-loading" role="status"><p className="discovery-eyebrow">{t.eventsLabel}</p><h1 className="discovery-title">{a.loadingDetail}</h1><p>{a.loadingLead}</p><div className="catalog-skeleton" aria-hidden="true" /></section>
  if (api.status === 'error') return <section className="home-container discovery-not-found" role="alert"><h1 className="discovery-title">{a.detailError}</h1><p>{a.detailErrorLead}</p><div className="catalog-recovery"><button type="button" className="home-button" onClick={api.retry}>{a.retry}</button><Link className="home-outline-button" to="/events">{t.backToResults}</Link></div></section>
  return <NotFound event />
}
