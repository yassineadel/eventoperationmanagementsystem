import test from 'node:test'
import assert from 'node:assert/strict'
import { getBookingCatalogue } from '../src/Components/Booking/catalogue.ts'
import { selectionTotals } from '../src/Components/Booking/bookingModel.ts'
import {
  completeSampleOrder, createSampleWallet, qrPayload, readWallet, refundQuote,
  requestSampleRefund, resendSampleTicket, sampleOwner, ticketEligibility, ticketIsPast,
  transferSampleTicket, walletStorageKey, writeWallet,
} from '../src/Components/Tickets/ticketsModel.ts'

const now = Date.parse('2026-10-20T12:00:00Z')
const reference = 'DEMO-1234ABCD'
const standingId = 'cairo-after-dark'
const standingItems = () => [{ key: 'middle-1', categoryId: 'middle' }, { key: 'front-1', categoryId: 'front' }]
function memory(initial) {
  let value = initial === undefined ? null : JSON.stringify(initial)
  return { getItem: () => value, setItem: (_key, next) => { value = next } }
}
function purchase(state = createSampleWallet(), items = standingItems(), eventId = standingId, ref = reference, paymentMethod) {
  const names = Object.fromEntries(items.map((item, index) => [item.key, index ? 'يوسف خالد' : '  Test Attendee  ']))
  const receipt = { reference: ref, eventId, quantity: items.length, total: selectionTotals(eventId, items).total, ...(paymentMethod === undefined ? {} : { paymentMethod }) }
  const result = completeSampleOrder(state, receipt, items, names, now)
  assert.equal(result.ok, true)
  return { ...result, items, names, receipt }
}

test('sample wallet contains coherent bilingual tickets, with past grouping at event end', () => {
  const wallet = createSampleWallet()
  assert.ok(wallet.orders.length > 0 && wallet.tickets.length > 0)
  assert.equal(new Set(wallet.tickets.map((ticket) => ticket.id)).size, wallet.tickets.length)
  for (const ticket of wallet.tickets) {
    assert.ok(ticket.event.title.en && ticket.event.title.ar && ticket.categoryName.en && ticket.categoryName.ar)
    assert.ok(wallet.orders.some((order) => order.reference === ticket.orderRef && order.ticketIds.includes(ticket.id)))
    assert.equal(Math.round((ticket.price + ticket.serviceFee) * 100), Math.round(ticket.paidTotal * 100))
    assert.ok(Date.parse(ticket.endsAt) > Date.parse(ticket.event.date))
  }
  const active = wallet.tickets.find((ticket) => ticket.status === 'active')
  const start = Date.parse(active.event.date)
  const end = Date.parse(active.endsAt)
  assert.equal(ticketIsPast(active, start), false)
  assert.equal(ticketIsPast(active, end - 1), false)
  assert.equal(ticketIsPast(active, end), true)
  assert.ok(qrPayload(active, end - 1))
  assert.equal(qrPayload(active, end), null)
  assert.equal(ticketEligibility(active, 'transfer', start).reason, 'past')
})

test('completed checkout snapshots per-ticket names, selections and totals exactly once', () => {
  const before = createSampleWallet()
  const result = purchase(before)
  const order = result.state.orders.find((item) => item.reference === reference)
  const tickets = order.ticketIds.map((id) => result.state.tickets.find((ticket) => ticket.id === id))
  assert.equal(result.orderRef, reference)
  assert.equal(result.state.orders.length, before.orders.length + 1)
  assert.equal(result.state.tickets.length, before.tickets.length + 2)
  assert.equal(order.subtotal, 910)
  assert.equal(order.fees, 84)
  assert.equal(order.total, 994)
  assert.deepEqual(tickets.map((ticket) => ticket.attendeeName), ['Test Attendee', 'يوسف خالد'])
  assert.deepEqual(tickets.map((ticket) => ticket.categoryId), ['middle', 'front'])
  result.names['middle-1'] = 'Changed after checkout'
  result.items[0].categoryId = 'rear'
  assert.equal(tickets[0].attendeeName, 'Test Attendee')
  assert.equal(tickets[0].categoryId, 'middle')
  assert.equal(before.orders.some((item) => item.reference === reference), false)
  const repeated = completeSampleOrder(result.state, result.receipt, standingItems(), { 'middle-1': 'Replacement Name', 'front-1': 'Other Name' }, now + 1)
  assert.equal(repeated.ok, true)
  assert.equal(repeated.state, result.state)
  assert.equal(repeated.state.tickets.length, before.tickets.length + 2)
  const conflict = completeSampleOrder(result.state, { ...result.receipt, eventId: 'next-perspectives' }, standingItems(), {}, now)
  assert.equal(conflict.ok, false)
  assert.equal(conflict.error, 'duplicate')
  assert.equal(conflict.state, result.state)
})

test('seated checkout preserves section, row and seat, and rejects invalid order inputs', () => {
  const state = createSampleWallet()
  const catalogue = getBookingCatalogue('next-perspectives')
  const seat = catalogue.seats.find((item) => item.status === 'available' && item.number > 3)
  const items = [{ key: seat.id, categoryId: seat.categoryId, seatId: seat.id }]
  const result = purchase(state, items, 'next-perspectives')
  const ticket = result.state.tickets.find((item) => item.orderRef === reference)
  assert.deepEqual(ticket.seat, { section: seat.section, row: seat.row, number: seat.number })
  const invalidInputs = [
    [{ ...result.receipt, eventId: 'missing-event' }, items, result.names],
    [{ ...result.receipt, reference: 'REAL-TICKET' }, items, result.names],
    [{ ...result.receipt, quantity: 2 }, items, result.names],
    [{ ...result.receipt, total: 1 }, items, result.names],
    [result.receipt, [], result.names],
    [result.receipt, items, { [seat.id]: ' ' }],
    [result.receipt, [{ ...items[0], seatId: 'foreign-seat' }], result.names],
  ]
  for (const [receipt, selection, names] of invalidInputs) {
    const invalid = completeSampleOrder(state, receipt, selection, names, now)
    assert.equal(invalid.ok, false)
    assert.equal(invalid.state, state)
  }
})

test('each sample payment method is recorded and restored without changing ticket prices or fees', () => {
  for (const paymentMethod of ['card', 'wallet', 'bank-transfer', 'free']) {
    const eventId = paymentMethod === 'free' ? 'coastal-weekender' : standingId
    const result = purchase(createSampleWallet(), standingItems(), eventId, reference, paymentMethod)
    const order = result.state.orders.find((item) => item.reference === reference)
    assert.equal(order.paymentMethod, paymentMethod)
    assert.equal(order.total, paymentMethod === 'free' ? 0 : 994)
    assert.equal(order.fees, paymentMethod === 'free' ? 0 : 84)
    const storage = memory()
    assert.equal(writeWallet(result.state, storage), true)
    assert.equal(JSON.parse(storage.getItem(walletStorageKey)).orders[0].paymentMethod, paymentMethod)
    assert.deepEqual(readWallet(storage).orders.find((item) => item.reference === reference), order)
  }
})

test('invalid methods and paid/free mismatches cannot create an order or tickets', () => {
  for (const eventId of [standingId, 'coastal-weekender']) {
    const state = createSampleWallet()
    const items = standingItems()
    const names = Object.fromEntries(items.map((item) => [item.key, 'Sample Attendee']))
    const receipt = { reference, eventId, quantity: items.length, total: selectionTotals(eventId, items).total }
    const invalidMethods = ['cash', 'CARD', '', null, 123, { cardNumber: 'NEVER-STORE-CARD' }, ...(receipt.total === 0 ? ['card', 'wallet', 'bank-transfer'] : ['free'])]
    for (const paymentMethod of invalidMethods) {
      const result = completeSampleOrder(state, { ...receipt, paymentMethod }, items, names, now)
      assert.equal(result.ok, false)
      assert.equal(result.error, 'not-found')
      assert.equal(result.state, state)
    }
  }
})

test('repeated completion preserves the original method and cannot change it or duplicate tickets', () => {
  const result = purchase(createSampleWallet(), standingItems(), standingId, reference, 'wallet')
  const order = result.state.orders.find((item) => item.reference === reference)
  const repeated = completeSampleOrder(result.state, result.receipt, standingItems(), { 'middle-1': 'Changed Name', 'front-1': 'Other Name' }, now + 1)
  assert.equal(repeated.ok, true)
  assert.equal(repeated.state, result.state)
  for (const paymentMethod of ['card', 'bank-transfer', undefined]) {
    const changed = completeSampleOrder(result.state, { ...result.receipt, paymentMethod }, standingItems(), result.names, now + 1)
    assert.equal(changed.ok, false)
    assert.equal(changed.error, 'duplicate')
    assert.equal(changed.state, result.state)
  }
  assert.equal(order.paymentMethod, 'wallet')
  assert.equal(result.state.tickets.filter((ticket) => ticket.orderRef === reference).length, 2)
})

test('legacy or malformed stored methods recover the order without trusting payment metadata', () => {
  for (const eventId of [standingId, 'coastal-weekender']) {
    const result = purchase(createSampleWallet(), standingItems(), eventId, reference, eventId === standingId ? 'card' : 'free')
    const storage = memory()
    writeWallet(result.state, storage)
    const raw = JSON.parse(storage.getItem(walletStorageKey))
    const expectedMethod = eventId === standingId ? undefined : 'free'
    for (const method of [undefined, 'unknown-method', { cardNumber: 'NEVER-TRUST-CARD' }, eventId === standingId ? 'free' : 'card']) {
      const modified = structuredClone(raw)
      if (method === undefined) delete modified.orders[0].paymentMethod
      else modified.orders[0].paymentMethod = method
      const restored = readWallet(memory(modified))
      const order = restored.orders.find((item) => item.reference === reference)
      assert.ok(order, 'the valid order remains available')
      assert.equal(order.paymentMethod, expectedMethod)
      assert.equal(order.total, result.receipt.total)
      assert.equal(restored.tickets.filter((ticket) => ticket.orderRef === reference).length, 2)
      assert.doesNotMatch(JSON.stringify(order), /NEVER-TRUST-CARD|cardNumber/)
    }
  }
})

test('refund request accepts the exact seven-day cutoff and rejects the next millisecond', () => {
  const state = createSampleWallet()
  const ticket = state.tickets.find((item) => item.status === 'active' && item.price > 0)
  const cutoff = Date.parse(ticket.event.date) - 7 * 86_400_000
  assert.equal(refundQuote(ticket, cutoff).eligible, true)
  assert.equal(refundQuote(ticket, cutoff).deadline, new Date(cutoff).toISOString())
  assert.equal(refundQuote(ticket, cutoff + 1).eligible, false)
  assert.equal(refundQuote(ticket, cutoff + 1).reason, 'refund-deadline')
  assert.equal(requestSampleRefund(state, ticket.id, true, cutoff).ok, true)
  const late = requestSampleRefund(state, ticket.id, true, cutoff + 1)
  assert.equal(late.ok, false)
  assert.equal(late.error, 'refund-deadline')
  assert.equal(late.state, state)
})

test('refund quote subtracts the original category fee once, with exact currency arithmetic', () => {
  const state = createSampleWallet()
  const ticket = state.tickets.find((item) => item.event.id === standingId)
  const quote = refundQuote(ticket, now)
  assert.equal(quote.paidTotal, 378)
  assert.equal(quote.fee, 28)
  assert.equal(quote.amount, 350)
  const fractional = { ...ticket, price: 123.45, serviceFee: 10.13, paidTotal: 133.58 }
  assert.equal(refundQuote(fractional, now).amount, 123.45)
  assert.equal(refundQuote({ ...ticket, transferCount: 1 }, now).reason, 'transferred-before')
  assert.equal(refundQuote(state.tickets.find((item) => item.paidTotal === 0), now).reason, 'free')
})

test('refund submission requires acknowledgement, retains the QR, and blocks duplicate requests or transfers', () => {
  const state = createSampleWallet()
  const ticket = state.tickets.find((item) => item.event.id === standingId)
  assert.equal(requestSampleRefund(state, ticket.id, false, now).error, 'confirmation')
  const oldCode = qrPayload(ticket, now)
  const submitted = requestSampleRefund(state, ticket.id, true, now)
  assert.equal(submitted.ok, true)
  const changed = submitted.state.tickets.find((item) => item.id === ticket.id)
  assert.equal(changed.status, 'refund-pending')
  assert.equal(changed.refund.amount, 350)
  assert.equal(changed.refund.fee, 28)
  assert.equal(qrPayload(changed, now), oldCode)
  assert.equal(requestSampleRefund(submitted.state, ticket.id, true, now + 1).error, 'refund-pending')
  assert.equal(transferSampleTicket(submitted.state, ticket.id, 'nour@example.com', true, now + 1).error, 'refund-pending')
  assert.equal(ticket.status, 'active')
  assert.equal(ticket.refund, null)
})

test('transfers validate known verified recipients, self-transfer, confirmation and transfer cap', () => {
  const state = createSampleWallet()
  const ticket = state.tickets.find((item) => item.event.id === standingId)
  const cases = [
    ['bad-address', true, 'recipient-invalid'],
    ['missing@example.com', true, 'recipient-missing'],
    ['omar@example.com', true, 'recipient-unverified'],
    [` ${sampleOwner.email.toUpperCase()} `, true, 'recipient-self'],
    ['nour@example.com', false, 'confirmation'],
  ]
  for (const [email, confirmed, reason] of cases) {
    const rejected = transferSampleTicket(state, ticket.id, email, confirmed, now)
    assert.equal(rejected.error, reason)
    assert.equal(rejected.state, state)
  }
  const capped = { ...state, tickets: state.tickets.map((item) => item.id === ticket.id ? { ...item, transferCount: 3 } : item) }
  assert.equal(transferSampleTicket(capped, ticket.id, 'nour@example.com', true, now).error, 'transfer-limit')
})

test('successful transfer invalidates the sender code, records history and cannot be repeated', () => {
  const state = createSampleWallet()
  const ticket = state.tickets.find((item) => item.event.id === standingId)
  const oldCode = qrPayload(ticket, now)
  assert.ok(oldCode?.startsWith('HAFLETNA-DEMO:NO-ENTRY:'))
  const result = transferSampleTicket(state, ticket.id, '  NOUR@EXAMPLE.COM  ', true, now)
  assert.equal(result.ok, true)
  const sent = result.state.tickets.find((item) => item.id === ticket.id)
  assert.equal(sent.status, 'transferred')
  assert.equal(sent.transferCount, 1)
  assert.equal(sent.codeVersion, ticket.codeVersion + 1)
  assert.equal(sent.transfers[0].recipientEmail, 'nour@example.com')
  assert.equal(qrPayload(sent, now), null)
  assert.equal(transferSampleTicket(result.state, ticket.id, 'salma@example.com', true, now + 1).error, 'transferred')
  assert.equal(requestSampleRefund(result.state, ticket.id, true, now + 1).error, 'transferred')
  assert.equal(qrPayload(ticket, now), oldCode, 'the previous state was not mutated')
})

test('unusable and cancelled tickets expose no QR or management actions', () => {
  const ticket = createSampleWallet().tickets.find((item) => item.event.id === standingId)
  for (const status of ['used', 'refunded', 'transferred']) {
    const blocked = { ...ticket, status }
    assert.equal(qrPayload(blocked, now), null)
    assert.equal(ticketEligibility(blocked, 'transfer', now).allowed, false)
    assert.equal(ticketEligibility(blocked, 'refund', now).allowed, false)
  }
  const cancelled = { ...ticket, event: { ...ticket.event, status: 'cancelled' } }
  assert.equal(qrPayload(cancelled, now), null)
  assert.equal(ticketEligibility(cancelled, 'transfer', now).reason, 'cancelled')
  assert.equal(ticketEligibility(cancelled, 'refund', now).reason, 'cancelled')
})

test('email preview keeps the same code and limits resends to three in a rolling hour', () => {
  let state = createSampleWallet()
  const ticket = state.tickets.find((item) => item.event.id === standingId)
  const payload = qrPayload(ticket, now)
  const quantity = state.tickets.length
  for (let index = 0; index < 3; index++) {
    const result = resendSampleTicket(state, ticket.id, now + index)
    assert.equal(result.ok, true)
    state = result.state
    const updated = state.tickets.find((item) => item.id === ticket.id)
    assert.equal(qrPayload(updated, now), payload)
    assert.equal(updated.resendCount, index + 1)
    assert.equal(state.tickets.length, quantity)
  }
  assert.equal(resendSampleTicket(state, ticket.id, now + 3).error, 'cooldown')
  assert.equal(resendSampleTicket(state, ticket.id, now + 3_600_000).ok, true)
})

test('unknown ticket identifiers leave the wallet unchanged', () => {
  const state = createSampleWallet()
  for (const result of [
    transferSampleTicket(state, 'missing-ticket', 'nour@example.com', true, now),
    requestSampleRefund(state, 'missing-ticket', true, now),
    resendSampleTicket(state, 'missing-ticket', now),
  ]) {
    assert.equal(result.ok, false)
    assert.equal(result.error, 'not-found')
    assert.equal(result.state, state)
  }
})

test('wallet reload preserves orders and lifecycle while clearing entered names and personal data', () => {
  let state = purchase().state
  const order = state.orders.find((item) => item.reference === reference)
  const [first, second] = order.ticketIds
  state = transferSampleTicket(state, first, 'nour@example.com', true, now + 1).state
  state = requestSampleRefund(state, second, true, now + 2).state
  const storage = memory()
  assert.equal(writeWallet(state, storage), true)
  const restored = readWallet(storage)
  assert.deepEqual(restored.orders.find((item) => item.reference === reference), order)
  const transferred = restored.tickets.find((item) => item.id === first)
  const pending = restored.tickets.find((item) => item.id === second)
  assert.equal(transferred.status, 'transferred')
  assert.equal(qrPayload(transferred, now), null)
  assert.equal(transferred.transfers[0].recipientId, 'sample-nour')
  assert.equal(pending.status, 'refund-pending')
  assert.equal(pending.refund.amount, state.tickets.find((item) => item.id === second).price)
  assert.ok(qrPayload(pending, now))
  assert.doesNotMatch(storage.getItem(walletStorageKey), /Test Attendee|يوسف خالد|nour@example\.com|ownerEmail|attendeeName/)
  assert.notEqual(pending.attendeeName, 'يوسف خالد')
})

test('persisted fields are explicitly whitelisted, including nested refund and transfer metadata', () => {
  const state = purchase(createSampleWallet(), standingItems(), standingId, reference, 'wallet').state
  const ticket = state.tickets.find((item) => item.orderRef === reference)
  const pending = requestSampleRefund(state, ticket.id, true, now).state
  const storedTicket = pending.tickets.find((item) => item.id === ticket.id)
  storedTicket.ownerName = 'NEVER-STORE-OWNER'
  storedTicket.ownerEmail = 'NEVER-STORE-EMAIL'
  storedTicket.payment = 'NEVER-STORE-PAYMENT'
  storedTicket.refund.reason = 'NEVER-STORE-REFUND-EXTRA'
  const storedOrder = pending.orders.find((item) => item.reference === reference)
  storedOrder.email = 'NEVER-STORE-ORDER'
  storedOrder.payment = { cardNumber: 'NEVER-STORE-CARD', cvv: 'NEVER-STORE-CVV' }
  storedOrder.cardNumber = 'NEVER-STORE-NUMBER'
  storedOrder.walletNumber = 'NEVER-STORE-WALLET'
  storedOrder.bankAccount = 'NEVER-STORE-BANK'
  pending.secret = 'NEVER-STORE-ROOT'
  const storage = memory()
  assert.equal(writeWallet(pending, storage), true)
  const persisted = storage.getItem(walletStorageKey)
  assert.equal(JSON.parse(persisted).orders[0].paymentMethod, 'wallet')
  assert.doesNotMatch(persisted, /NEVER-STORE|Test Attendee|يوسف خالد|"(?:payment|cardNumber|cvv|walletNumber|bankAccount|ownerName|ownerEmail|attendeeName|reason|secret)"\s*:/)
})

test('malformed or unavailable wallet storage recovers without trusting invalid lifecycle records', () => {
  const defaults = createSampleWallet()
  assert.deepEqual(readWallet({ getItem: () => '{broken' }), defaults)
  assert.deepEqual(readWallet(memory({ version: 99, orders: [], lifecycle: [] })), defaults)
  const blocked = { getItem() { throw Error('Blocked') }, setItem() { throw Error('Quota') } }
  assert.deepEqual(readWallet(blocked), defaults)
  assert.equal(writeWallet(defaults, blocked), false)
  assert.equal(writeWallet(defaults, null), false)
  const storage = memory()
  writeWallet(defaults, storage)
  const raw = JSON.parse(storage.getItem(walletStorageKey))
  const id = defaults.tickets[0].id
  for (const patch of [
    { status: 'admitted-without-checking' },
    { transferCount: 4 },
    { codeVersion: 0 },
    { status: 'refund-pending', refund: null },
    { status: 'transferred', transferCount: 1, codeVersion: 2, transfers: [{ at: new Date(now).toISOString(), recipientId: 'unknown-account' }] },
  ]) {
    const tampered = structuredClone(raw)
    tampered.lifecycle.find((item) => item.id === id).status = defaults.tickets[0].status
    Object.assign(tampered.lifecycle.find((item) => item.id === id), patch)
    const restored = readWallet(memory(tampered)).tickets.find((item) => item.id === id)
    assert.deepEqual(restored, defaults.tickets[0])
  }
})
