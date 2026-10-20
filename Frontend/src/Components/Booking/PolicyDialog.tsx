import { useEffect, useRef } from 'react'
import { usePreferences } from '../Auth/preferences'
import type { Event } from '../Homepage/types'
import Icon from '../Homepage/components/Icon'
import { getEventDetails } from '../Discovery/eventDetails'
import { bookingStrings } from './strings'

export default function PolicyDialog({ event, onClose, onAccept }: { event: Event; onClose: () => void; onAccept: () => void }) {
  const { lang } = usePreferences()
  const t = bookingStrings[lang]
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const element = dialog.current!
    const focus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const overflow = document.body.style.overflow
    element.showModal()
    document.body.style.overflow = 'hidden'
    element.querySelector<HTMLElement>('#booking-policy-title')?.focus({ preventScroll: true })
    return () => { element.close(); document.body.style.overflow = overflow; if (focus?.isConnected) focus.focus({ preventScroll: true }) }
  }, [])
  return <dialog ref={dialog} id="booking-policy-dialog" className="booking-policy-dialog" aria-modal="true" aria-labelledby="booking-policy-title" aria-describedby="booking-policy-lead" onCancel={(event) => { event.preventDefault(); onClose() }}>
    <button type="button" className="booking-dialog-close" aria-label={t.close} onClick={onClose}><Icon name="close" size={22} /></button><p className="discovery-eyebrow">{event.title[lang]}</p><h2 id="booking-policy-title" tabIndex={-1}>{t.policies}</h2><p id="booking-policy-lead">{t.policyLead}</p>
    <div className="booking-policy-copy">{getEventDetails(event).policies.map((policy) => <section key={policy.title.en}><h3>{policy.title[lang]}</h3><p>{policy.body[lang]}</p></section>)}</div>
    <p className="booking-subtle-note">{t.demoLead}</p><div className="booking-actions"><button className="home-outline-button" type="button" onClick={onClose}>{t.close}</button><button className="home-button" type="button" onClick={onAccept}>{t.agree}</button></div>
  </dialog>
}
