import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { usePreferences } from '../Auth/preferences'
import { events } from '../Homepage/data/events'
import type { Event } from '../Homepage/types'
import Icon from '../Homepage/components/Icon'
import { useBooking } from './bookingContext'
import { validAttendee, type BookingError, type SampleReceipt } from './bookingModel'
import { selectionPath } from './catalogue'
import { bookingMoney, bookingNumber, bookingStrings } from './strings'
import { BookingEmpty, BookingErrorMessage, BookingShell, OrderSummary, TicketDescription } from './BookingParts'
import PolicyDialog from './PolicyDialog'

function CheckoutResult({ event, receipt, outcome }: { event: Event; receipt?: SampleReceipt; outcome?: 'declined' | 'timeout' }) {
  const { lang } = usePreferences()
  const t = bookingStrings[lang]
  const { act } = useBooking()
  return <BookingShell step={3} event={event} title={receipt ? t.successTitle : outcome === 'declined' ? t.declinedTitle : t.timeoutTitle} lead={receipt ? t.successLead : outcome === 'declined' ? t.declinedLead : t.timeoutLead}>
    <section className={`booking-result booking-panel${receipt ? ' is-success' : ''}`} aria-live="polite"><span className="booking-result-mark"><Icon name={receipt ? 'ticket' : 'clock'} size={42} /></span><h2>{event.title[lang]}</h2>
      {receipt && <><p className="discovery-eyebrow">{t.sampleReference}</p><strong className="booking-reference" dir="ltr">{receipt.reference}</strong><dl className="booking-result-facts"><div><dt>{t.receiptQuantity}</dt><dd>{bookingNumber(receipt.quantity, lang)}</dd></div><div><dt>{t.receiptTotal}</dt><dd>{bookingMoney(receipt.total, lang)}</dd></div></dl></>}
      <p className="booking-subtle-note">{t.paymentNote}</p><div className="booking-actions"><Link className="home-outline-button" to="/events">{t.browse}</Link><Link className="home-button" to={selectionPath(event.id)} onClick={() => act({ type: 'reset', eventId: event.id })}>{t.chooseAgain}<Icon name="arrow" size={18} /></Link></div>
    </section>
  </BookingShell>
}

export default function Checkout() {
  const { lang } = usePreferences()
  const t = bookingStrings[lang]
  const { state, names, act, now } = useBooking()
  const [choice, setChoice] = useState<'success' | 'declined' | 'timeout'>('success')
  const [outcome, setOutcome] = useState<'declined' | 'timeout' | null>(null)
  const [policyOpen, setPolicyOpen] = useState(false)
  const [reviewed, setReviewed] = useState(false)
  const [accepted, setAccepted] = useState(false)
  const [policyError, setPolicyError] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<BookingError | ''>('')
  const inFlight = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])
  const event = events.find((event) => event.id === state.eventId)

  if (state.receipt && event) return <CheckoutResult event={event} receipt={state.receipt} />
  if (outcome && event) return <CheckoutResult event={event} outcome={outcome} />
  if (!event || !state.items.length || state.expired || state.expiresAt !== null && state.expiresAt <= now) return <BookingEmpty step={3} event={event} />
  if (event.status !== 'available' || Date.parse(event.date) <= now) return <BookingEmpty step={3} event={event} blocked />
  if (state.items.some((item) => !validAttendee(names[item.key] ?? ''))) return <BookingShell step={3} event={event} title={t.missingNamesTitle} lead={t.missingNamesLead}><div className="booking-layout"><section className="booking-panel booking-missing-names"><Icon name="user" size={42} /><Link className="home-button" to="/cart">{t.returnCart}<Icon name="arrow" size={18} /></Link></section><OrderSummary event={event} showItems /></div></BookingShell>

  function submit(submission: FormEvent) {
    submission.preventDefault()
    if (inFlight.current) return
    if (!accepted || !reviewed) { setPolicyError(true); document.getElementById('booking-read-policies')?.focus(); return }
    if (!state.items.length || !state.expiresAt || state.expiresAt <= Date.now()) { act({ type: 'expire' }); return }
    if (state.items.some((item) => !validAttendee(names[item.key] ?? ''))) return
    inFlight.current = true
    setProcessing(true); setError('')
    // Local UI simulation only: no payment endpoint, financial details or ticket issuance.
    timer.current = setTimeout(() => {
      inFlight.current = false
      setProcessing(false)
      if (!state.expiresAt || state.expiresAt <= Date.now()) { act({ type: 'expire' }); return }
      if (choice !== 'success') { act({ type: 'release' }); setOutcome(choice); return }
      const reference = `DEMO-${crypto.randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase()}`
      setError(act({ type: 'complete', reference }) ?? '')
    }, 1200)
  }

  return <BookingShell step={3} event={event} title={t.checkoutTitle} lead={t.checkoutLead}>
    <form className="booking-layout" noValidate onSubmit={submit} aria-busy={processing}>
      <div className="booking-checkout-main">
        <section className="booking-panel" aria-labelledby="booking-review-title"><header className="booking-panel-heading"><p className="discovery-eyebrow">01 / {t.stepCart}</p><h2 id="booking-review-title">{t.review}</h2></header><ol className="booking-review-list">{state.items.map((item, index) => <li key={item.key}><span className="booking-review-index" aria-hidden="true">{bookingNumber(index + 1, lang)}</span><div><TicketDescription item={item} eventId={event.id} /><span className="booking-review-name"><bdi>{names[item.key].trim()}</bdi></span></div><Icon name="ticket" size={21} /></li>)}</ol><Link className="home-text-link" to="/cart">{t.editSelection}<Icon name="arrow" size={16} /></Link></section>
        <section className="booking-panel booking-payment-panel" aria-labelledby="booking-payment-title"><header className="booking-panel-heading"><p className="discovery-eyebrow">02 / {t.demo}</p><h2 id="booking-payment-title">{t.paymentTitle}</h2><p>{t.paymentLead}</p></header>
          <fieldset className="booking-outcomes" disabled={processing}><legend>{t.outcome}</legend>{(['success', 'declined', 'timeout'] as const).map((value) => <label key={value} className={choice === value ? 'is-selected' : ''}><input type="radio" name="sample-payment-outcome" value={value} checked={choice === value} onChange={() => setChoice(value)} /><span>{value === 'success' ? t.successOption : value === 'declined' ? t.declineOption : t.timeoutOption}</span></label>)}</fieldset>
        </section>
        <section className="booking-panel" aria-labelledby="booking-policy-section-title"><header className="booking-panel-heading"><p className="discovery-eyebrow">03 / {t.stepCheckout}</p><h2 id="booking-policy-section-title">{t.policies}</h2><p>{t.policyLead}</p></header><button id="booking-read-policies" className="home-outline-button" type="button" aria-haspopup="dialog" aria-controls="booking-policy-dialog" disabled={processing} onClick={() => setPolicyOpen(true)}>{t.readPolicies}<Icon name="arrow" size={16} /></button><label className="booking-policy-checkbox"><input id="booking-policy-accept" type="checkbox" checked={accepted} disabled={!reviewed || processing} onChange={(event) => { setAccepted(event.target.checked); setPolicyError(false) }} aria-describedby={policyError ? 'booking-policy-error' : undefined} />{t.policyAccept}</label>{policyError && <p id="booking-policy-error" className="booking-field-error" role="alert">{t.policyRequired}</p>}</section>
      </div>
      <OrderSummary event={event}><BookingErrorMessage error={error} /><button className="home-button booking-full-button" type="submit" disabled={processing}>{processing ? <><span className="booking-spinner" aria-hidden="true" />{t.processing}</> : <>{t.pay}<Icon name="arrow" size={18} /></>}</button><p className="booking-subtle-note" role="status">{processing ? t.processing : t.paymentNote}</p></OrderSummary>
      {policyOpen && <PolicyDialog event={event} onClose={() => setPolicyOpen(false)} onAccept={() => { setAccepted(true); setReviewed(true); setPolicyError(false); setPolicyOpen(false) }} />}
    </form>
  </BookingShell>
}
