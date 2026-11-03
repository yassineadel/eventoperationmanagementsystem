import { useContext, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { usePreferences } from '../Auth/preferences'
import { useSession } from '../Auth/sessionContext'
import { ApiError } from '../../lib/api'
import { eventRequest } from '../../lib/eventRequests'
import { EventsClientContext } from '../../lib/useEventsApi'
import { TicketEmpty, TicketShell } from './TicketParts'
import { ticketsStrings } from './strings'
import { loadLiveOrder, type LiveOrderConfirmation } from './liveOrders'
import ConfirmationContent from './ConfirmationContent'

export default function LiveConfirmation({ identifier }: { identifier: string }) {
  const session = useSession()
  const { lang } = usePreferences()
  const t = ticketsStrings[lang]
  const client = useContext(EventsClientContext)
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<{ key: string; data?: LiveOrderConfirmation; missing?: boolean; signIn?: boolean } | null>(null)
  const key = `${session.status}:${session.user?.id ?? ''}:${identifier}:${attempt}`
  useEffect(() => {
    if (session.status !== 'authenticated') return
    const controller = new AbortController()
    eventRequest((signal) => loadLiveOrder(identifier, client, signal), controller.signal)
      .then((data) => { if (!controller.signal.aborted) setResult({ key, data }) })
      .catch((error) => { if (!controller.signal.aborted) setResult({ key, missing: error instanceof ApiError && [403, 404].includes(error.status), signIn: error instanceof ApiError && error.status === 401 }) })
    return () => controller.abort()
  }, [key, identifier, client, session.status])

  const current = result?.key === key ? result : null
  const returnTo = `/orders/${encodeURIComponent(identifier)}/confirmation`
  if (session.status === 'guest' || current?.signIn) return <TicketShell title={t.liveOrderSignIn} lead={t.liveOrderSignInLead} live>
    <Link className="home-button" to={`/login?returnTo=${encodeURIComponent(returnTo)}`}>{t.signIn}</Link>
  </TicketShell>
  if (session.status === 'unavailable') return <TicketShell title={t.liveOrderSignIn} lead={t.sessionUnavailable} live>
    <button className="home-outline-button" onClick={() => void session.refresh()}>{t.tryAgain}</button>
  </TicketShell>
  if (!current || session.status === 'loading') return <TicketShell title={t.liveOrderLoading} lead="" live><p role="status">{t.liveOrderLoading}</p></TicketShell>
  if (current.missing) return <TicketShell title={t.liveOrderMissing} lead={t.liveOrderMissingLead} live><TicketEmpty title={t.liveOrderMissing} lead={t.liveOrderMissingLead} /></TicketShell>
  if (!current.data) return <TicketShell title={t.liveOrderError} lead="" live><section className="tickets-empty tickets-panel" role="alert"><p>{t.liveOrderError}</p><button className="home-outline-button" onClick={() => setAttempt((value) => value + 1)}>{t.tryAgain}</button></section></TicketShell>
  const data = current.data
  if (data.status !== 'PAID') {
    const title = data.status === 'PENDING' ? t.livePending : data.status === 'FAILED' ? t.liveFailed : t.liveCancelled
    return <TicketShell title={title} lead={t.liveUnpaidLead} live><section className="tickets-empty tickets-panel"><p><bdi>{data.order.reference}</bdi></p><div className="tickets-actions"><button className="home-outline-button" onClick={() => setAttempt((value) => value + 1)}>{t.tryAgain}</button><Link className="home-button" to="/my-tickets">{t.wallet}</Link></div></section></TicketShell>
  }
  return <ConfirmationContent order={data.order} tickets={data.tickets} live quantity={data.quantity} currency={data.currency} testPayment={data.testPayment} />
}
