import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { usePreferences } from '../Auth/preferences'
import Icon from '../Homepage/components/Icon'
import { bookingMoney } from '../Booking/strings'
import { useTickets } from './ticketsContext'
import { refundQuote, type SampleTicket, type TicketRule } from './ticketsModel'
import { TicketEmpty, TicketShell } from './TicketParts'
import { TicketActionHeader, TicketActionSummary } from './TicketActionParts'

const en = {
  title: 'Request refund', lead: 'Review the refund amount and policy before submitting a request.', eyebrow: 'Refund request',
  missingTitle: 'We could not find that ticket.', missingLead: 'Open your sample wallet and choose a ticket to check its refund options.',
  back: 'Back to ticket', stepQuote: 'Your quote', stepReview: 'Review', stepRequested: 'Requested', steps: 'Refund request steps',
  quoteTitle: 'Refund amount', quoteLead: 'This sample quote applies to this ticket only. Every deduction is shown before you continue.',
  ticketPrice: 'Ticket face value', serviceFee: 'Non-refundable service fee', paidTotal: 'Original payment', refundable: 'Exact refundable amount',
  deadline: 'Request deadline', deadlineNote: 'Sample policy: request at least seven days before the event starts. The original category service fee is retained. Your refundable amount is the charged total minus that fee.',
  settlement: 'Sample settlement policy: after administrator approval, a refund returns to the original payment method within two weeks. This preview only records a request and does not move money.',
  samplePolicy: 'Sample refund policy', review: 'Review request', reviewTitle: 'Review refund request',
  reviewLead: 'Submitting records a sample request for review. It does not approve a refund or move any money.',
  attendee: 'Attendee', reference: 'Order reference', acknowledge: 'I have reviewed the deductions and the exact refundable amount. I understand this is a sample request, not an immediate refund.',
  confirm: 'Submit sample refund request', edit: 'Back to quote',
  requestedTitle: 'Refund request submitted', requestedLead: 'The sample refund request is recorded and awaiting review. No money has been returned.',
  status: 'Request status', pending: 'Pending review', requestedAt: 'Requested on', amountRequested: 'Requested refund amount',
  track: 'You can follow the sample request in your ticket details. Duplicate requests and transfers are blocked while it is pending.',
  codeNote: 'A pending request does not yet invalidate your sample ticket code. A completed refund would invalidate the ticket.',
  viewTicket: 'View ticket and request status', wallet: 'Back to My Tickets',
  unavailableTitle: 'This ticket is not eligible.', unavailableLead: 'No request has been submitted and your ticket has not changed.',
  generic: 'We could not record this sample request. Return to your ticket and check its latest status.',
  past: 'The refund deadline has passed. Requests must be made at least seven days before the event starts.',
  used: 'This ticket has already been used and is not eligible for a refund.', transferred: 'You have transferred this ticket to another owner and cannot request its refund.',
  transferredBefore: 'This ticket has transfer history. Transferred tickets are not eligible under this sample refund policy.',
  pendingError: 'A refund request is already pending for this ticket. You can view its status in the ticket details.',
  refunded: 'This ticket has already been refunded. Another request cannot be made.', free: 'This is a free ticket, so there is no payment to refund.',
  cancelled: 'Cancelled events follow a separate full-refund process. This sample request flow covers voluntary refunds only.',
  duplicate: 'A refund request already exists for this ticket. No duplicate request was created.',
  confirmation: 'Confirm that you have reviewed the amount and understand that this is a request for review.',
}
const ar: Record<keyof typeof en, string> = {
  title: 'طلب استرداد المبلغ', lead: 'راجع المبلغ وسياسة الاسترداد قبل تقديم الطلب.', eyebrow: 'طلب استرداد',
  missingTitle: 'لم نعثر على هذه التذكرة.', missingLead: 'افتح محفظتك التجريبية واختر تذكرة لمعرفة خيارات استرداد قيمتها.',
  back: 'العودة إلى التذكرة', stepQuote: 'حساب المبلغ', stepReview: 'المراجعة', stepRequested: 'تم الطلب', steps: 'خطوات طلب الاسترداد',
  quoteTitle: 'مبلغ الاسترداد', quoteLead: 'هذا الحساب التجريبي لهذه التذكرة فقط. تظهر جميع الخصومات قبل المتابعة.',
  ticketPrice: 'القيمة الأساسية للتذكرة', serviceFee: 'رسوم الخدمة غير المستردة', paidTotal: 'المبلغ المدفوع الأصلي', refundable: 'المبلغ المسترد بالتحديد',
  deadline: 'آخر موعد لتقديم الطلب', deadlineNote: 'السياسة التجريبية: يُقدم الطلب قبل بدء الفعالية بسبعة أيام على الأقل. تُحتفظ برسوم الخدمة الأصلية حسب فئة التذكرة، ويكون المبلغ المسترد هو الإجمالي المدفوع ناقص هذه الرسوم.',
  settlement: 'سياسة التسوية التجريبية: بعد موافقة الإدارة، يُعاد المبلغ إلى وسيلة الدفع الأصلية خلال أسبوعين. تكتفي هذه المعاينة بتسجيل الطلب ولا تحوّل أي أموال.',
  samplePolicy: 'سياسة الاسترداد التجريبية', review: 'مراجعة الطلب', reviewTitle: 'مراجعة طلب الاسترداد',
  reviewLead: 'يُسجّل الإرسال طلبًا تجريبيًا للمراجعة، ولا يعني الموافقة على الاسترداد أو تحويل أي أموال.',
  attendee: 'الحاضر', reference: 'مرجع الطلب', acknowledge: 'راجعت الخصومات والمبلغ المسترد بالتحديد، وأفهم أن هذا طلب تجريبي وليس استردادًا فوريًا.',
  confirm: 'إرسال طلب الاسترداد التجريبي', edit: 'العودة إلى حساب المبلغ',
  requestedTitle: 'تم تقديم طلب الاسترداد', requestedLead: 'سُجّل طلب الاسترداد التجريبي وهو بانتظار المراجعة. لم تُسترد أي أموال.',
  status: 'حالة الطلب', pending: 'قيد المراجعة', requestedAt: 'تاريخ تقديم الطلب', amountRequested: 'مبلغ الاسترداد المطلوب',
  track: 'يمكنك متابعة الطلب التجريبي في تفاصيل التذكرة. لا يمكن تكرار الطلب أو نقل التذكرة أثناء المراجعة.',
  codeNote: 'لا يُبطل الطلب قيد المراجعة رمز التذكرة التجريبي بعد. يؤدي اكتمال الاسترداد إلى إبطال التذكرة.',
  viewTicket: 'عرض التذكرة وحالة الطلب', wallet: 'العودة إلى تذاكري',
  unavailableTitle: 'هذه التذكرة غير مؤهلة للاسترداد.', unavailableLead: 'لم يُرسل أي طلب ولم يتم تغيير تذكرتك.',
  generic: 'تعذر تسجيل هذا الطلب التجريبي. عد إلى التذكرة وتحقق من حالتها الحالية.',
  past: 'انتهت مهلة طلب الاسترداد. يجب تقديم الطلب قبل بدء الفعالية بسبعة أيام على الأقل.',
  used: 'استُخدمت هذه التذكرة بالفعل، ولا يمكن استرداد قيمتها.', transferred: 'نقلت هذه التذكرة إلى مالك آخر، ولا يمكنك طلب استرداد قيمتها.',
  transferredBefore: 'سبق نقل هذه التذكرة. لا تتأهل التذاكر المنقولة للاسترداد وفق السياسة التجريبية.',
  pendingError: 'يوجد طلب استرداد قيد المراجعة لهذه التذكرة بالفعل. يمكنك متابعة حالته من تفاصيل التذكرة.',
  refunded: 'استُردت قيمة هذه التذكرة بالفعل، ولا يمكن تقديم طلب آخر.', free: 'هذه التذكرة مجانية، لذلك لا يوجد مبلغ لاسترداده.',
  cancelled: 'تخضع الفعاليات الملغاة لإجراء منفصل لاسترداد المبلغ بالكامل. يقتصر مسار الطلب التجريبي هذا على طلبات الاسترداد الاختيارية.',
  duplicate: 'يوجد طلب استرداد لهذه التذكرة بالفعل. لم يُنشأ طلب مكرر.',
  confirmation: 'أكد أنك راجعت المبلغ وتفهم أن هذا طلب للمراجعة.',
}

function RefundContent({ ticket }: { ticket: SampleTicket }) {
  const { lang } = usePreferences()
  const t = lang === 'ar' ? ar : en
  const { now, requestRefund } = useTickets()
  const [stage, setStage] = useState<'quote' | 'review' | 'requested'>('quote')
  const [acknowledged, setAcknowledged] = useState(false)
  const [error, setError] = useState<TicketRule | null>(null)
  const feedbackRef = useRef<HTMLParagraphElement>(null)
  const stageRef = useRef<HTMLHeadingElement>(null)
  const inFlight = useRef(false)
  const quote = refundQuote(ticket, now)
  const pending = ticket.status === 'refund-pending' && ticket.refund !== null
  const requested = stage === 'requested' || pending
  const detailPath = `/my-tickets/${ticket.id}`
  const date = (value: string) => new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Cairo' }).format(new Date(value))
  const rules: Partial<Record<TicketRule, string>> = {
    past: t.past, 'refund-deadline': t.past, used: t.used, transferred: t.transferred, 'transferred-before': t.transferredBefore,
    'refund-pending': t.pendingError, refunded: t.refunded, free: t.free, cancelled: t.cancelled,
    duplicate: t.duplicate, confirmation: t.confirmation,
  }
  const reasonText = (reason: TicketRule | null | undefined) => reason ? rules[reason] ?? t.generic : t.generic
  useEffect(() => { if (error) feedbackRef.current?.focus() }, [error])
  useEffect(() => { if (stage !== 'quote') stageRef.current?.focus() }, [stage])

  function confirm(event: FormEvent) {
    event.preventDefault()
    if (inFlight.current) return
    if (!acknowledged) { setError('confirmation'); return }
    inFlight.current = true
    const result = requestRefund(ticket.id, acknowledged)
    if (result.ok) { setError(null); setStage('requested') }
    else { setError(result.error ?? 'not-found'); inFlight.current = false }
  }
  const quoteDetails = <dl className="tickets-quote"><div><dt>{t.ticketPrice}</dt><dd>{bookingMoney(ticket.price, lang)}</dd></div><div><dt>{t.paidTotal}</dt><dd>{bookingMoney(quote.paidTotal, lang)}</dd></div><div><dt>{t.serviceFee}</dt><dd>− {bookingMoney(quote.fee, lang)}</dd></div><div className="tickets-quote-total"><dt>{t.refundable}</dt><dd>{bookingMoney(quote.amount, lang)}</dd></div></dl>

  return <TicketShell appearance="action" title={t.title} lead={t.lead} eyebrow={t.eyebrow} backTo={detailPath} backLabel={t.back} header={<TicketActionHeader title={t.title} lead={t.lead} eyebrow={t.eyebrow} kind="refund" />}>
    <ol className="tickets-action-steps ta-steps" aria-label={t.steps}>{[t.stepQuote, t.stepReview, t.stepRequested].map((label, index) => {
      const current = requested ? 2 : stage === 'review' ? 1 : 0
      return <li key={label} className={current === index ? 'is-current' : current > index ? 'is-done' : ''} aria-current={current === index ? 'step' : undefined}><span aria-hidden="true">{new Intl.NumberFormat(lang === 'ar' ? 'ar-EG' : 'en').format(index + 1)}</span>{label}</li>
    })}</ol>
    <div className="tickets-action-layout"><div className="tickets-stack">
      {requested && ticket.refund ? <section className="tickets-panel tickets-success ta-form-panel ta-result" aria-labelledby="refund-requested-title"><span className="tickets-success-mark"><Icon name="clock" size={34} /></span><h2 id="refund-requested-title" ref={stageRef} tabIndex={-1}>{t.requestedTitle}</h2><p>{t.requestedLead}</p>
        <div className="ta-result-details"><dl className="tickets-review-list"><div><dt>{t.status}</dt><dd><strong>{t.pending}</strong></dd></div><div><dt>{t.amountRequested}</dt><dd>{bookingMoney(ticket.refund.amount, lang)}</dd></div><div><dt>{t.requestedAt}</dt><dd><time dateTime={ticket.refund.requestedAt}>{date(ticket.refund.requestedAt)}</time></dd></div><div><dt>{t.reference}</dt><dd><bdi dir="ltr">{ticket.orderRef}</bdi></dd></div></dl></div><p>{t.track}</p><p>{t.settlement}</p><p className="tickets-notice"><Icon name="ticket" size={19} />{t.codeNote}</p><div className="tickets-action-footer"><Link className="home-button" to={detailPath}>{t.viewTicket}<Icon name="arrow" size={18} /></Link><Link className="home-outline-button" to="/my-tickets">{t.wallet}</Link></div>
      </section> : !quote.eligible ? <section className="tickets-panel ta-form-panel ta-unavailable" aria-labelledby="refund-unavailable-title"><span className="tickets-success-mark"><Icon name="lock" size={30} /></span><h2 id="refund-unavailable-title">{t.unavailableTitle}</h2><p className="tickets-alert">{reasonText(quote.reason)}</p><p>{t.unavailableLead}</p><Link className="home-outline-button" to={detailPath}>{t.back}</Link></section>
        : stage === 'quote' ? <section className="tickets-panel ta-form-panel ta-quote" aria-labelledby="refund-quote-title"><header className="tickets-panel-header"><p className="tickets-eyebrow">01 / {t.stepQuote}</p><h2 id="refund-quote-title">{t.quoteTitle}</h2><p>{t.quoteLead}</p></header><div className="ta-refund-amount">{quoteDetails}</div>
          <div className="tickets-refund-policy"><dl className="tickets-review-list"><div><dt>{t.deadline}</dt><dd><time dateTime={quote.deadline}>{date(quote.deadline)}</time></dd></div></dl><details className="ta-policy"><summary>{t.samplePolicy}</summary><p>{t.deadlineNote}</p></details><p>{t.settlement}</p></div><div className="tickets-action-footer"><button className="home-button" type="button" onClick={() => { setError(null); setAcknowledged(false); setStage('review') }}>{t.review}<Icon name="arrow" size={18} /></button><Link className="home-outline-button" to={detailPath}>{t.back}</Link></div>
        </section> : <section className="tickets-panel ta-form-panel ta-review" aria-labelledby="refund-review-title"><header className="tickets-panel-header"><p className="tickets-eyebrow">02 / {t.stepReview}</p><h2 id="refund-review-title" ref={stageRef} tabIndex={-1}>{t.reviewTitle}</h2><p>{t.reviewLead}</p></header><dl className="tickets-review-list"><div><dt>{t.attendee}</dt><dd><bdi>{ticket.attendeeName}</bdi></dd></div><div><dt>{t.reference}</dt><dd><bdi dir="ltr">{ticket.orderRef}</bdi></dd></div></dl><div className="ta-refund-amount">{quoteDetails}</div><p>{t.settlement}</p>
          <form noValidate onSubmit={confirm}><label className="tickets-checkbox"><input id="refund-confirmation" type="checkbox" checked={acknowledged} onChange={(event) => { setAcknowledged(event.target.checked); setError(null) }} aria-describedby={error ? 'refund-error' : undefined} />{t.acknowledge}</label>{error && <p id="refund-error" className="tickets-error" ref={feedbackRef} role="alert" tabIndex={-1}>{reasonText(error)}</p>}<div className="tickets-action-footer"><button className="home-button" type="submit">{t.confirm}<Icon name="arrow" size={18} /></button><button className="home-outline-button" type="button" onClick={() => { setStage('quote'); setError(null); setAcknowledged(false) }}>{t.edit}</button></div></form>
        </section>}
    </div><TicketActionSummary ticket={ticket} /></div>
  </TicketShell>
}

export default function RefundRequest() {
  const { ticketId } = useParams()
  const { state } = useTickets()
  const { lang } = usePreferences()
  const t = lang === 'ar' ? ar : en
  const ticket = state.tickets.find((candidate) => candidate.id === ticketId)
  return ticket ? <RefundContent key={ticket.id} ticket={ticket} /> : <TicketShell title={t.title} lead={t.lead} eyebrow={t.eyebrow}><TicketEmpty title={t.missingTitle} lead={t.missingLead} /></TicketShell>
}
