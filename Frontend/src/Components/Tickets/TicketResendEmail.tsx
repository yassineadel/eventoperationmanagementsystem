import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ApiError } from '../../lib/api'
import { resendTicketEmail } from '../../lib/bookingApi'
import { eventRequest } from '../../lib/eventRequests'
import { usePreferences } from '../Auth/preferences'
import { useSession } from '../Auth/sessionContext'
import Icon from '../Homepage/components/Icon'
import { ticketsStrings } from './strings'

export default function TicketResendEmail({ ticketId, available }: { ticketId: string; available: boolean }) {
  const { lang } = usePreferences()
  const session = useSession()
  const t = ticketsStrings[lang]
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [failure, setFailure] = useState<'limit' | 'session' | 'unavailable' | 'network'>('network')
  const pending = useRef<AbortController | null>(null)
  useEffect(() => () => pending.current?.abort(), [])
  async function resend() {
    if (pending.current || !available) return
    const controller = new AbortController()
    pending.current = controller
    setStatus('sending')
    try {
      await eventRequest((signal) => resendTicketEmail(ticketId, signal), controller.signal)
      if (!controller.signal.aborted) setStatus('sent')
    } catch (error) {
      if (controller.signal.aborted) return
      setFailure(error instanceof ApiError && error.status === 429 ? 'limit' : error instanceof ApiError && error.status === 401 ? 'session' : error instanceof ApiError && [400, 403, 404].includes(error.status) ? 'unavailable' : 'network')
      setStatus('error')
    } finally { if (pending.current === controller) pending.current = null }
  }
  const message = failure === 'limit' ? t.liveResendLimit : failure === 'session' ? t.liveResendSession : failure === 'unavailable' ? t.liveResendUnavailable : t.liveResendError
  return <article className="pass-action-card">
    <span className="pass-action-icon" aria-hidden="true"><Icon name="mail" size={25} /></span>
    <h3>{t.liveResend}</h3><p>{available ? t.liveResendLead : t.liveResendUnavailable}{available && session.user?.email && <><br /><strong><bdi dir="ltr">{session.user.email}</bdi></strong></>}</p>
    <button className="pass-action-link" type="button" disabled={!available || status === 'sending'} onClick={() => void resend()}>{status === 'sending' ? t.liveResending : t.liveResend}<Icon name="arrow" size={17} /></button>
    {status === 'sent' && <p className="tickets-success" role="status">{t.liveResendDone}</p>}
    {status === 'error' && <p className="tickets-error" role="alert">{message}{failure === 'session' && <> <Link to={`/login?returnTo=${encodeURIComponent(`/my-tickets/${ticketId}`)}`}>{t.signIn}</Link></>}</p>}
  </article>
}
