import { useParams } from 'react-router-dom'
import { usePreferences } from '../Auth/preferences'
import { useTickets } from './ticketsContext'
import { TicketEmpty, TicketShell } from './TicketParts'
import { ticketsStrings } from './strings'
import { isLiveOrderReference } from './liveOrders'
import LiveConfirmation from './LiveConfirmation'
import ConfirmationContent from './ConfirmationContent'

export default function Confirmation() {
  const { orderRef } = useParams()
  const { lang } = usePreferences()
  const { state } = useTickets()
  const t = ticketsStrings[lang]
  const order = state.orders.find((item) => item.reference === orderRef)
  if (!order && orderRef && isLiveOrderReference(orderRef)) return <LiveConfirmation identifier={orderRef} />
  if (!order) return <TicketShell title={t.orderNotFound} lead={t.orderNotFoundLead}><TicketEmpty title={t.orderNotFound} lead={t.orderNotFoundLead} /></TicketShell>
  const tickets = order.ticketIds.flatMap((id) => state.tickets.find((ticket) => ticket.id === id) ?? [])
  return <ConfirmationContent order={order} tickets={tickets} />
}
