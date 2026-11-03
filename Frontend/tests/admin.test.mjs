import test from 'node:test'
import assert from 'node:assert/strict'
import { toWall, minutesAfter, daysBetween, SAMPLE_NOW, setClock } from '../src/lib/adminTime.ts'
import { AdminApiError } from '../src/lib/adminErrors.ts'
import { toLatinDigits, parseWhole, plural, shownOf } from '../src/Components/Admin/adminText.ts'
import { adminEventsApi, waveStates } from '../src/lib/adminEventsApi.ts'
import { venuesApi, validateVenueForm } from '../src/lib/venuesApi.ts'
import { ordersApi, refundQuote, refundRequestsApi } from '../src/lib/ordersApi.ts'
import { usersApi, SAMPLE_ADMIN } from '../src/lib/usersApi.ts'
import { eventFormProblems, ticketProblems, canMoveWave, waveChanges, shownWaveStates, incompleteFaqs, overCapacity } from '../src/Components/Admin/eventRules.ts'
import { analyticsApi } from '../src/lib/analyticsApi.ts'
import { auditApi } from '../src/lib/auditLog.ts'
import { summary, presetRange, daily, byCategory, perEvent } from '../src/Components/Admin/analytics.ts'
import { toCsv } from '../src/Components/Admin/csv.ts'

const JAZZ = '4f2a9c1e-7b3d-4e8a-9c21-5d6e7f8a9b01'
const NILE_ARENA = '7c1e4b2a-91d3-4f0e-a6b5-2d8f3c9e1a07'
const DOWNTOWN_HALL = '3a9d7e15-c2f8-4b60-9e4a-81b5d0f6c7e2'
const RED_SEA_RUN = 'e7f3a5c2-4d7b-4e2f-9a65-9b0c1d2e3f45'
const POTTERY_DRAFT = '1b0c8d5f-7a0e-4b5c-8d98-2e3f4a5b6c78'
const SUNSET_BEATS = '8b3c0d2f-1a4e-4b9c-8d32-6e7f8a9b0c12'
const FILM_WEEK_DRAFT = 'f8a4b6d3-5e8c-4f3a-8b76-0c1d2e3f4a56'

const code = async (promise) => {
  try {
    await promise
  } catch (error) {
    assert.ok(error instanceof AdminApiError, `expected AdminApiError, got ${error}`)
    return error.code
  }
  assert.fail('expected the call to be rejected')
}

test('dates from the API read as Cairo wall time and never throw', () => {
  assert.equal(toWall('2026-10-24T20:00'), '2026-10-24T20:00')
  assert.equal(toWall('2026-10-24T20:00:00'), '2026-10-24T20:00')
  // January: Cairo is UTC+2.
  assert.equal(toWall('2026-01-10T17:00:00.000Z'), '2026-01-10T19:00')
  assert.equal(toWall('not a date'), null)
  assert.equal(toWall(undefined), null)
  assert.equal(minutesAfter('2026-10-24T20:00', -60), '2026-10-24T19:00')
  assert.equal(daysBetween('2026-10-17T20:00', '2026-10-24T20:00'), 7)
})

test('Arabic digits are read as numbers and Arabic plurals pick the right form', () => {
  assert.equal(toLatinDigits('٥٠٠'), '500')
  assert.equal(parseWhole('١٢٣ EGP'), 123)
  assert.equal(parseWhole('99999999999', 1000), 1000)
  const forms = { zero: 'لا تذاكر', one: 'تذكرة واحدة', two: 'تذكرتان', few: '{n} تذاكر', many: '{n} تذكرة', other: '{n} تذكرة' }
  assert.equal(plural('ar', 1, forms), 'تذكرة واحدة')
  assert.equal(plural('ar', 2, forms), 'تذكرتان')
  assert.equal(plural('ar', 5, forms), '5 تذاكر')
  assert.equal(plural('ar', 11, forms), '11 تذكرة')
  assert.equal(plural('en', 1, { one: '{n} ticket', other: '{n} tickets' }), '1 ticket')
})

test('waves sell in order: the first wave with places is on sale', () => {
  assert.deepEqual(waveStates([{ capacity: 10, sold: 10 }, { capacity: 20, sold: 3 }, { capacity: 5, sold: 0 }]), ['sold-out', 'on-sale', 'upcoming'])
  assert.deepEqual(waveStates([{ capacity: 1, sold: 1 }]), ['sold-out'])
})

test('event form rules: new events start in the future, doors open before the start, sales close by the start', () => {
  const base = {
    name: 'Show',
    category: 'concerts',
    performer: '',
    description: 'A show',
    venueId: NILE_ARENA,
    startAt: '2026-12-01T20:00',
    doorsOpenAt: '2026-12-01T19:00',
    durationMinutes: 90,
    salesOpenAt: '',
    salesCloseAt: '',
  }
  assert.deepEqual(eventFormProblems(base, { isNew: true, now: SAMPLE_NOW }), [])
  assert.deepEqual(eventFormProblems({ ...base, startAt: '2026-10-01T20:00', doorsOpenAt: '2026-10-01T19:00' }, { isNew: true, now: SAMPLE_NOW }), ['startPast'])
  assert.deepEqual(eventFormProblems({ ...base, startAt: '2026-10-01T20:00', doorsOpenAt: '2026-10-01T19:00' }, { isNew: false, now: SAMPLE_NOW }), [])
  assert.deepEqual(eventFormProblems({ ...base, doorsOpenAt: '2026-12-01T06:00' }, { isNew: true, now: SAMPLE_NOW }), ['doorsOpenAt'])
  assert.deepEqual(eventFormProblems({ ...base, salesCloseAt: '2026-12-01T21:00' }, { isNew: true, now: SAMPLE_NOW }), ['salesCloseAt'])
})

test('ticket editor flags each wave on its own row, and waves never move ahead of sold ones', () => {
  const forms = [
    { key: 'VIP', name: 'VIP', waves: [{ id: 'a', name: 'Early', price: 500, capacity: 50, sold: 50 }, { name: '', price: 900, capacity: 0, sold: 0 }] },
    { key: 'vip', name: '', waves: [] },
  ]
  const problems = ticketProblems(forms)
  assert.deepEqual(problems[0], { name: false, code: false, noWave: false, seats: false, waves: { 1: 'name' } })
  assert.deepEqual(problems[1], { name: true, code: true, noWave: true, seats: false, waves: {} })

  const waves = [{ name: 'A', price: 1, capacity: 1, sold: 1 }, { name: 'B', price: 1, capacity: 1, sold: 0 }, { name: 'C', price: 1, capacity: 1, sold: 0 }]
  assert.equal(canMoveWave(waves, 2, 1), true)
  assert.equal(canMoveWave(waves, 1, 0), false)
})

test('the review step lists price changes and which wave goes on sale', () => {
  const before = [{ key: 'VIP', name: 'VIP', price: 500, capacity: 70, sold: 50, waves: [{ id: 'a', name: 'Early', price: 500, capacity: 50, sold: 50 }, { id: 'b', name: 'Regular', price: 900, capacity: 20, sold: 0 }] }]
  const after = [{ key: 'VIP', name: 'VIP', waves: [{ id: 'a', name: 'Early', price: 500, capacity: 50, sold: 50 }, { id: 'b', name: 'Regular', price: 950, capacity: 20, sold: 0 }] }]
  assert.deepEqual(waveChanges(before, after), [{ kind: 'price', category: 'VIP', wave: 'Regular', from: 900, to: 950 }])
})

test('a refund the customer asked for keeps the service fee; other refunds return it', () => {
  const order = { items: [{ category: 'VIP', unitPrice: 500, qty: 2 }], fee: 30 }
  const tickets = [{ category: 'VIP', status: 'valid' }, { category: 'VIP', status: 'valid' }]
  assert.deepEqual(refundQuote(order, tickets, 'customer'), { count: 2, tickets: 1000, fee: 30, feeKept: true, amount: 1000 })
  assert.equal(refundQuote(order, tickets, 'eventChanged').amount, 1030)
})

test('a refund leaves out tickets already refunded or used', () => {
  const order = { items: [{ category: 'Standard', unitPrice: 400, qty: 3 }], fee: 36 }
  const tickets = [{ category: 'Standard', status: 'checked' }, { category: 'Standard', status: 'cancelled' }, { category: 'Standard', status: 'valid' }]
  assert.deepEqual(refundQuote(order, tickets, 'other'), { count: 1, tickets: 400, fee: 12, feeKept: false, amount: 412 })
})

test('waves show nothing on sale before publishing or after the event ends or is cancelled', () => {
  const waves = [{ capacity: 10, sold: 10 }, { capacity: 10, sold: 2 }, { capacity: 10, sold: 0 }]
  assert.deepEqual(shownWaveStates(waves, 'published'), ['sold-out', 'on-sale', 'upcoming'])
  assert.deepEqual(shownWaveStates(waves, 'draft'), ['sold-out', 'not-yet', 'not-yet'])
  assert.deepEqual(shownWaveStates(waves, 'cancelled'), ['sold-out', 'closed', 'closed'])
  assert.deepEqual(shownWaveStates(waves, 'past'), ['sold-out', 'closed', 'closed'])
})

test('list footers agree with the total in both languages', () => {
  const forms = { one: 'Showing {shown} of {n} event', other: 'Showing {shown} of {n} events' }
  assert.equal(shownOf('en', 1, 1, forms, String), 'Showing 1 of 1 event')
  const ar = { one: 'عرض {shown} من فعالية واحدة', two: 'عرض {shown} من فعاليتين', few: 'عرض {shown} من {n} فعاليات', many: 'عرض {shown} من {n} فعالية', other: 'عرض {shown} من {n} فعالية' }
  assert.equal(shownOf('ar', 3, 5, ar, String), 'عرض 3 من 5 فعاليات')
  assert.equal(shownOf('ar', 3, 12, ar, String), 'عرض 3 من 12 فعالية')
})

test('saving a venue without changes keeps every seat, its ID and its category', async () => {
  const before = await venuesApi.get(NILE_ARENA)
  const form = await venuesApi.getForm(NILE_ARENA)
  assert.deepEqual(validateVenueForm(form), [])
  await venuesApi.update(NILE_ARENA, form)
  const after = await venuesApi.get(NILE_ARENA)
  assert.deepEqual(after.layout.categories.map((c) => [c.key, c.places]), before.layout.categories.map((c) => [c.key, c.places]))
  const seats = (layout) => layout.sections.flatMap((s) => s.rows.flatMap((r) => r.seats.map((seat) => `${seat.id}:${seat.categoryKey}`)))
  assert.deepEqual(seats(after.layout), seats(before.layout))
})

test('venue validation catches empty sections, bad row ranges and duplicate codes', () => {
  const form = {
    name: 'Hall', address: 'Street', city: 'Cairo', country: 'Egypt', kind: 'seated',
    sections: [{ name: '', firstRow: 'D', lastRow: 'A', seatsPerRow: 10, categoryCode: 'STD' }],
    zones: [],
    categories: [{ name: 'Standard', code: 'STD', colour: '#000' }, { name: 'Other', code: 'STD', colour: '#111' }],
  }
  assert.deepEqual(validateVenueForm(form), [{ field: 'section', index: 0 }, { field: 'category', index: 1 }])
})

test('business rules come back as typed errors', async () => {
  assert.equal(await code(venuesApi.remove(DOWNTOWN_HALL)), 'venue-in-use')
  assert.equal(await code(usersApi.block(SAMPLE_ADMIN.id, 'test', SAMPLE_ADMIN)), 'self-block')
  const { categories } = await adminEventsApi.get(JAZZ)
  const forms = categories.map((c) => ({ key: c.key, name: c.name, waves: c.waves.map((w) => ({ ...w })) }))
  forms[0].waves[0].price += 100 // the VIP early-bird wave has sales
  assert.equal(await code(adminEventsApi.saveCategories(JAZZ, forms)), 'wave-price-locked')
})

test('approving a refund request cancels the ticket and returns its price', async () => {
  const [request] = (await refundRequestsApi.list()).filter((r) => r.status === 'submitted' && r.eligible)
  const approved = await refundRequestsApi.approve(request.id, 'Test admin')
  assert.equal(approved.status, 'approved')
  assert.equal(approved.ticket.status, 'cancelled')
  assert.equal(approved.amount, approved.order.items.find((i) => i.category === approved.ticket.category).unitPrice)
  assert.equal(await code(refundRequestsApi.approve(request.id)), 'request-decided')
})

test('blocking a user refunds the tickets they hold for upcoming events, whoever bought them', async () => {
  // Ahmed holds HFT-7Q2K-91, a VIP ticket for the jazz night that Mariam bought and gave him.
  const ahmed = { id: '2e7d5c1f-3a8b-4f9c-9d0e-1f2a3b4c5d0b' }
  const blocked = await usersApi.block(ahmed.id, 'Reselling tickets', SAMPLE_ADMIN)
  assert.deepEqual(blocked.refunded, { tickets: 1, amount: 1545 })
  assert.equal(blocked.tickets.find((k) => k.code === 'HFT-7Q2K-91').status, 'cancelled')
  const order = (await ordersApi.get('HF-10241')).order
  assert.equal(order.status, 'paid') // Mariam's other two tickets still work
  assert.equal(order.payment.refundAmount, 1545)
  const [latest] = await auditApi.list()
  assert.equal(latest.action, 'blocked')
  assert.equal(latest.target.label, 'Ahmed Sherif')
  assert.equal(latest.tickets, 1)
  await usersApi.unblock(ahmed.id)
})

test('cancelling an event refunds its paid orders in full', async () => {
  await adminEventsApi.cancel(JAZZ, 'Venue flooded', 'Test admin')
  const jazz = (await ordersApi.list()).filter((o) => o.eventKey === 'jazz')
  for (const order of jazz) {
    assert.equal(order.status, 'refunded')
    assert.equal(order.payment.refundAmount >= order.subtotal, true)
  }
  const { event } = await adminEventsApi.get(JAZZ)
  assert.equal(event.status, 'cancelled')
  // Mariam's order: 1,545 back when Ahmed was blocked, the rest now; never more than she paid.
  const mariam = jazz.find((o) => o.id === 'HF-10241')
  assert.equal(mariam.payment.refundAmount, mariam.total)
})

test('the activity log records each change with the admin who made it, newest first', async () => {
  const log = await auditApi.list()
  const cancel = log.find((e) => e.action === 'cancelled' && e.target.id === JAZZ)
  assert.equal(cancel.actor, 'Test admin')
  assert.equal(cancel.detail, 'Venue flooded')
  assert.ok(log.some((e) => e.action === 'approved' && e.actor === 'Test admin'))
  assert.ok(log.some((e) => e.action === 'unblocked' && e.target.label === 'Ahmed Sherif'))
  assert.ok(log.indexOf(cancel) < log.findIndex((e) => e.target.label === 'Red Sea Beach Run' && e.action === 'cancelled'))
})

test('refunding an order settles its open requests, so a ticket is never refunded twice', async () => {
  const before = (await ordersApi.get('HF-10237')).order
  const refunded = await ordersApi.refund('HF-10237', { reason: 'customer', note: '' }, 'Test admin')
  assert.equal(refunded.order.payment.refundAmount, before.subtotal)
  // RR-2042 asked to refund one of these tickets; the order refund already covered it.
  assert.equal(await code(refundRequestsApi.approve('RR-2042')), 'request-decided')
  const after = (await ordersApi.get('HF-10237')).order
  assert.ok(after.payment.refundAmount <= after.total)
  assert.equal(await code(ordersApi.refund('HF-10237', { reason: 'other', note: '' })), 'paid-only-refund')
})

test('cancelled or started events stay as they were, and drafts that should have started can’t be published', async () => {
  const { form } = await adminEventsApi.getForm(RED_SEA_RUN)
  assert.equal(await code(adminEventsApi.update(RED_SEA_RUN, form)), 'event-locked')
  setClock(() => '2026-12-31T00:00')
  try {
    assert.equal(await code(adminEventsApi.publish(POTTERY_DRAFT)), 'start-past')
  } finally {
    setClock(() => SAMPLE_NOW)
  }
})

test('a venue that events use can’t lose sections, seats or zones', async () => {
  const form = await venuesApi.getForm(DOWNTOWN_HALL)
  const smaller = form.kind === 'seated' ? { ...form, sections: form.sections.slice(0, -1) } : { ...form, zones: form.zones.slice(0, -1) }
  assert.equal(await code(venuesApi.update(DOWNTOWN_HALL, smaller)), 'venue-layout-locked')
  const other = { ...form, kind: form.kind === 'seated' ? 'standing' : 'seated' }
  assert.equal(await code(venuesApi.update(DOWNTOWN_HALL, other)), 'venue-layout-locked')
})

test('FAQ rows need both a question and an answer; empty rows are fine', () => {
  const base = {
    name: 'Jazz', category: 'concerts', performer: '', description: 'An evening', venueId: 'v', startAt: '2026-12-01T20:00', doorsOpenAt: '2026-12-01T19:00',
    durationMinutes: 120, salesOpenAt: '', salesCloseAt: '', images: [], policies: {}, faqs: [],
  }
  assert.deepEqual(incompleteFaqs([{ question: 'Parking?', answer: '' }, { question: '', answer: '' }, { question: 'Age?', answer: '12+' }]), [0])
  assert.deepEqual(eventFormProblems({ ...base, faqs: [{ question: '', answer: 'Yes' }] }, { isNew: true, now: SAMPLE_NOW }), ['faqs'])
  assert.deepEqual(eventFormProblems({ ...base, faqs: [{ question: '', answer: '' }] }, { isNew: true, now: SAMPLE_NOW }), [])
})

test('photos, policies and FAQs are saved; empty policies and blank questions are dropped', async () => {
  const { form } = await adminEventsApi.getForm(SUNSET_BEATS)
  assert.ok(form.images.length > 0 && form.faqs.length > 0)
  const saved = await adminEventsApi.update(SUNSET_BEATS, {
    ...form,
    images: ['/event-images/art.jpg', ...form.images],
    policies: { ...form.policies, accessibility: '   ' },
    faqs: [...form.faqs, { question: ' ', answer: ' ' }],
  })
  assert.equal(saved.images[0], '/event-images/art.jpg')
  assert.equal(saved.policies.accessibility, undefined)
  assert.equal(saved.faqs.length, form.faqs.length)
  await adminEventsApi.update(SUNSET_BEATS, form)
})

test('a seated venue limits each category to its seats; a standing venue limits the total', async () => {
  const seated = { kind: 'seated', capacity: 50, places: { VIP: { name: 'VIP', places: 10 } } }
  const forms = [{ key: 'VIP', name: 'VIP', waves: [{ name: 'A', price: 1, capacity: 11, sold: 0 }] }, { key: 'GOLD', name: 'Gold', waves: [{ name: 'A', price: 1, capacity: 1, sold: 0 }] }]
  assert.deepEqual(ticketProblems(forms, seated).map((p) => p.seats), [true, true])
  const standing = { kind: 'standing', capacity: 10, places: {} }
  assert.deepEqual(ticketProblems(forms, standing).map((p) => p.seats), [false, false])
  assert.equal(overCapacity(forms, standing), 2)

  // Seafront Theatre is seated with 220 Standard seats; the film week draft sells all of them.
  const { categories } = await adminEventsApi.get(FILM_WEEK_DRAFT)
  const asForms = categories.map((c) => ({ key: c.key, name: c.name, waves: c.waves.map((w) => ({ ...w })) }))
  const tooMany = asForms.map((c) => ({ ...c, waves: [...c.waves, { name: 'Extra', price: 600, capacity: 1, sold: 0 }] }))
  assert.equal(await code(adminEventsApi.saveCategories(FILM_WEEK_DRAFT, tooMany)), 'venue-seats-exceeded')
  const notThere = [...asForms, { key: 'LAWN', name: 'Lawn', waves: [{ name: 'A', price: 100, capacity: 10, sold: 0 }] }]
  assert.equal(await code(adminEventsApi.saveCategories(FILM_WEEK_DRAFT, notThere)), 'venue-seats-exceeded')
  // Riverfront Stage is standing and holds 1,800.
  const { categories: sunset } = await adminEventsApi.get(SUNSET_BEATS)
  const crowd = [...sunset.map((c) => ({ key: c.key, name: c.name, waves: c.waves.map((w) => ({ ...w })) })), { key: 'EXTRA', name: 'Extra', waves: [{ name: 'A', price: 100, capacity: 1000, sold: 0 }] }]
  assert.equal(await code(adminEventsApi.saveCategories(SUNSET_BEATS, crowd)), 'venue-over-capacity')
})

test('a transferred ticket belongs to whoever holds it now', async () => {
  const ahmed = await usersApi.get('2e7d5c1f-3a8b-4f9c-9d0e-1f2a3b4c5d0b')
  assert.ok(ahmed.tickets.some((k) => k.code === 'HFT-7Q2K-91' && k.holderEmail === 'ahmed.sherif@example.com' && k.holder === 'Ahmed Sherif'))
  const mariam = await usersApi.get('3b8a6f2c-4d9e-4c0f-8a1b-2c3d4e5f6a72')
  const given = mariam.tickets.find((k) => k.code === 'HFT-7Q2K-91')
  assert.ok(given && given.transfers[0].from.email === 'mariam.hassan@example.com')
})

test('analytics: money splits into platform fees and owner proceeds, and every view adds up', async () => {
  const data = await analyticsApi.load()
  const all = presetRange('all', data)
  const s = summary(data, all)
  const events = await adminEventsApi.list()
  // Every published event's sold tickets, plus the Red Sea run sold before it was cancelled.
  const sold = events.filter((e) => e.status !== 'draft').reduce((n, e) => n + e.sold, 0) + 600
  assert.equal(s.tickets, sold)
  assert.ok(Math.abs(s.platformNet + s.ownersDue - (s.transacted - s.refundTotal)) < 0.01)
  assert.ok(Math.abs(s.fees - s.ticketValue * data.serviceFee) < 0.01)
  assert.equal(daily(data, all).reduce((n, d) => n + d.tickets, 0), s.tickets)
  assert.equal(byCategory(data, all).reduce((n, c) => n + c.tickets, 0), s.tickets)
  assert.equal(perEvent(data, all).reduce((n, r) => n + r.tickets, 0), s.tickets)
  const week = presetRange('7', data)
  assert.equal(daily(data, week).length, 7)
  assert.ok(summary(data, week).tickets <= s.tickets)
  // A cancelled event refunds the fee too, so it comes off platform revenue.
  const cancelled = data.refunds.find((r) => r.reason === 'eventCancelled')
  assert.ok(cancelled && cancelled.feeRefunded > 0)
})

test('CSV export quotes commas and quotes, and keeps formulas as text', () => {
  assert.equal(toCsv([['a,b', 'say "hi"', '=SUM(A1)', 3]]), '"a,b","say ""hi""",\'=SUM(A1),3')
})
