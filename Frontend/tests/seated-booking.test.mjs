// Real seated events: the seat map built from the venue layout, holding seats, and names on the right seat at checkout
import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'

let server, catalogue, liveCheckout, liveHolds, bookingApi, model
before(async () => {
  server = await createServer({ server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom' })
  catalogue = await server.ssrLoadModule('/src/Components/Booking/catalogue.ts')
  liveCheckout = await server.ssrLoadModule('/src/Components/Booking/liveCheckout.ts')
  liveHolds = await server.ssrLoadModule('/src/Components/Booking/liveHolds.ts')
  bookingApi = await server.ssrLoadModule('/src/lib/bookingApi.ts')
  model = await server.ssrLoadModule('/src/Components/Booking/bookingModel.ts')
})
after(async () => { await server?.close() })

const eventId = 'e0000000-0000-4000-8000-000000000001'
const event = {
  id: eventId, title: { en: 'Opera night', ar: 'Opera night' }, description: { en: '', ar: '' }, performer: { en: '', ar: '' },
  venue: { en: 'Cairo Opera House', ar: 'Cairo Opera House' }, category: 'concerts', city: 'cairo', date: '2099-01-01T19:00:00Z',
  price: 300, status: 'available', source: 'api', image: '/event-images/concert.jpg', activity: { views: 0, registrations: 0 },
}
// Two sections that both start at row A (like the real Opera House), rows of different lengths, and an empty row
const layout = {
  sections: [
    { key: 'ORC', label: 'Orchestra', rows: [
      { label: 'A', seats: [1, 2, 3].map((n) => ({ id: `orc-a-${n}`, number: n, label: `ORC-A-${n}`, categoryKey: 'VIP' })) },
      { label: 'B', seats: [1, 2].map((n) => ({ id: `orc-b-${n}`, number: n, label: `ORC-B-${n}`, categoryKey: 'BOX' })) },
    ] },
    { key: 'BAL', label: 'Balcony', rows: [
      { label: 'A', seats: [1, 2, 3, 4].map((n) => ({ id: `bal-a-${n}`, number: n, label: `BAL-A-${n}`, categoryKey: 'STANDARD' })) },
      { label: 'Z', seats: [] },
    ] },
  ],
}
const availability = {
  eventId,
  categories: [
    { id: 'cat-vip', categoryKey: 'VIP', name: 'VIP', price: '500.00', capacity: 3, available: 1, soldOut: false },
    { id: 'cat-std', categoryKey: 'STANDARD', name: 'Standard', price: '200.00', capacity: 4, available: 3, soldOut: false },
  ],
  heldSeatIds: ['orc-a-2', 'orc-a-3'],
  soldSeatIds: ['bal-a-4'],
}
// The user already holds ORC-A-3 (it is in their cart)
const register = () => catalogue.registerLiveSeatedCatalogue(event, availability, layout, { 'cat-vip': 10, 'cat-std': 5 }, [], ['ORC-A-3'])
const seat = (c, id) => c.seats.find((s) => s.id === id)

test('a seated venue layout becomes sections, rows and seats with live statuses', () => {
  const c = register()
  assert.equal(c.mode, 'seated')
  assert.deepEqual(c.sections.map((s) => [s.key, s.label.en, s.rows.map((r) => `${r.label}:${r.seats.length}`)]), [
    ['ORC', 'Orchestra', ['A:3', 'B:2']],
    ['BAL', 'Balcony', ['A:4']], // the empty row Z is left out
  ])
  assert.equal(seat(c, 'orc-a-1').status, 'available')
  assert.equal(seat(c, 'orc-a-2').status, 'held') // held by someone else
  assert.equal(seat(c, 'orc-a-3').status, 'available') // held by this user: still theirs to choose
  assert.equal(seat(c, 'bal-a-4').status, 'sold')
  // BOX has no ticket category for this event: shown, but not on sale
  assert.equal(seat(c, 'orc-b-1').categoryId, '')
  assert.equal(seat(c, 'orc-b-1').status, 'sold')
  assert.equal(seat(c, 'bal-a-1').categoryId, 'cat-std')
  assert.equal(catalogue.seatLabel(seat(c, 'bal-a-1')), 'BAL-A-1')
  assert.equal(catalogue.seatSectionOf(c, seat(c, 'bal-a-1')).label.en, 'Balcony')
  assert.equal(catalogue.isLiveEvent(eventId), true)
})

test('the sample seat map keeps its three sections of four rows of twenty seats', () => {
  const sample = catalogue.getBookingCatalogue('next-perspectives')
  const sections = catalogue.seatSections(sample)
  assert.deepEqual(sections.map((s) => s.key), sample.categories.map((c) => c.id))
  assert.deepEqual(sections.flatMap((s) => s.rows.map((r) => r.label)), 'ABCDEFGHIJKL'.split(''))
  for (const section of sections) for (const row of section.rows) assert.deepEqual(row.seats.map((s) => s.number), Array.from({ length: 20 }, (_, i) => i + 1))
})

test('free and own seats can be selected; seats held by others or not on sale cannot', () => {
  const c = register()
  const now = Date.parse('2026-10-28T12:00:00Z')
  const item = (id) => ({ key: id, seatId: id, categoryId: seat(c, id).categoryId })
  const ok = model.transitionBooking(model.emptyBooking(), { type: 'select', eventId, items: [item('orc-a-1'), item('orc-a-3'), item('bal-a-1')] }, now)
  assert.equal(ok.error, undefined)
  assert.equal(ok.state.items.length, 3)
  for (const id of ['orc-a-2', 'bal-a-4']) {
    assert.equal(model.transitionBooking(model.emptyBooking(), { type: 'select', eventId, items: [item(id)] }, now).error, 'unavailable')
  }
  assert.equal(model.transitionBooking(model.emptyBooking(), { type: 'select', eventId, items: [item('orc-b-1')] }, now).error, 'invalid')
})

test('the layout is checked before use', () => {
  assert.throws(() => bookingApi.parseSeatedLayout({ zones: [] }), /Invalid seat layout/)
  assert.throws(() => bookingApi.parseSeatedLayout({ sections: [{ key: 'ORC', rows: [{ label: 'A', seats: [{ id: 'x', number: 'one', categoryKey: 'VIP' }] }] }] }), /Invalid seat layout/)
  assert.deepEqual(bookingApi.parseSeatedLayout(layout).sections.map((s) => s.key), ['ORC', 'BAL'])
})

// A fake backend: answers by method and path, and remembers what the app sent
function fakeServer(t, routes) {
  const calls = []
  t.mock.method(globalThis, 'fetch', async (url, init = {}) => {
    const path = new URL(url).pathname
    const method = init.method ?? 'GET'
    const body = init.body === undefined ? undefined : JSON.parse(init.body)
    calls.push({ method, path, body })
    const route = routes.find((r) => r.method === method && path.startsWith(r.path))
    const [status, response] = route ? route.reply(body) : [404, { message: 'Not found' }]
    return new Response(JSON.stringify(response), { status, headers: { 'Content-Type': 'application/json' } })
  })
  return calls
}
const line = (holdId, seat, categoryId) => ({ holdId, ticketCategoryId: categoryId, category: 'x', seat, quantity: 1, unitPrice: '1', unitServiceFee: '0', serviceFeePercent: '0', lineTotal: '1' })
const cartOf = (lines) => ({ eventId, lines, ticketCount: lines.length, subtotal: '0', serviceFeeTotal: '0', total: '0', currency: 'EGP' })

test('checkout gives each attendee name to the hold of THEIR seat, whatever order the cart is in', async (t) => {
  const c = register()
  // Two seats in the SAME category, so matching names by category (the old way) would swap them
  const items = ['orc-a-1', 'orc-a-3'].map((id) => ({ key: id, seatId: id, categoryId: seat(c, id).categoryId }))
  const names = { 'orc-a-1': 'Seat One Guest', 'orc-a-3': 'Seat Three Guest' }
  const calls = fakeServer(t, [
    // The cart lists seat 3 first, the opposite of the selection
    { method: 'GET', path: '/api/orders/cart', reply: () => [200, cartOf([line('hold-3', 'ORC-A-3', 'cat-vip'), line('hold-1', 'ORC-A-1', 'cat-vip')])] },
    { method: 'POST', path: '/api/orders/checkout', reply: () => [201, { order: { id: 'order-1', status: 'PENDING' }, payment: { providerTxId: 'tx-1' } }] },
    { method: 'POST', path: '/api/payments/simulator/', reply: () => [200, { message: 'ok' }] },
    { method: 'GET', path: '/api/orders/order-1', reply: () => [200, { id: 'order-1', status: 'PAID' }] },
  ])
  const order = await liveCheckout.payOnServer(eventId, items, names, 'key-1', 'success')
  assert.equal(order.status, 'PAID')
  const sent = calls.find((call) => call.path === '/api/orders/checkout').body
  assert.deepEqual(sent.attendees, [
    { holdId: 'hold-3', names: ['Seat Three Guest'] },
    { holdId: 'hold-1', names: ['Seat One Guest'] },
  ])
})

test('checkout stops before ordering when the held seats are not the chosen seats', async (t) => {
  const c = register()
  const items = ['orc-a-1', 'bal-a-1'].map((id) => ({ key: id, seatId: id, categoryId: seat(c, id).categoryId }))
  // The hold on BAL-A-1 ran out: only one seat is still held
  const calls = fakeServer(t, [{ method: 'GET', path: '/api/orders/cart', reply: () => [200, cartOf([line('hold-orc', 'ORC-A-1', 'cat-vip')])] }])
  await assert.rejects(liveCheckout.payOnServer(eventId, items, { 'orc-a-1': 'A Guest', 'bal-a-1': 'B Guest' }, 'key-2', 'success'), liveCheckout.SeatMismatchError)
  assert.equal(calls.some((call) => call.path === '/api/orders/checkout'), false)
})

test('holding seats releases earlier holds, sends the seat ids, and reports a taken seat clearly', async (t) => {
  const items = [{ key: 'orc-a-1', seatId: 'orc-a-1', categoryId: 'cat-vip' }, { key: 'bal-a-1', seatId: 'bal-a-1', categoryId: 'cat-std' }]
  const calls = fakeServer(t, [
    { method: 'GET', path: '/api/orders/cart', reply: () => [200, cartOf([line('old-hold', 'ORC-A-3', 'cat-vip')])] },
    { method: 'DELETE', path: '/api/inventory/holds/', reply: () => [200, { message: 'released' }] },
    { method: 'POST', path: '/api/inventory/holds', reply: () => [201, { holds: [{ expiresAt: '2099-01-01T10:10:00Z' }, { expiresAt: '2099-01-01T10:09:00Z' }] }] },
  ])
  const expiresAt = await liveHolds.syncHolds(eventId, items)
  assert.equal(expiresAt, Date.parse('2099-01-01T10:09:00Z'))
  assert.deepEqual(calls.map((call) => `${call.method} ${call.path}`), ['GET /api/orders/cart', 'DELETE /api/inventory/holds/old-hold', 'POST /api/inventory/holds'])
  assert.deepEqual(calls[2].body, { eventId, seatIds: ['orc-a-1', 'bal-a-1'] })

  t.mock.restoreAll()
  fakeServer(t, [
    { method: 'GET', path: '/api/orders/cart', reply: () => [200, cartOf([])] },
    { method: 'POST', path: '/api/inventory/holds', reply: () => [409, { message: 'One or more of these seats is being held by someone else' }] },
  ])
  await assert.rejects(liveHolds.syncHolds(eventId, items), liveHolds.SeatTakenError)
})

test('removing one seat in the cart releases only that seat', async (t) => {
  const calls = fakeServer(t, [
    { method: 'GET', path: '/api/orders/cart', reply: () => [200, cartOf([line('hold-orc', 'ORC-A-1', 'cat-vip'), line('hold-bal', 'BAL-A-1', 'cat-std')])] },
    { method: 'DELETE', path: '/api/inventory/holds/', reply: () => [200, { message: 'released' }] },
  ])
  await liveHolds.releaseSeatHold(eventId, 'BAL-A-1')
  assert.deepEqual(calls.filter((call) => call.method === 'DELETE').map((call) => call.path), ['/api/inventory/holds/hold-bal'])
})
