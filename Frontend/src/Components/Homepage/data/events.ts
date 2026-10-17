import type { Event } from '../types'

// Fictional events, including illustrative availability statuses, for the frontend demo.
export const events: Event[] = [
  {
    id: 'cairo-after-dark', category: 'concerts', city: 'cairo', date: '2026-11-06T20:00:00+02:00', price: 350, status: 'available', featured: true, activity: { views: 4100, registrations: 210 },
    title: { en: 'Cairo After Dark', ar: 'القاهرة بعد الغروب' }, venue: { en: 'The Garden Stage', ar: 'مسرح الحديقة' },
    description: { en: 'An open-air evening of live music, electric performances, and a city that never stops moving.', ar: 'أمسية موسيقية في الهواء الطلق، وعروض حية مميزة، في مدينة لا تتوقف عن الحركة.' }, image: '/event-images/concert.jpg',
  },
  {
    id: 'coastal-weekender', category: 'festivals', city: 'alexandria', date: '2026-11-13T16:00:00+02:00', price: 0, status: 'available', featured: true, activity: { views: 3100, registrations: 142 },
    title: { en: 'The Coastal Weekender', ar: 'مهرجان نهاية الأسبوع الساحلي' }, venue: { en: 'Seafront Gardens', ar: 'حدائق الواجهة البحرية' },
    description: { en: 'A seaside celebration of independent music, local food, and good company. Make a weekend of it.', ar: 'احتفال على البحر يجمع الموسيقى المستقلة والطعام المحلي والرفقة الجميلة. استمتع بنهاية أسبوع مختلفة.' }, image: '/event-images/festival.jpg',
  },
  {
    id: 'creative-canvas', category: 'arts', city: 'cairo', date: '2026-11-20T18:00:00+02:00', price: 200, status: 'sold-out', featured: true, activity: { views: 3400, registrations: 180 },
    title: { en: 'The Creative Canvas', ar: 'مساحة للإبداع' }, venue: { en: 'Downtown Art House', ar: 'بيت الفن بوسط البلد' },
    description: { en: 'Meet emerging artists and discover original work at an intimate evening of art, conversation, and inspiration.', ar: 'تعرّف على فنانين صاعدين واكتشف أعمالًا أصلية في أمسية تجمع الفن والحوار والإلهام.' }, image: '/event-images/art.jpg',
  },
  {
    id: 'city-strides', category: 'sports', city: 'giza', date: '2026-11-07T07:00:00+02:00', price: 200, status: 'available', activity: { views: 2200, registrations: 95 },
    title: { en: 'City Strides: The 5K', ar: 'خطوات المدينة: سباق ٥ كم' }, venue: { en: 'Riverside Park', ar: 'حديقة ضفاف النيل' },
    description: { en: 'Start your morning with a friendly community run. All paces welcome, with a relaxed gathering at the finish.', ar: 'ابدأ صباحك بالجري مع مجتمع ودود. جميع المستويات مرحب بها، مع لقاء لطيف عند خط النهاية.' }, image: '/event-images/sports.jpg',
  },
  {
    id: 'design-together', category: 'workshops', city: 'alexandria', date: '2026-11-21T11:00:00+02:00', price: 350, status: 'available', activity: { views: 1350, registrations: 60 },
    title: { en: 'Design Something Together', ar: 'لنصمم شيئًا معًا' }, venue: { en: 'The Creative Studio', ar: 'الاستوديو الإبداعي' },
    description: { en: 'A hands-on design workshop for curious minds. Learn, experiment, and leave with something you made yourself.', ar: 'ورشة تصميم عملية لكل من يحب الاستكشاف. تعلّم وجرّب واصنع شيئًا مميزًا بيديك.' }, image: '/event-images/workshop.jpg',
  },
  {
    id: 'next-perspectives', category: 'conferences', city: 'cairo', date: '2026-11-28T09:00:00+02:00', price: 800, status: 'available', activity: { views: 1700, registrations: 70 },
    title: { en: 'Next: New Perspectives', ar: 'الغد: آفاق جديدة' }, venue: { en: 'City Conference Hall', ar: 'قاعة مؤتمرات المدينة' },
    description: { en: 'A day of fresh ideas and thoughtful conversations with people building what comes next.', ar: 'يوم من الأفكار الجديدة والحوارات الملهمة مع أشخاص يصنعون ملامح المستقبل.' }, image: '/event-images/conference.jpg',
  },
  {
    id: 'sunset-beats', category: 'concerts', city: 'cairo', date: '2026-11-20T19:00:00+02:00', price: 250, status: 'available', activity: { views: 800, registrations: 35 },
    title: { en: 'Sunset Beats', ar: 'إيقاعات الغروب' }, venue: { en: 'The Garden Stage', ar: 'مسرح الحديقة' },
    description: { en: 'An intimate evening of acoustic music and warm lights, made for catching up with your favourite people.', ar: 'أمسية حميمة تجمع الموسيقى الهادئة والأضواء الدافئة، لقضاء وقت جميل مع أحبائك.' }, image: '/event-images/venue-garden.jpg',
  },
  {
    id: 'nile-nights', category: 'arts', city: 'giza', date: '2026-11-13T18:00:00+02:00', price: 150, status: 'cancelled', activity: { views: 750, registrations: 30 },
    title: { en: 'Nile Nights', ar: 'ليالي النيل' }, venue: { en: 'Riverside Park', ar: 'حديقة ضفاف النيل' },
    description: { en: 'Stories, art, and conversation come together for a relaxed cultural evening by the river.', ar: 'تلتقي الحكايات والفنون والحوارات في أمسية ثقافية هادئة على ضفاف النيل.' }, image: '/event-images/venue-riverside.jpg',
  },
]
