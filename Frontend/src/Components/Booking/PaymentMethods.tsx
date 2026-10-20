import { usePreferences } from '../Auth/preferences'
import type { PaymentMethodId } from './paymentOptions'
import './PaymentMethods.css'

const copy = {
  en: {
    legend: 'Choose a payment method',
    lead: 'Preview your preferred way to pay with illustrative sample details.',
    sample: 'Sample',
    selected: 'Selected method',
    notSelected: 'Choose a method to preview its sample payment details.',
    note: 'This is a sample payment preview. Selecting a method does not make a payment.',
    error: 'Choose a payment method before continuing.',
    detail: 'Sample payment details',
    account: 'Sample account',
    number: 'Sample number',
    holder: 'Sample attendee',
    methods: {
      card: { title: 'Credit or debit card', subtitle: 'A familiar way to pay.', detail: 'A sample card is ready for this checkout preview.', number: '•••• 4242', label: 'Card ending in 4242' },
      wallet: { title: 'Mobile wallet', subtitle: 'Pay from your mobile.', detail: 'A sample mobile wallet is ready for this checkout preview.', number: '•••• 1234', label: 'Wallet ending in 1234' },
      'bank-transfer': { title: 'Bank transfer', subtitle: 'Pay through your bank.', detail: 'Preview a bank payment with a fictional sample account.', number: '•••• 6789', label: 'Account ending in 6789' },
    },
  },
  ar: {
    legend: 'اختر طريقة الدفع',
    lead: 'استعرض طريقة الدفع المفضلة لديك باستخدام بيانات توضيحية تجريبية.',
    sample: 'تجريبي',
    selected: 'الطريقة المختارة',
    notSelected: 'اختر طريقة لاستعراض بيانات الدفع التجريبية الخاصة بها.',
    note: 'هذه معاينة تجريبية للدفع. اختيار الطريقة لا ينفذ أي عملية دفع.',
    error: 'اختر طريقة الدفع قبل المتابعة.',
    detail: 'بيانات الدفع التجريبية',
    account: 'حساب تجريبي',
    number: 'الرقم التجريبي',
    holder: 'حاضر تجريبي',
    methods: {
      card: { title: 'بطاقة ائتمان أو خصم', subtitle: 'طريقة مألوفة للدفع.', detail: 'بطاقة تجريبية جاهزة لمعاينة الدفع في هذه الصفحة.', number: '•••• 4242', label: 'بطاقة تنتهي بالرقم 4242' },
      wallet: { title: 'محفظة إلكترونية', subtitle: 'ادفع من هاتفك.', detail: 'محفظة إلكترونية تجريبية جاهزة لمعاينة الدفع في هذه الصفحة.', number: '•••• 1234', label: 'محفظة تنتهي بالرقم 1234' },
      'bank-transfer': { title: 'تحويل بنكي', subtitle: 'ادفع من خلال البنك.', detail: 'استعرض الدفع البنكي باستخدام حساب تجريبي وهمي.', number: '•••• 6789', label: 'حساب ينتهي بالرقم 6789' },
    },
  },
} as const

const methods: PaymentMethodId[] = ['card', 'wallet', 'bank-transfer']

function MethodIcon({ method }: { method: PaymentMethodId }) {
  const path = method === 'card'
    ? 'M3 5h18v14H3V5Zm0 5h18M6 15h4'
    : method === 'wallet'
      ? 'M4 6h15v3M4 6V4h12M4 6v14h17V9H4m12 4h5v4h-5v-4Z'
      : 'm2 9 10-6 10 6H2Zm2 12h16M6 11v7m6-7v7m6-7v7'
  return <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={path} /></svg>
}

export default function PaymentMethods({ method, onChange, disabled, error }: {
  method: PaymentMethodId | null
  onChange: (id: PaymentMethodId) => void
  disabled: boolean
  error: boolean
}) {
  const { lang } = usePreferences()
  const t = copy[lang]
  const selected = method ? t.methods[method] : null

  return <fieldset
    id="booking-payment-methods"
    className={`booking-methods${error ? ' has-error' : ''}`}
    tabIndex={-1}
    disabled={disabled}
    aria-invalid={error || undefined}
    aria-describedby={`booking-methods-lead booking-methods-note${error ? ' booking-payment-method-error' : ''}`}
  >
    <legend>{t.legend}</legend>
    <p id="booking-methods-lead" className="booking-methods-lead">{t.lead}</p>
    <div className="booking-methods-grid">
      {methods.map((id) => <label key={id} className={`booking-method${method === id ? ' is-selected' : ''}`}>
        <input type="radio" name="sample-payment-method" value={id} checked={method === id} onChange={() => onChange(id)} aria-describedby={`booking-method-caption-${id}`} />
        <span className="booking-method-icon"><MethodIcon method={id} /></span>
        <span className="booking-method-copy"><strong>{t.methods[id].title}</strong><span id={`booking-method-caption-${id}`}>{t.methods[id].subtitle}</span></span>
        <span className="booking-method-sample">{t.sample}</span>
      </label>)}
    </div>
    {error && <p id="booking-payment-method-error" className="booking-field-error" role="alert">{t.error}</p>}
    <div className={`booking-method-preview${method ? ' has-selection' : ''}`} aria-live="polite" aria-atomic="true">
      {method && selected ? <>
        <div className={`booking-method-art booking-method-art--${method}`} aria-hidden="true" dir="ltr">
          <span className="booking-method-art-brand">HAFLETNA <span>/ {t.sample}</span></span>
          <span className="booking-method-art-emblem"><MethodIcon method={method} /></span>
          <span className="booking-method-art-number">{selected.number}</span>
          <span className="booking-method-art-owner">{t.holder}</span>
          <svg className="booking-method-art-orbit" width="160" height="160" viewBox="0 0 160 160" fill="none"><circle cx="80" cy="80" r="65" /><circle cx="80" cy="80" r="45" /><circle cx="80" cy="80" r="25" /></svg>
        </div>
        <div className="booking-method-preview-copy">
          <p className="booking-method-preview-eyebrow">{t.selected}</p>
          <strong>{selected.title}</strong>
          <p>{selected.detail}</p>
          <dl aria-label={t.detail}>
            <div><dt>{t.account}</dt><dd>{t.holder}</dd></div>
            <div><dt>{t.number}</dt><dd><span className="home-sr-only">{selected.label}</span><bdi dir="ltr" aria-hidden="true">{selected.number}</bdi></dd></div>
          </dl>
        </div>
      </> : <p className="booking-method-placeholder"><MethodIcon method="card" />{t.notSelected}</p>}
    </div>
    <p id="booking-methods-note" className="booking-methods-note">{t.note}</p>
  </fieldset>
}
