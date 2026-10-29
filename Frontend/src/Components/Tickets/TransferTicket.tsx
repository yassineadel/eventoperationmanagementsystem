import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { usePreferences } from '../Auth/preferences'
import Icon from '../Homepage/components/Icon'
import { useTickets } from './ticketsContext'
import { sampleRecipients, ticketEligibility, type SampleTicket, type TicketRule } from './ticketsModel'
import { TicketEmpty, TicketShell } from './TicketParts'
import { TicketActionHeader, TicketActionSummary } from './TicketActionParts'

const en = {
  title: 'Transfer ticket', lead: 'Choose a recipient and review the transfer details.', eyebrow: 'Ticket transfer',
  missingTitle: 'We could not find that ticket.', missingLead: 'Open your sample wallet and choose a ticket to transfer.',
  back: 'Back to ticket', stepRecipient: 'Recipient', stepReview: 'Review', stepDone: 'Complete', steps: 'Transfer steps',
  recipientTitle: 'Recipient details', recipientLead: 'For this preview, choose a verified sample account below or enter its email address.',
  email: 'Recipient email', emailHint: 'Only the listed sample accounts can receive a sample transfer. No invitation or email is sent.',
  howTitle: 'How does a transfer work?', howLead: 'You give this ticket to someone else so they can attend in your place. Choose their verified sample account, review their name and email, then confirm. Your current QR code is disabled after confirmation. This preview records the transfer only; it does not deliver a ticket to another account.',
  sampleAccounts: 'Verified sample accounts', sampleAccount: 'Use this sample account', verified: 'Verified sample account',
  review: 'Review transfer', reviewTitle: 'Review transfer', reviewLead: 'Check the recipient carefully before confirming the sample transfer.',
  from: 'Current owner', to: 'New owner', attendee: 'New attendee name', transferCount: 'Transfers already used', ofThree: 'of 3',
  important: 'Your current ticket code will stop working after the transfer. The ticket will remain in your wallet as a transfer record, without a usable QR code.',
  refundNote: 'A transferred ticket cannot be refunded in this sample policy. Each ticket allows up to three transfers in total.',
  acknowledge: 'I have checked the recipient and understand that my current ticket code will be invalidated.',
  confirm: 'Confirm sample transfer', edit: 'Edit recipient', successTitle: 'Sample transfer complete',
  successLead: 'The sample transfer is recorded and your previous QR code is disabled. This preview does not deliver a ticket to another account or send an email.',
  sentTo: 'Sample ticket transferred to', viewTicket: 'View transfer record', wallet: 'Back to My Tickets',
  unavailableTitle: 'This ticket cannot be transferred.', unavailableLead: 'Your ticket has not been changed.',
  generic: 'We could not complete the sample transfer. Return to your ticket and try again.',
  past: 'This event has already started. Transfers are closed.', used: 'This ticket has already been used and cannot be transferred.',
  transferred: 'This ticket has already been transferred to another owner.', pending: 'A refund request is pending for this ticket. Transfers are unavailable while it is reviewed.',
  refunded: 'This ticket has been refunded and cannot be transferred.', limit: 'This ticket has reached its limit of three transfers.',
  cancelled: 'This event is cancelled. Ticket transfers are unavailable.', invalid: 'Enter a valid recipient email address.',
  unverified: 'That sample account has not verified its email. Choose a verified sample account.',
  self: 'Choose another recipient. You already own this ticket.', missing: 'We could not find that sample account. Choose one of the verified accounts shown below.',
  confirmation: 'Confirm that you have checked the recipient and understand what happens to your current code.',
}
const ar: Record<keyof typeof en, string> = {
  title: 'تحويل التذكرة', lead: 'اختر المستلم وراجع بيانات التحويل.', eyebrow: 'نقل التذكرة',
  missingTitle: 'لم نعثر على هذه التذكرة.', missingLead: 'افتح محفظتك التجريبية واختر التذكرة التي تريد نقلها.',
  back: 'العودة إلى التذكرة', stepRecipient: 'المستلم', stepReview: 'المراجعة', stepDone: 'الاكتمال', steps: 'خطوات نقل التذكرة',
  recipientTitle: 'بيانات المستلم', recipientLead: 'لهذه المعاينة، اختر حسابًا تجريبيًا موثّقًا من القائمة أو أدخل بريده الإلكتروني.',
  email: 'البريد الإلكتروني للمستلم', emailHint: 'يمكن نقل التذكرة التجريبية إلى الحسابات الموضحة فقط. لن تُرسل دعوة أو رسالة بريد فعلية.',
  howTitle: 'كيف يعمل نقل التذكرة؟', howLead: 'تمنح هذه التذكرة لشخص آخر ليحضر بدلًا منك. اختر حسابه التجريبي الموثّق، وراجع اسمه وبريده، ثم أكّد النقل. بعد التأكيد يتوقف رمز QR الحالي. تسجّل هذه المعاينة عملية النقل فقط، ولا تضيف تذكرة إلى حساب آخر.',
  sampleAccounts: 'حسابات تجريبية موثّقة', sampleAccount: 'استخدام هذا الحساب التجريبي', verified: 'حساب تجريبي موثّق',
  review: 'مراجعة النقل', reviewTitle: 'مراجعة التحويل', reviewLead: 'تأكد من بيانات المستلم قبل تأكيد النقل التجريبي.',
  from: 'المالك الحالي', to: 'المالك الجديد', attendee: 'اسم الحاضر الجديد', transferCount: 'مرات النقل المستخدمة', ofThree: 'من ٣',
  important: 'بعد النقل لن يعمل رمز تذكرتك الحالي. ستبقى التذكرة في محفظتك كسجل للنقل، دون رمز QR قابل للاستخدام.',
  refundNote: 'لا يمكن استرداد قيمة تذكرة سبق نقلها وفق السياسة التجريبية. الحد الأقصى لكل تذكرة ثلاث عمليات نقل.',
  acknowledge: 'راجعت بيانات المستلم وأفهم أن رمز تذكرتي الحالي سيصبح غير صالح.',
  confirm: 'تأكيد النقل التجريبي', edit: 'تعديل المستلم', successTitle: 'اكتمل التحويل التجريبي',
  successLead: 'سُجّل النقل التجريبي وتوقف رمز QR السابق. لا تضيف هذه المعاينة تذكرة إلى حساب آخر ولا ترسل رسالة بريد.',
  sentTo: 'نُقلت التذكرة التجريبية إلى', viewTicket: 'عرض سجل النقل', wallet: 'العودة إلى تذاكري',
  unavailableTitle: 'لا يمكن نقل هذه التذكرة.', unavailableLead: 'لم يتم تغيير تذكرتك.',
  generic: 'تعذر إتمام النقل التجريبي. عد إلى التذكرة وحاول مرة أخرى.',
  past: 'بدأت هذه الفعالية بالفعل، وأُغلق نقل التذاكر.', used: 'استُخدمت هذه التذكرة بالفعل ولا يمكن نقلها.',
  transferred: 'نُقلت هذه التذكرة بالفعل إلى مالك آخر.', pending: 'يوجد طلب استرداد قيد المراجعة لهذه التذكرة. لا يمكن نقلها أثناء مراجعة الطلب.',
  refunded: 'استُردت قيمة هذه التذكرة ولا يمكن نقلها.', limit: 'وصلت هذه التذكرة إلى الحد الأقصى، وهو ثلاث عمليات نقل.',
  cancelled: 'أُلغيت هذه الفعالية ولا يتاح نقل تذاكرها.', invalid: 'أدخل بريدًا إلكترونيًا صحيحًا للمستلم.',
  unverified: 'لم يوثّق هذا الحساب التجريبي بريده الإلكتروني. اختر حسابًا تجريبيًا موثّقًا.',
  self: 'اختر مستلمًا آخر، فأنت تملك هذه التذكرة بالفعل.', missing: 'لم نعثر على هذا الحساب التجريبي. اختر أحد الحسابات الموثّقة الموضحة أدناه.',
  confirmation: 'أكد أنك راجعت بيانات المستلم وتفهم ما سيحدث لرمز تذكرتك الحالي.',
}

function TransferContent({ ticket }: { ticket: SampleTicket }) {
  const { lang } = usePreferences()
  const t = lang === 'ar' ? ar : en
  const { now, transferTicket } = useTickets()
  const [email, setEmail] = useState('')
  const [recipient, setRecipient] = useState<(typeof sampleRecipients)[number] | null>(null)
  const [stage, setStage] = useState<'recipient' | 'review' | 'done'>('recipient')
  const [acknowledged, setAcknowledged] = useState(false)
  const [error, setError] = useState<TicketRule | null>(null)
  const feedbackRef = useRef<HTMLParagraphElement>(null)
  const reviewRef = useRef<HTMLHeadingElement>(null)
  const inFlight = useRef(false)
  const eligibility = ticketEligibility(ticket, 'transfer', now)
  const rules: Partial<Record<TicketRule, string>> = {
    past: t.past, used: t.used, transferred: t.transferred, 'refund-pending': t.pending, refunded: t.refunded,
    'transfer-limit': t.limit, cancelled: t.cancelled, 'recipient-invalid': t.invalid,
    'recipient-unverified': t.unverified, 'recipient-self': t.self, 'recipient-missing': t.missing, confirmation: t.confirmation,
  }
  const reasonText = (reason: TicketRule | null | undefined) => reason ? rules[reason] ?? t.generic : t.generic
  const detailPath = `/my-tickets/${encodeURIComponent(ticket.id)}`
  useEffect(() => { if (error) feedbackRef.current?.focus() }, [error])
  useEffect(() => { if (stage !== 'recipient') reviewRef.current?.focus() }, [stage])

  function review(event: FormEvent) {
    event.preventDefault()
    if (!eligibility.allowed) { setError(eligibility.reason); return }
    const normalized = email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) { setError('recipient-invalid'); return }
    if (normalized === ticket.ownerEmail.toLowerCase()) { setError('recipient-self'); return }
    const found = sampleRecipients.find((candidate) => candidate.email.toLowerCase() === normalized)
    if (!found) { setError('recipient-missing'); return }
    if (!found.verified) { setError('recipient-unverified'); return }
    setRecipient(found); setEmail(found.email); setError(null); setAcknowledged(false); setStage('review')
  }
  function confirm(event: FormEvent) {
    event.preventDefault()
    if (inFlight.current || !recipient) return
    if (!acknowledged) { setError('confirmation'); return }
    inFlight.current = true
    const result = transferTicket(ticket.id, recipient.email, acknowledged)
    if (result.ok) { setError(null); setStage('done') }
    else { setError(result.error ?? 'not-found'); inFlight.current = false }
  }

  return <TicketShell title={t.title} lead={t.lead} eyebrow={t.eyebrow} backTo={detailPath} backLabel={t.back} appearance="action" header={<TicketActionHeader title={t.title} lead={t.lead} eyebrow={t.eyebrow} kind="transfer" />}>
    <ol className="tickets-action-steps ta-steps" aria-label={t.steps}>{[t.stepRecipient, t.stepReview, t.stepDone].map((label, index) => {
      const current = stage === 'recipient' ? 0 : stage === 'review' ? 1 : 2
      return <li key={label} className={current === index ? 'is-current' : current > index ? 'is-done' : ''} aria-current={current === index ? 'step' : undefined}><span aria-hidden="true">{new Intl.NumberFormat(lang === 'ar' ? 'ar-EG' : 'en').format(index + 1)}</span>{label}</li>
    })}</ol>
    <div className="tickets-action-layout"><div className="tickets-stack">
      {stage === 'done' && recipient ? <section className="tickets-panel tickets-success ta-form-panel ta-result" aria-labelledby="transfer-success-title">
        <span className="tickets-success-mark"><Icon name="conferences" size={34} /></span><h2 id="transfer-success-title" ref={reviewRef} tabIndex={-1}>{t.successTitle}</h2><p>{t.successLead}</p>
        <div className="tickets-recipient-card"><span>{t.sentTo}</span><strong><bdi>{recipient.name}</bdi></strong><bdi dir="ltr">{recipient.email}</bdi></div>
        <div className="tickets-action-footer"><Link className="home-button" to={detailPath}>{t.viewTicket}<Icon name="arrow" size={18} /></Link><Link className="home-outline-button" to="/my-tickets">{t.wallet}</Link></div>
      </section> : !eligibility.allowed ? <section className="tickets-panel ta-form-panel ta-unavailable" aria-labelledby="transfer-unavailable-title"><span className="tickets-success-mark"><Icon name="lock" size={30} /></span><h2 id="transfer-unavailable-title">{t.unavailableTitle}</h2><p className="tickets-alert">{reasonText(eligibility.reason)}</p><p>{t.unavailableLead}</p><Link className="home-outline-button" to={detailPath}>{t.back}</Link></section>
        : stage === 'recipient' ? <section className="tickets-panel ta-form-panel ta-recipient" aria-labelledby="transfer-recipient-title"><header className="tickets-panel-header"><p className="tickets-eyebrow">01 / {t.stepRecipient}</p><h2 id="transfer-recipient-title">{t.recipientTitle}</h2><p>{t.recipientLead}</p></header>
          <details className="ta-how"><summary><Icon name="conferences" size={18} />{t.howTitle}</summary><p>{t.howLead}</p></details>
          <form noValidate onSubmit={review}><div className="tickets-field"><label htmlFor="transfer-recipient-email">{t.email}</label><input className="tickets-input" id="transfer-recipient-email" type="email" inputMode="email" dir="ltr" autoComplete="off" maxLength={254} value={email} aria-invalid={Boolean(error)} aria-describedby={`transfer-email-hint${error ? ' transfer-error' : ''}`} onChange={(event) => { setEmail(event.target.value); setError(null) }} /><p id="transfer-email-hint">{t.emailHint}</p></div>
            {error && <p id="transfer-error" className="tickets-error" ref={feedbackRef} role="alert" tabIndex={-1}>{reasonText(error)}</p>}
            <fieldset className="tickets-sample-recipients"><legend>{t.sampleAccounts}</legend><div className="tickets-link-list">{sampleRecipients.filter((candidate) => candidate.verified && candidate.email.toLowerCase() !== ticket.ownerEmail.toLowerCase()).map((candidate) => <button className="tickets-recipient-card" key={candidate.id} type="button" aria-label={`${t.sampleAccount}: ${candidate.name}`} aria-pressed={email.trim().toLowerCase() === candidate.email.toLowerCase()} onClick={() => { setEmail(candidate.email); setError(null); document.getElementById('transfer-recipient-email')?.focus() }}><span><Icon name="user" size={20} /><strong><bdi>{candidate.name}</bdi></strong></span><bdi dir="ltr">{candidate.email}</bdi><small>{t.verified}</small></button>)}</div></fieldset>
            <div className="tickets-action-footer"><button className="home-button" type="submit">{t.review}<Icon name="arrow" size={18} /></button><Link className="home-outline-button" to={detailPath}>{t.back}</Link></div>
          </form></section> : recipient && <section className="tickets-panel ta-form-panel ta-review" aria-labelledby="transfer-review-title"><header className="tickets-panel-header"><p className="tickets-eyebrow">02 / {t.stepReview}</p><h2 id="transfer-review-title" ref={reviewRef} tabIndex={-1}>{t.reviewTitle}</h2><p>{t.reviewLead}</p></header>
          <div className="ta-ownership"><div><span>{t.from}</span><strong><bdi>{ticket.ownerName}</bdi></strong><bdi dir="ltr">{ticket.ownerEmail}</bdi></div><Icon name="arrow" size={21} /><div><span>{t.to}</span><strong><bdi>{recipient.name}</bdi></strong><bdi dir="ltr">{recipient.email}</bdi></div></div>
          <dl className="tickets-review-list"><div><dt>{t.attendee}</dt><dd><bdi>{recipient.name}</bdi></dd></div><div><dt>{t.transferCount}</dt><dd>{new Intl.NumberFormat(lang === 'ar' ? 'ar-EG' : 'en').format(ticket.transferCount)} {t.ofThree}</dd></div></dl>
          <p className="tickets-notice"><Icon name="lock" size={19} />{t.important}</p><p>{t.refundNote}</p>
          <form noValidate onSubmit={confirm}><label className="tickets-checkbox"><input id="transfer-confirmation" type="checkbox" checked={acknowledged} onChange={(event) => { setAcknowledged(event.target.checked); setError(null) }} aria-describedby={error ? 'transfer-error' : undefined} />{t.acknowledge}</label>{error && <p id="transfer-error" className="tickets-error" ref={feedbackRef} role="alert" tabIndex={-1}>{reasonText(error)}</p>}<div className="tickets-action-footer"><button className="home-button" type="submit">{t.confirm}<Icon name="arrow" size={18} /></button><button className="home-outline-button" type="button" onClick={() => { setStage('recipient'); setError(null); setAcknowledged(false) }}>{t.edit}</button></div></form>
        </section>}
    </div><TicketActionSummary ticket={ticket} /></div>
  </TicketShell>
}

export default function TransferTicket() {
  const { ticketId } = useParams()
  const { state } = useTickets()
  const { lang } = usePreferences()
  const t = lang === 'ar' ? ar : en
  const ticket = state.tickets.find((candidate) => candidate.id === ticketId)
  return ticket ? <TransferContent key={ticket.id} ticket={ticket} /> : <TicketShell title={t.title} lead={t.lead} eyebrow={t.eyebrow}><TicketEmpty title={t.missingTitle} lead={t.missingLead} /></TicketShell>
}
