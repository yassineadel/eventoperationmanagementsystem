import type { Language } from '../Homepage/types.ts'

export const paymentMethodIds = ['card', 'wallet', 'bank-transfer'] as const
export type PaymentMethodId = typeof paymentMethodIds[number]
export type SamplePaymentMethod = PaymentMethodId | 'free'

export function isSamplePaymentMethod(value: unknown): value is SamplePaymentMethod {
  return value === 'free' || paymentMethodIds.some((method) => method === value)
}

export function paymentMethodName(method: SamplePaymentMethod, lang: Language) {
  const names = {
    card: { en: 'Credit / debit card', ar: 'بطاقة ائتمان أو خصم' },
    wallet: { en: 'Mobile wallet', ar: 'محفظة إلكترونية' },
    'bank-transfer': { en: 'Bank transfer', ar: 'تحويل بنكي' },
    free: { en: 'No payment required', ar: 'لا يلزم الدفع' },
  }
  return names[method][lang]
}
