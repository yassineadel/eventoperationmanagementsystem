import type { Event, Language, LocalizedText } from '../Homepage/types.ts'
import { getBookingCatalogue } from '../Booking/catalogue.ts'

type VenueDetails = { address: LocalizedText; coordinates: readonly [number, number]; duration: number; capacity: number; gallery: string[] }
const venueDetails: Record<string, VenueDetails> = {
  'cairo-after-dark': { address: { en: 'Garden Quarter, Cairo — sample venue', ar: 'حي الحدائق، القاهرة — مكان تجريبي' }, coordinates: [30.0444, 31.2357], duration: 180, capacity: 500, gallery: ['/event-images/hero-ticket.png', '/event-images/concert.jpg', '/event-images/venue-garden.jpg'] },
  'coastal-weekender': { address: { en: 'Seafront promenade, Alexandria — sample venue', ar: 'ممشى الواجهة البحرية، الإسكندرية — مكان تجريبي' }, coordinates: [31.2001, 29.9187], duration: 360, capacity: 1200, gallery: ['/event-images/festival.jpg', '/event-images/venue-seafront.jpg', '/event-images/concert.jpg'] },
  'creative-canvas': { address: { en: 'Arts Quarter, Downtown Cairo — sample venue', ar: 'حي الفنون، وسط القاهرة — مكان تجريبي' }, coordinates: [30.0483, 31.2392], duration: 150, capacity: 200, gallery: ['/event-images/art.jpg', '/event-images/workshop.jpg', '/event-images/venue-garden.jpg'] },
  'city-strides': { address: { en: 'Riverside walkway, Giza — sample venue', ar: 'ممشى ضفاف النيل، الجيزة — مكان تجريبي' }, coordinates: [30.0131, 31.2089], duration: 90, capacity: 350, gallery: ['/event-images/sports.jpg', '/event-images/venue-riverside.jpg', '/event-images/festival.jpg'] },
  'design-together': { address: { en: 'Creative Quarter, Alexandria — sample venue', ar: 'الحي الإبداعي، الإسكندرية — مكان تجريبي' }, coordinates: [31.204, 29.924], duration: 180, capacity: 80, gallery: ['/event-images/workshop.jpg', '/event-images/art.jpg', '/event-images/conference.jpg'] },
  'next-perspectives': { address: { en: 'City Centre, Cairo — sample venue', ar: 'وسط المدينة، القاهرة — مكان تجريبي' }, coordinates: [30.0544, 31.244], duration: 480, capacity: 800, gallery: ['/event-images/conference.jpg', '/event-images/workshop.jpg', '/event-images/venue-garden.jpg'] },
  'sunset-beats': { address: { en: 'Garden Quarter, Cairo — sample venue', ar: 'حي الحدائق، القاهرة — مكان تجريبي' }, coordinates: [30.0444, 31.2357], duration: 120, capacity: 150, gallery: ['/event-images/venue-garden.jpg', '/event-images/concert.jpg', '/event-images/hero-ticket.png'] },
  'nile-nights': { address: { en: 'Riverside walkway, Giza — sample venue', ar: 'ممشى ضفاف النيل، الجيزة — مكان تجريبي' }, coordinates: [30.0131, 31.2089], duration: 150, capacity: 120, gallery: ['/event-images/venue-riverside.jpg', '/event-images/art.jpg', '/event-images/venue-seafront.jpg'] },
}

export function getEventDetails(event: Event) {
  const details = venueDetails[event.id]
  if (!details) throw new Error(`Missing sample details for ${event.id}`)
  const doorsOpen = new Date(new Date(event.date).getTime() - 30 * 60_000).toISOString()
  const familyEvent = event.category === 'sports' || event.category === 'festivals'
  const policies = [
    { title: { en: 'Admission & age', ar: 'الدخول والعمر' }, body: familyEvent
      ? { en: 'All ages are welcome. Guests under 16 must be accompanied by an adult. Children remain the responsibility of their guardian.', ar: 'نرحب بجميع الأعمار. يجب أن يصاحب من هم دون ١٦ عامًا شخص بالغ، وتبقى رعاية الأطفال مسؤولية أولياء أمورهم.' }
      : { en: 'Guests must be aged 16 or over. Guests under 18 must be accompanied by an adult. Bring a valid photo ID.', ar: 'الدخول لمن تبلغ أعمارهم ١٦ عامًا فأكثر. يجب أن يصاحب من هم دون ١٨ عامًا شخص بالغ. يُرجى إحضار إثبات هوية به صورة.' } },
    { title: { en: 'Entry & safety', ar: 'الدخول والسلامة' }, body: { en: 'Arrive before the start time for entry checks. Glass containers, dangerous items, and professional recording equipment are not permitted. Follow the venue team’s directions.', ar: 'احضر قبل البداية لإجراءات الدخول. لا يُسمح بالعبوات الزجاجية أو الأدوات الخطرة أو معدات التسجيل الاحترافية. يُرجى اتباع تعليمات فريق المكان.' } },
    { title: { en: 'Cancellation & refunds', ar: 'الإلغاء واسترداد المبلغ' }, body: event.price === 0
      ? { en: 'This sample event has free entry. If the event is cancelled, no refund is applicable. Checkout is a frontend simulation only.', ar: 'الدخول لهذه الفعالية التجريبية مجاني. لا ينطبق استرداد المبلغ في حال الإلغاء. إتمام الحجز محاكاة للواجهة فقط.' }
      : { en: 'Illustrative policy: refund requests close seven days before the event, subject to approval and the category service fee. No payments or refund requests are processed in this preview.', ar: 'سياسة توضيحية: تُغلق طلبات الاسترداد قبل الفعالية بسبعة أيام، وتخضع للموافقة ورسوم الخدمة حسب الفئة. لا تتم معالجة أي مدفوعات أو طلبات استرداد في هذا العرض.' } },
    { title: { en: 'Accessibility', ar: 'إمكانية الوصول' }, body: { en: 'The sample venue includes step-free entry and an accessible viewing or seating area. Contact the organiser ahead of a real visit to confirm individual access needs.', ar: 'يتضمن المكان التجريبي مدخلًا دون درجات ومنطقة مشاهدة أو جلوس مهيّأة. تواصل مع المنظّم قبل أي زيارة فعلية لتأكيد احتياجات الوصول الخاصة بك.' } },
  ]
  const faqs = [
    { question: { en: 'When should I arrive?', ar: 'متى يجب أن أحضر؟' }, answer: { en: 'Doors open 30 minutes before the listed start time. Allow time for entry checks and finding your place.', ar: 'تفتح الأبواب قبل موعد البداية المعلن بـ ٣٠ دقيقة. خصّص وقتًا لإجراءات الدخول والوصول إلى مكانك.' } },
    { question: { en: 'Can I book tickets here?', ar: 'هل يمكنني حجز التذاكر هنا؟' }, answer: { en: 'You can try ticket selection, cart, and checkout with sample data. No real seats are reserved, payments collected, or tickets issued.', ar: 'يمكنك تجربة اختيار التذاكر والسلة وإتمام الحجز ببيانات تجريبية. لا تُحجز مقاعد حقيقية ولا تُحصّل أموال ولا تُصدر تذاكر.' } },
    { question: { en: 'Are food and drinks available?', ar: 'هل تتوفر مأكولات ومشروبات؟' }, answer: { en: 'Sample on-site refreshments are listed as available for purchase separately. They are not included in the displayed admission price.', ar: 'تُدرج المأكولات والمشروبات في هذا المثال على أنها متاحة للشراء بشكل منفصل، ولا يشملها سعر الدخول المعروض.' } },
    { question: { en: 'Is the map an exact venue address?', ar: 'هل تعرض الخريطة عنوان المكان بدقة؟' }, answer: { en: 'The venue is fictional. The map marks an approximate city location to demonstrate the location feature.', ar: 'المكان غير حقيقي. تعرض الخريطة موقعًا تقريبيًا داخل المدينة لتوضيح ميزة عرض الموقع.' } },
  ]
  const capacity = getBookingCatalogue(event.id)!.categories.reduce((total, category) => total + category.capacity, 0)
  return { ...details, capacity, doorsOpen, organiser: { en: 'Hafletna Experiences — sample organiser', ar: 'تجارب حفلتنا — منظّم تجريبي' }, policies, faqs }
}

export function venueMapLinks(coordinates: readonly [number, number], lang: Language) {
  const location = coordinates.join(',')
  const embedParams = new URLSearchParams({ q: location, hl: lang, z: '15', output: 'embed' })
  const externalParams = new URLSearchParams({ api: '1', query: location })
  return {
    embed: `https://www.google.com/maps?${embedParams}`,
    external: `https://www.google.com/maps/search/?${externalParams}`,
  }
}
