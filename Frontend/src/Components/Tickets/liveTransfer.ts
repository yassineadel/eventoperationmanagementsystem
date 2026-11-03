import { ApiError } from '../../lib/api'
import { isEmail } from '../../lib/validation'
import type { SampleTicket } from './ticketsModel'

export type TransferIssue = 'invalid' | 'self' | 'recipientMissing' | 'recipientBlocked' | 'missing' | 'session' | 'past' | 'used' | 'transferred' | 'refunded' | 'refundPending' | 'limit' | 'cancelled' | 'unavailable' | 'confirmation' | 'uncertain'

export function transferAvailability(ticket: SampleTicket, now: number): TransferIssue | null {
  if (ticket.status === 'transferred') return 'transferred'
  if (ticket.status === 'used') return 'used'
  if (ticket.status === 'refunded') return 'refunded'
  if (ticket.status === 'refund-pending') return 'refundPending'
  if (ticket.event.status === 'cancelled') return 'cancelled'
  if (Date.parse(ticket.event.date) <= now) return 'past'
  if (ticket.transferCount >= 3) return 'limit'
  return null
}

export function transferRecipient(value: string, ownEmail: string): { email: string; issue: TransferIssue | null } {
  const email = value.trim().toLowerCase()
  return { email, issue: email.length > 254 || !isEmail(email) ? 'invalid' : email === ownEmail.trim().toLowerCase() ? 'self' : null }
}

// Translate the backend's current transfer contract without exposing raw server messages.
export function transferFailure(error: unknown): TransferIssue {
  if (!(error instanceof ApiError) || error.status === 0) return 'uncertain'
  if (error.status === 401) return 'session'
  const message = error.message.toLowerCase()
  if (message.includes('no hafletna account')) return 'recipientMissing'
  if (message.includes('to that account')) return 'recipientBlocked'
  if (message.includes('already hold')) return 'self'
  if (message.includes('already started')) return 'past'
  if (message.includes('at most')) return 'limit'
  if (message.includes('refund in progress')) return 'refundPending'
  if (error.status === 404) return 'missing'
  if (error.status === 400 || error.status === 403 || error.status === 409) return 'unavailable'
  return 'uncertain'
}

export const liveTransferStrings = {
  en: {
    title: 'Transfer ticket', lead: 'Choose a recipient and review the transfer details.', eyebrow: 'TICKET TRANSFER', back: 'Back to ticket',
    loading: 'Loading your ticket…', loadError: 'We could not load this ticket. Please try again.', missingTitle: 'This ticket is not available.',
    missingLead: 'Open My Tickets to check your tickets. It may have been transferred or the link may be incorrect.',
    signIn: 'Sign in to transfer your ticket', signInLead: 'Sign in to the account that currently holds this ticket.',
    recipient: 'Recipient', review: 'Review', complete: 'Complete', steps: 'Transfer steps', recipientTitle: 'Recipient details',
    recipientLead: 'Enter the email of an existing, verified Hafletna customer account.', email: 'Recipient email',
    emailHint: 'Use the email registered on their Hafletna account. Check the address carefully.',
    how: 'How does a transfer work?', howLead: 'The ticket moves to the recipient’s My Tickets with a new entry QR code. Your old code stops working. The backend checks the recipient and ticket when you confirm.',
    reviewButton: 'Review transfer', reviewTitle: 'Review transfer', reviewLead: 'Check this email before confirming. Account eligibility is checked when the transfer is submitted.',
    from: 'Current holder', to: 'Recipient email', transferCount: 'Transfers already used',
    important: 'After confirmation, your current QR code stops working and the recipient receives the ticket in My Tickets.',
    policy: 'Transferred tickets cannot be refunded. Each ticket supports up to three transfers in total.',
    acknowledge: 'I have checked the recipient email and understand that my current QR code will stop working.',
    confirm: 'Confirm transfer', sending: 'Transferring…', edit: 'Edit recipient', successTitle: 'Ticket transferred',
    successLead: 'The recipient can now open this ticket in My Tickets. Your previous QR code is no longer valid.', sentTo: 'Transferred to',
    recordedLead: 'This ticket belongs to another account. Your previous QR code is no longer valid.', wallet: 'Back to My Tickets',
    event: 'Event details', unavailableTitle: 'This ticket cannot be transferred.', retry: 'Try again', checkStatus: 'Check ticket status',
    actionLead: 'Give this ticket to another registered Hafletna customer.',
    issues: {
      invalid: 'Enter a valid recipient email address.', self: 'Choose another recipient. You already hold this ticket.',
      recipientMissing: 'No eligible Hafletna account uses this email. Ask the recipient to register and verify their email first.',
      recipientBlocked: 'This ticket cannot be transferred to that account. Choose another recipient.',
      missing: 'This ticket is no longer available to your account. Check My Tickets for its latest status.',
      session: 'Your session has expired. Sign in again before continuing.', past: 'Transfers close when the event starts.',
      used: 'This ticket has already been used.', transferred: 'You have transferred this ticket to another account.',
      refunded: 'This ticket has been refunded.', refundPending: 'A refund is in progress for this ticket. Transfers are unavailable.',
      limit: 'This ticket has reached its limit of three transfers.', cancelled: 'This event is cancelled. Transfers are unavailable.',
      unavailable: 'The ticket or account status has changed. Check the latest ticket status before continuing.',
      confirmation: 'Confirm that you have checked the recipient and understand what happens to your QR code.',
      uncertain: 'We could not confirm the transfer result. Check the ticket status before trying again.',
    } satisfies Record<TransferIssue, string>,
  },
  ar: {
    title: 'تحويل التذكرة', lead: 'اختر المستلم وراجع بيانات التحويل.', eyebrow: 'نقل التذكرة', back: 'العودة إلى التذكرة',
    loading: 'جارٍ تحميل تذكرتك…', loadError: 'تعذّر تحميل هذه التذكرة. يرجى المحاولة مجددًا.', missingTitle: 'هذه التذكرة غير متاحة.',
    missingLead: 'افتح تذاكري للتحقق من تذاكرك. ربما نُقلت التذكرة أو كان الرابط غير صحيح.',
    signIn: 'سجّل الدخول لنقل تذكرتك', signInLead: 'سجّل الدخول إلى الحساب الذي يملك هذه التذكرة حاليًا.',
    recipient: 'المستلم', review: 'المراجعة', complete: 'الاكتمال', steps: 'خطوات نقل التذكرة', recipientTitle: 'بيانات المستلم',
    recipientLead: 'أدخل بريد حساب عميل مسجّل وموثّق في حفلتنا.', email: 'البريد الإلكتروني للمستلم',
    emailHint: 'استخدم البريد المسجّل في حسابه بحفلتنا. راجع العنوان بعناية.',
    how: 'كيف يعمل نقل التذكرة؟', howLead: 'تنتقل التذكرة إلى صفحة تذاكري لدى المستلم مع رمز QR جديد للدخول، ويتوقف رمزك القديم. يتحقق الخادم من المستلم والتذكرة عند التأكيد.',
    reviewButton: 'مراجعة التحويل', reviewTitle: 'مراجعة التحويل', reviewLead: 'راجع البريد قبل التأكيد. يُتحقق من أهلية الحساب عند إرسال طلب النقل.',
    from: 'المالك الحالي', to: 'بريد المستلم', transferCount: 'مرات النقل المستخدمة',
    important: 'بعد التأكيد يتوقف رمز QR الحالي، وتظهر التذكرة لدى المستلم في صفحة تذاكري.',
    policy: 'لا يمكن استرداد قيمة تذكرة سبق نقلها. الحد الأقصى لكل تذكرة ثلاث عمليات نقل.',
    acknowledge: 'راجعت بريد المستلم وأفهم أن رمز QR الحالي سيتوقف عن العمل.',
    confirm: 'تأكيد التحويل', sending: 'جارٍ التحويل…', edit: 'تعديل المستلم', successTitle: 'تم نقل التذكرة',
    successLead: 'يمكن للمستلم الآن فتح هذه التذكرة في تذاكري. لم يعد رمز QR السابق صالحًا.', sentTo: 'نُقلت إلى',
    recordedLead: 'أصبحت هذه التذكرة مملوكة لحساب آخر. لم يعد رمز QR السابق صالحًا.', wallet: 'العودة إلى تذاكري',
    event: 'تفاصيل الفعالية', unavailableTitle: 'لا يمكن نقل هذه التذكرة.', retry: 'المحاولة مجددًا', checkStatus: 'التحقق من حالة التذكرة',
    actionLead: 'امنح هذه التذكرة لعميل آخر مسجّل في حفلتنا.',
    issues: {
      invalid: 'أدخل بريدًا إلكترونيًا صحيحًا للمستلم.', self: 'اختر مستلمًا آخر، فأنت تملك هذه التذكرة بالفعل.',
      recipientMissing: 'لا يوجد حساب مؤهّل بهذا البريد. اطلب من المستلم التسجيل وتأكيد بريده أولًا.',
      recipientBlocked: 'لا يمكن نقل التذكرة إلى هذا الحساب. اختر مستلمًا آخر.',
      missing: 'لم تعد هذه التذكرة متاحة لحسابك. راجع حالتها في تذاكري.',
      session: 'انتهت جلستك. سجّل الدخول مجددًا قبل المتابعة.', past: 'يُغلق نقل التذاكر عند بدء الفعالية.',
      used: 'استُخدمت هذه التذكرة بالفعل.', transferred: 'نقلت هذه التذكرة إلى حساب آخر.',
      refunded: 'استُردت قيمة هذه التذكرة.', refundPending: 'يوجد طلب استرداد جارٍ لهذه التذكرة. نقلها غير متاح.',
      limit: 'وصلت هذه التذكرة إلى الحد الأقصى، وهو ثلاث عمليات نقل.', cancelled: 'أُلغيت هذه الفعالية. النقل غير متاح.',
      unavailable: 'تغيّرت حالة التذكرة أو الحساب. تحقّق من أحدث حالة للتذكرة قبل المتابعة.',
      confirmation: 'أكد أنك راجعت بيانات المستلم وتفهم ما سيحدث لرمز QR.',
      uncertain: 'تعذّر تأكيد نتيجة النقل. تحقّق من حالة التذكرة قبل المحاولة مجددًا.',
    } satisfies Record<TransferIssue, string>,
  },
}
