import { Link } from 'react-router-dom'
import { usePreferences } from '../Auth/preferences'
import Icon from '../Homepage/components/Icon'
import { useTickets } from './ticketsContext'
import type { SampleTicket } from './ticketsModel'
import { liveTransferStrings, transferAvailability } from './liveTransfer'

export default function TicketTransferAction({ ticket }: { ticket: SampleTicket }) {
  const { lang } = usePreferences()
  const { now } = useTickets()
  const t = liveTransferStrings[lang]
  const blocked = transferAvailability(ticket, now)
  return <article className={`pass-action-card${blocked ? ' is-unavailable' : ''}`}>
    <span className="pass-action-icon" aria-hidden="true"><Icon name="conferences" size={25} /></span><h3>{t.title}</h3><p>{blocked ? t.issues[blocked] : t.actionLead}</p>
    {blocked ? <button className="pass-action-link" type="button" disabled>{t.title}<Icon name="lock" size={17} /></button> : <Link className="pass-action-link" to={`/my-tickets/${encodeURIComponent(ticket.id)}/transfer`}>{t.title}<Icon name="arrow" size={17} /></Link>}
  </article>
}
