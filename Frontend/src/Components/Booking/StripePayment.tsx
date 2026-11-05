import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { loadStripe, type Appearance, type Stripe, type StripeElements } from '@stripe/stripe-js'
import { usePreferences } from '../Auth/preferences'

const text = {
  en: {
    test: 'Test mode: use card 4242 4242 4242 4242, any future date and any CVC. Card 4000 0000 0000 0002 is declined.',
    secure: 'Your card details go straight to Stripe. Hafletna never sees them.',
    loading: 'Loading the secure card form…',
    loadError: 'The card form could not load. Check your connection and refresh the page.',
  },
  ar: {
    test: 'وضع الاختبار: استخدم البطاقة 4242 4242 4242 4242 وأي تاريخ مستقبلي وأي رمز CVC. البطاقة 4000 0000 0000 0002 تُرفض.',
    secure: 'تُرسل بيانات بطاقتك مباشرةً إلى Stripe، ولا تراها حفلتنا أبدًا.',
    loading: 'جارٍ تحميل نموذج البطاقة الآمن…',
    loadError: 'تعذّر تحميل نموذج البطاقة. تحقق من اتصالك وأعد تحميل الصفحة.',
  },
}

// Stripe.js is loaded once per public key
const stripes = new Map<string, Promise<Stripe | null>>()
const getStripe = (key: string) => {
  if (!stripes.has(key)) stripes.set(key, loadStripe(key))
  return stripes.get(key)!
}

// Stripe's form lives in its own frame, so it can't use our CSS. Read the site's colours
// (they change with light/dark mode) and hand them to Stripe instead.
function siteAppearance(el: HTMLElement, dark: boolean): Appearance {
  const css = getComputedStyle(el)
  const v = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback
  const surface = v('--home-surface', dark ? '#11162d' : '#fffdfa')
  const ink = v('--home-ink', dark ? '#f8f3fb' : '#0a0b23')
  const muted = v('--home-muted', dark ? '#c1bdd3' : '#59586c')
  const line = v('--home-line', dark ? '#2d3154' : '#e7e0e8')
  const purple = v('--home-purple', dark ? '#ad76ff' : '#7200f5')
  const paper = v('--home-paper', dark ? '#090c20' : '#fbf8f3')
  return {
    theme: dark ? 'night' : 'stripe',
    variables: {
      colorPrimary: purple, colorBackground: paper, colorText: ink, colorTextSecondary: muted,
      colorTextPlaceholder: muted, colorDanger: dark ? '#ff8a8a' : '#c4314b', colorIcon: muted,
      fontFamily: "'Plus Jakarta Sans', 'Segoe UI', sans-serif", fontSizeBase: '14px', borderRadius: '8px', spacingUnit: '4px',
    },
    rules: {
      '.Input': { backgroundColor: paper, border: `1px solid ${line}`, boxShadow: 'none', padding: '12px 14px' },
      '.Input:focus': { border: `1px solid ${purple}`, boxShadow: `0 0 0 3px ${purple}33` },
      '.Input--invalid': { border: `1px solid ${dark ? '#ff8a8a' : '#c4314b'}` },
      '.Label': { color: muted, fontSize: '12px', fontWeight: '600' },
      '.Tab, .Block': { backgroundColor: surface, border: `1px solid ${line}`, boxShadow: 'none' },
      '.Tab--selected': { border: `1px solid ${purple}` },
    },
  }
}

export type StripeCardFormHandle = {
  /** Checks the card fields. Resolves to an error message, or null when they are complete. */
  check: () => Promise<string | null>
  /** Charges the card for the order the server created. Resolves to an error message, or null on success. */
  pay: (clientSecret: string, orderId: string) => Promise<string | null>
}

/**
 * Stripe's card form, shown inside the checkout like any online shop.
 * It appears before the order exists ("deferred" payment): the order and its payment are created
 * only when the buyer presses Pay, then the card is charged with the order's clientSecret.
 */
const StripeCardForm = forwardRef<StripeCardFormHandle, { publishableKey: string; amount: number; disabled?: boolean }>(
  function StripeCardForm({ publishableKey, amount, disabled }, ref) {
    const { lang, theme } = usePreferences()
    const t = text[lang]
    const mount = useRef<HTMLDivElement>(null)
    const stripe = useRef<Stripe | null>(null)
    const elements = useRef<StripeElements | null>(null)
    const [ready, setReady] = useState(false)
    const [loadError, setLoadError] = useState(false)
    // Stripe counts in piastres; the card form needs an amount above zero
    const minor = Math.max(100, Math.round(amount * 100))

    useEffect(() => {
      let cancelled = false
      getStripe(publishableKey).then((loaded) => {
        if (cancelled) return
        if (!loaded || !mount.current) { setLoadError(true); return }
        stripe.current = loaded
        elements.current = loaded.elements({
          mode: 'payment', amount: minor, currency: 'egp', locale: lang,
          fonts: [{ cssSrc: 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700&display=swap' }],
          appearance: siteAppearance(mount.current, theme === 'dark'),
        })
        const form = elements.current.create('payment', { wallets: { link: 'never', applePay: 'never', googlePay: 'never' } })
        form.on('ready', () => setReady(true))
        form.mount(mount.current)
      }).catch(() => setLoadError(true))
      return () => { cancelled = true; elements.current?.getElement('payment')?.destroy(); elements.current = null; setReady(false) }
      // the amount is updated below without rebuilding the form
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [publishableKey, lang])

    useEffect(() => { elements.current?.update({ amount: minor }) }, [minor])
    // Switching light/dark mode recolours the form without losing what was typed
    useEffect(() => {
      if (mount.current) elements.current?.update({ appearance: siteAppearance(mount.current, theme === 'dark') })
    }, [theme, ready])

    useImperativeHandle(ref, () => ({
      check: async () => {
        if (!elements.current) return t.loadError
        const { error } = await elements.current.submit()
        return error?.message ?? null
      },
      pay: async (clientSecret, orderId) => {
        if (!stripe.current || !elements.current) return t.loadError
        const { error } = await stripe.current.confirmPayment({
          elements: elements.current,
          clientSecret,
          redirect: 'if_required',
          confirmParams: { return_url: `${window.location.origin}/orders/${encodeURIComponent(orderId)}/confirmation` },
        })
        return error?.message ?? null
      },
    }), [t.loadError])

    return <div className="booking-stripe" aria-disabled={disabled}>
      <p className="booking-subtle-note">{t.secure}</p>
      {!ready && !loadError && <p className="booking-subtle-note" role="status">{t.loading}</p>}
      {loadError && <p className="booking-error" role="alert">{t.loadError}</p>}
      <div ref={mount} style={disabled ? { pointerEvents: 'none', opacity: 0.6 } : undefined} />
      <p className="booking-subtle-note">{t.test}</p>
    </div>
  },
)

export default StripeCardForm
