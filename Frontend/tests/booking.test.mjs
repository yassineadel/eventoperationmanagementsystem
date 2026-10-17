import test from 'node:test'
import assert from 'node:assert/strict'
import { getBookingCatalogue } from '../src/Components/Booking/catalogue.ts'
import { events } from '../src/Components/Homepage/data/events.ts'
import { HOLD_MS, MAX_TICKETS, bookingStorageKey, categoryRemaining, emptyBooking, readBooking, selectionTotals, transitionBooking, validAttendee, writeBooking } from '../src/Components/Booking/bookingModel.ts'

const now = Date.parse('2026-10-17T12:00:00Z')
const standingId = 'cairo-after-dark'
const seatedId = 'next-perspectives'
const standingItem = (number = 1, categoryId = 'middle') => ({ key: `${categoryId}-${number}`, categoryId })
const seatItem = (seat) => ({ key: seat.id, seatId: seat.id, categoryId: seat.categoryId })
function select(state = emptyBooking(), items = [standingItem()], eventId = standingId, timestamp = now) {
  const result = transitionBooking(state, { type: 'select', eventId, items }, timestamp)
  assert.equal(result.error, undefined)
  return result.state
}
function memory(initial) {
  let value = initial ? JSON.stringify(initial) : null
  return { getItem: () => value, setItem: (_key, next) => { value = next } }
}

test('every sample event has a coherent mode, bilingual categories and explicit sample seat IDs', () => {
  for (const event of events) {
    const catalogue = getBookingCatalogue(event.id)
    assert.equal(catalogue.categories.length, 3)
    for (const category of catalogue.categories) {
      assert.ok(category.name.en && category.name.ar && category.description.en && category.description.ar)
      assert.ok(category.price >= 0 && category.feePercent >= 0)
      if (catalogue.mode === 'seated') assert.equal(category.remaining, catalogue.seats.filter((seat) => seat.categoryId === category.id && seat.status === 'available').length)
    }
    if (catalogue.mode === 'seated') {
      assert.equal(catalogue.seats.length, 240)
      assert.equal(new Set(catalogue.seats.map((seat) => seat.id)).size, 240)
      assert.equal(new Set(catalogue.seats.map((seat) => `${seat.row}-${seat.number}`)).size, 240)
      for (const seat of catalogue.seats) {
        assert.ok(seat.id.startsWith('sample-'))
        assert.equal(catalogue.categories.filter((category) => category.id === seat.categoryId).length, 1)
      }
    }
  }
  assert.equal(getBookingCatalogue('not-an-event'), null)
})

test('reservation starts on first selection and amendments never extend the original deadline', () => {
  const first = select()
  assert.equal(first.expiresAt, now + HOLD_MS)
  const second = select(first, [standingItem(), standingItem(2)], standingId, now + 30_000)
  assert.equal(second.expiresAt, first.expiresAt)
  const removed = transitionBooking(second, { type: 'remove', key: standingItem(2).key }, now + 60_000).state
  assert.equal(removed.items.length, 1)
  assert.equal(removed.expiresAt, first.expiresAt)
  assert.equal(first.items.length, 1, 'state is not mutated')
  const empty = transitionBooking(removed, { type: 'remove', key: standingItem().key }, now + 90_000).state
  assert.equal(empty.expiresAt, null)
  assert.equal(select(empty, [standingItem()], standingId, now + 100_000).expiresAt, now + 100_000 + HOLD_MS)
})

test('seat selection rejects held, sold, foreign, mismatched and duplicate seats', () => {
  const catalogue = getBookingCatalogue(seatedId)
  const available = catalogue.seats.find((seat) => seat.status === 'available')
  const chosen = select(emptyBooking(), [seatItem(available)], seatedId)
  assert.equal(chosen.items[0].seatId, available.id)
  for (const seat of catalogue.seats.filter((seat) => seat.status !== 'available').slice(0, 5)) assert.equal(transitionBooking(emptyBooking(), { type: 'select', eventId: seatedId, items: [seatItem(seat)] }, now).error, 'unavailable')
  assert.equal(transitionBooking(emptyBooking(), { type: 'select', eventId: seatedId, items: [seatItem(available), seatItem(available)] }, now).error, 'invalid')
  assert.equal(transitionBooking(emptyBooking(), { type: 'select', eventId: seatedId, items: [{ ...seatItem(available), categoryId: 'rear' }] }, now).error, 'unavailable')
  assert.equal(transitionBooking(emptyBooking(), { type: 'select', eventId: seatedId, items: [{ key: 'foreign', seatId: 'foreign', categoryId: 'front' }] }, now).error, 'unavailable')
})

test('standing quantities cannot exceed availability or include sold-out or invalid categories', () => {
  assert.equal(transitionBooking(emptyBooking(), { type: 'select', eventId: standingId, items: [standingItem(1, 'rear')] }, now).error, 'unavailable')
  assert.equal(transitionBooking(emptyBooking(), { type: 'select', eventId: standingId, items: [standingItem(1, 'unknown')] }, now).error, 'invalid')
  const state = emptyBooking()
  state.purchases[standingId] = { quantity: 0, seats: [], categories: { middle: 54 } }
  assert.equal(categoryRemaining(state, standingId, 'middle'), 0)
  assert.equal(transitionBooking(state, { type: 'select', eventId: standingId, items: [standingItem()] }, now).error, 'unavailable')
})

test('eight-ticket cap includes previous completed sample checkouts, not just the current cart', () => {
  const items = Array.from({ length: 6 }, (_, index) => standingItem(index + 1))
  const first = select(emptyBooking(), items)
  const complete = transitionBooking(first, { type: 'complete', reference: 'DEMO-1234ABCD' }, now + 1000)
  assert.equal(complete.error, undefined)
  assert.equal(complete.state.purchases[standingId].quantity, 6)
  const next = transitionBooking(complete.state, { type: 'select', eventId: standingId, items: [standingItem(), standingItem(2), standingItem(3)] }, now + 2000)
  assert.equal(next.error, 'limit')
  assert.equal(select(complete.state, [standingItem(), standingItem(2)]).items.length, 2)
  assert.equal(transitionBooking(emptyBooking(), { type: 'select', eventId: standingId, items: Array.from({ length: MAX_TICKETS + 1 }, (_, index) => standingItem(index + 1)) }, now).error, 'limit')
})

test('expiration releases the entire selection and refuses stale completion at the exact boundary', () => {
  const state = select()
  assert.equal(transitionBooking(state, { type: 'expire' }, state.expiresAt - 1).state, state)
  const expired = transitionBooking(state, { type: 'complete', reference: 'DEMO-1234ABCD' }, state.expiresAt)
  assert.equal(expired.error, 'expired')
  assert.equal(expired.state.items.length, 0)
  assert.equal(expired.state.receipt, null)
  assert.equal(expired.state.expired, true)
  const restarted = transitionBooking(expired.state, { type: 'reset', eventId: standingId }, state.expiresAt).state
  assert.equal(select(restarted, [standingItem()], standingId, state.expiresAt).expiresAt, state.expiresAt + HOLD_MS)
})

test('switching events requires an explicit reset and unavailable or past events cannot be selected', () => {
  const state = select()
  assert.equal(transitionBooking(state, { type: 'select', eventId: 'coastal-weekender', items: [standingItem()] }, now).error, 'replace')
  const reset = transitionBooking(state, { type: 'reset', eventId: 'coastal-weekender' }, now).state
  assert.equal(select(reset, [standingItem()], 'coastal-weekender').eventId, 'coastal-weekender')
  for (const eventId of ['creative-canvas', 'nile-nights']) assert.equal(transitionBooking(emptyBooking(), { type: 'select', eventId, items: [standingItem()] }, now).error, 'unavailable')
  assert.equal(transitionBooking(emptyBooking(), { type: 'select', eventId: standingId, items: [standingItem()] }, Date.parse('2027-01-01')).error, 'unavailable')
})

test('itemised totals derive prices and category fees from catalogue; free checkout stays free', () => {
  const items = [standingItem(1, 'front'), standingItem()]
  const totals = selectionTotals(standingId, items)
  assert.equal(totals.subtotal, 560 + 350)
  assert.equal(totals.fees, 56 + 28)
  assert.equal(totals.total, 994)
  assert.equal(selectionTotals('coastal-weekender', items).total, 0)
  assert.equal(selectionTotals(standingId, [{ ...standingItem(), price: 1, fee: 0 }]).total, 378)
})

test('completion consumes sample inventory once; duplicate completion and reusing a sold seat fail', () => {
  const seat = getBookingCatalogue(seatedId).seats.find((seat) => seat.status === 'available')
  const selected = select(emptyBooking(), [seatItem(seat)], seatedId)
  const before = categoryRemaining(selected, seatedId, seat.categoryId)
  const completed = transitionBooking(selected, { type: 'complete', reference: 'DEMO-1234ABCD' }, now + 1000).state
  assert.equal(completed.receipt.quantity, 1)
  assert.equal(completed.receipt.total, selectionTotals(seatedId, selected.items).total)
  assert.equal(categoryRemaining(completed, seatedId, seat.categoryId), before - 1)
  assert.equal(transitionBooking(completed, { type: 'complete', reference: 'DEMO-5678ABCD' }, now + 2000).error, 'empty')
  assert.equal(transitionBooking(completed, { type: 'select', eventId: seatedId, items: [seatItem(seat)] }, now + 2000).error, 'unavailable')
  assert.equal(completed.purchases[seatedId].quantity, 1)
})

test('decline, timeout and abandoning a selection can release inventory without issuing a sample receipt', () => {
  const state = select()
  const released = transitionBooking(state, { type: 'release' }, now + 1000).state
  assert.equal(released.items.length, 0)
  assert.equal(released.expiresAt, null)
  assert.equal(released.receipt, null)
  assert.deepEqual(released.purchases, {})
  assert.equal(categoryRemaining(released, standingId, 'middle'), categoryRemaining(emptyBooking(), standingId, 'middle'))
})

test('session reload preserves the original hold deadline and expires old or corrupt holds safely', () => {
  const state = select()
  const storage = memory()
  assert.equal(writeBooking(state, storage), true)
  const restored = readBooking(storage, now + 1000)
  assert.equal(restored.expiresAt, state.expiresAt)
  assert.equal(restored.items.length, 1)
  const expired = readBooking(storage, state.expiresAt)
  assert.equal(expired.expired, true)
  assert.equal(expired.items.length, 0)
  assert.deepEqual(readBooking({ getItem: () => '{broken' }, now), emptyBooking())
  assert.equal(readBooking(memory({ ...state, expiresAt: now + HOLD_MS * 2 }), now).items.length, 0)
  assert.equal(readBooking(memory({ ...state, items: [{ key: 'bad', categoryId: 'middle' }] }), now).items.length, 0)
  const blocked = { getItem() { throw Error('Blocked') }, setItem() { throw Error('Quota') } }
  assert.deepEqual(readBooking(blocked, now), emptyBooking())
  assert.equal(writeBooking(state, blocked), false)
})

test('storage retains only supported booking fields and excludes attendee, contact and payment data', () => {
  const state = select()
  state.items[0].name = 'never-store-attendee'
  state.payment = 'never-store-payment'
  state.email = 'never-store-email'
  state.purchases[standingId] = { quantity: 1, seats: [], categories: { middle: 1, secret: 'never-store-secret' }, name: 'never-store-purchase' }
  const storage = memory()
  writeBooking(state, storage)
  assert.doesNotMatch(storage.getItem(bookingStorageKey), /never-store|payment|email|name|secret/)
  assert.equal(readBooking(storage, now).items.length, 1)
})

test('sample receipts and accumulated limits survive reload; attendee names accept English and Arabic', () => {
  const state = transitionBooking(select(), { type: 'complete', reference: 'DEMO-1234ABCD' }, now + 1000).state
  const storage = memory()
  writeBooking(state, storage)
  const restored = readBooking(storage, now + 2000)
  assert.deepEqual(restored.receipt, state.receipt)
  assert.equal(restored.purchases[standingId].quantity, 1)
  for (const patch of [{ reference: ['DEMO-1234ABCD'] }, { total: Number.MAX_VALUE }, { quantity: 9 }, { total: -1 }]) {
    assert.equal(readBooking(memory({ ...state, receipt: { ...state.receipt, ...patch } }), now + 2000).receipt, null)
  }
  assert.equal(validAttendee('Youssef Hassan'), true)
  assert.equal(validAttendee('يوسف حسن'), true)
  for (const name of ['', ' ', 'A', 'x'.repeat(101)]) assert.equal(validAttendee(name), false)
})
