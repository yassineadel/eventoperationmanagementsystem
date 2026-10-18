import type { EventStatus, Language, LocalizedText } from '../Homepage/types'

export const eventStatusLabels: Record<EventStatus, LocalizedText> = {
  available: { en: 'Available', ar: 'متاح' },
  'sold-out': { en: 'Sold out', ar: 'نفدت التذاكر' },
  cancelled: { en: 'Cancelled', ar: 'ملغاة' },
}

const en = {
  sampleStatus: 'Sample status', saveEvent: 'Save event', saved: 'Saved', removeSaved: 'Remove saved event',
  savedMessage: 'Event saved in this browser.', removedMessage: 'Event removed from saved events.',
  savedForVisit: 'Event saved for this visit. Browser storage is unavailable.', removedForVisit: 'Event removed for this visit. Browser storage is unavailable.',
  savedEvents: 'Saved events', savedOnly: 'Show saved events only', savedInBrowser: 'Your saved events are kept in this browser.',
  savedSession: 'Browser storage is unavailable. Your saved events are kept for this visit only.',
  savedEmptyTitle: 'No saved events yet.', savedEmptyLead: 'Press the bookmark button on an event to keep it here.',
  savedFilteredTitle: 'No saved events match these filters.',
  soldOutNote: 'This sample event is sold out. You can still save it and view its details.',
  cancelledNote: 'This sample event is cancelled. Its information is shown for reference.',
  cancelledBooking: 'Event cancelled',
}
const ar: Record<keyof typeof en, string> = {
  sampleStatus: 'حالة تجريبية', saveEvent: 'حفظ الفعالية', saved: 'محفوظة', removeSaved: 'إزالة الفعالية من المحفوظات',
  savedMessage: 'تم حفظ الفعالية في هذا المتصفح.', removedMessage: 'تمت إزالة الفعالية من المحفوظات.',
  savedForVisit: 'تم حفظ الفعالية لهذه الزيارة. تخزين المتصفح غير متاح.', removedForVisit: 'تمت إزالة الفعالية لهذه الزيارة. تخزين المتصفح غير متاح.',
  savedEvents: 'الفعاليات المحفوظة', savedOnly: 'عرض الفعاليات المحفوظة فقط', savedInBrowser: 'تُحفظ فعالياتك في هذا المتصفح.',
  savedSession: 'تخزين المتصفح غير متاح. تبقى الفعاليات المحفوظة لهذه الزيارة فقط.',
  savedEmptyTitle: 'لا توجد فعاليات محفوظة بعد.', savedEmptyLead: 'اضغط على زر الحفظ في أي فعالية لتجدها هنا.',
  savedFilteredTitle: 'لا توجد فعاليات محفوظة تطابق هذه الفلاتر.',
  soldOutNote: 'نفدت تذاكر هذه الفعالية التجريبية. لا يزال بإمكانك حفظها وعرض تفاصيلها.',
  cancelledNote: 'هذه الفعالية التجريبية ملغاة. تُعرض معلوماتها للرجوع إليها.',
  cancelledBooking: 'الفعالية ملغاة',
}
export const eventUiStrings: Record<Language, typeof ar> = { en, ar }
