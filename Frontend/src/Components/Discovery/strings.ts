import type { Language } from '../Homepage/types'

const en = {
  listingTitle: 'Events', listingLead: 'Search and filter events by category, city, date and price.',
  listingPageTitle: 'Explore events | Hafletna', allEvents: 'All events', filters: 'Filters', showFilters: 'Show filters', hideFilters: 'Hide filters',
  search: 'Search events', searchPlaceholder: 'Search events, performers, categories, or venues', category: 'Category', city: 'City', dateRange: 'Date range',
  fromDate: 'From date', toDate: 'To date', price: 'Price', allPrices: 'Any price', freeOnly: 'Free entry', paidOnly: 'Paid events',
  sortBy: 'Sort by', soonest: 'Date: soonest first', popular: 'Most popular', priceLow: 'Price: low to high', priceHigh: 'Price: high to low', name: 'Event name',
  clearAll: 'Clear all filters', activeFilters: 'Active filters', removeFilter: 'Remove filter', from: 'From', until: 'Until',
  showing: 'Showing', of: 'of', events: 'events', pagination: 'Event pages', previous: 'Previous', next: 'Next', page: 'Page',
  emptyTitle: 'No events found', emptyLead: 'No sample events match all your filters. Try a wider date range, another city, or remove a filter.',
  invalidDates: 'The end date must be on or after the start date.', demo: 'Events, venue information, and availability are sample data for this frontend preview.',
  about: 'About this event', venue: 'Venue & location', policies: 'Event policies', faq: 'Frequently asked questions',
  doors: 'Doors open', starts: 'Event starts', duration: 'Duration', capacity: 'Capacity', attendees: 'attendees',
  gallery: 'Event photos', photo: 'Photo', previousPhoto: 'Previous photo', nextPhoto: 'Next photo',
  backToResults: 'Back to results', exploreEvents: 'Explore all events', organisedBy: 'Organised by',
  locationNote: 'The map shows an approximate city location for this fictional sample venue.', openMap: 'Open in Google Maps',
  tickets: 'Tickets', generalAdmission: 'General admission', bookingPreview: 'Booking unavailable in preview',
  bookingNote: 'Try sample ticket selection, cart, and checkout. No real reservation, payment, or ticket is created.', localTime: 'All times are local to Egypt.',
  eventNotFound: 'This event could not be found.', notFoundLead: 'The event may no longer be public, or the link may be incorrect. Browse events to find another experience.',
  pageNotFound: 'This page could not be found.', pageNotFoundLead: 'Use the navigation to return home or browse events.',
  home: 'Home', eventsLabel: 'Events', sample: 'Sample event',
}

const ar: Record<keyof typeof en, string> = {
  listingTitle: 'الفعاليات', listingLead: 'ابحث عن الفعاليات حسب الفئة والمدينة والتاريخ والسعر.',
  listingPageTitle: 'استكشف الفعاليات | حفلتنا', allEvents: 'كل الفعاليات', filters: 'الفلاتر', showFilters: 'إظهار الفلاتر', hideFilters: 'إخفاء الفلاتر',
  search: 'ابحث عن فعاليات', searchPlaceholder: 'ابحث عن فعالية أو فنان أو فئة أو مكان', category: 'الفئة', city: 'المدينة', dateRange: 'الفترة الزمنية',
  fromDate: 'من تاريخ', toDate: 'إلى تاريخ', price: 'السعر', allPrices: 'كل الأسعار', freeOnly: 'دخول مجاني', paidOnly: 'فعاليات مدفوعة',
  sortBy: 'ترتيب حسب', soonest: 'التاريخ: الأقرب أولًا', popular: 'الأكثر رواجًا', priceLow: 'السعر: من الأقل إلى الأعلى', priceHigh: 'السعر: من الأعلى إلى الأقل', name: 'اسم الفعالية',
  clearAll: 'مسح كل الفلاتر', activeFilters: 'الفلاتر المفعّلة', removeFilter: 'إزالة الفلتر', from: 'من', until: 'حتى',
  showing: 'عرض', of: 'من', events: 'فعاليات', pagination: 'صفحات الفعاليات', previous: 'السابق', next: 'التالي', page: 'صفحة',
  emptyTitle: 'لا توجد نتائج', emptyLead: 'لا توجد فعاليات تجريبية تطابق كل اختياراتك. وسّع الفترة الزمنية أو اختر مدينة أخرى أو أزل أحد الفلاتر.',
  invalidDates: 'يجب أن يكون تاريخ النهاية في يوم البداية أو بعده.', demo: 'الفعاليات ومعلومات الأماكن وحالة التوفر بيانات تجريبية لهذا العرض.',
  about: 'عن الفعالية', venue: 'المكان والموقع', policies: 'سياسات الفعالية', faq: 'الأسئلة الشائعة',
  doors: 'فتح الأبواب', starts: 'بداية الفعالية', duration: 'المدة', capacity: 'السعة', attendees: 'شخص',
  gallery: 'صور الفعالية', photo: 'صورة', previousPhoto: 'الصورة السابقة', nextPhoto: 'الصورة التالية',
  backToResults: 'العودة إلى النتائج', exploreEvents: 'استكشف كل الفعاليات', organisedBy: 'تنظيم',
  locationNote: 'تعرض الخريطة موقعًا تقريبيًا داخل المدينة لهذا المكان التجريبي غير الحقيقي.', openMap: 'فتح في خرائط Google',
  tickets: 'التذاكر', generalAdmission: 'دخول عام', bookingPreview: 'الحجز غير متاح في العرض التجريبي',
  bookingNote: 'جرّب اختيار التذاكر والسلة وإتمام الحجز. لا حجز فعلي ولا دفع ولا إصدار تذاكر حقيقية.', localTime: 'جميع المواعيد بتوقيت مصر المحلي.',
  eventNotFound: 'لم نعثر على هذه الفعالية.', notFoundLead: 'قد تكون الفعالية غير متاحة للعامة أو الرابط غير صحيح. تصفح الفعاليات لاكتشاف تجربة أخرى.',
  pageNotFound: 'لم نعثر على هذه الصفحة.', pageNotFoundLead: 'استخدم القائمة للعودة إلى الرئيسية أو استكشاف الفعاليات.',
  home: 'الرئيسية', eventsLabel: 'الفعاليات', sample: 'فعالية تجريبية',
}

export type DiscoveryStrings = typeof ar
export const discoveryStrings: Record<Language, DiscoveryStrings> = { en, ar }
