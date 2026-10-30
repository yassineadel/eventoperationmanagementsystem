import { useContext, useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ApiError } from '../../lib/api'
import { transferTicketToAccount, type TicketTransferResult } from '../../lib/bookingApi'
import { eventRequest } from '../../lib/eventRequests'
import { EventsClientContext } from '../../lib/useEventsApi'
import { usePreferences } from '../Auth/preferences'
import { useSession } from '../Auth/sessionContext'
import Icon from '../Homepage/components/Icon'
import { loadLiveTicket, type LiveTicketData } from './liveTickets'
import { liveTransferStrings, transferAvailability, transferFailure, transferRecipient, type TransferIssue } from './liveTransfer'
import { TicketEmpty, TicketShell } from './TicketParts'
import { TicketActionHeader, TicketActionSummary } from './TicketActionParts'

export default function LiveTransferTicket({ ticketId }: { ticketId: string }) {
  const { lang } = usePreferences()
  const t = liveTransferStrings[lang]
  const session = useSession()
  const client = useContext(EventsClientContext)
  const [attempt, setAttempt] = useState(0)
  const key = `${session.status}:${session.user?.id ?? ''}:${ticketId}:${attempt}`
  const [result, setResult] = useState<{ key: string; data?: LiveTicketData; missing?: boolean; signIn?: boolean } | null>(null)
  useEffect(() => {
    if (session.status !== 'authenticated') return
    const controller = new AbortController()
    eventRequest((signal) => loadLiveTicket(ticketId, client, signal), controller.signal)
      .then((data) => { if (!controller.signal.aborted) setResult({ key, data }) })
      .catch((error) => { if (!controller.signal.aborted) setResult({ key, missing: error instanceof ApiError && [403, 404].includes(error.status), signIn: error instanceof ApiError && error.status === 401 }) })
    return () => controller.abort()
  }, [key, ticketId, client, session.status])
  const current = result?.key === key ? result : null
  const login = `/login?returnTo=${encodeURIComponent(`/my-tickets/${ticketId}/transfer`)}`
  if (session.status === 'guest' || current?.signIn) return <TicketShell title={t.signIn} lead={t.signInLead} live><Link className="home-button" to={login}>{t.signIn}</Link></TicketShell>
  if (session.status === 'unavailable') return <TicketShell title={t.title} lead={t.loadError} live><button className="home-outline-button" onClick={() => void session.refresh()}>{t.retry}</button></TicketShell>
  if (!current || session.status === 'loading') return <TicketShell title={t.loading} lead="" live><p role="status">{t.loading}</p></TicketShell>
  if (current.missing) return <TicketShell title={t.missingTitle} lead={t.missingLead} live><TicketEmpty title={t.missingTitle} lead={t.missingLead} /></TicketShell>
  if (!current.data || !session.user) return <TicketShell title={t.title} lead="" live><section className="tickets-empty tickets-panel" role="alert"><p>{t.loadError}</p><button className="home-outline-button" onClick={() => setAttempt((value) => value + 1)}>{t.retry}</button></section></TicketShell>
  return <LiveTransferForm key={key} data={current.data} owner={{ name: session.user.fullName || session.user.email, email: session.user.email }} onReload={() => setAttempt((value) => value + 1)} />
}

export function LiveTransferForm({ data, owner, onReload }: { data: LiveTicketData; owner: { name: string; email: string }; onReload: () => void }) {
  const { lang } = usePreferences()
  const t = liveTransferStrings[lang]
  const { ticket } = data
  const [stage, setStage] = useState<'recipient' | 'review' | 'done'>(data.status === 'TRANSFERRED_AWAY' ? 'done' : 'recipient')
  const [email, setEmail] = useState('')
  const [reviewedEmail, setReviewedEmail] = useState('')
  const [acknowledged, setAcknowledged] = useState(false)
  const [issue, setIssue] = useState<TransferIssue | null>(null)
  const [busy, setBusy] = useState(false)
  const [needsRefresh, setNeedsRefresh] = useState(false)
  const [completed, setCompleted] = useState<TicketTransferResult | null>(null)
  const [now, setNow] = useState(Date.now)
  const pending = useRef<AbortController | null>(null)
  const stageRef = useRef<HTMLHeadingElement>(null)
  const feedbackRef = useRef<HTMLParagraphElement>(null)
  useEffect(() => () => pending.current?.abort(), [])
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer) }, [])
  useEffect(() => { if (stage !== 'recipient') stageRef.current?.focus() }, [stage])
  useEffect(() => { if (issue) feedbackRef.current?.focus() }, [issue])
  const blocked = data.status === 'EXPIRED' ? 'past' : data.transfersLeft === 0 ? 'limit' : transferAvailability(ticket, now)
  const detailPath = `/my-tickets/${encodeURIComponent(ticket.id)}`
  const displayTicket = stage === 'done' ? { ...ticket, status: 'transferred' as const, attendeeName: completed?.attendeeName ?? ticket.attendeeName, transferCount: completed?.transferCount ?? ticket.transferCount } : ticket
  const number = (value: number) => new Intl.NumberFormat(lang === 'ar' ? 'ar-EG' : 'en').format(value)

  function review(event: FormEvent) {
    event.preventDefault()
    if (busy || needsRefresh) return
    const unavailable = transferAvailability(ticket, Date.now())
    if (unavailable) { setIssue(unavailable); return }
    const recipient = transferRecipient(email, owner.email)
    if (recipient.issue) { setIssue(recipient.issue); return }
    setEmail(recipient.email); setReviewedEmail(recipient.email); setAcknowledged(false); setIssue(null); setStage('review')
  }
  async function confirm(event: FormEvent) {
    event.preventDefault()
    if (pending.current || needsRefresh || !reviewedEmail) return
    if (!acknowledged) { setIssue('confirmation'); return }
    const unavailable = transferAvailability(ticket, Date.now())
    if (unavailable) { setIssue(unavailable); return }
    const controller = new AbortController()
    pending.current = controller; setBusy(true); setIssue(null)
    try {
      const result = await eventRequest((signal) => transferTicketToAccount(ticket.id, reviewedEmail, signal), controller.signal)
      if (controller.signal.aborted) return
      setCompleted(result); setStage('done')
    } catch (error) {
      if (controller.signal.aborted) return
      const failure = transferFailure(error)
      setIssue(failure)
      if (['uncertain', 'unavailable', 'missing', 'refundPending', 'limit', 'past'].includes(failure)) setNeedsRefresh(true)
      if (['recipientMissing', 'recipientBlocked', 'self'].includes(failure)) { setAcknowledged(false); setStage('recipient') }
    } finally { if (!controller.signal.aborted) setBusy(false); if (pending.current === controller) pending.current = null }
  }
  const feedback = issue && <p className="tickets-error" id="live-transfer-error" role="alert" tabIndex={-1} ref={feedbackRef}>{t.issues[issue]}{issue === 'session' && <> <Link to={`/login?returnTo=${encodeURIComponent(`${detailPath}/transfer`)}`}>{t.signIn}</Link></>}</p>
  return <TicketShell title={t.title} lead={t.lead} eyebrow={t.eyebrow} backTo={detailPath} backLabel={t.back} appearance="action" live header={<TicketActionHeader title={t.title} lead={t.lead} eyebrow={t.eyebrow} kind="transfer" />}>
    <ol className="tickets-action-steps ta-steps" aria-label={t.steps}>{[t.recipient, t.review, t.complete].map((label, index) => {
      const current = stage === 'done' ? 2 : stage === 'review' ? 1 : 0
      return <li key={label} className={current === index ? 'is-current' : current > index ? 'is-done' : ''} aria-current={current === index ? 'step' : undefined}><span aria-hidden="true">{number(index + 1)}</span>{label}</li>
    })}</ol>
    <div className="tickets-action-layout"><div className="tickets-stack">
      {stage === 'done' ? <section className="tickets-panel tickets-success ta-form-panel ta-result" aria-labelledby="live-transfer-done">
        <span className="tickets-success-mark" aria-hidden="true"><Icon name="conferences" size={34} /></span><h2 id="live-transfer-done" ref={stageRef} tabIndex={-1}>{t.successTitle}</h2><p>{completed ? t.successLead : t.recordedLead}</p>
        {completed && <div className="tickets-recipient-card"><span>{t.sentTo}</span><strong><bdi dir="ltr">{reviewedEmail}</bdi></strong></div>}
        <div className="tickets-action-footer"><Link className="home-button" to="/my-tickets">{t.wallet}<Icon name="arrow" size={18} /></Link><Link className="home-outline-button" to={`/events/${encodeURIComponent(ticket.event.id)}`}>{t.event}</Link></div>
      </section> : blocked ? <section className="tickets-panel ta-form-panel ta-unavailable"><span className="tickets-success-mark" aria-hidden="true"><Icon name="lock" size={30} /></span><h2>{t.unavailableTitle}</h2><p className="tickets-alert">{t.issues[blocked]}</p><Link className="home-outline-button" to={detailPath}>{t.back}</Link></section>
        : stage === 'recipient' ? <section className="tickets-panel ta-form-panel ta-recipient" aria-labelledby="live-transfer-recipient-title"><header className="tickets-panel-header"><p className="tickets-eyebrow">01 / {t.recipient}</p><h2 id="live-transfer-recipient-title">{t.recipientTitle}</h2><p>{t.recipientLead}</p></header>
          <details className="ta-how"><summary><Icon name="conferences" size={18} />{t.how}</summary><p>{t.howLead}</p></details>
          <form noValidate onSubmit={review}><div className="tickets-field"><label htmlFor="live-transfer-email">{t.email}</label><input className="tickets-input" id="live-transfer-email" type="email" inputMode="email" autoComplete="off" dir="ltr" maxLength={254} value={email} disabled={busy || needsRefresh} onChange={(event) => { setEmail(event.target.value); setIssue(null) }} aria-invalid={issue === 'invalid' || issue === 'self' || issue === 'recipientMissing' || issue === 'recipientBlocked'} aria-describedby={`live-transfer-email-hint${issue ? ' live-transfer-error' : ''}`} /><p id="live-transfer-email-hint">{t.emailHint}</p></div>
            {feedback}<div className="tickets-action-footer">{needsRefresh ? <button className="home-button" type="button" onClick={onReload}>{t.checkStatus}</button> : <button className="home-button" type="submit">{t.reviewButton}<Icon name="arrow" size={18} /></button>}<Link className="home-outline-button" to={detailPath}>{t.back}</Link></div>
          </form></section>
        : <section className="tickets-panel ta-form-panel ta-review" aria-labelledby="live-transfer-review-title"><header className="tickets-panel-header"><p className="tickets-eyebrow">02 / {t.review}</p><h2 id="live-transfer-review-title" ref={stageRef} tabIndex={-1}>{t.reviewTitle}</h2><p>{t.reviewLead}</p></header>
          <div className="ta-ownership"><div><span>{t.from}</span><strong><bdi>{owner.name}</bdi></strong><bdi dir="ltr">{owner.email}</bdi></div><Icon name="arrow" size={21} /><div><span>{t.to}</span><strong><bdi dir="ltr">{reviewedEmail}</bdi></strong></div></div>
          <dl className="tickets-review-list"><div><dt>{t.transferCount}</dt><dd>{number(ticket.transferCount)} / {number(ticket.transferCount + data.transfersLeft)}</dd></div></dl><p className="tickets-notice"><Icon name="lock" size={19} />{t.important}</p><p>{t.policy}</p>
          <form noValidate onSubmit={(event) => void confirm(event)} aria-busy={busy}><label className="tickets-checkbox"><input type="checkbox" checked={acknowledged} disabled={busy || needsRefresh} onChange={(event) => { setAcknowledged(event.target.checked); setIssue(null) }} aria-describedby={issue ? 'live-transfer-error' : undefined} />{t.acknowledge}</label>{feedback}
            <div className="tickets-action-footer">{needsRefresh ? <button className="home-button" type="button" onClick={onReload}>{t.checkStatus}</button> : <button className="home-button" type="submit" disabled={busy}>{busy ? t.sending : t.confirm}<Icon name="arrow" size={18} /></button>}<button className="home-outline-button" type="button" disabled={busy || needsRefresh} onClick={() => { setStage('recipient'); setIssue(null); setAcknowledged(false) }}>{t.edit}</button></div>
          </form></section>}
    </div><TicketActionSummary ticket={displayTicket} live /></div>
  </TicketShell>
}
