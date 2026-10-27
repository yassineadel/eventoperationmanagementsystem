import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { usePreferences } from '../Auth/preferences'
import { useSession } from '../Auth/sessionContext'
import Icon from '../Homepage/components/Icon'
import { useBooking } from './bookingContext'
import { selectionTotals, validAttendee } from './bookingModel'
import { getBookingCatalogue, selectionPath, getBookingEvent, isLiveEvent, seatLabel } from './catalogue'
import { bookingMoney, bookingNumber } from './strings'
import { useBookingStrings } from './liveStrings'
import { BookingEmpty, BookingShell, OrderSummary, TicketDescription } from './BookingParts'
import { resolveAttendeeNames } from './attendees'
import { releaseSeatHold, syncHolds } from './liveHolds'
import LiveBookingRestore from './LiveBookingRestore'

// After a page refresh, a real event's cart is loaded again from the server first
export default function Cart() {
  return <LiveBookingRestore><CartContent /></LiveBookingRestore>
}

function CartContent() {
  const { lang } = usePreferences()
  const t = useBookingStrings()
  const { state, names: enteredNames, setAttendee, act, now } = useBooking()
  const session = useSession()
  const names = resolveAttendeeNames(state.items, enteredNames, session.status === 'authenticated' ? session.user : null)
  const navigate = useNavigate()
  const [submitted, setSubmitted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [serverError, setServerError] = useState('')
  const event = state.eventId ? getBookingEvent(state.eventId) : undefined
  if (!event || !state.items.length || state.expired || state.expiresAt !== null && state.expiresAt <= now) return <BookingEmpty event={event} />
  if (event.status !== 'available' || Date.parse(event.date) <= now) return <BookingEmpty event={event} blocked />
  const totals = selectionTotals(event.id, state.items)
  const catalogue = getBookingCatalogue(event.id)!
    const eventId = event.id
  // Removing a ticket of a real event also gives its place back on the server
  async function removeTicket(key: string) {
    if (!isLiveEvent(eventId)) { act({ type: 'remove', key }); return }
    setBusy(true)
    setServerError('')
    try {
      const seat = catalogue.seats.find((seat) => seat.id === state.items.find((item) => item.key === key)?.seatId)
      if (seat) {
        // A seat: give back only this seat's hold; the other seats keep theirs
        await releaseSeatHold(eventId, seatLabel(seat))
        act({ type: 'remove', key })
      } else {
        const expiresAt = await syncHolds(eventId, state.items.filter((item) => item.key !== key))
        act({ type: 'remove', key })
        if (expiresAt) act({ type: 'held', expiresAt })
      }
    } catch (error) {
      setServerError(error instanceof Error ? error.message : t.loadError)
    } finally {
      setBusy(false)
    }
  }
  function submit(event: FormEvent) {
    event.preventDefault()
    setSubmitted(true)
    const invalid = state.items.findIndex((item) => !validAttendee(names[item.key] ?? ''))
    if (invalid >= 0) { document.getElementById(`attendee-${invalid}`)?.focus(); return }
    navigate('/checkout?preview=1')
  }
  return <BookingShell step={2} event={event} title={t.cartTitle} lead={t.cartLead}>
    <form noValidate onSubmit={submit} className="booking-layout booking-cart-layout">
      <section className="booking-cart-content" aria-labelledby="cart-attendees-title"><header className="booking-panel-heading"><p className="discovery-eyebrow">{bookingNumber(state.items.length, lang)} {t.tickets}</p><h2 id="cart-attendees-title">{t.attendees}</h2><p>{t.attendeesLead}</p></header>
        <div className="booking-cart-items">{state.items.map((item, index) => {
          const category = catalogue.categories.find((category) => category.id === item.categoryId)!
          const invalid = submitted && !validAttendee(names[item.key] ?? '')
          const line = totals.lines.find((line) => line.key === item.key)!
          return <article className={`booking-cart-ticket tone-${category.color}`} key={item.key}><div className="booking-ticket-index"><span>{t.ticketNumber}</span><strong>{bookingNumber(index + 1, lang)}</strong><Icon name="ticket" size={22} /></div><div className="booking-cart-ticket-content"><div className="booking-cart-ticket-top"><div className="booking-cart-ticket-description"><TicketDescription item={item} eventId={event.id} /></div><button className="booking-icon-button" type="button" aria-label={`${t.remove}: ${t.ticketNumber} ${bookingNumber(index + 1, lang)}`} disabled={busy} onClick={() => removeTicket(item.key)}><Icon name="trash" size={18} /></button></div>
            <div className="booking-line-prices"><span>{t.price}: <bdi>{bookingMoney(line.price, lang)}</bdi></span><span>{t.fees} ({bookingNumber(category.feePercent, lang)}%): <bdi>{bookingMoney(line.fee, lang)}</bdi></span></div>
            <label className="booking-label" htmlFor={`attendee-${index}`}>{t.attendee} <span className="home-sr-only">{bookingNumber(index + 1, lang)}</span></label><input className="booking-input" id={`attendee-${index}`} value={names[item.key] ?? ''} onChange={(event) => setAttendee(item.key, event.target.value)} maxLength={100} autoComplete="off" placeholder={t.attendeePlaceholder} aria-invalid={invalid || undefined} aria-describedby={invalid ? `attendee-error-${index}` : undefined} required />{invalid && <p id={`attendee-error-${index}`} className="booking-field-error">{t.attendeeError}</p>}
          </div></article>
        })}</div><p className="booking-subtle-note">{t.namesNote}</p><Link className="home-text-link" to={selectionPath(event.id)}><span className="discovery-back-arrow"><Icon name="arrow" size={17} /></span>{t.editSelection}</Link>
      </section>
      <OrderSummary event={event}>{serverError && <p className="booking-error" role="alert">{serverError}</p>}<button type="submit" disabled={busy} className="home-button booking-full-button">{t.readyCheckout}<Icon name="arrow" size={18} /></button><p className="booking-subtle-note">{t.paymentNote}</p></OrderSummary>
    </form>
  </BookingShell>
}
