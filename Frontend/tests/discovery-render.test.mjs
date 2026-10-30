import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { createServer } from 'vite'
import { events as sampleEvents } from '../src/Components/Homepage/data/events.ts'
import { emptyBooking, transitionBooking } from '../src/Components/Booking/bookingModel.ts'
import { createSampleWallet, requestSampleRefund, transferSampleTicket } from '../src/Components/Tickets/ticketsModel.ts'
import { mapEventDetail } from '../src/lib/eventsModel.ts'
import { parsePublicVenues } from '../src/lib/homepageApi.ts'
import { homeStrings } from '../src/Components/Homepage/strings.ts'
import { detail as apiDetail, eventId as apiEventId } from './fixtures/events-api.mjs'

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
let TicketsContext
let Confirmation
let MyTickets
let WalletContents
let TicketDetail
let TransferTicket
let RefundRequest
let PaymentMethods
let EventsClientContext
let DetailContent
let HeroSection, EventHub, VenueDiscovery

before(async () => {
  server = await createServer({ cacheDir: 'node_modules/.vite-tests/discovery-render', server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom' })
  Layout = (await server.ssrLoadModule('/src/Components/Discovery/DiscoveryLayout.tsx')).default
  Listing = (await server.ssrLoadModule('/src/Components/Discovery/EventsListing.tsx')).default
  Detail = (await server.ssrLoadModule('/src/Components/Discovery/EventDetail.tsx')).default
  DetailContent = (await server.ssrLoadModule('/src/Components/Discovery/EventDetail.tsx')).EventDetailContent
  Homepage = (await server.ssrLoadModule('/src/Components/Homepage/Homepage.tsx')).default
  HeroSection = (await server.ssrLoadModule('/src/Components/Homepage/components/HeroSection.tsx')).default
  EventHub = (await server.ssrLoadModule('/src/Components/Homepage/components/EventHub.tsx')).default
  VenueDiscovery = (await server.ssrLoadModule('/src/Components/Homepage/components/VenueDiscovery.tsx')).default
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
  TicketsContext = (await server.ssrLoadModule('/src/Components/Tickets/ticketsContext.ts')).TicketsContext
  Confirmation = (await server.ssrLoadModule('/src/Components/Tickets/Confirmation.tsx')).default
  MyTickets = (await server.ssrLoadModule('/src/Components/Tickets/MyTickets.tsx')).default
  WalletContents = (await server.ssrLoadModule('/src/Components/Tickets/MyTickets.tsx')).WalletContents
  TicketDetail = (await server.ssrLoadModule('/src/Components/Tickets/TicketDetail.tsx')).default
  TransferTicket = (await server.ssrLoadModule('/src/Components/Tickets/TransferTicket.tsx')).default
  RefundRequest = (await server.ssrLoadModule('/src/Components/Tickets/RefundRequest.tsx')).default
  PaymentMethods = (await server.ssrLoadModule('/src/Components/Booking/PaymentMethods.tsx')).default
  EventsClientContext = (await server.ssrLoadModule('/src/lib/useEventsApi.ts')).EventsClientContext
  authPages = await Promise.all(['LoginPage/Login', 'RegisterPage/Register', 'VerifyEmailPage/VerifyEmail', 'ForgotPasswordPage/ForgotPassword', 'ResetPasswordPage/ResetPassword', 'AuthCallbackPage/AuthCallback'].map(async (path) => (await server.ssrLoadModule(`/src/Components/${path}.tsx`)).default))
})
after(async () => { await server?.close() })

function render(path, lang = 'en', theme = 'light', savedIds = [], sessionState = { status: 'guest', user: null }, booking = {}, wallet = {}) {
  const value = { lang, theme, setLang() {}, setTheme() {} }
  let savedValue = JSON.stringify(savedIds)
  const storage = { getItem: () => savedValue, setItem: (_key, value) => { savedValue = value } }
  const session = { ...sessionState, acceptUser() {}, updateUser() {}, async refresh() {}, async signOut() {} }
  const bookingValue = { state: booking.state ?? emptyBooking(), now: booking.now ?? Date.now(), names: booking.names ?? {}, storageAvailable: true, restoration: booking.restoration ?? 'ready', retryRestore() {}, act() {}, setAttendee() {} }
  const ticketsValue = { state: wallet.state ?? createSampleWallet(), now: wallet.now ?? Date.parse('2026-10-20T12:00:00Z'), storageAvailable: wallet.storageAvailable ?? true, completeOrder() {}, transferTicket() {}, requestRefund() {}, resendTicket() {}, resetSamples() {} }
  return renderToStaticMarkup(h(EventsClientContext.Provider, { value: null }, h(PreferencesContext.Provider, { value },
    h(SessionContext.Provider, { value: session }, h(SavedEventsProvider, { storage }, h(BookingContext.Provider, { value: bookingValue }, h(TicketsContext.Provider, { value: ticketsValue }, h(MemoryRouter, { initialEntries: [path] }, h(Routes, null,
      h(Route, { path: '/', element: h(Homepage) }),
      h(Route, { element: h(Layout) },
        h(Route, { path: '/events', element: h(Listing) }),
        h(Route, { path: '/events/:eventId', element: h(Detail) }),
        h(Route, { path: '/events/:eventId/tickets', element: h(TicketSelection) }),
        h(Route, { path: '/cart', element: h(Cart) }),
        h(Route, { path: '/checkout', element: h(Checkout) }),
        h(Route, { path: '/orders/:orderRef/confirmation', element: h(Confirmation) }),
        h(Route, { path: '/my-tickets', element: h(MyTickets) }),
        h(Route, { path: '/wallet-content', element: h(WalletContents, { tickets: wallet.liveTickets ?? [] }) }),
        h(Route, { path: '/my-tickets/:ticketId', element: h(TicketDetail) }),
        h(Route, { path: '/my-tickets/:ticketId/transfer', element: h(TransferTicket) }),
        h(Route, { path: '/my-tickets/:ticketId/refund', element: h(RefundRequest) }),
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
    )))))),
  )))
}

test('API catalogue pages initially load without flashing sample events in both languages and themes', () => {
  for (const lang of ['en', 'ar']) for (const theme of ['light', 'dark']) {
    for (const [path, Component] of [['/events', Listing], [`/events/${apiEventId}`, Detail]]) {
      const html = renderToStaticMarkup(h(PreferencesContext.Provider, { value: { lang, theme, setLang() {}, setTheme() {} } },
        h(SavedEventsProvider, { storage: { getItem() { return null }, setItem() {} } }, h('div', { className: 'home-root', 'data-theme': theme, lang, dir: lang === 'ar' ? 'rtl' : 'ltr' }, h(MemoryRouter, { initialEntries: [path] }, h(Routes, null, h(Route, { path: path === '/events' ? '/events' : '/events/:eventId', element: h(Component) })))))))
      assert.match(html, /catalog-(loading|detail-loading)/)
      assert.doesNotMatch(html, /Cairo After Dark|The Coastal Weekender/)
      assert.ok(html.includes(`data-theme="${theme}"`))
    }
  }
})

test('API details render actual inventory, unknown prices, and missing information without invented policies', () => {
  for (const lang of ['en', 'ar']) for (const theme of ['light', 'dark']) {
    const mapped = mapEventDetail(apiDetail({ ticketCategories: [] }))
    const html = renderToStaticMarkup(h(PreferencesContext.Provider, { value: { lang, theme, setLang() {}, setTheme() {} } },
      h(SavedEventsProvider, { storage: { getItem() { return null }, setItem() {} } }, h(MemoryRouter, null, h(DetailContent, mapped)))))
    assert.ok(html.includes(lang === 'en' ? 'Price unavailable' : 'السعر غير متاح'))
    assert.ok(html.includes(lang === 'en' ? 'has not published event policies' : 'لم ينشر المنظّم سياسات'))
    assert.ok(html.includes(lang === 'en' ? 'Payments are currently simulated' : 'الدفع حاليًا بالمحاكاة'))
    assert.ok(html.includes('Cairo Jazz Band'))
    assert.doesNotMatch(html, /Hafletna Experiences|seven days|30 minutes|sample organiser/)
    assert.doesNotMatch(html, /href="\/events\/[^"]+\/tickets"/)
    assert.match(html, /google.com\/maps\?q=30.0424%2C31.2244/)
    assert.match(html, /16:00|١٦:٠٠|18:00|١٨:٠٠|19:00|١٩:٠٠/)
  }
})

test('sample after-buying routes render English and Arabic in both themes', () => {
  const routes = [
    ['/orders/DEMO-A1B2C3D4/confirmation', 'tickets-confirm-hero'],
    ['/my-tickets/DEMO-A1B2C3D4-1', 'tickets-pass'],
    ['/my-tickets/DEMO-A1B2C3D4-1/transfer', 'transfer-recipient-email'],
    ['/my-tickets/DEMO-A1B2C3D4-1/refund', 'refund-quote-title'],
  ]
  for (const lang of ['en', 'ar']) for (const theme of ['light', 'dark']) for (const [path, marker] of routes) {
    const html = render(path, lang, theme)
    assert.ok(html.includes(marker), path)
    assert.ok(html.includes(`lang="${lang}"`))
    assert.ok(html.includes(`data-theme="${theme}"`))
    assert.ok(html.includes(`dir="${lang === 'ar' ? 'rtl' : 'ltr'}"`))
    assert.ok(html.includes(lang === 'ar' ? 'محفظة تذاكر تجريبية' : 'Sample ticket wallet'))
    assert.doesNotMatch(html, /undefined|NaN/)
  }
})

test('wallet content groups only the supplied account tickets into upcoming and past', () => {
  const wallet = { liveTickets: createSampleWallet().tickets }
  const upcoming = render('/wallet-content', 'en', 'dark', [], undefined, {}, wallet)
  assert.match(upcoming, /href="\/my-tickets\/DEMO-A1B2C3D4-1"/)
  assert.doesNotMatch(upcoming, /href="\/my-tickets\/DEMO-C1D2E3F4-1"/)
  assert.match(upcoming, /id="tickets-tab-upcoming"[^>]*aria-selected="true"/)
  const past = render('/wallet-content?view=past', 'en', 'dark', [], undefined, {}, wallet)
  assert.match(past, /href="\/my-tickets\/DEMO-C1D2E3F4-1"/)
  assert.doesNotMatch(past, /href="\/my-tickets\/DEMO-A1B2C3D4-1"/)
  assert.match(past, /id="tickets-tab-past"[^>]*aria-selected="true"/)
})

test('guest, loading and unavailable sessions never show sample tickets from browser storage', () => {
  for (const status of ['guest', 'loading', 'unavailable']) for (const lang of ['en', 'ar']) for (const theme of ['light', 'dark']) {
    const html = render('/my-tickets?view=past', lang, theme, [], { status, user: null })
    assert.match(html, /id="wallet-access-title"/)
    assert.doesNotMatch(html, /DEMO-|Sample ticket wallet|محفظة تذاكر تجريبية|wallet-stats|tickets-wallet-card|Load sample|تحميل تذاكر تجريبية|Cairo After Dark/)
    if (status !== 'loading') assert.match(html, /href="\/login\?returnTo=%2Fmy-tickets"/)
    else assert.doesNotMatch(html, /href="\/login\?returnTo=/)
    assert.ok(html.includes(lang === 'ar' ? 'تذاكري' : 'My Tickets'))
  }
})

test('authenticated wallet waits for its API response without flashing samples or an empty account', () => {
  const session = { status: 'authenticated', user: { id: 'real-user', fullName: 'Real Member', email: 'real@example.com', role: 'customer' } }
  for (const lang of ['en', 'ar']) for (const theme of ['light', 'dark']) {
    const html = render('/my-tickets', lang, theme, [], session)
    assert.ok(html.includes(lang === 'ar' ? 'جارٍ تحميل تذاكرك' : 'Loading your tickets'))
    assert.doesNotMatch(html, /DEMO-|tickets-wallet-card|Sample ticket wallet|No upcoming sample|example wallet/)
  }
})

test('an account without tickets shows a real empty state without any load-samples action', () => {
  for (const lang of ['en', 'ar']) for (const theme of ['light', 'dark']) {
    const html = render('/wallet-content', lang, theme, [], undefined, {}, { liveTickets: [] })
    assert.ok(html.includes(lang === 'ar' ? 'ليس لديك تذاكر قادمة' : 'You have no upcoming tickets'))
    assert.doesNotMatch(html, /DEMO-|tickets-wallet-card|Sample ticket wallet|example wallet|Load sample/)
  }
})

test('confirmation is scoped to the requested order and recovers unknown references', () => {
  const html = render('/orders/DEMO-A1B2C3D4/confirmation')
  assert.match(html, /DEMO-A1B2C3D4-1/)
  assert.doesNotMatch(html, /DEMO-E5F6A7B8-1|DEMO-C1D2E3F4-1/)
  assert.match(render('/orders/unknown/confirmation'), /This sample order is not available/)
  for (const suffix of ['', '/transfer', '/refund']) assert.match(render(`/my-tickets/unknown${suffix}`), /tickets-empty/)
})

test('ticket QR and actions follow sample status while pending refunds retain the QR', () => {
  const now = Date.parse('2026-10-20T12:00:00Z')
  const original = createSampleWallet()
  const id = original.tickets[0].id
  const html = render(`/my-tickets/${id}`)
  assert.match(html, /class="tickets-qr-svg"/)
  assert.match(html, /not valid for admission/)
  assert.match(html, new RegExp(`href="/my-tickets/${id}/transfer"`))
  assert.match(html, /google\.com\/maps/)
  const pending = requestSampleRefund(original, id, true, now).state
  const requested = render(`/my-tickets/${id}/refund`, 'en', 'dark', [], undefined, {}, { state: pending, now })
  assert.match(requested, /Pending review/)
  assert.doesNotMatch(requested, /id="refund-confirmation"/)
  assert.match(render(`/my-tickets/${id}`, 'en', 'dark', [], undefined, {}, { state: pending, now }), /class="tickets-qr-svg"/)
  const transferred = transferSampleTicket(original, id, 'nour@example.com', true, now).state
  const sent = render(`/my-tickets/${id}`, 'en', 'dark', [], undefined, {}, { state: transferred, now })
  assert.doesNotMatch(sent, /class="tickets-qr-svg"/)
  assert.match(sent, /Transferred/)
  assert.match(render('/my-tickets/DEMO-C1D2E3F4-1'), /tickets-qr-placeholder/)
})

test('refund quote exposes the exact deduction before asking for confirmation', () => {
  const html = render('/my-tickets/DEMO-A1B2C3D4-1/refund')
  assert.match(html, /Original payment/)
  assert.match(html, /Non-refundable service fee/)
  assert.match(html, /Exact refundable amount/)
  assert.match(html, /EGP\s*378\.00/)
  assert.match(html, /EGP\s*28\.00/)
  assert.match(html, /EGP\s*350\.00/)
  assert.doesNotMatch(html, /id="refund-confirmation"/)
  assert.match(html, /after administrator approval/)
})

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

test('account routes require sign-in without offering a sample profile', () => {
  for (const path of ['/profile', '/profile/settings']) for (const query of ['', '?preview=1']) {
    const html = render(`${path}${query}`)
    assert.match(html, /Sign in to your account/)
    assert.doesNotMatch(html, /Try sample profile|preview=1|Youssef Hassan/)
    assert.doesNotMatch(html, /id="profile-name"|id="account-new-password"/)
    assert.ok(html.includes(`/login?returnTo=${encodeURIComponent(path)}`))
  }
  assert.match(render('/profile', 'en', 'dark', [], { status: 'unavailable', user: null }), /We could not check your account/)
  assert.match(render('/profile', 'en', 'light', [], { status: 'loading', user: null }), /Checking your session/)
})

test('signed-in profile screens render both languages and themes without sample access', () => {
  const session = { status: 'authenticated', user: { id: 'real-user', fullName: 'Real Member', email: 'real@example.com', role: 'customer', phone: '', emailVerified: null, marketingOptIn: false, deletionRequestedAt: null } }
  for (const lang of ['en', 'ar']) for (const theme of ['light', 'dark']) {
    const html = render('/profile?preview=1', lang, theme, [], session)
    assert.match(html, new RegExp(`dir="${lang === 'ar' ? 'rtl' : 'ltr'}"`))
    assert.match(html, new RegExp(`data-theme="${theme}"`))
    assert.match(html, /id="profile-name"/)
    assert.match(html, /value="Real Member"/)
    assert.match(html, /id="profile-phone"/)
    assert.match(html, /href="\/profile\/settings"/)
    assert.doesNotMatch(html, /class="account-fields" disabled/)
    assert.doesNotMatch(html, /[Ss]ample profile|ملف شخصي تجريبي|تجربة الملف الشخصي|preview=1|Youssef Hassan/)
    const settings = render('/profile/settings?preview=1', lang, theme, [], session)
    for (const section of ['account-security', 'account-password', 'account-email', 'account-communications', 'account-deletion']) assert.ok(settings.includes(`id="${section}"`))
    assert.equal((settings.match(/class="account-card account-settings-card/g) ?? []).length, 3)
    assert.match(settings, /id="account-change-password"[^>]*aria-haspopup="dialog"/)
    assert.match(settings, /id="account-change-email"[^>]*aria-haspopup="dialog"/)
    assert.doesNotMatch(settings, /<dialog|id="account-confirm-password"|id="account-new-email"/)
    assert.equal((settings.match(/role="switch"/g) ?? []).length, 1)
    assert.doesNotMatch(settings, /id="account-request-deletion"[^>]*disabled/)
    assert.doesNotMatch(settings, /HafletnaDemo1|[Ss]ample profile|الملف التجريبي|preview=1/)
    assert.ok(settings.includes(lang === 'ar' ? 'الدخول والأمان' : 'Sign-in &amp; security'))
    assert.ok(settings.includes(lang === 'ar' ? 'طلب حذف الحساب' : 'Request account deletion'))
  }
})

test('real account details and security are editable without allowing legacy sample profiles', () => {
  const session = { status: 'authenticated', user: { id: 'real-user', fullName: 'Real Member', email: 'real@example.com', role: 'customer', phone: '', emailVerified: null } }
  const html = render('/profile', 'en', 'light', [], session)
  assert.match(html, /value="Real Member"/)
  assert.match(html, /Verification status unavailable/)
  assert.doesNotMatch(html, /class="account-fields" disabled=""/)
  assert.match(html, /Changes are saved to your account/)
  const settings = render('/profile/settings', 'en', 'dark', [], session)
  assert.doesNotMatch(settings, /id="account-change-password"[^>]*disabled=""/)
  assert.doesNotMatch(settings, /id="account-change-email"[^>]*disabled=""/)
  assert.match(settings, /id="account-request-deletion"[^>]*disabled=""/)
  assert.doesNotMatch(settings, /HafletnaDemo1/)
  assert.match(settings, /We could not load your saved account settings/)
  assert.match(settings, /Refresh account/)
  assert.doesNotMatch(settings, /role="switch"/)
  const legacy = render('/profile?preview=1', 'en', 'light', [], session)
  assert.match(legacy, /value="Real Member"/)
  assert.doesNotMatch(legacy, /value="Youssef Hassan"|Try sample profile|preview=1/)
})

test('the combined email preference reflects the backend value in both languages and themes', () => {
  for (const marketingOptIn of [true, false]) for (const lang of ['en', 'ar']) for (const theme of ['light', 'dark']) {
    const session = { status: 'authenticated', user: { id: 'qa', fullName: 'QA Member', email: 'member@example.test', role: 'customer', phone: '', emailVerified: true, marketingOptIn, deletionRequestedAt: null } }
    const html = render('/profile/settings', lang, theme, [], session)
    const toggle = html.match(/<input[^>]*id="preference-marketing"[^>]*>/)?.[0]
    assert.ok(toggle)
    assert.equal(toggle.includes('checked=""'), marketingOptIn)
    assert.equal((html.match(/role="switch"/g) ?? []).length, 1)
    assert.ok(html.includes(lang === 'ar' ? 'أخبار الفعاليات والعروض' : 'Event news and offers'))
    assert.doesNotMatch(html, /id="preference-offers"|id="preference-event-news"/)
  }
})

test('pending deletion survives account reload and exposes cancellation with localised dates', () => {
  const session = { status: 'authenticated', user: { id: 'qa', fullName: 'QA Member', email: 'member@example.test', role: 'customer', phone: '', emailVerified: true, marketingOptIn: true, deletionRequestedAt: '2026-10-24T12:00:00.000Z' } }
  for (const lang of ['en', 'ar']) for (const theme of ['light', 'dark']) {
    const html = render('/profile/settings', lang, theme, [], session)
    assert.match(html, /id="account-cancel-deletion"/)
    assert.doesNotMatch(html, /id="account-cancel-deletion"[^>]*disabled/)
    assert.doesNotMatch(html, /id="account-request-deletion"|id="account-delete-email"/)
    assert.match(html, /dateTime="2026-10-24T12:00:00.000Z"/)
    assert.match(html, /dateTime="2026-11-07T12:00:00.000Z"/)
    assert.match(html, /class="account-fields account-preferences-fields" disabled=""/)
    assert.match(html, /id="account-change-password"[^>]*disabled=""/)
    assert.ok(html.includes(lang === 'ar' ? 'إلغاء طلب الحذف' : 'Cancel deletion request'))
    assert.doesNotMatch(html, /[Ss]ample deletion|حذف تجريبي/)
  }
})

test('password and email dialogs render accessible, localised forms in both themes', () => {
  const session = { status: 'authenticated', user: { id: 'real-user', fullName: 'Real Member', email: 'real@example.com', role: 'customer', phone: '', emailVerified: null } }
  for (const lang of ['en', 'ar']) for (const theme of ['light', 'dark']) {
    for (const kind of ['password', 'email']) {
      const html = render(`/profile/${kind}-dialog`, lang, theme, [], session)
      assert.match(html, new RegExp(`data-theme="${theme}"`))
      assert.match(html, new RegExp(`dir="${lang === 'ar' ? 'rtl' : 'ltr'}"`))
      assert.match(html, new RegExp(`<dialog[^>]*id="account-${kind}-dialog"[^>]*aria-modal="true"[^>]*aria-labelledby="account-${kind}-dialog-title"[^>]*aria-describedby="account-${kind}-dialog-lead"`))
      assert.ok(html.includes(lang === 'ar' ? 'إغلاق النافذة' : 'Close dialog'))
      assert.ok(html.includes(lang === 'ar' ? 'إلغاء' : 'Cancel'))
      assert.doesNotMatch(html, /HafletnaDemo1/)
      assert.doesNotMatch(html, /class="account-fields" disabled=""/)
      if (kind === 'password') {
        for (const id of ['account-current-password', 'account-new-password', 'account-confirm-password', 'account-password-rules']) assert.ok(html.includes(`id="${id}"`))
        assert.match(html, /aria-describedby="account-password-rules"/)
      } else {
        assert.ok(html.includes('id="account-new-email"'))
        assert.doesNotMatch(html, /id="account-email-password"|[Ss]ample verification code/)
        assert.match(html, /real@example.com/)
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

test('homepage retains its controls and themes without rendering fictional content before the API loads', () => {
  for (const lang of ['en', 'ar']) for (const theme of ['light', 'dark']) {
    const html = render('/', lang, theme)
    assert.equal((html.match(/class="home-search"/g) ?? []).length, 1)
    assert.match(html, /id="event-category"/)
    assert.doesNotMatch(html, /home-category-filters|home-recommendation-strip|id="recommendations"/)
    assert.match(html, /id="event-tab-for-you"/)
    assert.match(html, /id="venues"/)
    assert.equal((html.match(/class="home-venue-card"/g) ?? []).length, 0)
    assert.doesNotMatch(html, /href="\/events\/cairo-after-dark"|The Garden Stage|Riverside Park/)
    assert.match(html, /href="\/events"/)
    assert.match(html, /href="\/login"/)
    assert.match(html, /href="\/register"/)
    assert.match(html, /class="board-discovery-layout home-container"/)
    assert.match(html, /class="board-feature"/)
    const footer = html.match(/<footer class="board-footer">[\s\S]*?<\/footer>/)?.[0]
    assert.ok(footer)
    assert.doesNotMatch(footer, /href="\/login"|href="\/register"|href="\/cart"|home-navigation|hf-controls|hf-segmented/)
    assert.ok(footer.includes(homeStrings[lang].help))
    assert.ok(footer.includes(homeStrings[lang].privacy))
  }
})

test('database homepage content keeps API order, bilingual venue fallbacks and valid detail links', () => {
  const event = mapEventDetail(apiDetail()).event
  const venues = parsePublicVenues([{ id: apiEventId, name: 'Database venue', nameAr: 'مكان من قاعدة البيانات', city: 'Cairo', type: 'SEATED' }])
  for (const lang of ['en', 'ar']) for (const theme of ['light', 'dark']) {
    const t = homeStrings[lang]
    const resource = { key: 'loaded', events: [event], total: 1, loading: false, failed: false, hasMore: false, loadingMore: false, moreFailed: false, loadMore() {}, retry() {} }
    const hubProps = { t, lang, draft: { query: '', city: '', category: '', date: '' }, setDraft() {}, resource, onSearch() {}, onClear() {}, active: false, view: 'trending', onViewChange() {}, preferences: { interests: [], city: '' }, onPreferencesChange() {}, onPersonalise() {} }
    const html = renderToStaticMarkup(h(PreferencesContext.Provider, { value: { lang, theme, setLang() {}, setTheme() {} } }, h(SavedEventsProvider, { storage: { getItem() { return null }, setItem() {} } }, h(MemoryRouter, null, h('div', { 'data-theme': theme, dir: lang === 'ar' ? 'rtl' : 'ltr' },
      h(HeroSection, { t, lang, event }), h(EventHub, hubProps), h(VenueDiscovery, { t, lang, resource: { status: 'success', data: venues, retry() {} } }),
    )))))
    assert.ok(html.includes(`/events/${apiEventId}`))
    assert.match(html, /Cairo Jazz Night/)
    assert.equal((html.match(/class="board-event-row"/g) ?? []).length, 1)
    assert.match(html, /Cairo Jazz Band/)
    assert.match(html, /class="board-event-date"/)
    assert.match(html, /class="board-event-actions"/)
    assert.ok(html.includes(lang === 'ar' ? 'مكان من قاعدة البيانات' : 'Database venue'))
    assert.ok(html.includes(t.illustrativePhoto))
    assert.match(html, /q=Database\+venue&amp;city=cairo/)
    assert.doesNotMatch(html, /Sample event status|Sample events for preview|حالة الفعالية التجريبية/)
  }
})

test('empty and failed homepage resources explain the state without sample substitutes', () => {
  for (const lang of ['en', 'ar']) for (const failed of [false, true]) {
    const t = homeStrings[lang]
    const html = renderToStaticMarkup(h(MemoryRouter, null, h('div', null,
      h(HeroSection, { t, lang, event: null, failed, onRetry() {} }),
      h(VenueDiscovery, { t, lang, resource: { status: failed ? 'error' : 'success', data: failed ? null : [], retry() {} } }),
    )))
    assert.ok(html.includes(failed ? t.eventsError : t.catalogueEmpty))
    assert.ok(html.includes(failed ? t.venuesError : t.venuesEmpty))
    assert.doesNotMatch(html, /home-venue-card|cairo-after-dark|href="\/events\/undefined"|Invalid Date/)
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

test('paid checkout offers sample payment methods, collapsed outcomes, and policy review in both languages and themes', () => {
  for (const lang of ['en', 'ar']) for (const theme of ['light', 'dark']) {
    const missing = render('/checkout', lang, theme, [], undefined, activeBooking(false))
    assert.ok(missing.includes(lang === 'ar' ? 'أسماء الحاضرين غير مكتملة' : 'Missing attendee names'))
    assert.match(missing, /href="\/cart"/)
    assert.doesNotMatch(missing, /name="sample-payment-outcome"/)
    const html = render('/checkout?preview=1', lang, theme, [], undefined, activeBooking())
    assert.equal((html.match(/name="sample-payment-method"/g) ?? []).length, 3)
    for (const method of ['card', 'wallet', 'bank-transfer']) assert.ok(html.includes(`value="${method}"`))
    assert.equal((html.match(/name="sample-payment-outcome"/g) ?? []).length, 3)
    assert.match(html, /<details class="booking-simulation-controls">/)
    assert.match(html, /id="booking-read-policies"[^>]*aria-haspopup="dialog"/)
    assert.match(html, /id="booking-policy-accept"[^>]*disabled=""/)
    assert.doesNotMatch(html, /type="password"|name="card|name="cvv|type="email"/)
    assert.ok(html.includes(lang === 'ar' ? 'لن تُحصّل أي أموال' : 'no payment is taken'))
    assert.ok(html.includes(lang === 'ar' ? 'إتمام الحجز التجريبي' : 'Complete sample checkout'))
  }
})

test('each method renders its selected sample fixture without accepting financial details', () => {
  for (const lang of ['en', 'ar']) for (const method of ['card', 'wallet', 'bank-transfer']) {
    const html = renderToStaticMarkup(h(PreferencesContext.Provider, { value: { lang, theme: 'dark', setLang() {}, setTheme() {} } }, h(PaymentMethods, { method, onChange() {}, disabled: false, error: false })))
    const selected = (html.match(/<input[^>]*>/g) ?? []).find((input) => input.includes(`value="${method}"`))
    assert.ok(selected?.includes('checked=""'))
    assert.ok(html.includes(method === 'card' ? '4242' : method === 'wallet' ? '1234' : '6789'))
    assert.match(html, /booking-method-preview has-selection/)
    assert.equal((html.match(/<input/g) ?? []).length, 3)
    assert.doesNotMatch(html, /type="text"|type="tel"|type="password"|name="cvv|autocomplete="cc-/)
  }
  const html = renderToStaticMarkup(h(PreferencesContext.Provider, { value: { lang: 'en', theme: 'light', setLang() {}, setTheme() {} } }, h(PaymentMethods, { method: null, onChange() {}, disabled: true, error: true })))
  assert.match(html, /id="booking-payment-methods"[^>]*disabled=""/)
  assert.match(html, /id="booking-payment-method-error"[^>]*role="alert"/)
})

test('free checkout skips payment methods and payment failure controls', () => {
  for (const lang of ['en', 'ar']) for (const theme of ['light', 'dark']) {
    const now = Date.parse('2026-10-20T12:00:00Z')
    const state = transitionBooking(emptyBooking(), { type: 'select', eventId: 'coastal-weekender', items: [{ key: 'middle-1', categoryId: 'middle' }] }, now).state
    const html = render('/checkout', lang, theme, [], undefined, { state, now, names: { 'middle-1': 'Sample Guest' } })
    assert.ok(html.includes(lang === 'ar' ? 'لا يلزم الدفع' : 'No payment required'))
    assert.ok(html.includes(lang === 'ar' ? 'تأكيد الحجز التجريبي المجاني' : 'Confirm free sample booking'))
    assert.doesNotMatch(html, /name="sample-payment-method"|name="sample-payment-outcome"/)
  }
})

test('confirmation identifies the selected sample payment method and free bookings', () => {
  for (const lang of ['en', 'ar']) {
    assert.ok(render('/orders/DEMO-A1B2C3D4/confirmation', lang).includes(lang === 'ar' ? 'بطاقة ائتمان أو خصم' : 'Credit / debit card'))
    assert.ok(render('/orders/DEMO-F1A2B3C4/confirmation', lang).includes(lang === 'ar' ? 'لا يلزم الدفع' : 'No payment required'))
  }
})

test('signed-in account name fills only the first cart ticket in English and Arabic and both themes', () => {
  for (const lang of ['en', 'ar']) for (const theme of ['light', 'dark']) {
    const fullName = lang === 'ar' ? 'يوسف خالد' : 'Youssef Khaled'
    const session = { status: 'authenticated', user: { id: 'member-1', fullName, email: 'member@example.com', role: 'USER', phone: '', emailVerified: true } }
    const booking = activeBooking(false)
    const html = render('/cart', lang, theme, [], session, booking)
    assert.equal(html.match(/id="attendee-0"[^>]*value="([^"]*)"/)?.[1], fullName)
    assert.equal(html.match(/id="attendee-1"[^>]*value="([^"]*)"/)?.[1], '')
    assert.ok(html.includes(lang === 'ar' ? 'يُملأ اسم حسابك تلقائيًا' : 'Your signed-in name fills the first ticket'))
    assert.match(render('/checkout', lang, theme, [], session, booking), /booking-missing-names/)
    booking.state = { ...booking.state, items: booking.state.items.slice(0, 1) }
    const checkout = render('/checkout', lang, theme, [], session, booking)
    assert.ok(checkout.includes(`<span class="booking-review-name"><bdi>${fullName}</bdi></span>`))
    assert.match(checkout, /name="sample-payment-outcome"/)
    assert.doesNotMatch(checkout, /booking-missing-names/)
    assert.deepEqual(booking.names, {}, 'account name is derived without mutating the memory-only names')
  }
})

test('cart and checkout preserve guest-name edits and require correction after the default is explicitly cleared', () => {
  const session = { status: 'authenticated', user: { id: 'member-1', fullName: 'Account Holder', email: 'member@example.com', role: 'USER', phone: '', emailVerified: true } }
  const booking = activeBooking(false)
  booking.names = { 'middle-1': 'First Guest', 'front-1': 'Second Guest' }
  const cart = render('/cart', 'en', 'dark', [], session, booking)
  assert.equal(cart.match(/id="attendee-0"[^>]*value="([^"]*)"/)?.[1], 'First Guest')
  assert.equal(cart.match(/id="attendee-1"[^>]*value="([^"]*)"/)?.[1], 'Second Guest')
  const checkout = render('/checkout', 'en', 'dark', [], session, booking)
  assert.ok(checkout.includes('<span class="booking-review-name"><bdi>First Guest</bdi></span>'))
  assert.ok(checkout.includes('<span class="booking-review-name"><bdi>Second Guest</bdi></span>'))
  booking.names['middle-1'] = ''
  const cleared = render('/cart', 'en', 'dark', [], session, booking)
  assert.equal(cleared.match(/id="attendee-0"[^>]*value="([^"]*)"/)?.[1], '')
  assert.match(render('/checkout', 'en', 'dark', [], session, booking), /booking-missing-names/)
})

test('autofill waits for an authenticated session and does not use an email display-name fallback', () => {
  const booking = activeBooking(false)
  const user = { id: 'member-1', fullName: 'Account Holder', email: 'member@example.com', role: 'USER', phone: '', emailVerified: true }
  for (const status of ['guest', 'loading', 'unavailable']) {
    const html = render('/cart', 'en', 'light', [], { status, user }, booking)
    assert.equal(html.match(/id="attendee-0"[^>]*value="([^"]*)"/)?.[1], '')
  }
  const authenticated = render('/cart', 'en', 'light', [], { status: 'authenticated', user }, booking)
  assert.equal(authenticated.match(/id="attendee-0"[^>]*value="([^"]*)"/)?.[1], 'Account Holder')
  const missingName = render('/cart', 'en', 'light', [], { status: 'authenticated', user: { ...user, fullName: user.email } }, booking)
  assert.equal(missingName.match(/id="attendee-0"[^>]*value="([^"]*)"/)?.[1], '')
})

test('buying screens wait for reservation recovery instead of showing an empty cart or stale selection', () => {
  for (const path of ['/cart', '/checkout', `/events/${apiEventId}/tickets`]) for (const lang of ['en', 'ar']) for (const theme of ['light', 'dark']) {
    const html = render(path, lang, theme, [], undefined, { restoration: 'loading' })
    assert.match(html, /role="status"/)
    assert.ok(html.includes(lang === 'ar' ? 'جارٍ استعادة حجزك' : 'Restoring your reservation'))
    assert.doesNotMatch(html, /booking-empty|booking-stepper|id="attendee-0"|sample-payment-outcome/)
    const failed = render(path, lang, theme, [], undefined, { restoration: 'failed' })
    assert.match(failed, /role="alert"/)
    assert.ok(failed.includes(lang === 'ar' ? 'حاول مرة أخرى' : 'Try again'))
    assert.doesNotMatch(failed, /booking-empty|sample-payment-outcome/)
  }
})

test('booking handles empty, expired, replacement, sold-out, cancelled and invalid-event routes', () => {
  assert.match(render('/cart'), /Your cart is empty/)
  assert.match(render('/checkout'), /Your cart is empty/)
  const expired = activeBooking()
  expired.state = { ...expired.state, items: [], expiresAt: null, expired: true }
  assert.match(render('/cart', 'en', 'light', [], undefined, expired), /Reservation expired/)
  assert.match(render('/events/next-perspectives/tickets', 'en', 'dark', [], undefined, activeBooking()), /Replace your current selection/)
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
