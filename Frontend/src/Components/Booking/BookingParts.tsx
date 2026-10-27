import { useEffect, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { usePreferences } from '../Auth/preferences'
import type { Event } from '../Homepage/types'
import { formatDate } from '../Homepage/discovery'
import Icon from '../Homepage/components/Icon'
import { useBooking } from './bookingContext'
import { HOLD_MS, selectionTotals, type BookingError, type Selection } from './bookingModel'
import { getBookingCatalogue, seatSectionOf, selectionPath } from './catalogue'
import { bookingMoney, bookingNumber } from './strings'
import { useBookingStrings } from './liveStrings'
import './Booking.css'

export function BookingShell({ step, event, title, lead, children }: { step: number; event?: Event; title: string; lead: string; children: ReactNode }) {
  const { lang } = usePreferences()
  const t = useBookingStrings(event?.id)
  const { state, storageAvailable } = useBooking()
  useEffect(() => { document.title = `${title} | ${lang === 'ar' ? 'حفلتنا' : 'Hafletna'}` }, [title, lang])
  const steps = [t.stepSelection, t.stepCart, t.stepCheckout]
  return <div className="booking-page home-container">
    <nav className="booking-steps" aria-label={t.journey}><ol>{steps.map((label, index) => <li key={label} className={step === index + 1 ? 'is-current' : step > index + 1 ? 'is-done' : ''} aria-current={step === index + 1 ? 'step' : undefined}>
      <span aria-hidden="true">{bookingNumber(index + 1, lang)}</span>{index === 0 && event && step > 1 ? <Link to={selectionPath(event.id)}>{label}</Link> : index === 1 && state.items.length > 0 && step > 2 ? <Link to="/cart">{label}</Link> : <span>{label}</span>}
    </li>)}</ol><Link className="home-text-link" to={event ? `/events/${event.id}` : '/events'}>{event ? t.details : t.browse}<Icon name="arrow" size={16} /></Link></nav>
    <header className="booking-heading"><p className="discovery-eyebrow">{event ? event.title[lang] : 'Hafletna'}</p><h1 className="discovery-title">{title}</h1><p>{lead}</p></header>
    <div className="booking-demo" role="note"><Icon name="ticket" size={22} /><div><strong>{t.demo}</strong><p>{t.demoLead}</p>{!storageAvailable && <p className="booking-storage-note">{t.storage}</p>}</div></div>
    {children}
  </div>
}

export function ReservationTimer() {
  const { state, now } = useBooking()
  const { lang } = usePreferences()
  const t = useBookingStrings()
  if (state.expiresAt === null || !state.items.length) return null
  const remaining = Math.max(0, state.expiresAt - now)
  const seconds = Math.ceil(remaining / 1000)
  const digits = new Intl.NumberFormat(lang === 'ar' ? 'ar-EG' : 'en', { minimumIntegerDigits: 2 })
  return <div className={`booking-hold${remaining <= 60_000 ? ' is-urgent' : ''}`}><div><Icon name="clock" size={19} /><span><strong>{t.hold}</strong><small>{t.holdLead}</small></span><output role="timer" aria-live="off" aria-label={t.holdLead} dir="ltr">{digits.format(Math.floor(seconds / 60))}:{digits.format(seconds % 60)}</output></div>
    <progress max={HOLD_MS} value={remaining} aria-label={t.holdLead} />{remaining <= 60_000 && <p role="alert">{t.expiryWarning}</p>}
  </div>
}

export function TicketDescription({ item, eventId }: { item: Selection; eventId: string }) {
  const { lang } = usePreferences()
  const t = useBookingStrings(eventId)
  const catalogue = getBookingCatalogue(eventId)!
  const category = catalogue.categories.find((category) => category.id === item.categoryId)!
  const seat = catalogue.seats.find((seat) => seat.id === item.seatId)
  // Real venues repeat row letters in each section (Orchestra A, Balcony A), so name the section when it isn't the category
  const section = seat ? seatSectionOf(catalogue, seat)?.label[lang] : undefined
  const where = section && section !== category.name[lang] ? <><bdi>{section}</bdi> · </> : null
  return <><strong>{category.name[lang]}</strong>{seat && <span>{where}{t.row} <bdi>{seat.row}</bdi> · {t.seat} {bookingNumber(seat.number, lang)}</span>}</>
}

export function OrderSummary({ event, children, showItems = false }: { event: Event; children?: ReactNode; showItems?: boolean }) {
  const { lang } = usePreferences()
  const t = useBookingStrings(event.id)
  const { state } = useBooking()
  const totals = selectionTotals(event.id, state.eventId === event.id ? state.items : [])
  return <aside className="booking-summary" aria-labelledby="booking-summary-title">
    <div className="booking-summary-photo"><img src={event.image} alt="" width="640" height="320" /><span><Icon name="ticket" size={20} />{t.demo}</span></div>
    <div className="booking-summary-body"><p className="discovery-eyebrow">{t.summary}</p><h2 id="booking-summary-title">{event.title[lang]}</h2><p className="booking-summary-meta"><Icon name="pin" size={15} />{event.venue[lang]}</p><p className="booking-summary-meta"><Icon name="calendar" size={15} /><time dateTime={event.date}>{formatDate(event.date, lang, true)}</time></p>
      <div className="booking-ticket-tear" aria-hidden="true" /><ReservationTimer />
      {showItems && state.eventId === event.id && <ul className="booking-mini-items">{state.items.map((item) => <li key={item.key}><div><TicketDescription item={item} eventId={event.id} /></div><span>{bookingMoney(totals.lines.find((line) => line.key === item.key)!.price, lang)}</span></li>)}</ul>}
      <dl className="booking-totals"><div><dt>{t.subtotal} <span>({bookingNumber(totals.lines.length, lang)})</span></dt><dd>{bookingMoney(totals.subtotal, lang)}</dd></div><div><dt>{t.fees}</dt><dd>{bookingMoney(totals.fees, lang)}</dd></div><div className="booking-grand-total"><dt>{t.total}</dt><dd>{bookingMoney(totals.total, lang)}</dd></div></dl>
      {children}
    </div>
  </aside>
}

export function BookingErrorMessage({ error }: { error: BookingError | '' | undefined }) {
  const t = useBookingStrings()
  const message = error === 'limit' ? t.errorLimit : error === 'expired' ? t.errorExpired : error === 'unavailable' ? t.errorUnavailable : error ? t.errorInvalid : ''
  return message ? <p className="booking-error" role="alert">{message}</p> : null
}

export function BookingEmpty({ step = 2, event, blocked = false }: { step?: number; event?: Event; blocked?: boolean }) {
  const t = useBookingStrings(event?.id)
  const { state, act } = useBooking()
  const expired = !blocked && state.expired
  return <BookingShell step={step} event={event} title={blocked ? t.blockedTitle : expired ? t.expiredTitle : t.emptyTitle} lead={blocked ? t.blockedLead : expired ? t.expiredLead : t.emptyLead}>
    <section className="booking-empty"><span className="booking-empty-mark"><Icon name={expired ? 'clock' : 'ticket'} size={42} /></span>
      {event && !blocked ? <Link className="home-button" to={selectionPath(event.id)} onClick={() => act({ type: 'reset', eventId: event.id })}>{expired ? t.restart : t.chooseAgain}<Icon name="arrow" size={18} /></Link> : <Link className="home-button" to="/events">{t.browse}<Icon name="arrow" size={18} /></Link>}
    </section>
  </BookingShell>
}
