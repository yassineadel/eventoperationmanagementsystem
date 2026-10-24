import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { usePreferences } from '../Auth/preferences'
import { events } from '../Homepage/data/events'
import type { Event } from '../Homepage/types'
import Icon from '../Homepage/components/Icon'
import NotFound from '../Discovery/NotFound'
import { useBooking } from './bookingContext'
import { categoryRemaining, MAX_TICKETS, type BookingError, type Selection } from './bookingModel'
import { getBookingCatalogue, getBookingEvent, registerLiveCatalogue, type Seat, isLiveEvent } from './catalogue'
import { useApiEvent } from '../../lib/useEventsApi'
import { eventIdPattern } from '../../lib/eventsModel'
import { getAvailability, getCart, holdStanding, releaseHold, type Availability, type Hold } from '../../lib/bookingApi'
import { ApiError } from '../../lib/api'
import { bookingMoney, bookingNumber, bookingStrings } from './strings'
import { BookingEmpty, BookingErrorMessage, BookingShell, OrderSummary, ReservationTimer, TicketDescription } from './BookingParts'
import SeatMap from './SeatMap'

function SelectionContent({ event }: { event: Event }) {
  const { lang } = usePreferences()
  const t = bookingStrings[lang]
  const { state, act, now } = useBooking()
  const catalogue = getBookingCatalogue(event.id)!
  const [inspected, setInspected] = useState<Seat | null>(null)
  const [zone, setZone] = useState('middle')
  const [error, setError] = useState<BookingError | ''>('')
  const navigate = useNavigate()
  const [reserving, setReserving] = useState(false)
  const [serverError, setServerError] = useState('')
  const items = state.eventId === event.id ? state.items : []
  const purchased = state.purchases[event.id]
  const atLimit = items.length + (purchased?.quantity ?? 0) >= MAX_TICKETS

  if (event.status !== 'available' || Date.parse(event.date) <= now) return <BookingEmpty step={1} event={event} blocked />
  if (state.expired) return <BookingEmpty step={1} event={event} />
  if (state.items.length && state.eventId !== event.id) return <BookingShell step={1} event={event} title={t.replaceTitle} lead={t.replaceLead}>
    <section className="booking-replace booking-panel"><Icon name="ticket" size={36} /><h2>{state.eventId ? getBookingEvent(state.eventId)?.title[lang] : ''}</h2><ReservationTimer /><div className="booking-actions"><Link className="home-outline-button" to="/cart">{t.keepCart}</Link><button className="home-button" type="button" onClick={() => act({ type: 'reset', eventId: event.id })}>{t.replace}</button></div></section>
  </BookingShell>

  function select(next: Selection[]) { setError(act({ type: 'select', eventId: event.id, items: next }) ?? '') }
  function changeQuantity(categoryId: string, quantity: number) {
    const current = items.filter((item) => item.categoryId === categoryId)
    const others = items.filter((item) => item.categoryId !== categoryId)
    if (quantity < current.length) select([...others, ...current.slice(0, quantity)])
    else {
      const key = Array.from({ length: MAX_TICKETS }, (_, index) => `${categoryId}-${index + 1}`).find((key) => !current.some((item) => item.key === key))
      if (key) select([...items, { key, categoryId }])
    }
  }
    // Real events: reserve the chosen tickets on the server, then go to the cart
  async function reserve() {
    setReserving(true)
    setServerError('')
    try {
      // Give back anything held earlier for this event, so the server matches this selection
      const previous = await getCart(event.id)
      await Promise.all(previous.lines.map((line) => releaseHold(line.holdId)))

      // Count the chosen tickets per category, then hold each category once
      const counts = new Map<string, number>()
      for (const item of items) counts.set(item.categoryId, (counts.get(item.categoryId) ?? 0) + 1)
      const holds: Hold[] = []
      for (const [categoryId, quantity] of counts) {
        const result = await holdStanding(event.id, categoryId, quantity)
        holds.push(...result.holds)
      }

      // The timer now follows the server's deadline
      act({ type: 'held', expiresAt: Math.min(...holds.map((hold) => Date.parse(hold.expiresAt))) })
      navigate('/cart')
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) setServerError(t.signInToReserve)
      else setServerError(error instanceof Error ? error.message : t.loadError)
    } finally {
      setReserving(false)
    }
  }
  const inspectedCategory = catalogue.categories.find((category) => category.id === inspected?.categoryId)
  const inspectedSelected = Boolean(inspected && items.some((item) => item.seatId === inspected.id))
  const inspectedUnavailable = Boolean(inspected && (inspected.status !== 'available' || purchased?.seats.includes(inspected.id)))

  return <BookingShell step={1} event={event} title={t.selection} lead={catalogue.mode === 'seated' ? t.selectionLead : t.standingLead}>
    <div className="booking-layout">
      <div className="booking-selection-main">
        {catalogue.mode === 'seated' ? <>
          <SeatMap catalogue={catalogue} selectedIds={items.flatMap((item) => item.seatId ? [item.seatId] : [])} purchasedIds={purchased?.seats ?? []} disabled={false} inspectedId={inspected?.id} onInspect={(seat) => {
            setInspected(seat); setError('')
            if (window.matchMedia('(max-width: 900px)').matches) requestAnimationFrame(() => document.getElementById('booking-seat-inspector')?.scrollIntoView({ block: 'nearest' }))
          }} />
          <section id="booking-seat-inspector" className="booking-seat-inspector booking-panel" aria-live="polite" aria-atomic="true">
            {inspected && inspectedCategory ? <><div className={`booking-seat-stamp tone-${inspectedCategory.color}`} aria-hidden="true"><small>{inspected.row}</small><strong>{bookingNumber(inspected.number, lang)}</strong></div><div><p className="discovery-eyebrow">{inspectedCategory.name[lang]}</p><h3>{t.row} <bdi>{inspected.row}</bdi> · {t.seat} {bookingNumber(inspected.number, lang)}</h3><p>{t.section}: {inspectedCategory.name[lang]}</p><p>{bookingMoney(inspectedCategory.price, lang)} · {bookingNumber(inspectedCategory.feePercent, lang)}% {t.feeRate}</p>{inspectedUnavailable && <p>{t.unavailableSeat}</p>}</div><button className={inspectedSelected ? 'home-outline-button' : 'home-button'} type="button" disabled={inspectedUnavailable || atLimit && !inspectedSelected} onClick={() => select(inspectedSelected ? items.filter((item) => item.seatId !== inspected.id) : [...items, { key: inspected.id, seatId: inspected.id, categoryId: inspected.categoryId }])}>{inspectedSelected ? t.removeSeat : t.addSeat}</button></>
              : <><Icon name="ticket" size={30} /><div><h3>{t.chooseSeat}</h3><p>{t.chooseSeatLead}</p></div></>}
          </section>
          <div className="booking-category-key" aria-label={t.categories}>{catalogue.categories.map((category) => <div className={`tone-${category.color}`} key={category.id}><span className="booking-category-dot" aria-hidden="true" /><div><strong>{category.name[lang]}</strong><span>{bookingMoney(category.price, lang)} + {bookingNumber(category.feePercent, lang)}% {t.feeRate}</span></div></div>)}</div>
        </> : <>
          <section className="booking-zone-map booking-panel" aria-labelledby="zone-map-title"><header className="booking-panel-heading"><p className="discovery-eyebrow">{t.standing}</p><h2 id="zone-map-title">{t.zoneMap}</h2><p>{t.zoneMapLead}</p></header>
            <div className="booking-zone-plan"><div className="booking-standing-stage"><span>{t.stage}</span><small>{t.standingStage}</small></div>{catalogue.categories.map((category, index) => {
              const remaining = categoryRemaining(state, event.id, category.id) - items.filter((item) => item.categoryId === category.id).length
              return <button type="button" className={`booking-map-zone tone-${category.color}${zone === category.id ? ' is-active' : ''}${remaining <= 0 ? ' is-full' : ''}`} key={category.id} onClick={() => { setZone(category.id); document.getElementById(`zone-${category.id}`)?.scrollIntoView({ block: 'nearest' }) }} aria-pressed={zone === category.id} aria-controls={`zone-${category.id}`}><span className="booking-zone-number" aria-hidden="true">0{index + 1}</span><strong>{category.name[lang]}</strong><span>{remaining > 0 ? `${bookingNumber(remaining, lang)} ${t.remaining}` : t.soldOut}</span></button>
            })}<span className="booking-zone-entry" aria-hidden="true">↓</span></div>
          </section>
          <section className="booking-zone-options" aria-labelledby="zone-options-title"><h2 id="zone-options-title">{t.zones}</h2>{catalogue.categories.map((category, index) => {
            const quantity = items.filter((item) => item.categoryId === category.id).length
            const available = categoryRemaining(state, event.id, category.id)
            return <article id={`zone-${category.id}`} key={category.id} className={`booking-zone-option tone-${category.color}${zone === category.id ? ' is-active' : ''}`}><span className="booking-zone-index" aria-hidden="true">0{index + 1}</span><div className="booking-zone-copy"><h3>{category.name[lang]}</h3><p>{category.description[lang]}</p><span>{bookingNumber(Math.max(0, available - quantity), lang)} {t.remaining} · {bookingNumber(category.feePercent, lang)}% {t.feeRate}</span><progress max={category.capacity} value={Math.max(0, available - quantity)} aria-label={`${category.name[lang]}: ${t.remaining}`} /></div><div className="booking-zone-purchase"><strong>{category.price ? bookingMoney(category.price, lang) : t.free}</strong><small>{t.each}</small><div className="booking-stepper" role="group" aria-label={`${t.quantity}: ${category.name[lang]}`}><button type="button" aria-label={`${t.decrease}: ${category.name[lang]}`} disabled={!quantity} onClick={() => changeQuantity(category.id, quantity - 1)}>−</button><output aria-live="polite">{bookingNumber(quantity, lang)}</output><button type="button" aria-label={`${t.increase}: ${category.name[lang]}`} disabled={quantity >= available || atLimit} onClick={() => changeQuantity(category.id, quantity + 1)}>+</button></div></div></article>
          })}</section>
        </>}
        <p className={`booking-limit-note${atLimit ? ' is-full' : ''}`}>{t.maxNote}</p><BookingErrorMessage error={error} />
      </div>
      <OrderSummary event={event}>
        {items.length ? <ul className="booking-selection-items">{items.map((item) => <li key={item.key}><div><TicketDescription item={item} eventId={event.id} /></div><button type="button" aria-label={`${t.remove}: ${item.seatId ? catalogue.seats.find((seat) => seat.id === item.seatId)?.row + ' ' + catalogue.seats.find((seat) => seat.id === item.seatId)?.number : catalogue.categories.find((category) => category.id === item.categoryId)?.name[lang]}`} onClick={() => select(items.filter((current) => current.key !== item.key))}><Icon name="close" size={16} /></button></li>)}</ul> : <div className="booking-summary-empty"><Icon name="ticket" size={26} /><h3>{t.selectionEmpty}</h3><p>{t.selectionEmptyLead}</p></div>}
{serverError && <p className="booking-error" role="alert">{serverError}</p>}
        {!items.length ? <button className="home-button booking-full-button" disabled>{t.continueCart}</button>
          : isLiveEvent(event.id) ? <button className="home-button booking-full-button" type="button" disabled={reserving} onClick={reserve}>{reserving ? t.reserving : t.continueCart}<Icon name="arrow" size={18} /></button>
          : <Link className="home-button booking-full-button" to="/cart">{t.continueCart}<Icon name="arrow" size={18} /></Link>}
      </OrderSummary>
    </div>
  </BookingShell>
}

// A real event from the backend: load it and its live availability, then show the same page
function LiveSelection({ eventId }: { eventId: string }) {
  const { lang } = usePreferences()
  const t = bookingStrings[lang]
  const api = useApiEvent(eventId)
  const [availability, setAvailability] = useState<Availability | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    getAvailability(eventId, controller.signal)
      .then(setAvailability)
      .catch(() => { if (!controller.signal.aborted) setFailed(true) })
    return () => controller.abort()
  }, [eventId])

  if (api.status === 'not-found' || api.status === 'idle') return <NotFound event />
  if (api.status === 'error' || failed) return <section className="home-container discovery-not-found" role="alert"><h1 className="discovery-title">{t.loadError}</h1><button type="button" className="home-button" onClick={() => window.location.reload()}>{t.retry}</button></section>
  if (!api.data || !availability) return <section className="home-container" role="status"><p>{t.loading}</p></section>

  // Seat maps for seated venues come in a later step
  if (api.data.details.venueType === 'SEATED') return <BookingEmpty step={1} event={api.data.event} blocked />

  const feePercents = Object.fromEntries(api.data.details.ticketCategories?.map((c) => [c.id, c.feePercent ?? 0]) ?? [])
  registerLiveCatalogue(api.data.event, availability, feePercents)
  return <SelectionContent key={eventId} event={api.data.event} />
}

export default function TicketSelection() {
  const { eventId = '' } = useParams()
  const sample = events.find((event) => event.id === eventId)
  if (sample) return <SelectionContent key={sample.id} event={sample} />
  // Real event ids are UUIDs; anything else can't exist
  return eventIdPattern.test(eventId) ? <LiveSelection eventId={eventId} /> : <NotFound event />
}
