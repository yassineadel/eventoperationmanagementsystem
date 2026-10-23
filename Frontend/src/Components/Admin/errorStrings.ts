// Messages for errors the admin data modules throw, English and Arabic, so an admin sees
// what blocked an action instead of a generic "something went wrong".
import { useCallback } from 'react'
import { ApiError } from '../../lib/api'
import { AdminApiError, type AdminErrorCode } from '../../lib/adminErrors'
import { usePreferences } from '../Auth/preferences'

type Key = AdminErrorCode | 'network' | 'forbidden' | 'signedOut'

const en: Record<Key, string> = {
  'venue-locked': 'The venue can’t change after the event is published.',
  'venue-missing': 'That venue no longer exists. Choose another one.',
  'venue-in-use': 'Events use this venue, so it can’t be deleted.',
  'draft-only-delete': 'Only drafts can be deleted. Cancel a published event instead.',
  'draft-only-publish': 'This event is already published.',
  'published-only-cancel': 'Only published events can be cancelled.',
  'tickets-locked': 'Tickets can’t change once the event is cancelled or has started.',
  'category-has-sales': 'A category with sales can’t be removed.',
  'wave-has-sales': 'A wave with sales can’t be removed.',
  'wave-price-locked': 'The price of a wave with sales can’t change.',
  'wave-below-sold': 'A wave can’t have fewer tickets than it already sold.',
  'self-block': 'You can’t block your own account.',
  'self-role': 'You can’t change your own role.',
  'paid-only-refund': 'Only paid orders can be refunded.',
  'request-decided': 'Someone already decided this request. Reload to see the result.',
  network: 'Hafletna can’t be reached. Check your connection and try again.',
  forbidden: 'Your account isn’t allowed to do this.',
  signedOut: 'Your session ended. Sign in again to continue.',
}

const ar: Record<Key, string> = {
  'venue-locked': 'لا يمكن تغيير المكان بعد نشر الفعالية.',
  'venue-missing': 'هذا المكان لم يعد موجودًا. اختر مكانًا آخر.',
  'venue-in-use': 'تستخدم فعاليات هذا المكان، لذلك لا يمكن حذفه.',
  'draft-only-delete': 'يمكن حذف المسودات فقط. ألغِ الفعالية المنشورة بدلًا من ذلك.',
  'draft-only-publish': 'هذه الفعالية منشورة بالفعل.',
  'published-only-cancel': 'يمكن إلغاء الفعاليات المنشورة فقط.',
  'tickets-locked': 'لا يمكن تغيير التذاكر بعد إلغاء الفعالية أو بدئها.',
  'category-has-sales': 'لا يمكن حذف فئة بها مبيعات.',
  'wave-has-sales': 'لا يمكن حذف موجة بها مبيعات.',
  'wave-price-locked': 'لا يمكن تغيير سعر موجة بها مبيعات.',
  'wave-below-sold': 'لا يمكن أن تقل تذاكر الموجة عما بيع منها.',
  'self-block': 'لا يمكنك حظر حسابك.',
  'self-role': 'لا يمكنك تغيير دورك.',
  'paid-only-refund': 'يمكن استرداد الطلبات المدفوعة فقط.',
  'request-decided': 'تم البت في هذا الطلب بالفعل. أعد التحميل لرؤية النتيجة.',
  network: 'تعذّر الوصول إلى حفلتنا. تحقق من اتصالك وحاول مرة أخرى.',
  forbidden: 'حسابك غير مسموح له بذلك.',
  signedOut: 'انتهت جلستك. سجّل الدخول مرة أخرى للمتابعة.',
}

/** Turns a caught error into a message for the admin; unknown errors get `fallback`. */
export function useErrorText() {
  const { lang } = usePreferences()
  return useCallback(
    (error: unknown, fallback: string) => {
      const table = lang === 'ar' ? ar : en
      if (error instanceof AdminApiError) return table[error.code]
      if (error instanceof ApiError) {
        if (error.isNetwork) return table.network
        if (error.status === 401) return table.signedOut
        if (error.status === 403) return table.forbidden
      }
      return fallback
    },
    [lang],
  )
}
