import type { TicketRule } from './ticketsModel'
import type { Language } from '../Homepage/types'

const en = {
  liveTitle: 'Your tickets', liveLead: 'These are your real tickets. Show the QR code at the gate. In test mode, payments take no money.',
  liveLoading: 'Loading your tickets…', liveError: 'We could not load your tickets. Refresh the page to try again.',
  wallet: 'My Tickets', walletTitle: 'Your next story, in your pocket.', walletLead: 'Every plan has a place. Find your upcoming experiences and look back at the ones you have made.',
  sample: 'Sample ticket wallet', sampleLead: 'This preview uses fictional tickets. QR codes are demonstration codes, not valid for admission. Transfers, refunds, and email actions are simulated.',
  storageNote: 'Browser storage is unavailable. This sample wallet will last only while this page is open.',
  sessionNote: 'Sample tickets and activity stay in this browser tab. Custom attendee names stay in memory; after a refresh, saved tickets use sample names.',
  sampleNames: 'Sample attendee', upcoming: 'Upcoming', past: 'Past', experiences: 'Experiences', tickets: 'Tickets', upcomingCount: 'Upcoming tickets', pastCount: 'Past tickets',
  viewTicket: 'Open ticket', viewEvent: 'Event details', browse: 'Explore events', backWallet: 'Back to My Tickets',
  noUpcoming: 'Your next plan is still unwritten.', noUpcomingLead: 'No upcoming sample tickets are here. Explore an event and complete the sample checkout, or load the example wallet.',
  noPast: 'The memories start here.', noPastLead: 'Your past tickets will appear here after their event date. Load the example wallet to preview this view.',
  loadSamples: 'Load example tickets', sampleAdded: 'Example tickets have been added to this tab.',
  ticketNotFound: 'This ticket is not in your wallet.', ticketNotFoundLead: 'The link may be incorrect, or its sample session may have ended. Return to your wallet to choose a ticket.',
  orderNotFound: 'This sample order is not available.', orderNotFoundLead: 'The reference may be incorrect, or the sample order may belong to another browser session.',
  confirmedEyebrow: 'A new plan, made.', confirmedTitle: 'You are on the list.', confirmedLead: 'Your sample checkout is complete. Your ticket previews are ready to explore.',
  orderReference: 'Sample order reference', bookedOn: 'Created', orderSummary: 'Your plan at a glance', orderTickets: 'Inside your order',
  paymentLabel: 'Sample payment', paymentStatus: 'Simulated success', noCharge: 'No payment was taken and no real tickets were issued.',
  subtotal: 'Tickets subtotal', serviceFees: 'Service fees', total: 'Sample total', quantity: 'Quantity', openWallet: 'Go to My Tickets',
  nextTitle: 'What happens next?', nextWallet: 'Find your tickets in My Tickets.', nextQr: 'Open a ticket to explore the sample QR pass.', nextManage: 'Try the transfer and refund preview when eligible.',
  ticket: 'Ticket', ticketReference: 'Ticket reference', attendee: 'Attendee', category: 'Ticket category', section: 'Section', row: 'Row', seat: 'Seat', standing: 'Standing admission',
  date: 'Date & time', venue: 'Venue', doors: 'Doors open', price: 'Ticket price', fee: 'Service fee', localTime: 'All times are local to Egypt.',
  yourPass: 'Your pass to the moment.', ticketLead: 'The details, the place, and your next great experience.',
  qrHeading: 'Sample entry pass', qrLead: 'Demonstration QR only', qrWarning: 'Not valid for entry. This code identifies a fictional preview ticket only.', qrUnavailable: 'An entry QR is unavailable for this ticket status.',
  keepReady: 'A little preparation goes a long way.', arrive: 'Arrive before the start time and allow time for entry checks.', bringId: 'For a real booking, bring ID that matches the attendee details.',
  manage: 'Make it your plan.', manageLead: 'Plans can change. Check the options available for this sample ticket.',
  transfer: 'Transfer ticket', transferLead: 'Let someone else take your place.', refund: 'Request refund', refundLead: 'Review the illustrative refund policy.',
  resend: 'Preview ticket email', resendLead: 'Try the email confirmation interface.', resendDone: 'Sample email preview recorded. No email was sent.',
  timeline: 'Ticket activity', created: 'Sample ticket created', transferPending: 'Sample transfer pending', transferred: 'Sample ticket transferred', refundRequested: 'Sample refund requested',
  cancelled: 'Cancelled', used: 'Used', expired: 'Event ended', active: 'Active sample ticket', transferStatus: 'Transfer pending', transferredStatus: 'Transferred', refundStatus: 'Refund requested', refunded: 'Refunded',
  ticketUnavailable: 'This ticket is unavailable for admission.',
  unknownAttendee: 'Re-enter the attendee name before submitting a transfer. Names are not stored after a refresh.',
  transferBlockedPast: 'Transfers are closed after the event starts.', transferBlockedStatus: 'This ticket status does not allow a transfer.',
  refundBlockedPast: 'Refunds are closed after the event starts.', refundBlockedStatus: 'This ticket status does not allow a refund.', refundBlockedCutoff: 'The sample refund deadline is seven days before the event.', refundBlockedFree: 'This ticket was free, so there is no payment to refund.',
  sampleFlow: 'Fictional preview', status: 'Status', orderDetails: 'Order details',
}

const ar: Record<keyof typeof en, string> = {
    liveTitle: 'تذاكرك', liveLead: 'هذه تذاكرك الحقيقية. اعرض رمز QR عند البوابة. في وضع الاختبار لا يُخصم أي مبلغ.',
  liveLoading: 'جارٍ تحميل تذاكرك…', liveError: 'تعذّر تحميل تذاكرك. حدّث الصفحة للمحاولة مرة أخرى.',
  wallet: 'تذاكري', walletTitle: 'قصتك القادمة، بين يديك.', walletLead: 'لكل خطة مكانها. تابع تجاربك القادمة واستعد ذكريات الفعاليات السابقة.',
  sample: 'محفظة تذاكر تجريبية', sampleLead: 'يعرض هذا النموذج تذاكر وهمية. رموز QR للعرض فقط ولا تصلح للدخول. التحويل والاسترداد والبريد الإلكتروني عمليات محاكاة.',
  storageNote: 'تخزين المتصفح غير متاح. ستبقى المحفظة التجريبية أثناء فتح هذه الصفحة فقط.',
  sessionNote: 'تبقى التذاكر التجريبية ونشاطها في علامة التبويب الحالية. تبقى أسماء الحاضرين المُدخلة في الذاكرة؛ وتُستبدل بأسماء تجريبية عند تحديث الصفحة.',
  sampleNames: 'حاضر تجريبي', upcoming: 'القادمة', past: 'السابقة', experiences: 'تجارب', tickets: 'تذاكر', upcomingCount: 'التذاكر القادمة', pastCount: 'التذاكر السابقة',
  viewTicket: 'فتح التذكرة', viewEvent: 'تفاصيل الفعالية', browse: 'استكشف الفعاليات', backWallet: 'العودة إلى تذاكري',
  noUpcoming: 'خطتك القادمة تنتظر اختيارك.', noUpcomingLead: 'لا توجد تذاكر تجريبية قادمة. استكشف فعالية وأكمل الحجز التجريبي، أو حمّل محفظة الأمثلة.',
  noPast: 'هنا تبدأ الذكريات.', noPastLead: 'تظهر تذاكر الفعاليات السابقة هنا بعد موعدها. حمّل محفظة الأمثلة لتجربة هذا العرض.',
  loadSamples: 'تحميل تذاكر الأمثلة', sampleAdded: 'أُضيفت تذاكر الأمثلة إلى علامة التبويب الحالية.',
  ticketNotFound: 'هذه التذكرة غير موجودة في محفظتك.', ticketNotFoundLead: 'قد يكون الرابط غير صحيح أو انتهت الجلسة التجريبية. عُد إلى محفظتك لاختيار تذكرة.',
  orderNotFound: 'هذا الطلب التجريبي غير متاح.', orderNotFoundLead: 'قد يكون المرجع غير صحيح، أو ينتمي الطلب التجريبي إلى جلسة متصفح أخرى.',
  confirmedEyebrow: 'خطة جديدة، ولحظة قادمة.', confirmedTitle: 'أصبح اسمك على القائمة.', confirmedLead: 'اكتمل الحجز التجريبي. أصبحت معاينات تذاكرك جاهزة للاستكشاف.',
  orderReference: 'مرجع الطلب التجريبي', bookedOn: 'تاريخ الإنشاء', orderSummary: 'خطتك في لمحة', orderTickets: 'تذاكر طلبك',
  paymentLabel: 'الدفع التجريبي', paymentStatus: 'نجاح بالمحاكاة', noCharge: 'لم تُحصّل أي أموال ولم تُصدر تذاكر حقيقية.',
  subtotal: 'مجموع أسعار التذاكر', serviceFees: 'رسوم الخدمة', total: 'الإجمالي التجريبي', quantity: 'العدد', openWallet: 'الانتقال إلى تذاكري',
  nextTitle: 'ما الخطوة التالية؟', nextWallet: 'اعثر على تذاكرك في صفحة تذاكري.', nextQr: 'افتح تذكرة لاستكشاف رمز QR التجريبي.', nextManage: 'جرّب التحويل وطلب الاسترداد عند استيفاء الشروط.',
  ticket: 'التذكرة', ticketReference: 'مرجع التذكرة', attendee: 'الحاضر', category: 'فئة التذكرة', section: 'المنطقة', row: 'الصف', seat: 'المقعد', standing: 'دخول دون مقاعد محددة',
  date: 'التاريخ والوقت', venue: 'المكان', doors: 'فتح الأبواب', price: 'سعر التذكرة', fee: 'رسوم الخدمة', localTime: 'جميع المواعيد بتوقيت مصر المحلي.',
  yourPass: 'تذكرتك إلى اللحظة.', ticketLead: 'التفاصيل والمكان وتجربتك القادمة.',
  qrHeading: 'تذكرة دخول تجريبية', qrLead: 'رمز QR للعرض فقط', qrWarning: 'لا يصلح للدخول. يشير هذا الرمز إلى تذكرة وهمية في النموذج فقط.', qrUnavailable: 'رمز الدخول غير متاح مع حالة هذه التذكرة.',
  keepReady: 'بعض الاستعداد يصنع الفرق.', arrive: 'احضر قبل موعد البداية وخصّص وقتًا لإجراءات الدخول.', bringId: 'في الحجز الحقيقي، أحضر إثبات هوية يطابق بيانات الحاضر.',
  manage: 'خطتك كما تريدها.', manageLead: 'قد تتغير الخطط. تعرّف على الخيارات المتاحة لهذه التذكرة التجريبية.',
  transfer: 'تحويل التذكرة', transferLead: 'امنح شخصًا آخر مكانك.', refund: 'طلب استرداد المبلغ', refundLead: 'راجع سياسة الاسترداد التوضيحية.',
  resend: 'معاينة بريد التذكرة', resendLead: 'جرّب واجهة تأكيد البريد الإلكتروني.', resendDone: 'سُجّلت معاينة البريد التجريبية. لم يُرسل أي بريد.',
  timeline: 'سجل التذكرة', created: 'إنشاء التذكرة التجريبية', transferPending: 'تحويل تجريبي معلّق', transferred: 'تحويل التذكرة التجريبية', refundRequested: 'طلب استرداد تجريبي',
  cancelled: 'ملغاة', used: 'مستخدمة', expired: 'انتهت الفعالية', active: 'تذكرة تجريبية نشطة', transferStatus: 'تحويل معلّق', transferredStatus: 'تم التحويل', refundStatus: 'طُلب الاسترداد', refunded: 'مستردة',
  ticketUnavailable: 'هذه التذكرة غير متاحة للدخول.',
  unknownAttendee: 'أعد إدخال اسم الحاضر قبل تأكيد التحويل. لا تُحفظ الأسماء بعد تحديث الصفحة.',
  transferBlockedPast: 'يُغلق التحويل بعد بداية الفعالية.', transferBlockedStatus: 'لا تسمح حالة هذه التذكرة بالتحويل.',
  refundBlockedPast: 'يُغلق الاسترداد بعد بداية الفعالية.', refundBlockedStatus: 'لا تسمح حالة هذه التذكرة بالاسترداد.', refundBlockedCutoff: 'تنتهي مهلة الاسترداد التجريبية قبل الفعالية بسبعة أيام.', refundBlockedFree: 'هذه التذكرة مجانية ولا يوجد مبلغ لاسترداده.',
  sampleFlow: 'عرض وهمي', status: 'الحالة', orderDetails: 'تفاصيل الطلب',
}

export const ticketsStrings: Record<Language, typeof en> = { en, ar }

export function ticketRuleText(reason: TicketRule | null | undefined, lang: Language): string {
  const ar = lang === 'ar'
  switch (reason) {
    case 'past': return ar ? 'بدأت الفعالية أو انتهت؛ هذا الإجراء غير متاح.' : 'The event has started or ended; this action is unavailable.'
    case 'used': return ar ? 'استُخدمت هذه التذكرة التجريبية بالفعل.' : 'This sample ticket has already been used.'
    case 'transferred': return ar ? 'تم تحويل هذه التذكرة ولم تعد متاحة في محفظة المرسل.' : 'This ticket has been transferred and is no longer available to its sender.'
    case 'refund-pending': return ar ? 'يوجد طلب استرداد تجريبي معلّق لهذه التذكرة.' : 'A sample refund request is already pending for this ticket.'
    case 'refunded': return ar ? 'تظهر هذه التذكرة التجريبية على أنها مستردة.' : 'This sample ticket is marked as refunded.'
    case 'transfer-limit': return ar ? 'وصلت هذه التذكرة إلى الحد الأقصى للتحويلات التجريبية.' : 'This ticket has reached the sample transfer limit.'
    case 'transferred-before': return ar ? 'لا تسمح السياسة التجريبية باسترداد تذكرة تم تحويلها سابقًا.' : 'The sample policy excludes previously transferred tickets from refunds.'
    case 'free': return ar ? 'التذكرة مجانية ولا يوجد مبلغ لاسترداده.' : 'This ticket was free, so there is no payment to refund.'
    case 'cancelled': return ar ? 'الفعالية ملغاة. يُعالج استرداد المبلغ كاملًا بشكل منفصل عن طلب الاسترداد العادي.' : 'The event is cancelled. Full cancellation refunds are handled separately from ordinary refund requests.'
    case 'refund-deadline': return ar ? 'انتهت مهلة طلب الاسترداد التجريبية قبل الفعالية بسبعة أيام.' : 'The sample refund deadline is seven days before the event and has now passed.'
    case 'recipient-invalid': return ar ? 'أدخل عنوان بريد إلكتروني صحيحًا للمستلم.' : 'Enter a valid recipient email address.'
    case 'recipient-unverified': return ar ? 'يجب تأكيد البريد الإلكتروني لحساب المستلم التجريبي.' : 'The sample recipient account must have a verified email address.'
    case 'recipient-self': return ar ? 'اختر مستلمًا غير مالك التذكرة الحالي.' : 'Choose a recipient other than the current ticket owner.'
    case 'recipient-missing': return ar ? 'لا يوجد حساب مستلم تجريبي بهذا البريد.' : 'No sample recipient account exists for that email.'
    case 'duplicate': return ar ? 'سُجّل هذا الإجراء التجريبي بالفعل.' : 'This sample action has already been recorded.'
    case 'cooldown': return ar ? 'انتظر قبل تجربة إرسال بريد آخر.' : 'Wait before trying another email preview.'
    case 'not-found': return ar ? 'لم تعد هذه التذكرة متاحة في المحفظة.' : 'This ticket is no longer available in the wallet.'
    case 'confirmation': return ar ? 'راجع التفاصيل وأكّد موافقتك قبل المتابعة.' : 'Review the details and confirm your agreement before continuing.'
    default: return ''
  }
}
