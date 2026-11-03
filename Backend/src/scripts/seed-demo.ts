/// <reference types="node" />
// Demo data for the admin console: customers, orders, tickets, transfers, refunds, drafts, a cancelled
// event and gate staff. Run AFTER seed:venues and seed:events:  npm run seed:demo
//
// Every purchase goes through the real flow (hold → checkout → payment), so counters, totals and
// tickets always agree. Payments use the simulator (no money, no Stripe). Customers use
// @demo.hafletna.test addresses, which never receive email. Safe to re-run: it adds more activity.

process.env.PAYMENT_PROVIDER = 'simulator' // must be set before the app's config is loaded

import bcrypt from 'bcrypt'
import type { Prisma } from '@prisma/client'

const DEMO_PASSWORD = 'Demo-1234'

const FIRST = ['Ahmed', 'Mohamed', 'Omar', 'Youssef', 'Karim', 'Mostafa', 'Hassan', 'Ali', 'Mahmoud', 'Tarek', 'Sherif', 'Amr',
  'Nour', 'Salma', 'Mariam', 'Farida', 'Yasmin', 'Hana', 'Laila', 'Rana', 'Dina', 'Malak', 'Habiba', 'Jana']
const LAST = ['El Sayed', 'Hassan', 'Mostafa', 'Abdelrahman', 'Farouk', 'Khaled', 'Saleh', 'Nabil', 'Fathy', 'Gamal', 'Samir', 'Adel', 'Ibrahim', 'Mansour']

let seed = 20261102
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31)
const pick = <T>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)]
const between = (a: number, b: number) => a + Math.floor(rand() * (b - a + 1))

async function main() {
  const { default: prisma } = await import('../config/db')
  const { holdSeats, holdStanding, getAvailability } = await import('../modules/inventory/inventory.service')
  const { checkout } = await import('../modules/orders/orders.service')
  const { fulfilOrder, failOrder } = await import('../modules/payments/payments.service')
  const { transferTicket } = await import('../modules/tickets/tickets.service')
  const { requestRefund, approveRefund, rejectRefund } = await import('../modules/tickets/refunds.service')
  const admin = await import('../modules/admin/admin.service')

  if (process.env.NODE_ENV === 'production') throw new Error('seed:demo is for development databases only')

  const adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN', isSynthetic: false }, orderBy: { createdAt: 'asc' } })
    ?? await prisma.user.findFirstOrThrow({ where: { role: 'ADMIN' } })

  // ── customers ──
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10)
  const customers: { id: string; email: string }[] = []
  for (let i = 0; i < 42; i++) {
    const fullName = `${FIRST[i % FIRST.length]} ${pick(LAST)}`
    const email = `${fullName.toLowerCase().replace(/[^a-z]+/g, '.')}.${i + 1}@demo.hafletna.test`
    const user = await prisma.user.upsert({
      where: { email },
      create: { email, fullName, passwordHash, phone: `010${between(10000000, 99999999)}`, marketingOptIn: rand() > 0.5, isSynthetic: true,
        createdAt: new Date(Date.now() - between(5, 200) * 86_400_000) },
      update: {},
    })
    customers.push(user)
  }
  console.log(`Customers: ${customers.length} (password ${DEMO_PASSWORD})`)

  // ── purchases through the real flow ──
  const events = await prisma.event.findMany({
    where: { status: 'PUBLISHED', startAt: { gt: new Date(Date.now() + 2 * 86_400_000) } },
    include: { venue: { select: { type: true } }, ticketCategories: true },
  })
  const names = (n: number) => Array.from({ length: n }, () => `${pick(FIRST)} ${pick(LAST)}`)
  let paid = 0
  let failed = 0
  let pending = 0
  let skipped = 0
  const paidOrders: { orderId: string; userId: string; eventId: string }[] = []

  const buy = async (userId: string, event: (typeof events)[number], outcome: 'paid' | 'failed' | 'pending') => {
    try {
      let holdIds: { id: string; quantity: number }[] = []
      if (event.venue.type === 'SEATED') {
        const av = await getAvailability(event.id)
        const taken = new Set([...av.heldSeatIds, ...av.soldSeatIds])
        const priced = new Set(event.ticketCategories.map((c) => c.categoryKey))
        const seats = await prisma.seat.findMany({ where: { venueId: event.venueId, categoryKey: { in: [...priced] } }, orderBy: [{ section: 'asc' }, { row: 'asc' }, { number: 'asc' }] })
        const free = seats.filter((s) => !taken.has(s.id))
        if (free.length < 2) return
        const start = between(0, free.length - 2)
        const chosen = free.slice(start, start + between(1, Math.min(4, free.length - start)))
        holdIds = (await holdSeats(userId, event.id, chosen.map((s) => s.id))).map((h) => ({ id: h.id, quantity: h.quantity }))
      } else {
        const cat = pick(event.ticketCategories)
        const h = await holdStanding(userId, event.id, cat.id, between(1, 4))
        holdIds = [{ id: h.id, quantity: h.quantity }]
      }
      const { order } = await checkout(userId, {
        eventId: event.id, idempotencyKey: `demo-${Date.now().toString(36)}-${rand().toString(36).slice(2, 12)}`, policyAccepted: true,
        attendees: holdIds.map((h) => ({ holdId: h.id, names: names(h.quantity) })),
      })
      if (outcome === 'paid') {
        if ((await fulfilOrder(order.id)) === 'PAID') { paid++; paidOrders.push({ orderId: order.id, userId, eventId: event.id }) }
      } else if (outcome === 'failed') {
        if (await failOrder(order.id, 'FAILED')) failed++
      } else pending++
    } catch (e) {
      // sold out, over the 8-ticket limit, etc.: just skip (the first few reasons are shown)
      if (skipped++ < 3) console.log(`  skipped a purchase: ${e instanceof Error ? e.message : e}`)
    }
  }

  for (const c of customers) {
    for (let k = between(1, 5); k > 0; k--) await buy(c.id, pick(events), rand() < 0.88 ? 'paid' : 'failed')
  }
  for (let i = 0; i < 4; i++) await buy(pick(customers).id, pick(events), 'pending')
  console.log(`Orders: ${paid} paid, ${failed} failed, ${pending} waiting for payment`)

  // spread the sales over the last 30 days so the dashboard chart has a shape
  for (const { orderId } of paidOrders) {
    const when = new Date(Date.now() - between(0, 29) * 86_400_000 - between(0, 23) * 3_600_000)
    await prisma.$transaction([
      prisma.order.update({ where: { id: orderId }, data: { createdAt: when, paidAt: when } }),
      prisma.payment.update({ where: { orderId }, data: { createdAt: when, paidAt: when } }),
      prisma.ticket.updateMany({ where: { orderItem: { orderId } }, data: { createdAt: when } }),
    ])
  }

  // ── transfers ──
  let transfers = 0
  for (let i = 0; i < 12 && paidOrders.length; i++) {
    const { userId } = pick(paidOrders)
    const t = await prisma.ticket.findFirst({ where: { holderId: userId, status: 'VALID' } })
    const to = pick(customers.filter((c) => c.id !== userId))
    if (t) await transferTicket(userId, t.id, to.email).then(() => transfers++).catch(() => {})
  }
  console.log(`Transfers: ${transfers}`)

  // ── refund requests in every state ──
  const reasons = ['I can no longer attend', 'Travelling that week', 'Bought the wrong date', 'Family emergency', 'The event clashes with my exams']
  const rejections = ['Your request arrived after the refund deadline in the event policy.', 'Tickets bought in a promotion cannot be refunded.', 'We could not verify this request. Please contact support.']
  const refunds: string[] = []
  for (let i = 0; i < 26 && paidOrders.length; i++) {
    const { userId } = pick(paidOrders)
    const t = await prisma.ticket.findFirst({ where: { holderId: userId, status: 'VALID', refunds: { none: {} }, transfers: { none: {} } } })
    if (t) await requestRefund(userId, t.id, pick(reasons)).then((r) => refunds.push(r.id)).catch(() => {})
  }
  let approved = 0
  let rejected = 0
  for (const [i, id] of refunds.entries()) {
    if (i % 3 === 0) await approveRefund(adminUser.id, id).then(() => approved++).catch(() => {})
    else if (i % 3 === 1) await rejectRefund(adminUser.id, id, pick(rejections)).then(() => rejected++).catch(() => {})
  }
  console.log(`Refunds: ${refunds.length} requested (${approved} approved, ${rejected} rejected, ${refunds.length - approved - rejected} waiting)`)

  // ── a few blocked customers ──
  for (const [i, c] of customers.slice(-3).entries()) {
    await admin.blockUser(adminUser.id, c.id, ['Repeated chargebacks', 'Reselling tickets above face value', 'Abusive messages to staff'][i]).catch(() => {})
  }

  // ── draft events (not on sale yet) ──
  const venues = await prisma.venue.findMany()
  const drafts = [
    { name: 'Ramadan Nights Festival', category: 'festivals', performer: 'Various artists', days: 120 },
    { name: 'Startup Founders Summit', category: 'conferences', performer: 'Egypt Tech Hub', days: 95 },
    { name: 'Spring Symphony Gala', category: 'concerts', performer: 'Cairo Symphony Orchestra', days: 140 },
  ]
  for (const d of drafts) {
    if (await prisma.event.findFirst({ where: { name: d.name } })) continue
    const venue = d.category === 'festivals' ? venues.find((v) => v.type === 'STANDING')! : venues.find((v) => v.type === 'SEATED')!
    const start = new Date(Date.now() + d.days * 86_400_000)
    start.setHours(20, 0, 0, 0)
    const ev = await admin.createAdminEvent(adminUser.id, {
      name: d.name, category: d.category, performer: d.performer, venueId: venue.id,
      description: `${d.name}: a draft event still being prepared.`, startAt: start.toISOString(),
      doorsOpenAt: new Date(start.getTime() - 3_600_000).toISOString(), durationMinutes: 150,
    })
    const areas = ev.availableCategories
    for (const [i, a] of areas.entries()) await admin.addCategory(adminUser.id, ev.id, { categoryKey: a.key, price: (areas.length - i) * 250, serviceFeePercent: 5 })
  }

  // ── one cancelled event, with its tickets refunded in full ──
  const withSales = await prisma.event.findFirst({
    where: { status: 'PUBLISHED', tickets: { some: { status: 'VALID' } }, name: { not: { contains: 'Webhook' } } },
    orderBy: { startAt: 'desc' },
  })
  if (withSales && !(await prisma.event.findFirst({ where: { status: 'CANCELLED' } }))) {
    const r = await admin.cancelAdminEvent(adminUser.id, withSales.id, 'The performer is unwell. Every ticket has been refunded in full.')
    console.log(`Cancelled "${withSales.name}"; refunding ${r.ticketsToRefund} tickets in the background`)
  }

  // ── gate staff ──
  for (const s of [{ fullName: 'Mona Adel', username: 'mona.gate' }, { fullName: 'Hesham Fawzy', username: 'hesham.gate' }]) {
    const exists = await prisma.staffAccount.findUnique({ where: { username: s.username } })
    const staff = exists ?? (await admin.createStaff(adminUser.id, { ...s, password: '1234' }))
    for (const ev of events.slice(0, 3)) await admin.assignStaff(adminUser.id, staff.id, ev.id).catch(() => {})
  }

  const counts = await Promise.all([prisma.order.count(), prisma.ticket.count(), prisma.refund.count(), prisma.user.count(), prisma.auditLog.count()])
  console.log(`\nDatabase now has ${counts[0]} orders, ${counts[1]} tickets, ${counts[2]} refunds, ${counts[3]} users, ${counts[4]} activity entries.`)
  await prisma.$disconnect()
}

main().then(() => process.exit(0)).catch((err: Prisma.PrismaClientKnownRequestError | Error) => {
  console.error(err)
  process.exit(1)
})
