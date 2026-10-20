import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { createServer } from 'vite'
import { events as sampleEvents } from '../src/Components/Homepage/data/events.ts'
import { emptyBooking, transitionBooking } from '../src/Components/Booking/bookingModel.ts'

let server
let Layout
let Listing
let Detail
let Homepage
let NotFound
let PreferencesContext
let SavedEventsProvider
let ProfileLayout
let ProfileDetails
let AccountSettings
let PasswordChangeDialog
let EmailChangeDialog
let SessionContext
let authPages
let BookingContext
let TicketSelection
let Cart
let Checkout
let PolicyDialog

before(async () => {
  server = await createServer({ server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom' })
  Layout = (await server.ssrLoadModule('/src/Components/Discovery/DiscoveryLayout.tsx')).default
  Listing = (await server.ssrLoadModule('/src/Components/Discovery/EventsListing.tsx')).default
  Detail = (await server.ssrLoadModule('/src/Components/Discovery/EventDetail.tsx')).default
  Homepage = (await server.ssrLoadModule('/src/Components/Homepage/Homepage.tsx')).default
  NotFound = (await server.ssrLoadModule('/src/Components/Discovery/NotFound.tsx')).default
  PreferencesContext = (await server.ssrLoadModule('/src/Components/Auth/preferences.ts')).PreferencesContext
  SavedEventsProvider = (await server.ssrLoadModule('/src/Components/Discovery/SavedEventsProvider.tsx')).default
  ProfileLayout = (await server.ssrLoadModule('/src/Components/Profile/ProfileLayout.tsx')).default
  ProfileDetails = (await server.ssrLoadModule('/src/Components/Profile/ProfileDetails.tsx')).default
  AccountSettings = (await server.ssrLoadModule('/src/Components/Profile/AccountSettings.tsx')).default
  PasswordChangeDialog = (await server.ssrLoadModule('/src/Components/Profile/PasswordChangeDialog.tsx')).default
  EmailChangeDialog = (await server.ssrLoadModule('/src/Components/Profile/EmailChangeDialog.tsx')).default
  SessionContext = (await server.ssrLoadModule('/src/Components/Auth/sessionContext.ts')).SessionContext
  BookingContext = (await server.ssrLoadModule('/src/Components/Booking/bookingContext.ts')).BookingContext
  TicketSelection = (await server.ssrLoadModule('/src/Components/Booking/TicketSelection.tsx')).default
  Cart = (await server.ssrLoadModule('/src/Components/Booking/Cart.tsx')).default
  Checkout = (await server.ssrLoadModule('/src/Components/Booking/Checkout.tsx')).default
  PolicyDialog = (await server.ssrLoadModule('/src/Components/Booking/PolicyDialog.tsx')).default
  authPages = await Promise.all(['LoginPage/Login', 'RegisterPage/Register', 'VerifyEmailPage/VerifyEmail', 'ForgotPasswordPage/ForgotPassword', 'ResetPasswordPage/ResetPassword', 'AuthCallbackPage/AuthCallback'].map(async (path) => (await server.ssrLoadModule(`/src/Components/${path}.tsx`)).default))
})
after(async () => { await server?.close() })

function render(path, lang = 'en', theme = 'light', savedIds = [], sessionState = { status: 'guest', user: null }, booking = {}) {
  const value = { lang, theme, setLang() {}, setTheme() {} }
  let savedValue = JSON.stringify(savedIds)
  const storage = { getItem: () => savedValue, setItem: (_key, value) => { savedValue = value } }
  const session = { ...sessionState, acceptUser() {}, async refresh() {}, async signOut() {} }
  const bookingValue = { state: booking.state ?? emptyBooking(), now: booking.now ?? Date.now(), names: booking.names ?? {}, storageAvailable: true, act() {}, setAttendee() {} }
  return renderToStaticMarkup(h(PreferencesContext.Provider, { value },
    h(SessionContext.Provider, { value: session }, h(SavedEventsProvider, { storage }, h(BookingContext.Provider, { value: bookingValue }, h(MemoryRouter, { initialEntries: [path] }, h(Routes, null,
      h(Route, { path: '/', element: h(Homepage) }),
      h(Route, { element: h(Layout) },
        h(Route, { path: '/events', element: h(Listing) }),
        h(Route, { path: '/events/:eventId', element: h(Detail) }),
        h(Route, { path: '/events/:eventId/tickets', element: h(TicketSelection) }),
        h(Route, { path: '/cart', element: h(Cart) }),
        h(Route, { path: '/checkout', element: h(Checkout) }),
        h(Route, { path: '/policy-dialog', element: h(PolicyDialog, { event: sampleEvents[0], onClose() {}, onAccept() {} }) }),
        h(Route, { path: '/profile', element: h(ProfileLayout) },
          h(Route, { index: true, element: h(ProfileDetails) }),
          h(Route, { path: 'settings', element: h(AccountSettings) }),
          h(Route, { path: 'password-dialog', element: h(PasswordChangeDialog, { onClose() {}, onComplete() {} }) }),
          h(Route, { path: 'email-dialog', element: h(EmailChangeDialog, { onClose() {}, onComplete() {} }) }),
        ),
        h(Route, { path: '*', element: h(NotFound) }),
      ),
      ...['/login', '/register', '/verify-email', '/forgot-password', '/reset-password', '/auth/callback'].map((path, index) => h(Route, { key: path, path, element: h(authPages[index]) })),
    ))))),
  ))
}

test('listing routes render bounded pages and URL-selected filters in both languages and themes', () => {
  for (const lang of ['en', 'ar']) for (const theme of ['light', 'dark']) {
    const first = render('/events', lang, theme)
    assert.match(first, new RegExp(`lang="${lang}"`))
    assert.match(first, new RegExp(`data-theme="${theme}"`))
    assert.match(first, new RegExp(`dir="${lang === 'ar' ? 'rtl' : 'ltr'}"`))
    assert.equal((first.match(/class="home-event-card"/g) ?? []).length, 6)
    assert.match(first, /aria-current="page"/)
    const second = render('/events?page=2', lang, theme)
    assert.equal((second.match(/class="home-event-card"/g) ?? []).length, 2)
    const filtered = render('/events?category=concerts&city=cairo&price=paid', lang, theme)
    assert.equal((filtered.match(/class="home-event-card"/g) ?? []).length, 2)
    assert.match(filtered, /class="listing-active-filters"/)
    assert.match(filtered, /id="listing-city"/)
  }
})

test('account routes gate real profile access and offer an explicit sample preview', () => {
  for (const path of ['/profile', '/profile/settings']) {
    const html = render(path)
    assert.match(html, /Your space at Hafletna/)
    assert.match(html, /Try sample profile/)
    assert.ok(html.includes(`href="${path}?preview=1"`))
    assert.doesNotMatch(html, /id="profile-name"|id="account-new-password"/)
    assert.ok(html.includes(`/login?returnTo=${encodeURIComponent(path)}`))
  }
  assert.match(render('/profile', 'en', 'dark', [], { status: 'unavailable', user: null }), /We could not check your account/)
  assert.match(render('/profile', 'en', 'light', [], { status: 'loading', user: null }), /Checking your session/)
})

test('sample profile screens render both languages and themes without requiring a real account', () => {
  for (const lang of ['en', 'ar']) for (const theme of ['light', 'dark']) {
    const html = render('/profile?preview=1', lang, theme)
    assert.match(html, new RegExp(`dir="${lang === 'ar' ? 'rtl' : 'ltr'}"`))
    assert.match(html, new RegExp(`data-theme="${theme}"`))
    assert.match(html, /id="profile-name"/)
    assert.match(html, /value="Youssef Hassan"/)
    assert.match(html, /id="profile-phone"/)
    assert.match(html, /href="\/profile\/settings\?preview=1"/)
    assert.doesNotMatch(html, /class="account-fields" disabled/)
    assert.ok(html.includes(lang === 'ar' ? 'ملف شخصي تجريبي' : 'Sample profile'))
    const settings = render('/profile/settings?preview=1', lang, theme)
    for (const section of ['account-security', 'account-password', 'account-email', 'account-communications', 'account-deletion']) assert.ok(settings.includes(`id="${section}"`))
    assert.equal((settings.match(/class="account-card account-settings-card/g) ?? []).length, 3)
    assert.match(settings, /id="account-change-password"[^>]*aria-haspopup="dialog"/)
    assert.match(settings, /id="account-change-email"[^>]*aria-haspopup="dialog"/)
    assert.doesNotMatch(settings, /<dialog|id="account-confirm-password"|id="account-new-email"/)
    assert.equal((settings.match(/role="switch"/g) ?? []).length, 2)
    assert.doesNotMatch(settings, /HafletnaDemo1/)
    assert.ok(settings.includes(lang === 'ar' ? 'حفظ التفضيلات' : 'Save preferences'))
    assert.ok(settings.includes(lang === 'ar' ? 'الدخول والأمان' : 'Sign-in &amp; security'))
    assert.ok(settings.includes(lang === 'ar' ? 'طلب حذف الحساب' : 'Request account deletion'))
  }
})

test('real account details are read-only until profile endpoints exist, and sample mode stays separate', () => {
  const session = { status: 'authenticated', user: { id: 'real-user', fullName: 'Real Member', email: 'real@example.com', role: 'customer', phone: '', emailVerified: null } }
  const html = render('/profile', 'en', 'light', [], session)
  assert.match(html, /value="Real Member"/)
  assert.match(html, /Verification status unavailable/)
  assert.match(html, /class="account-fields" disabled=""/)
  assert.match(html, /Account changes are not enabled yet/)
  const settings = render('/profile/settings', 'en', 'dark', [], session)
  assert.match(settings, /id="account-change-password"[^>]*disabled=""/)
  assert.match(settings, /id="account-change-email"[^>]*disabled=""/)
  assert.doesNotMatch(settings, /HafletnaDemo1/)
  assert.match(settings, /Your saved communication preferences are not available yet/)
  assert.doesNotMatch(settings, /role="switch"/)
  const sample = render('/profile?preview=1', 'en', 'light', [], session)
  assert.match(sample, /value="Youssef Hassan"/)
  assert.doesNotMatch(sample, /value="Real Member"/)
})

test('password and email dialogs render accessible, localised forms in both themes', () => {
  for (const lang of ['en', 'ar']) for (const theme of ['light', 'dark']) {
    for (const kind of ['password', 'email']) {
      const html = render(`/profile/${kind}-dialog?preview=1`, lang, theme)
      assert.match(html, new RegExp(`data-theme="${theme}"`))
      assert.match(html, new RegExp(`dir="${lang === 'ar' ? 'rtl' : 'ltr'}"`))
      assert.match(html, new RegExp(`<dialog[^>]*id="account-${kind}-dialog"[^>]*aria-modal="true"[^>]*aria-labelledby="account-${kind}-dialog-title"[^>]*aria-describedby="account-${kind}-dialog-lead"`))
      assert.ok(html.includes(lang === 'ar' ? 'إغلاق النافذة' : 'Close dialog'))
      assert.ok(html.includes(lang === 'ar' ? 'إلغاء' : 'Cancel'))
      assert.match(html, /HafletnaDemo1/)
      assert.doesNotMatch(html, /class="account-fields" disabled=""/)
      if (kind === 'password') {
        for (const id of ['account-current-password', 'account-new-password', 'account-confirm-password', 'account-password-rules']) assert.ok(html.includes(`id="${id}"`))
        assert.match(html, /aria-describedby="account-password-rules"/)
      } else {
        for (const id of ['account-new-email', 'account-email-password']) assert.ok(html.includes(`id="${id}"`))
        assert.match(html, /youssef@example.com/)
        assert.doesNotMatch(html, /id="account-email-code"/)
        assert.ok(html.includes(lang === 'ar' ? 'يبقى بريدك الحالي كما هو حتى التحقق من العنوان الجديد.' : 'Your current email stays unchanged until the new address is verified.'))
      }
    }
  }
})

test('signed-in header replaces sign-in links with account access without changing the public navigation', () => {
  const session = { status: 'authenticated', user: { id: '1', fullName: 'Youssef', email: 'member@example.com', role: 'customer', phone: '', emailVerified: true } }
  const html = render('/', 'en', 'light', [], session)
  assert.match(html, /class="home-account-trigger"/)
  assert.match(html, /aria-label="Open account menu: Youssef"/)
  assert.match(html, /class="home-mobile-account"/)
  assert.doesNotMatch(html, /href="\/login"|href="\/register"/)
  assert.match(html, /href="\/events"/)
})

test('all existing authentication routes still render their inputs and Google callback states', () => {
  const checks = [['/login', 'login-email'], ['/register', 'register-name'], ['/verify-email', 'verify-code'], ['/forgot-password', 'forgot-email'], ['/reset-password', 'reset-code']]
  for (const lang of ['en', 'ar']) for (const [path, id] of checks) {
    const html = render(path, lang, 'dark')
    assert.ok(html.includes(`id="${id}"`), `${path}: ${id}`)
    assert.match(html, /data-theme="dark"/)
  }
  assert.match(render('/auth/callback'), /Hafletna/)
})

test('listing empty states and reversed date ranges render recovery actions', () => {
  const empty = render('/events?q=unmatched-query')
  assert.match(empty, /No sample events match all your filters/)
  assert.match(empty, /Clear all filters/)
  assert.equal((empty.match(/class="home-event-card"/g) ?? []).length, 0)
  const invalid = render('/events?from=2026-11-20&to=2026-11-01')
  assert.match(invalid, /role="alert"/)
  assert.match(invalid, /end date must be on or after/)
})

test('all detail sections and gallery controls render in English and Arabic', () => {
  for (const lang of ['en', 'ar']) for (const theme of ['light', 'dark']) {
    const html = render('/events/cairo-after-dark', lang, theme)
    for (const id of ['event-about', 'event-venue', 'event-policies', 'event-faq', 'event-gallery-image', 'event-ticket-title']) assert.ok(html.includes(`id="${id}"`), id)
    const mapSrc = html.match(/<iframe[^>]*src="([^"]+)"/)?.[1]
    assert.ok(mapSrc, 'venue map is rendered')
    const map = new URL(mapSrc.replaceAll('&amp;', '&'))
    assert.equal(map.hostname, 'www.google.com')
    assert.equal(map.searchParams.get('q'), '30.0444,31.2357')
    assert.equal(map.searchParams.get('hl'), lang)
    assert.ok(html.includes(lang === 'ar' ? 'فتح في خرائط Google' : 'Open in Google Maps'))
    assert.equal((html.match(/class="detail-faq"/g) ?? []).length, 4)
    assert.match(html, /aria-pressed="true"/)
    assert.match(html, /href="\/events\?category=concerts"/)
    assert.ok(html.includes(lang === 'ar' ? 'فتح الأبواب' : 'Doors open'))
    assert.ok(html.includes(lang === 'ar' ? 'السعة' : 'Capacity'))
    assert.match(html, /href="\/events\/cairo-after-dark\/tickets"/)
    assert.ok(html.includes(lang === 'ar' ? 'اختيار التذاكر' : 'Choose tickets'))
  }
})

test('unknown event and page URLs have recovery links', () => {
  const missing = render('/events/not-an-event')
  assert.match(missing, /This event could not be found/)
  assert.match(missing, /href="\/events"/)
  assert.match(render('/not-a-page'), /This page could not be found/)
})

test('detail back links preserve the original listing filters and page', () => {
  const html = render({ pathname: '/events/cairo-after-dark', state: { from: '/events?city=cairo&page=2' } })
  assert.match(html, /href="\/events\?city=cairo&amp;page=2"/)
  const invalid = render({ pathname: '/events/cairo-after-dark', state: { from: 'https://example.com' } })
  assert.doesNotMatch(invalid, /href="https:\/\/example\.com"/)
})

test('homepage retains one filter bar and links into full event screens', () => {
  for (const lang of ['en', 'ar']) for (const theme of ['light', 'dark']) {
    const html = render('/', lang, theme)
    assert.equal((html.match(/class="home-search"/g) ?? []).length, 1)
    assert.match(html, /id="event-category"/)
    assert.doesNotMatch(html, /home-category-filters|home-recommendation-strip|id="recommendations"/)
    assert.match(html, /id="event-tab-for-you"/)
    assert.match(html, /id="venues"/)
    assert.equal((html.match(/class="home-venue-card"/g) ?? []).length, 3)
    assert.match(html, /href="\/events\/cairo-after-dark"/)
    assert.match(html, /href="\/events"/)
    assert.match(html, /href="\/login"/)
    assert.match(html, /href="\/register"/)
  }
})

test('cards and details expose translated saved controls and sample status labels', () => {
  for (const lang of ['en', 'ar']) for (const theme of ['light', 'dark']) {
    const listing = render('/events', lang, theme, ['cairo-after-dark'])
    assert.equal((listing.match(/class="event-save-button"/g) ?? []).length, 6)
    assert.ok(listing.includes(lang === 'ar' ? 'إزالة الفعالية من المحفوظات: القاهرة بعد الغروب' : 'Remove saved event: Cairo After Dark'))
    assert.ok(listing.includes(lang === 'ar' ? 'حالة تجريبية: نفدت التذاكر' : 'Sample status: Sold out'))
    assert.ok(listing.includes(lang === 'ar' ? 'حالة تجريبية: ملغاة' : 'Sample status: Cancelled'))
    const detail = render('/events/cairo-after-dark', lang, theme, ['cairo-after-dark'])
    assert.match(detail, /class="event-save-button event-save-button--labelled"[^>]*aria-pressed="true"/)
    assert.ok(detail.includes(lang === 'ar' ? 'حالة تجريبية: متاح' : 'Sample status: Available'))
  }
})

test('Saved listing has recovery guidance and retains cancelled or sold-out bookmarks', () => {
  const empty = render('/events?saved=1')
  assert.match(empty, /No saved events yet/)
  assert.match(empty, /Press the bookmark button/)
  const saved = render('/events?saved=1', 'en', 'light', ['creative-canvas', 'nile-nights'])
  assert.equal((saved.match(/class="home-event-card"/g) ?? []).length, 2)
  assert.match(saved, /The Creative Canvas/)
  assert.match(saved, /Nile Nights/)
  assert.match(saved, /Your saved events are kept in this browser/)
  assert.match(render('/events?saved=1&city=alexandria', 'en', 'dark', ['cairo-after-dark']), /No saved events match these filters/)
})

test('sold-out and cancelled detail pages explain their status beside the disabled booking action', () => {
  const soldOut = render('/events/creative-canvas')
  assert.match(soldOut, /This sample event is sold out/)
  assert.match(soldOut, /disabled="">Sold out<\/button>/)
  const cancelled = render('/events/nile-nights')
  assert.match(cancelled, /This sample event is cancelled/)
  assert.match(cancelled, /disabled="">Event cancelled<\/button>/)
})

function activeBooking(names = true) {
  const now = Date.now()
  const items = [{ key: 'middle-1', categoryId: 'middle' }, { key: 'front-1', categoryId: 'front' }]
  const state = transitionBooking(emptyBooking(), { type: 'select', eventId: 'cairo-after-dark', items }, now).state
  return { state, now, names: names ? { 'middle-1': 'Youssef Hassan', 'front-1': 'يوسف حسن' } : {} }
}

test('seated and standing selection render in both languages and themes with disabled unavailable inventory', () => {
  for (const lang of ['en', 'ar']) for (const theme of ['light', 'dark']) {
    const seated = render('/events/next-perspectives/tickets', lang, theme)
    assert.match(seated, new RegExp(`dir="${lang === 'ar' ? 'rtl' : 'ltr'}"`))
    assert.match(seated, new RegExp(`data-theme="${theme}"`))
    assert.equal((seated.match(/data-seat-index=/g) ?? []).length, 240)
    assert.equal((seated.match(/tabindex="0"/g) ?? []).length, 1)
    assert.match(seated, /booking-seat is-sold/)
    assert.match(seated, /booking-seat is-held/)
    assert.match(seated, /id="booking-seat-inspector"/)
    assert.ok(seated.includes(lang === 'ar' ? 'لا تُحجز مقاعد فعلية' : 'No real seats are held'))
    assert.ok(seated.includes(lang === 'ar' ? 'تكبير' : 'Zoom in'))
    const standing = render('/events/cairo-after-dark/tickets', lang, theme)
    assert.equal((standing.match(/class="booking-map-zone /g) ?? []).length, 3)
    assert.equal((standing.match(/class="booking-stepper"/g) ?? []).length, 3)
    assert.match(standing, /booking-map-zone tone-amber is-full/)
    assert.doesNotMatch(standing, /data-seat-index=/)
  }
})

test('cart renders attendee inputs, separate fees, remove controls and an accessible shared cart count', () => {
  for (const lang of ['en', 'ar']) for (const theme of ['light', 'dark']) {
    const booking = activeBooking()
    const html = render('/cart', lang, theme, [], undefined, booking)
    assert.equal((html.match(/class="booking-cart-ticket tone-/g) ?? []).length, 2)
    assert.match(html, /id="attendee-0"[^>]*value="Youssef Hassan"/)
    assert.match(html, /id="attendee-1"[^>]*value="يوسف حسن"/)
    assert.equal((html.match(/class="booking-icon-button"/g) ?? []).length, 2)
    assert.match(html, /role="timer" aria-live="off"/)
    assert.match(html, /class="home-booking-cart has-items"/)
    assert.ok(html.includes(lang === 'ar' ? 'رسوم الخدمة' : 'Service fees'))
    assert.ok(html.includes(lang === 'ar' ? 'تجربة إتمام الحجز' : 'Try sample checkout'))
  }
})

test('checkout requires names after refresh and exposes only sample payment outcomes and policy review', () => {
  for (const lang of ['en', 'ar']) for (const theme of ['light', 'dark']) {
    const missing = render('/checkout', lang, theme, [], undefined, activeBooking(false))
    assert.ok(missing.includes(lang === 'ar' ? 'لكل تذكرة اسم.' : 'Every ticket needs a name.'))
    assert.match(missing, /href="\/cart"/)
    assert.doesNotMatch(missing, /name="sample-payment-outcome"/)
    const html = render('/checkout?preview=1', lang, theme, [], undefined, activeBooking())
    assert.equal((html.match(/name="sample-payment-outcome"/g) ?? []).length, 3)
    assert.match(html, /id="booking-read-policies"[^>]*aria-haspopup="dialog"/)
    assert.match(html, /id="booking-policy-accept"[^>]*disabled=""/)
    assert.doesNotMatch(html, /type="password"|name="card|name="cvv|type="email"/)
    assert.ok(html.includes(lang === 'ar' ? 'لا تدخل بيانات بطاقة' : 'Do not enter card details'))
    assert.ok(html.includes(lang === 'ar' ? 'إتمام الحجز التجريبي' : 'Complete sample checkout'))
  }
})

test('booking handles empty, expired, replacement, sold-out, cancelled and invalid-event routes', () => {
  assert.match(render('/cart'), /Your next experience is still out there/)
  assert.match(render('/checkout'), /Your next experience is still out there/)
  const expired = activeBooking()
  expired.state = { ...expired.state, items: [], expiresAt: null, expired: true }
  assert.match(render('/cart', 'en', 'light', [], undefined, expired), /reservation couldn’t/)
  assert.match(render('/events/next-perspectives/tickets', 'en', 'dark', [], undefined, activeBooking()), /A different night/)
  for (const id of ['creative-canvas', 'nile-nights']) {
    const html = render(`/events/${id}/tickets`)
    assert.match(html, /This event is unavailable for booking/)
    assert.doesNotMatch(html, /data-seat-index=|class="booking-stepper"/)
  }
  assert.match(render('/events/no-such-event/tickets'), /This event could not be found/)
})

test('policy dialog contains the same event policies in both languages and themes', () => {
  for (const lang of ['en', 'ar']) for (const theme of ['light', 'dark']) {
    const html = render('/policy-dialog', lang, theme)
    assert.match(html, /<dialog[^>]*aria-modal="true"[^>]*aria-labelledby="booking-policy-title"/)
    assert.ok(html.includes(lang === 'ar' ? 'الدخول والعمر' : 'Admission &amp; age'))
    assert.ok(html.includes(lang === 'ar' ? 'الدخول والسلامة' : 'Entry &amp; safety'))
    assert.ok(html.includes(lang === 'ar' ? 'الإلغاء واسترداد المبلغ' : 'Cancellation &amp; refunds'))
    assert.ok(html.includes(lang === 'ar' ? 'إمكانية الوصول' : 'Accessibility'))
    assert.ok(html.includes(lang === 'ar' ? 'الموافقة على السياسات' : 'Accept policies'))
  }
})

test('completed sample checkout renders a reference and cannot expose another payment submission', () => {
  const booking = activeBooking()
  booking.state = transitionBooking(booking.state, { type: 'complete', reference: 'DEMO-1234ABCD' }, booking.now + 1000).state
  const html = render('/checkout', 'en', 'dark', [], undefined, booking)
  assert.match(html, /DEMO-1234ABCD/)
  assert.match(html, /No money was collected and no real ticket was created/)
  assert.doesNotMatch(html, /name="sample-payment-outcome"/)
})
