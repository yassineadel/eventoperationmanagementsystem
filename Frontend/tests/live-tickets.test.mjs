import { after, afterEach, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { createServer } from 'vite'

let server, orders, api, liveCheckout, liveTickets, transfer, LiveTransferForm, LiveTransferTicket, TicketTransferAction, ConfirmationContent, TicketStatus, PreferencesContext, TicketsContext
const originalFetch = globalThis.fetch
before(async () => {
  server = await createServer({ cacheDir: 'node_modules/.vite-tests/live-tickets', server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom' })
  orders = await server.ssrLoadModule('/src/Components/Tickets/liveOrders.ts')
  api = await server.ssrLoadModule('/src/lib/bookingApi.ts')
  liveCheckout = await server.ssrLoadModule('/src/Components/Booking/liveCheckout.ts')
  liveTickets = await server.ssrLoadModule('/src/Components/Tickets/liveTickets.ts')
  transfer = await server.ssrLoadModule('/src/Components/Tickets/liveTransfer.ts')
  const transferPage = await server.ssrLoadModule('/src/Components/Tickets/LiveTransferTicket.tsx')
  LiveTransferForm = transferPage.LiveTransferForm
  LiveTransferTicket = transferPage.default
  TicketTransferAction = (await server.ssrLoadModule('/src/Components/Tickets/TicketTransferAction.tsx')).default
  ConfirmationContent = (await server.ssrLoadModule('/src/Components/Tickets/ConfirmationContent.tsx')).default
  TicketStatus = (await server.ssrLoadModule('/src/Components/Tickets/TicketParts.tsx')).TicketStatus
  PreferencesContext = (await server.ssrLoadModule('/src/Components/Auth/preferences.ts')).PreferencesContext
  TicketsContext = (await server.ssrLoadModule('/src/Components/Tickets/ticketsContext.ts')).TicketsContext
})
after(async () => { await server?.close() })
afterEach(() => { globalThis.fetch = originalFetch })

const id = 'e0000000-0000-4000-8000-000000000001'
const reference = 'HF-ABC234'
const event = { id: 'event-live', name: 'Database concert', startAt: '2099-11-19T17:00:00Z' }
const order = { id, reference, eventId: event.id, event, status: 'PAID', subtotal: '600.00', serviceFeeTotal: '30.00', total: '630.00', currency: 'EGP', expiresAt: null, paidAt: '2026-10-30T18:00:00Z', createdAt: '2026-10-30T17:50:00Z', payment: { provider: 'simulator', status: 'SUCCEEDED' }, items: [{ ticketCategoryId: 'floor', quantity: 2, unitPrice: '300.00', serviceFeePercent: '5.00', serviceFeeAmount: '15.00' }] }
const ticket = (ticketId, orderReference = reference) => ({ id: ticketId, orderReference, status: 'VALID', qrToken: 'private-server-token', attendeeName: `Guest ${ticketId}`, category: 'Floor', seat: null, transferCount: 0, event: { ...event, doorsOpenAt: '2099-11-19T16:00:00Z', endsAt: '2099-11-19T20:00:00Z', venue: { name: 'Database venue', address: 'Cairo', city: 'Cairo' } } })
function transport(load) {
  const calls = []
  globalThis.fetch = async (url, init) => {
    const path = new URL(url).pathname
    calls.push({ path, init })
    assert.equal(init.credentials, 'include')
    const [status, value] = await load(path, init)
    return new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } })
  }
  return calls
}
const signal = () => new AbortController().signal
const read = (path) => path === `/api/orders/${id}` ? [200, order] : path === '/api/tickets' ? [200, { upcoming: [ticket('one'), ticket('two'), ticket('other', 'HF-OTHER2')], past: [] }] : [404, {}]

test('a direct order URL reloads the server totals and exactly that order’s tickets', async () => {
  const calls = transport(read)
  const first = await orders.loadLiveOrder(id, null, signal())
  const refreshed = await orders.loadLiveOrder(id, null, signal())
  assert.equal(refreshed.order.reference, reference)
  assert.equal(refreshed.order.total, 630)
  assert.equal(refreshed.order.fees, 30)
  assert.equal(refreshed.quantity, 2)
  assert.equal(refreshed.status, 'PAID')
  assert.deepEqual(refreshed.order.ticketIds, ['one', 'two'])
  assert.deepEqual(first, refreshed)
  assert.equal(calls.filter((call) => call.path === `/api/orders/${id}`).length, 2)
  assert.equal(JSON.stringify(refreshed).includes('private-server-token'), false)
})

test('a human-readable reference resolves only against the current account’s orders', async () => {
  const calls = transport((path) => path === '/api/orders' ? [200, [{ id, reference }]] : read(path))
  assert.equal((await orders.loadLiveOrder(reference, null, signal())).id, id)
  assert.deepEqual(calls.map((call) => call.path), ['/api/orders', `/api/orders/${id}`, '/api/tickets'])
  transport(() => [200, []])
  await assert.rejects(orders.loadLiveOrder('HF-NOT234', null, signal()), (error) => error.status === 404)
})

test('expired sessions and failed ticket requests remain errors rather than a fabricated confirmation', async () => {
  transport(() => [401, { message: 'Sign in' }])
  await assert.rejects(orders.loadLiveOrder(id, null, signal()), (error) => error.status === 401)
  transport((path) => path === '/api/tickets' ? [503, { message: 'Unavailable' }] : read(path))
  await assert.rejects(orders.loadLiveOrder(id, null, signal()), (error) => error.status === 503)
})

test('pending, failed and cancelled orders keep their server status and do not load a usable ticket', async () => {
  for (const status of ['PENDING', 'FAILED', 'CANCELLED']) {
    const calls = transport(() => [200, { ...order, status }])
    const result = await orders.loadLiveOrder(id, null, signal())
    assert.equal(result.status, status)
    assert.deepEqual(result.tickets, [])
    assert.equal(calls.length, 1)
  }
})

test('confirmation recognises backend IDs and references while retaining the sample route', () => {
  assert.equal(orders.isLiveOrderReference(id), true)
  assert.equal(orders.isLiveOrderReference(reference), true)
  assert.equal(orders.isLiveOrderReference('DEMO-A1B2C3D4'), false)
})

test('retrying a completed checkout returns its saved order without starting another payment', async () => {
  const calls = transport((path) => path === '/api/orders/cart'
    ? [200, { eventId: event.id, lines: [], ticketCount: 0 }]
    : path === '/api/orders/checkout' ? [201, { order, payment: null }] : [500, { message: 'Unexpected second payment' }])
  const result = await liveCheckout.payOnServer(event.id, [], {}, 'same-checkout-key', 'success')
  assert.equal(result.status, 'PAID')
  assert.equal(result.id, id)
  assert.deepEqual(calls.map((call) => call.path), ['/api/orders/cart', '/api/orders/checkout'])
})

test('resend uses the authenticated ticket endpoint and preserves server rate-limit errors', async () => {
  const calls = transport(() => [200, { message: 'Queued' }])
  await api.resendTicketEmail('ticket one')
  assert.equal(calls.length, 1)
  assert.equal(calls[0].path, '/api/tickets/ticket%20one/resend')
  assert.equal(calls[0].init.method, 'POST')
  assert.equal(calls[0].init.body, '{}')
  for (const status of [401, 400, 429, 502]) {
    transport(() => [status, { message: 'Rejected' }])
    await assert.rejects(api.resendTicketEmail('one'), (error) => error.status === status)
  }
})

function render(component, lang, theme) {
  return renderToStaticMarkup(h(PreferencesContext.Provider, { value: { lang, theme, setLang() {}, setTheme() {} } },
    h(TicketsContext.Provider, { value: { state: { tickets: [], orders: [] }, storageAvailable: true, now: Date.parse('2026-10-30T12:00:00Z') } }, h(MemoryRouter, null, component))))
}
test('real confirmation keeps the design and correct labels in both languages and themes', async () => {
  transport(read)
  const data = await orders.loadLiveOrder(id, null, signal())
  for (const lang of ['en', 'ar']) for (const theme of ['light', 'dark']) {
    const html = render(h(ConfirmationContent, { ...data, live: true }), lang, theme)
    assert.match(html, /oc-layout/)
    assert.ok(html.includes(reference))
    assert.ok(html.includes(lang === 'ar' ? 'تذكرة نشطة' : 'Active ticket'))
    assert.ok(html.includes(lang === 'ar' ? 'مرجع الطلب' : 'Order reference'))
    assert.doesNotMatch(html, /Active sample ticket|تذكرة تجريبية نشطة|Sample total|Fictional preview|DEMO-/)
    assert.ok(html.includes('/my-tickets/one'))
  }
})
test('sample and live badges remain distinct and used tickets never become active', async () => {
  transport(read)
  const data = await orders.loadLiveOrder(id, null, signal())
  for (const lang of ['en', 'ar']) {
    const live = render(h(TicketStatus, { ticket: data.tickets[0] }), lang, 'light')
    const sample = render(h(TicketStatus, { ticket: { ...data.tickets[0], event: { ...data.order.event, source: undefined } } }), lang, 'light')
    assert.ok(live.includes(lang === 'ar' ? 'تذكرة نشطة' : 'Active ticket'))
    assert.ok(sample.includes(lang === 'ar' ? 'تذكرة تجريبية نشطة' : 'Active sample ticket'))
    const used = render(h(TicketStatus, { ticket: { ...data.tickets[0], status: 'used' } }), lang, 'dark')
    assert.ok(used.includes(lang === 'ar' ? 'مستخدمة' : 'Used'))
  }
})

async function transferData(overrides = {}) {
  transport(() => [200, { ...ticket('one'), transfersLeft: 3, ...overrides }])
  return liveTickets.loadLiveTicket('one', null, signal())
}
const owner = { name: 'Account holder', email: 'holder@example.test' }

test('the live transfer form loads one authenticated ticket without retaining its QR token', async () => {
  const calls = transport(() => [200, { ...ticket('one'), transfersLeft: 3 }])
  const data = await liveTickets.loadLiveTicket('one', null, signal())
  assert.equal(data.ticket.id, 'one')
  assert.equal(data.status, 'VALID')
  assert.equal(data.transfersLeft, 3)
  assert.equal(data.ticket.event.source, 'api')
  assert.equal(JSON.stringify(data).includes('private-server-token'), false)
  assert.equal(calls[0].path, '/api/tickets/one')
})

test('recipient input is normalised and rejects invalid addresses and self transfers', () => {
  assert.deepEqual(transfer.transferRecipient('  Friend@Example.test ', owner.email), { email: 'friend@example.test', issue: null })
  assert.equal(transfer.transferRecipient(' HOLDER@example.test ', owner.email).issue, 'self')
  assert.equal(transfer.transferRecipient('invalid', owner.email).issue, 'invalid')
  assert.equal(transfer.transferRecipient('a'.repeat(255) + '@example.test', owner.email).issue, 'invalid')
})

test('used, refunded, already transferred, cancelled, started and capped tickets cannot be offered for transfer', async () => {
  const { ticket: value } = await transferData()
  const now = Date.parse('2026-10-30T12:00:00Z')
  assert.equal(transfer.transferAvailability(value, now), null)
  for (const [status, reason] of [['used', 'used'], ['refunded', 'refunded'], ['transferred', 'transferred'], ['refund-pending', 'refundPending']]) assert.equal(transfer.transferAvailability({ ...value, status }, now), reason)
  assert.equal(transfer.transferAvailability({ ...value, transferCount: 3 }, now), 'limit')
  assert.equal(transfer.transferAvailability({ ...value, event: { ...value.event, status: 'cancelled' } }, now), 'cancelled')
  assert.equal(transfer.transferAvailability(value, Date.parse(value.event.date)), 'past')
})

test('the transfer POST sends the reviewed email to the existing authenticated endpoint', async () => {
  const calls = transport(() => [200, { transferCount: 1, transfersLeft: 2, attendeeName: 'Recipient Name' }])
  const result = await api.transferTicketToAccount('ticket one', 'friend@example.test')
  assert.equal(result.transfersLeft, 2)
  assert.equal(result.attendeeName, 'Recipient Name')
  assert.equal(calls.length, 1)
  assert.equal(calls[0].path, '/api/tickets/ticket%20one/transfer')
  assert.equal(calls[0].init.method, 'POST')
  assert.deepEqual(JSON.parse(calls[0].init.body), { email: 'friend@example.test' })
})

test('recipient errors, missing tickets, expired sessions and uncertain results remain distinct', async () => {
  const cases = [
    [404, 'No Hafletna account uses this email. Ask the person to register first, then try again.', 'recipientMissing'],
    [404, 'Ticket not found', 'missing'], [400, 'You already hold this ticket', 'self'],
    [400, 'This ticket cannot be transferred to that account', 'recipientBlocked'],
    [400, 'This event has already started', 'past'], [400, 'A ticket can be transferred at most 3 times', 'limit'],
    [400, 'This ticket has a refund in progress and cannot be transferred', 'refundPending'],
    [401, 'Sign in', 'session'], [409, 'This ticket can no longer be transferred', 'unavailable'], [502, 'Unavailable', 'uncertain'],
  ]
  for (const [status, message, issue] of cases) {
    transport(() => [status, { message }])
    try { await api.transferTicketToAccount('one', 'friend@example.test'); assert.fail('Expected API error') }
    catch (error) { assert.equal(transfer.transferFailure(error), issue) }
    assert.ok(transfer.liveTransferStrings.en.issues[issue])
    assert.ok(transfer.liveTransferStrings.ar.issues[issue])
  }
  assert.equal(transfer.transferFailure(new Error('Timed out')), 'uncertain')
})

test('real transfer renders the existing compact layout in English and Arabic in both themes', async () => {
  const data = await transferData()
  for (const lang of ['en', 'ar']) for (const theme of ['light', 'dark']) {
    const html = render(h(LiveTransferForm, { data, owner, onReload() {} }), lang, theme)
    assert.match(html, /ta-steps/)
    assert.match(html, /ta-summary/)
    assert.match(html, /id="live-transfer-email"/)
    assert.ok(html.includes(lang === 'ar' ? 'حساب عميل مسجّل' : 'existing, verified Hafletna'))
    assert.doesNotMatch(html, /Verified sample accounts|Fictional preview|ta-summary-total|private-server-token/)
  }
})

test('ineligible transfer pages explain their state without showing a recipient or confirmation form', async () => {
  for (const overrides of [{ status: 'USED' }, { status: 'REFUNDED' }, { transferCount: 3, transfersLeft: 0 }]) {
    const data = await transferData(overrides)
    for (const lang of ['en', 'ar']) {
      const html = render(h(LiveTransferForm, { data, owner, onReload() {} }), lang, 'dark')
      assert.ok(html.includes(lang === 'ar' ? 'لا يمكن نقل هذه التذكرة' : 'This ticket cannot be transferred'))
      assert.doesNotMatch(html, /id="live-transfer-email"|type="submit"/)
    }
  }
})

test('refreshing a transferred ticket shows its transfer record instead of allowing another submission', async () => {
  const data = await transferData({ status: 'TRANSFERRED_AWAY', transferCount: 1, transfersLeft: 2 })
  const html = render(h(LiveTransferForm, { data, owner, onReload() {} }), 'en', 'light')
  assert.match(html, /Ticket transferred/)
  assert.match(html, /previous QR code is no longer valid/)
  assert.doesNotMatch(html, /id="live-transfer-email"|type="submit"|private-server-token/)
})

test('ticket details offer the live transfer link and disable it for unusable tickets', async () => {
  const data = await transferData()
  const html = render(h(TicketTransferAction, { ticket: data.ticket }), 'en', 'dark')
  assert.match(html, /href="\/my-tickets\/one\/transfer"/)
  assert.doesNotMatch(html, /sample/)
  const blocked = render(h(TicketTransferAction, { ticket: { ...data.ticket, status: 'used' } }), 'ar', 'light')
  assert.match(blocked, /disabled/)
  assert.doesNotMatch(blocked, /href=/)
})

test('a live transfer route requires sign-in instead of opening a sample transfer', () => {
  const html = render(h(LiveTransferTicket, { ticketId: id }), 'en', 'dark')
  assert.match(html, /Sign in to transfer your ticket/)
  assert.match(html, /returnTo=%2Fmy-tickets%2F/)
  assert.doesNotMatch(html, /Verified sample accounts|type="email"/)
})
