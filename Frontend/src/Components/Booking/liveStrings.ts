import { usePreferences } from '../Auth/preferences'
import type { Language } from '../Homepage/types'
import { useBooking } from './bookingContext'
import { isLiveEvent } from './catalogue'
import { bookingStrings, type BookingStrings } from './strings'

// Texts that change for real events: tickets and orders are real, only the payment is a test simulator.
// Every other text stays the same as the sample booking.
const en: Partial<BookingStrings> = {
  demo: 'Test mode',
  demoLead: 'Tickets, reservations and orders are real. Payments use a test simulator, so no money is taken.',
  maxNote: 'Up to 8 tickets per account for each event.',
  hold: 'Tickets reserved',
  expiryWarning: 'Less than one minute remains. Complete checkout or start a new selection.',
  expiredLead: 'The timer ended and your tickets were released. Pick your tickets again to reserve them.',
  replaceLead: 'Your cart contains tickets for another event. Starting here releases that selection.',
  errorLimit: 'Your selection exceeds the 8-ticket limit for this event. Please review your existing bookings and reservations.',
  errorExpired: 'Your reservation has expired. Start a new selection.',
  namesNote: 'Each name belongs to the person attending, who may be different from the buyer. The name is printed on the ticket.',
  readyCheckout: 'Continue to checkout',
  paymentLead: 'Choose a payment method. In test mode no card details are needed and no money is taken.',
  simulationTools: 'Test payment outcome',
  simulationLead: 'Test mode: choose what the payment simulator should do.',
  freePaymentLead: 'This booking is free. Confirm it without choosing a payment method.',
  reserveFree: 'Confirm free booking',
  outcome: 'Payment outcome',
  policyLead: 'Review the event policies before completing your booking.',
  policyAccept: 'I have read and agree to the event policies.',
  pay: 'Pay now',
  processing: 'Processing your payment…',
  paymentNote: 'Test mode: the payment is simulated and no money is taken.',
  successTitle: 'Booking confirmed',
  successLead: 'Your booking is confirmed. Your tickets have been emailed to you.',
  sampleReference: 'Booking reference',
  declinedTitle: 'The payment was declined.',
  declinedLead: 'Nothing was charged and your tickets were released. Choose tickets again to retry.',
  timeoutTitle: 'The payment was not completed.',
  timeoutLead: 'Nothing was charged and your tickets were released. Choose tickets again to retry.',
  receiptQuantity: 'Tickets',
  receiptTotal: 'Total paid',
  map: 'Interactive seat map',
  unavailableSeat: 'This seat is unavailable. Choose an available seat.',
  seatingNote: 'Live seat map. A held seat can become free again when its reservation ends.',
}

const ar: Partial<BookingStrings> = {
  demo: 'وضع الاختبار',
  demoLead: 'التذاكر والحجوزات والطلبات حقيقية. تتم المدفوعات عبر محاكي اختبار، لذلك لا يُخصم أي مبلغ.',
  maxNote: 'حتى ٨ تذاكر لكل حساب في كل فعالية.',
  hold: 'تذاكر محجوزة',
  expiryWarning: 'تبقّى أقل من دقيقة. أكمل الدفع أو ابدأ اختيارًا جديدًا.',
  expiredLead: 'انتهى الوقت وأُلغي حجز تذاكرك. اختر تذاكرك مرة أخرى لحجزها.',
  replaceLead: 'تحتوي سلتك على تذاكر لفعالية أخرى. البدء هنا يُلغي ذلك الاختيار.',
  errorLimit: 'تتجاوز اختياراتك الحد الأقصى البالغ ٨ تذاكر لهذه الفعالية. يُرجى مراجعة تذاكرك المحجوزة والحجوزات المؤقتة.',
  errorExpired: 'انتهت مدة حجزك. ابدأ اختيارًا جديدًا.',
  namesNote: 'كل اسم يخص الشخص الذي سيحضر، وقد يختلف عن المشتري. يُطبع الاسم على التذكرة.',
  readyCheckout: 'المتابعة إلى الدفع',
  paymentLead: 'اختر طريقة الدفع. في وضع الاختبار لا حاجة لبيانات بطاقة ولا يُخصم أي مبلغ.',
  simulationTools: 'نتيجة الدفع التجريبي',
  simulationLead: 'وضع الاختبار: اختر ما يجب أن يفعله محاكي الدفع.',
  freePaymentLead: 'هذا الحجز مجاني. أكّده دون اختيار طريقة دفع.',
  reserveFree: 'تأكيد الحجز المجاني',
  outcome: 'نتيجة الدفع',
  policyLead: 'راجع سياسات الفعالية قبل إتمام حجزك.',
  policyAccept: 'قرأت سياسات الفعالية وأوافق عليها.',
  pay: 'ادفع الآن',
  processing: 'جارٍ معالجة الدفع…',
  paymentNote: 'وضع الاختبار: الدفع محاكى ولا يُخصم أي مبلغ.',
  successTitle: 'تم تأكيد الحجز',
  successLead: 'تم تأكيد حجزك وأُرسلت تذاكرك إلى بريدك الإلكتروني.',
  sampleReference: 'رقم الحجز',
  declinedTitle: 'تم رفض الدفع.',
  declinedLead: 'لم يُخصم أي مبلغ وأُلغي حجز تذاكرك. اختر التذاكر مرة أخرى للمحاولة.',
  timeoutTitle: 'لم يكتمل الدفع.',
  timeoutLead: 'لم يُخصم أي مبلغ وأُلغي حجز تذاكرك. اختر التذاكر مرة أخرى للمحاولة.',
  receiptQuantity: 'التذاكر',
  receiptTotal: 'إجمالي المدفوع',
  map: 'خريطة مقاعد تفاعلية',
  unavailableSeat: 'هذا المقعد غير متاح. اختر مقعدًا متاحًا.',
  seatingNote: 'خريطة مقاعد مباشرة. قد يصبح المقعد المحجوز مؤقتًا متاحًا من جديد عند انتهاء حجزه.',
}

const liveText: Record<Language, Partial<BookingStrings>> = { en, ar }

/**
 * The booking texts in the current language. For a real event, the sample texts are replaced by the ones above.
 * eventId: the event the component shows; when left out, the event in the cart.
 */
export function useBookingStrings(eventId?: string | null): BookingStrings {
  const { lang } = usePreferences()
  const { state } = useBooking()
  const live = isLiveEvent(eventId ?? state.eventId ?? '')
  return live ? { ...bookingStrings[lang], ...liveText[lang] } : bookingStrings[lang]
}
