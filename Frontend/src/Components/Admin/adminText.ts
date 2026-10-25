// Small text helpers shared by the admin pages.

const ARABIC_INDIC = '٠١٢٣٤٥٦٧٨٩'
const PERSIAN = '۰۱۲۳۴۵۶۷۸۹'

/** Arabic-Indic and Persian digits as 0–9, so ٥٠٠ typed on an Arabic keyboard reads as 500. */
export function toLatinDigits(value: string) {
  return value.replace(/[٠-٩۰-۹]/g, (d) => String(ARABIC_INDIC.includes(d) ? ARABIC_INDIC.indexOf(d) : PERSIAN.indexOf(d)))
}

/** A whole number typed into a field, in any digits, capped so it can't run away. */
export function parseWhole(value: string, max = 1_000_000) {
  const n = Number(toLatinDigits(value).replace(/[^0-9]/g, '').slice(0, 9)) || 0
  return Math.min(n, max)
}

/** Keeps left-to-right text such as an email or a code in order inside an Arabic sentence. */
export function isolate(text: string) {
  return `⁨${text}⁩`
}

/** Plural forms keyed by Intl.PluralRules categories; Arabic uses zero, one, two, few, many and other. */
export type PluralForms = { other: string } & Partial<Record<Intl.LDMLPluralRule, string>>

const rules = { en: new Intl.PluralRules('en-US'), ar: new Intl.PluralRules('ar-EG') }

/** The right form for `n`, with "{n}" replaced by the formatted number. */
export function plural(lang: 'en' | 'ar', n: number, forms: PluralForms, formatted = String(n)) {
  const form = forms[rules[lang].select(n)] ?? forms.other
  return form.replace('{n}', formatted)
}

/** "Showing 3 of 12 events" under a list; the noun agrees with the total. */
export function shownOf(lang: 'en' | 'ar', shown: number, total: number, forms: PluralForms, num: (n: number) => string) {
  return plural(lang, total, forms, num(total)).replace('{shown}', num(shown))
}
