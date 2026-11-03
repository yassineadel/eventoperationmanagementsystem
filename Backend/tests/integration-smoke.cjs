// Runs the real application against a newly created, disposable local database,
// a dedicated Redis process and a local SMTP capture. Never uses the user's data.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const net = require('node:net')
const { spawn, spawnSync } = require('node:child_process')
const { randomUUID, randomBytes } = require('node:crypto')
const root = path.resolve(__dirname, '../..')
const backend = path.join(root, 'Backend')
const runtime = path.join(backend, 'node_modules/.hafletna-qa')
fs.mkdirSync(runtime, { recursive: true })
const settings = require('dotenv').parse(fs.readFileSync(path.join(backend, '.env')))
const originalUrl = new URL(settings.DATABASE_URL)
if (!['localhost', '127.0.0.1'].includes(originalUrl.hostname)) throw Error('Local database required')
const databaseName = `hafletna_qa_${Date.now()}`
const databaseUrl = new URL(originalUrl); databaseUrl.pathname = `/${databaseName}`; databaseUrl.search = '?schema=public'
const adminUrl = new URL(originalUrl); adminUrl.pathname = '/postgres'
Object.assign(process.env, settings, {
  NODE_ENV: 'test', PORT: '3002', FRONTEND_URL: 'http://127.0.0.1:5183', DATABASE_URL: databaseUrl.href,
  REDIS_URL: 'redis://127.0.0.1:6381', JWT_SECRET: randomBytes(48).toString('hex'), PAYMENT_PROVIDER: 'simulator',
  MAIL_USER: 'qa-sender@example.test', MAIL_PASS: 'local-test-only', MAIL_HOST: '127.0.0.1', MAIL_PORT: '1026', MAIL_AUTH: 'false', MAIL_SECURE: 'false',
  GOOGLE_CLIENT_ID: 'local-qa-client', GOOGLE_CLIENT_SECRET: 'local-qa-secret', GOOGLE_CALLBACK_URL: 'http://127.0.0.1:3002/api/auth/google/callback',
})
require('ts-node/register')
const { PrismaClient } = require('@prisma/client')
const admin = new PrismaClient({ datasources: { db: { url: adminUrl.href } } })
let prisma, redis, redisProcess, smtp, server, databaseCreated = false
const results = [], messages = []
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
async function waitFor(test) { for (let i = 0; i < 60; i++) { if (await test()) return; await pause(100) } throw Error('Timed out waiting for local service') }
function command(args) {
  const result = spawnSync(process.execPath, args, { cwd: backend, env: process.env, encoding: 'utf8', windowsHide: true })
  if (result.status !== 0) throw Error(`Setup command failed: ${result.stderr || result.stdout}`)
}
async function check(name, fn) {
  try { await fn(); results.push({ name, status: 'passed' }); console.log(`PASS ${name}`) }
  catch (error) { results.push({ name, status: 'failed', error: error.message }); console.log(`FAIL ${name}: ${error.message}`) }
  fs.writeFileSync(path.join(runtime, 'results.json'), JSON.stringify(results, null, 2))
}
function client(ip) {
  let cookie = ''
  return async (method, route, body, expected = 200) => {
    const response = await fetch(`http://127.0.0.1:3002${route}`, { method, redirect: 'manual', signal: AbortSignal.timeout(15000),
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ip, ...(cookie ? { Cookie: cookie } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
    const raw = await response.text(); let value
    try { value = JSON.parse(raw) } catch { value = raw }
    assert.equal(response.status, expected, `${method} ${route}: ${response.status} ${JSON.stringify(value).slice(0, 250)}`)
    if (response.headers.get('set-cookie')) cookie = response.headers.get('set-cookie').split(';')[0]
    return value
  }
}
async function setup() {
  // Do not accidentally reuse another project's local Redis or API instance.
  for (const port of [3002, 6381, 1026]) {
    await new Promise((resolve, reject) => {
      const probe = net.createServer()
      probe.once('error', reject)
      probe.listen(port, '127.0.0.1', () => probe.close(resolve))
    })
  }
  await admin.$executeRawUnsafe(`CREATE DATABASE "${databaseName}"`); databaseCreated = true
  command(['node_modules/prisma/build/index.js', 'migrate', 'deploy'])
  command(['node_modules/ts-node/dist/bin.js', 'src/scripts/seed-venues.ts'])
  command(['node_modules/ts-node/dist/bin.js', 'src/scripts/seed-events.ts'])
  const executable = path.join(root, 'Frontend/node_modules/.hafletna-local/redis/Redis-8.10.2-Windows-x64-msys2/redis-server.exe')
  assert.ok(fs.existsSync(executable), 'Local Redis executable missing')
  redisProcess = spawn(executable, ['--bind', '127.0.0.1', '--protected-mode', 'yes', '--port', '6381', '--save', '', '--appendonly', 'no'], { cwd: runtime, windowsHide: true, stdio: 'ignore' })
  await waitFor(async () => { try { const socket = net.createConnection(6381, '127.0.0.1'); await new Promise((resolve, reject) => { socket.once('connect', resolve); socket.once('error', reject) }); socket.destroy(); return true } catch { return false } })
  smtp = net.createServer((socket) => {
    let buffer = '', data = false, mail = ''
    socket.setEncoding('utf8'); socket.write('220 localhost QA SMTP\r\n')
    socket.on('data', (chunk) => {
      buffer += chunk
      while (buffer.includes('\r\n')) {
        const end = buffer.indexOf('\r\n'), line = buffer.slice(0, end); buffer = buffer.slice(end + 2)
        if (data) { if (line === '.') { messages.push(mail); mail = ''; data = false; socket.write('250 Accepted\r\n') } else mail += line + '\r\n'; continue }
        if (/^(EHLO|HELO)/i.test(line)) socket.write('250 localhost\r\n')
        else if (/^DATA/i.test(line)) { data = true; socket.write('354 Send message\r\n') }
        else if (/^QUIT/i.test(line)) { socket.end('221 Bye\r\n') }
        else socket.write('250 OK\r\n')
      }
    })
  })
  await new Promise((resolve) => smtp.listen(1026, '127.0.0.1', resolve))
  const app = require('../src/app').default
  prisma = require('../src/config/db').default; redis = require('../src/config/redis').default
  require('../src/modules/platform/email.worker').startEmailWorker()
  server = await new Promise((resolve) => { const handle = app.listen(3002, '127.0.0.1', () => resolve(handle)) })
  fs.writeFileSync(path.join(runtime, 'state.json'), JSON.stringify({ databaseName, port: 3002, frontend: 5183 }))
}
async function run() {
  const a = client('127.0.1.1'), b = client('127.0.1.2'), anonymous = client('127.0.1.3')
  const email = 'qa-member@example.test', password = 'HafletnaQa2026!A', changed = 'HafletnaQa2026!B'
  await check('Health, payment simulator and guest access protection', async () => {
    assert.equal((await anonymous('GET', '/health')).status, 'ok')
    assert.equal((await anonymous('GET', '/api/payments/config')).provider, 'simulator')
    await anonymous('GET', '/api/auth/me', undefined, 401); await anonymous('GET', '/api/tickets', undefined, 401)
  })
  await check('Registration, SMTP delivery, verification and login', async () => {
    await a('POST', '/api/auth/register', { fullName: 'QA Member', email, password, phone: '01012345678' }, 201)
    await waitFor(() => messages.some((mail) => mail.includes(email)))
    const code = await redis.get(`verify:${email}`); assert.match(code, /^\d{6}$/)
    await a('POST', '/api/auth/verify-email', { email, code })
    const result = await a('POST', '/api/auth/login', { email, password }); assert.equal(result.user.email, email)
    assert.equal((await a('GET', '/api/auth/me')).user.fullName, 'QA Member')
  })
  await check('Profile details and communication preferences persist', async () => {
    await a('PATCH', '/api/auth/me', { fullName: 'QA Updated Member', phone: '01112345678' })
    const saved = await a('GET', '/api/auth/me'); assert.equal(saved.user.fullName, 'QA Updated Member'); assert.equal(saved.user.phone, '01112345678')
    await a('PATCH', '/api/auth/me/preferences', { marketingOptIn: true }); assert.equal((await a('GET', '/api/auth/me')).user.marketingOptIn, true)
    await a('PATCH', '/api/auth/me/preferences', { marketingOptIn: false })
  })
  await check('Password change and password-reset flow', async () => {
    await a('POST', '/api/auth/change-password', { currentPassword: password, newPassword: changed })
    await a('POST', '/api/auth/login', { email, password: changed })
    await a('POST', '/api/auth/forgot-password', { email })
    const code = await redis.get(`reset:${email}`)
    await a('POST', '/api/auth/reset-password', { email, code, newPassword: password })
    await a('POST', '/api/auth/login', { email, password })
  })
  await check('Verified email change and deletion request/cancellation', async () => {
    const nextEmail = 'qa-updated@example.test'
    await a('POST', '/api/auth/change-email/request', { newEmail: nextEmail })
    const me = (await a('GET', '/api/auth/me')).user
    const code = await redis.get(`email-change:${me.id}`)
    const stored = code && JSON.parse(code)
    await a('POST', '/api/auth/change-email/verify', { code: stored?.code ?? code })
    assert.equal((await a('GET', '/api/auth/me')).user.email, nextEmail)
    const request = await a('POST', '/api/auth/me/deletion', { confirmEmail: nextEmail }); assert.ok(request.deletesAt)
    await a('DELETE', '/api/auth/me/deletion'); assert.equal((await a('GET', '/api/auth/me')).user.deletionRequestedAt, null)
  })
  let seated, standing, free, paidTicket, otherTicket
  await check('Public database events, filters, sorting, pagination and venue layouts', async () => {
    const page = await anonymous('GET', '/api/events'); assert.ok(page.events.length); assert.equal(page.pageSize, 6); assert.ok(page.total > 6)
    const searched = await anonymous('GET', '/api/events?q=Jazz'); assert.ok(searched.events.every((e) => e.name.includes('Jazz')))
    const second = await anonymous('GET', '/api/events?page=2'); assert.equal(second.page, 2); assert.notEqual(second.events[0].id, page.events[0].id)
    for (const sort of ['popular', 'price-low', 'price-high', 'name']) assert.equal((await anonymous('GET', `/api/events?sort=${sort}`)).sort, sort)
    assert.equal((await anonymous('GET', '/api/events?q=no-such-qa-event')).total, 0)
    const venues = await anonymous('GET', '/api/venues'); assert.equal(venues.length, 2)
    await anonymous('GET', '/api/venues/cairo-opera-house-small-hall/layout')
    const lookup = async (q) => (await anonymous('GET', `/api/events/${(await anonymous('GET', `/api/events?q=${encodeURIComponent(q)}`)).events[0].id}`))
    seated = await lookup('Oud & Strings Evening'); standing = await lookup('Summer Beats Festival'); free = await lookup('Food Truck Festival')
    const categories = await anonymous('GET', '/api/events?category=concerts&category=arts&city=CAIRO&price=paid')
    assert.ok(categories.total > 0)
    assert.ok(categories.events.every((e) => ['concerts', 'arts'].includes(e.category) && e.venue.city.toLowerCase() === 'cairo' && Number(e.priceFrom) > 0))
    const freeOnly = await anonymous('GET', '/api/events?price=free'); assert.ok(freeOnly.total > 0); assert.ok(freeOnly.events.every((e) => Number(e.priceFrom) === 0))
    const day = seated.startAt.slice(0, 10)
    const dated = await anonymous('GET', `/api/events?from=${day}&to=${day}`); assert.ok(dated.events.some((e) => e.id === seated.id))
    const prices = (await anonymous('GET', '/api/events?sort=price-low')).events.map((e) => Number(e.priceFrom))
    assert.deepEqual(prices, [...prices].sort((x, y) => x - y))
    await anonymous('GET', `/api/events/${randomUUID()}`, undefined, 404)
  })
  await check('Standing holds, server cart totals, ownership and release', async () => {
    const category = standing.ticketCategories[0]
    const held = await a('POST', '/api/inventory/holds', { eventId: standing.id, ticketCategoryId: category.id, quantity: 2 }, 201)
    const cart = await a('GET', `/api/orders/cart?eventId=${standing.id}`); assert.equal(cart.ticketCount, 2); assert.ok(Number(cart.total) > Number(cart.subtotal))
    const own = await a('GET', `/api/inventory/holds?eventId=${standing.id}`); assert.equal(own.length, 1); assert.equal(own[0].expiresAt, held.holds[0].expiresAt)
    await anonymous('DELETE', `/api/inventory/holds/${own[0].id}`, undefined, 401)
    await a('DELETE', `/api/inventory/holds/${own[0].id}`); assert.equal((await a('GET', `/api/orders/cart?eventId=${standing.id}`)).ticketCount, 0)
  })
  async function checkout(event, quantity = 1) {
    const held = await a('POST', '/api/inventory/holds', { eventId: event.id, ticketCategoryId: event.ticketCategories[0].id, quantity }, 201)
    const body = { eventId: event.id, idempotencyKey: randomUUID(), policyAccepted: true, attendees: held.holds.map((h) => ({ holdId: h.id, names: Array.from({ length: h.quantity }, (_, i) => `QA Guest ${i + 1}`) })) }
    const created = await a('POST', '/api/orders/checkout', body, 201)
    const repeat = await a('POST', '/api/orders/checkout', body, 201); assert.equal(repeat.order.id, created.order.id)
    return created
  }
  async function buy(event, outcome = 'success', quantity = 1) {
    const created = await checkout(event, quantity)
    if (created.payment) await a('POST', `/api/payments/simulator/${created.payment.providerTxId}`, { outcome })
    return a('GET', `/api/orders/${created.order.id}`)
  }
  await check('Checkout, duplicate submission, simulated success and real ticket QR', async () => {
    const order = await buy(standing, 'success', 2); assert.equal(order.status, 'PAID')
    const wallet = await a('GET', '/api/tickets'); const tickets = wallet.upcoming.filter((t) => t.orderReference === order.reference)
    assert.equal(tickets.length, 2); assert.ok(tickets[0].qrToken); paidTicket = tickets[0]; otherTicket = tickets[1]
    await a('GET', `/api/tickets/${paidTicket.id}`)
    await anonymous('GET', `/api/tickets/${paidTicket.id}`, undefined, 401)
  })
  await check('Declined payment releases holds', async () => {
    assert.equal((await buy(standing, 'decline')).status, 'FAILED')
    assert.equal((await a('GET', `/api/orders/cart?eventId=${standing.id}`)).ticketCount, 0)
  })
  await check('Ticket email resend reaches local SMTP', async () => {
    const count = messages.length; await a('POST', `/api/tickets/${paidTicket.id}/resend`, {})
    await waitFor(() => messages.length > count)
  })
  await check('Ticket transfer changes ownership and invalidates the old QR', async () => {
    const bcrypt = require('bcrypt')
    await prisma.user.create({ data: { email: 'qa-recipient@example.test', fullName: 'QA Recipient', isSynthetic: true, passwordHash: await bcrypt.hash(password, 10) } })
    await b('POST', '/api/auth/login', { email: 'qa-recipient@example.test', password })
    await a('POST', `/api/tickets/${paidTicket.id}/transfer`, { email: 'qa-recipient@example.test' })
    const received = await b('GET', `/api/tickets/${paidTicket.id}`); assert.notEqual(received.qrToken, paidTicket.qrToken); assert.equal(received.attendeeName, 'QA Recipient')
    const sent = (await a('GET', '/api/tickets')).upcoming.find((t) => t.id === paidTicket.id); assert.equal(sent.status, 'TRANSFERRED_AWAY'); assert.equal(sent.qrToken, null)
  })
  await check('Refund quote, request and duplicate-request protection', async () => {
    const quote = await a('GET', `/api/tickets/${otherTicket.id}/refund-quote`); assert.equal(quote.eligible, true)
    const request = await a('POST', `/api/tickets/${otherTicket.id}/refund`, { reason: 'QA test request' }, 201); assert.equal(request.status, 'SUBMITTED')
    await a('POST', `/api/tickets/${otherTicket.id}/refund`, { reason: 'Duplicate' }, 400)
  })
  await check('Transfer rejects self, missing recipients, pending refunds and a fourth transfer', async () => {
    await b('POST', `/api/tickets/${paidTicket.id}/transfer`, { email: 'qa-recipient@example.test' }, 400)
    await b('POST', `/api/tickets/${paidTicket.id}/transfer`, { email: 'not-registered@example.test' }, 404)
    await a('POST', `/api/tickets/${otherTicket.id}/transfer`, { email: 'qa-recipient@example.test' }, 400)
    await b('POST', `/api/tickets/${paidTicket.id}/transfer`, { email: 'qa-updated@example.test' })
    const final = await a('POST', `/api/tickets/${paidTicket.id}/transfer`, { email: 'qa-recipient@example.test' })
    assert.equal(final.transferCount, 3); assert.equal(final.transfersLeft, 0)
    await b('POST', `/api/tickets/${paidTicket.id}/transfer`, { email: 'qa-updated@example.test' }, 400)
    assert.equal((await b('GET', `/api/tickets/${paidTicket.id}`)).transferCount, 3)
  })
  await check('Seated inventory rejects double holds and preserves seat identity', async () => {
    const layout = await anonymous('GET', '/api/venues/cairo-opera-house-small-hall/layout'); const seat = layout.sections[0].rows[0].seats[0]
    const held = await a('POST', '/api/inventory/holds', { eventId: seated.id, seatIds: [seat.id] }, 201)
    await b('POST', '/api/inventory/holds', { eventId: seated.id, seatIds: [seat.id] }, 409)
    assert.equal((await a('GET', `/api/orders/cart?eventId=${seated.id}`)).lines[0].holdId, held.holds[0].id)
    await a('DELETE', `/api/inventory/holds/${held.holds[0].id}`)
  })
  await check('Ticket limit and invalid quantities are rejected without adding holds', async () => {
    const body = { eventId: free.id, ticketCategoryId: free.ticketCategories[0].id }
    await a('POST', '/api/inventory/holds', { ...body, quantity: 9 }, 400)
    await a('POST', '/api/inventory/holds', { ...body, quantity: 0 }, 400)
    assert.equal((await a('GET', `/api/inventory/holds?eventId=${free.id}`)).length, 0)
  })
  await check('Free event checkout issues a zero-cost ticket', async () => {
    // The current API uses the same simulator journey for paid and zero-cost orders.
    const order = await buy(free)
    assert.equal(order.status, 'PAID'); assert.equal(Number(order.total), 0)
    assert.equal((await a('GET', '/api/tickets')).upcoming.filter((t) => t.orderReference === order.reference).length, 1)
  })
  await check('Order ownership and unpaid-order cancellation', async () => {
    const created = await checkout(standing)
    await b('GET', `/api/orders/${created.order.id}`, undefined, 404)
    await b('POST', `/api/orders/${created.order.id}/cancel`, {}, 404)
    await a('POST', `/api/orders/${created.order.id}/cancel`, {})
    assert.equal((await a('GET', `/api/orders/${created.order.id}`)).status, 'CANCELLED')
    assert.equal((await a('GET', `/api/orders/cart?eventId=${standing.id}`)).ticketCount, 0)
  })
  await check('Duplicate payment callbacks issue each ticket only once', async () => {
    const order = await buy(standing, 'success_twice')
    assert.equal(order.status, 'PAID')
    assert.equal((await a('GET', '/api/tickets')).upcoming.filter((t) => t.orderReference === order.reference).length, 1)
  })
  await check('Lost payment confirmation is recovered by reconciliation', async () => {
    const created = await checkout(standing)
    await a('POST', `/api/payments/simulator/${created.payment.providerTxId}`, { outcome: 'success_lost' })
    assert.equal((await a('GET', `/api/orders/${created.order.id}`)).status, 'PENDING')
    await prisma.order.update({ where: { id: created.order.id }, data: { createdAt: new Date(Date.now() - 180_000) } })
    await require('../src/modules/payments/payments.service').reconcilePayments()
    assert.equal((await a('GET', `/api/orders/${created.order.id}`)).status, 'PAID')
  })
  await check('Timed-out payment is cancelled and releases inventory', async () => {
    const created = await checkout(standing)
    await a('POST', `/api/payments/simulator/${created.payment.providerTxId}`, { outcome: 'timeout' })
    await prisma.order.update({ where: { id: created.order.id }, data: { createdAt: new Date(Date.now() - 180_000), expiresAt: new Date(Date.now() - 1_000) } })
    await require('../src/modules/payments/payments.service').reconcilePayments()
    assert.equal((await a('GET', `/api/orders/${created.order.id}`)).status, 'CANCELLED')
    assert.equal((await a('GET', `/api/orders/cart?eventId=${standing.id}`)).ticketCount, 0)
  })
  await check('Logout removes authenticated access', async () => { await b('POST', '/api/auth/logout', {}); await b('GET', '/api/auth/me', undefined, 401) })
  // Stable synthetic credentials for optional browser QA of the real backend.
  const browserPassword = await require('bcrypt').hash(password, 10)
  await prisma.user.upsert({ where: { email: 'qa-browser@example.test' }, create: { email: 'qa-browser@example.test', fullName: 'QA Browser Member', passwordHash: browserPassword, isSynthetic: true }, update: {} })
  console.log(`RESULT ${results.filter((r) => r.status === 'passed').length}/${results.length} checks passed; ${messages.length} SMTP messages captured`)
}
let cleaning = false
async function cleanup() {
  if (cleaning) return; cleaning = true
  server?.close(); smtp?.close()
  await prisma?.$disconnect()
  if (databaseCreated && /^hafletna_qa_\d+$/.test(databaseName)) await admin.$executeRawUnsafe(`DROP DATABASE "${databaseName}" WITH (FORCE)`)
  await admin.$disconnect()
  redis?.disconnect()
  redisProcess?.kill()
}
process.on('SIGINT', () => cleanup().finally(() => process.exit(0)))
process.on('SIGTERM', () => cleanup().finally(() => process.exit(0)))
;(async () => {
  try {
    await setup(); await run()
    if (process.argv.includes('--serve')) { console.log('QA backend ready on http://127.0.0.1:3002; synthetic browser account ready'); return }
    await cleanup(); process.exit(results.some((r) => r.status === 'failed') ? 1 : 0)
  } catch (error) { console.error('QA setup/run failed:', error.message); await cleanup(); process.exit(1) }
})()
