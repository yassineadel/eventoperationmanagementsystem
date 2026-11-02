import { useEffect, useState } from 'react'
import { ApiError, getJson, postJson } from '../../lib/api'
import { usePreferences } from '../Auth/preferences'
import Icon from '../Homepage/components/Icon'
import { bookingMoney } from '../Booking/strings'

// The refund state of a real ticket, as the server reports it (the administrator's message included)
type Refund = { id: string; status: 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'SETTLED'; type: string; amount: string; message: string | null; requestedAt: string; reviewedAt: string | null } | null
type Quote = { eligible: boolean; reason: string | null; pricePaid: string; serviceFeeRetained: string; refundAmount: string; requestDeadline: string }

const copy = {
  en: {
    title: 'Refund', lead: 'Changed your plans? Ask for your money back. An administrator reviews every request.',
    youGet: 'You get back', feeKept: 'service fee kept', deadline: 'Requests close on',
    reason: 'Reason (optional)', reasonHint: 'e.g. I can no longer attend', request: 'Request refund', sending: 'Sending…', confirm: 'Send request',
    waiting: 'Refund requested', waitingLead: 'An administrator will review it soon. We will email you the result.',
    approved: 'Refund approved', approvedLead: (a: string) => `${a} is on its way to the card you paid with. It can take up to two weeks to appear.`,
    rejected: 'Refund declined', rejectedLead: 'Message from Hafletna:', stillValid: 'Your ticket is still valid.',
    cancelled: 'Event cancelled: full refund', notEligible: 'Not refundable',
  },
  ar: {
    title: 'الاسترداد', lead: 'تغيّرت خططك؟ اطلب استرداد المبلغ. يراجع أحد المسؤولين كل طلب.',
    youGet: 'ستسترد', feeKept: 'لا تُسترد رسوم الخدمة', deadline: 'آخر موعد للطلب',
    reason: 'السبب (اختياري)', reasonHint: 'مثلًا: لم أعد أستطيع الحضور', request: 'طلب استرداد', sending: 'جارٍ الإرسال…', confirm: 'إرسال الطلب',
    waiting: 'تم إرسال طلب الاسترداد', waitingLead: 'سيراجعه أحد المسؤولين قريبًا وسنرسل إليك النتيجة بالبريد.',
    approved: 'تمت الموافقة على الاسترداد', approvedLead: (a: string) => `${a} في طريقه إلى البطاقة التي دفعت بها. قد يستغرق ظهوره حتى أسبوعين.`,
    rejected: 'تم رفض طلب الاسترداد', rejectedLead: 'رسالة من حفلتنا:', stillValid: 'ما زالت تذكرتك صالحة.',
    cancelled: 'أُلغيت الفعالية: استرداد كامل', notEligible: 'غير قابلة للاسترداد',
  },
}

/** Request a refund for a real ticket, and see its result (including the administrator's message). */
export default function TicketRefundAction({ ticketId }: { ticketId: string }) {
  const { lang } = usePreferences()
  const c = copy[lang]
  const [refund, setRefund] = useState<Refund | undefined>(undefined)
  const [quote, setQuote] = useState<Quote | null>(null)
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    getJson<{ refund: Refund }>(`/api/tickets/${encodeURIComponent(ticketId)}`, { signal: controller.signal })
      .then((t) => {
        setRefund(t.refund ?? null)
        if (!t.refund || t.refund.status === 'REJECTED') {
          getJson<Quote>(`/api/tickets/${encodeURIComponent(ticketId)}/refund-quote`, { signal: controller.signal }).then(setQuote).catch(() => {})
        }
      })
      .catch(() => { if (!controller.signal.aborted) setRefund(null) })
    return () => controller.abort()
  }, [ticketId, tick])

  const send = async () => {
    setBusy(true); setError('')
    try {
      await postJson(`/api/tickets/${encodeURIComponent(ticketId)}/refund`, { reason: reason.trim() || undefined })
      setOpen(false); setReason(''); setTick((n) => n + 1)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong')
    } finally { setBusy(false) }
  }

  const money = (v: string) => bookingMoney(Number(v), lang)
  const done = refund && (refund.status === 'APPROVED' || refund.status === 'SETTLED')
  const pending = refund?.status === 'SUBMITTED'
  const rejected = refund?.status === 'REJECTED'

  return <article className={`pass-action-card${!done && !pending && quote && !quote.eligible ? ' is-unavailable' : ''}`}>
    <span className="pass-action-icon" aria-hidden="true"><Icon name="ticket" size={25} /></span>
    <h3>{done ? (refund.type === 'EVENT_CANCELLED' ? c.cancelled : c.approved) : pending ? c.waiting : rejected ? c.rejected : c.title}</h3>

    {done && <p className="tickets-success" role="status">{c.approvedLead(money(refund.amount))}</p>}
    {pending && <p>{c.waitingLead}<br /><strong>{c.youGet}: {money(refund.amount)}</strong></p>}
    {rejected && <div className="tickets-error" role="status" style={{ marginBottom: 8 }}><strong>{c.rejectedLead}</strong><br /><bdi>{refund.message}</bdi><br /><small>{c.stillValid}</small></div>}

    {!done && !pending && quote && (quote.eligible ? <>
      {!rejected && <p>{c.lead}</p>}
      <p><strong>{c.youGet}: {money(quote.refundAmount)}</strong><br /><small>{money(quote.serviceFeeRetained)} {c.feeKept} · {c.deadline} {new Date(quote.requestDeadline).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-GB')}</small></p>
      {open ? <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 12 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>{c.reason}
          <textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={c.reasonHint} maxLength={500}
            style={{ font: 'inherit', padding: 8, borderRadius: 8, border: '1px solid var(--home-line)', background: 'var(--home-paper)', color: 'inherit' }} /></label>
        <button className="home-button" type="button" disabled={busy} onClick={() => void send()}>{busy ? c.sending : c.confirm}</button>
      </div> : <button className="pass-action-link" type="button" onClick={() => setOpen(true)}>{c.request}<Icon name="arrow" size={17} /></button>}
    </> : !rejected && <p>{c.notEligible}: {quote.reason}</p>)}
    {error && <p className="tickets-error" role="alert">{error}</p>}
  </article>
}
