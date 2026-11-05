import bcrypt from 'bcrypt'
import { Prisma } from '@prisma/client'
import prisma from '../../config/db'
import { createEvent, deleteEvent, updateEvent, type EventInput } from '../events/events.service'
import { failOrder, providerFor } from '../payments/payments.service'
import { approveRefund, listRefunds, rejectRefund, settleRefund } from '../tickets/refunds.service'
import { getTransferChain } from '../tickets/tickets.service'
import { sendTicketEmail } from '../tickets/ticket-mail'
import { getAllVenues, getVenueCategories, getVenueLayout, saveVenue } from '../venues/venues.service'
import { parseLayout, type VenueLayout } from '../venues/venues.layout'
import { resolveMapLink } from './maps'

export class AdminError extends Error {
  constructor(message: string, public status = 400) { super(message) }
}

const PAGE = 15
const page = (n: unknown) => Math.max(1, Number.parseInt(String(n ?? 1), 10) || 1)
const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
const isUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
const paged = <T>(rows: T[], total: number, current: number) => ({ rows, total, page: current, pageCount: Math.max(1, Math.ceil(total / PAGE)) })

export const EVENT_CATEGORIES = ['concerts', 'festivals', 'arts', 'sports', 'workshops', 'conferences'] as const
export const CITIES = ['Cairo', 'Giza', 'Alexandria'] as const

/** Every admin change is recorded: who, what, on which record (FR-ADM-22) */
export const audit = (adminId: string, action: string, entityType: string, entityId: string, details?: object) =>
  prisma.auditLog.create({ data: { actorUserId: adminId, action, entityType, entityId, details: details as Prisma.InputJsonValue } })

// ─── Dashboard ──────────────────────────────────────────────────────────────

export const getDashboard = async () => {
  // days are counted in UTC on both sides (the database groups by UTC day), so today is always the last bar
  const since = new Date()
  since.setUTCHours(0, 0, 0, 0)
  since.setUTCDate(since.getUTCDate() - 13)
  const [revenue, ticketsSold, ordersByStatus, customers, eventsByStatus, upcoming, pendingRefunds, refunded, daily, top, recent] = await Promise.all([
    prisma.order.aggregate({ where: { status: 'PAID' }, _sum: { total: true, serviceFeeTotal: true } }),
    prisma.ticket.count({ where: { status: { in: ['VALID', 'USED'] } } }),
    prisma.order.groupBy({ by: ['status'], _count: true }),
    prisma.user.count({ where: { role: 'USER' } }),
    prisma.event.groupBy({ by: ['status'], _count: true }),
    prisma.event.count({ where: { status: 'PUBLISHED', startAt: { gte: new Date() } } }),
    prisma.refund.count({ where: { status: 'SUBMITTED' } }),
    prisma.refund.aggregate({ where: { status: 'SETTLED' }, _sum: { amount: true } }),
    prisma.$queryRaw<{ day: Date; revenue: number; orders: number; tickets: number }[]>`
      SELECT date_trunc('day', o.paid_at AT TIME ZONE 'UTC') AS day, SUM(o.total)::float AS revenue, COUNT(*)::int AS orders,
             COALESCE(SUM((SELECT SUM(quantity) FROM order_items i WHERE i.order_id = o.id)), 0)::int AS tickets
      FROM orders o WHERE o.status = 'PAID' AND o.paid_at >= ${since}
      GROUP BY 1 ORDER BY 1`,
    prisma.$queryRaw<{ id: string; name: string; sold: number; capacity: number; revenue: number }[]>`
      SELECT e.id, e.name, SUM(c.sold_count)::int AS sold, SUM(c.capacity)::int AS capacity,
             COALESCE((SELECT SUM(total) FROM orders o WHERE o.event_id = e.id AND o.status = 'PAID'), 0)::float AS revenue
      FROM events e JOIN ticket_categories c ON c.event_id = e.id
      GROUP BY e.id ORDER BY sold DESC, e.name LIMIT 6`,
    prisma.order.findMany({
      orderBy: { createdAt: 'desc' }, take: 8,
      select: { id: true, reference: true, status: true, total: true, createdAt: true, user: { select: { fullName: true } }, event: { select: { name: true } } },
    }),
  ])

  // one point per day for the last 14 days, zero on days with no sales
  const byDay = new Map(daily.map((d) => [new Date(d.day).toISOString().slice(0, 10), d]))
  const sales = Array.from({ length: 14 }, (_, i) => {
    const day = new Date(since.getTime() + i * 86_400_000).toISOString().slice(0, 10)
    const d = byDay.get(day)
    return { day, revenue: d?.revenue ?? 0, orders: d?.orders ?? 0, tickets: d?.tickets ?? 0 }
  })

  return {
    revenue: Number(revenue._sum.total ?? 0),
    serviceFees: Number(revenue._sum.serviceFeeTotal ?? 0),
    refunded: Number(refunded._sum.amount ?? 0),
    ticketsSold,
    customers,
    upcomingEvents: upcoming,
    pendingRefunds,
    orders: Object.fromEntries(ordersByStatus.map((o) => [o.status, o._count])),
    events: Object.fromEntries(eventsByStatus.map((e) => [e.status, e._count])),
    sales,
    topEvents: top,
    recentOrders: recent,
  }
}

// ─── Events ─────────────────────────────────────────────────────────────────

const eventRowSelect = {
  id: true, name: true, category: true, performer: true, status: true, startAt: true, createdAt: true, images: true,
  venue: { select: { id: true, name: true, city: true, type: true } },
  ticketCategories: { select: { capacity: true, soldCount: true, heldCount: true, price: true } },
} satisfies Prisma.EventSelect

const eventSummary = (e: Prisma.EventGetPayload<{ select: typeof eventRowSelect }>) => ({
  ...e,
  sold: e.ticketCategories.reduce((n, c) => n + c.soldCount, 0),
  capacity: e.ticketCategories.reduce((n, c) => n + c.capacity, 0),
  fromPrice: e.ticketCategories.length ? Math.min(...e.ticketCategories.map((c) => Number(c.price))) : null,
  isPast: e.startAt.getTime() < Date.now(),
  ticketCategories: undefined,
})

export const listEvents = async (q: Record<string, unknown>) => {
  const search = text(q.q)
  const status = ['DRAFT', 'PUBLISHED', 'CANCELLED'].includes(String(q.status)) ? (q.status as 'DRAFT') : undefined
  const category = EVENT_CATEGORIES.includes(q.category as never) ? String(q.category) : undefined
  const when = q.when === 'past' ? { lt: new Date() } : q.when === 'upcoming' ? { gte: new Date() } : undefined
  const where: Prisma.EventWhereInput = {
    ...(status && { status }),
    ...(category && { category }),
    ...(when && { startAt: when }),
    ...(text(q.venueId) && isUuid(text(q.venueId)) && { venueId: text(q.venueId) }),
    ...(search && { OR: [{ name: { contains: search, mode: 'insensitive' } }, { performer: { contains: search, mode: 'insensitive' } }] }),
  }
  const current = page(q.page)
  const [total, rows] = await Promise.all([
    prisma.event.count({ where }),
    prisma.event.findMany({ where, select: eventRowSelect, orderBy: { startAt: q.sort === 'newest' ? 'desc' : 'asc' }, skip: (current - 1) * PAGE, take: PAGE }),
  ])
  return paged(rows.map(eventSummary), total, current)
}

export const getEvent = async (id: string) => {
  const event = await prisma.event.findUnique({
    where: { id },
    include: {
      venue: { select: { id: true, slug: true, name: true, city: true, type: true, capacity: true } },
      ticketCategories: { orderBy: { price: 'desc' } },
      createdBy: { select: { fullName: true } },
      staffAssignments: { where: { revokedAt: null }, select: { id: true, staff: { select: { id: true, fullName: true, username: true } } } },
    },
  })
  if (!event) throw new AdminError('Event not found', 404)
  const [revenue, orders, tickets, venueCategories] = await Promise.all([
    prisma.order.aggregate({ where: { eventId: id, status: 'PAID' }, _sum: { total: true } }),
    prisma.order.groupBy({ by: ['status'], where: { eventId: id }, _count: true }),
    prisma.ticket.groupBy({ by: ['status'], where: { eventId: id }, _count: true }),
    getVenueCategories(event.venue.slug),
  ])
  return {
    ...event,
    stats: {
      revenue: Number(revenue._sum.total ?? 0),
      orders: Object.fromEntries(orders.map((o) => [o.status, o._count])),
      tickets: Object.fromEntries(tickets.map((t) => [t.status, t._count])),
    },
    // venue areas not priced yet, so the admin can add them
    availableCategories: venueCategories.filter((c) => !event.ticketCategories.some((t) => t.categoryKey === c.key)),
  }
}

type EventBody = EventInput & { policyText?: string; image?: string }

const eventInput = (body: Record<string, unknown>, creating: boolean): EventBody => {
  const out: EventBody = {}
  const str = (k: string) => (typeof body[k] === 'string' ? (body[k] as string).trim() : undefined)
  if (str('name') !== undefined) out.name = str('name')
  if (str('category') !== undefined) {
    if (!EVENT_CATEGORIES.includes(str('category') as never)) throw new AdminError('Choose a valid category')
    out.category = str('category')
  }
  if (body.performer !== undefined) out.performer = str('performer') || null
  if (str('description') !== undefined) out.description = str('description')
  if (body.about !== undefined) out.about = str('about') || null
  if (str('venueId') !== undefined) out.venueId = str('venueId')
  for (const k of ['startAt', 'doorsOpenAt'] as const) {
    if (body[k] !== undefined) {
      const d = new Date(String(body[k]))
      if (Number.isNaN(d.getTime())) throw new AdminError(`${k === 'startAt' ? 'Start' : 'Doors open'} time is not a valid date`)
      out[k] = d.toISOString()
    }
  }
  for (const k of ['salesOpenAt', 'salesCloseAt'] as const) {
    if (body[k] !== undefined) out[k] = body[k] ? new Date(String(body[k])).toISOString() : null
  }
  if (body.durationMinutes !== undefined) {
    const n = Number(body.durationMinutes)
    if (!Number.isInteger(n) || n < 15 || n > 24 * 60) throw new AdminError('Duration must be between 15 minutes and 24 hours')
    out.durationMinutes = n
  }
  if (body.image !== undefined) {
    const img = str('image')
    if (img && !/^https:\/\/\S+$|^\/event-images\/\S+$/.test(img)) throw new AdminError('The image must be an https link')
    out.images = img ? [img] : []
  }
  if (body.refundPolicy !== undefined || body.transferPolicy !== undefined || body.entryPolicy !== undefined) {
    const policy = (k: string) => (str(k) ? { en: str(k), ar: str(k) } : undefined)
    out.policies = JSON.parse(JSON.stringify({ refundPolicy: policy('refundPolicy'), transferPolicy: policy('transferPolicy'), entryPolicy: policy('entryPolicy') }))
  }
  if (creating) {
    for (const k of ['name', 'category', 'description', 'venueId', 'startAt', 'doorsOpenAt'] as const) {
      if (!out[k]) throw new AdminError('Please fill in the name, category, description, venue and times')
    }
    out.durationMinutes ??= 120
  }
  if (out.startAt && out.doorsOpenAt && new Date(out.doorsOpenAt) > new Date(out.startAt)) throw new AdminError('Doors must open before the event starts')
  return out
}

const DEFAULT_POLICIES = {
  refundPolicy: { en: 'You can request a refund up to 7 days before the event. Refunds need approval, and the service fee is not refunded. If the event is cancelled, you get a full refund.', ar: 'يمكنك طلب استرداد المبلغ حتى ٧ أيام قبل الفعالية. تخضع الطلبات للموافقة ولا تُسترد رسوم الخدمة. في حال إلغاء الفعالية يُسترد المبلغ كاملًا.' },
  transferPolicy: { en: 'A ticket can be transferred to another Hafletna account at most 3 times. The old QR code stops working.', ar: 'يمكن تحويل التذكرة إلى حساب آخر في حفلتنا ٣ مرات كحد أقصى، ويتوقف رمز QR القديم عن العمل.' },
}

export const createAdminEvent = async (adminId: string, body: Record<string, unknown>) => {
  const data = eventInput(body, true)
  const venue = await prisma.venue.findUnique({ where: { id: data.venueId! }, select: { slug: true } })
  if (!venue) throw new AdminError('Choose a venue')
  const event = await createEvent(adminId, { ...data, policies: data.policies ?? DEFAULT_POLICIES } as Parameters<typeof createEvent>[1])

  // ticket types sent with the form, priced per venue area
  const cats = Array.isArray(body.categories) ? (body.categories as Record<string, unknown>[]) : []
  for (const c of cats) await addCategory(adminId, event.id, c, false)
  await audit(adminId, 'EVENT_CREATED', 'Event', event.id, { name: event.name })
  return getEvent(event.id)
}

export const updateAdminEvent = async (adminId: string, id: string, body: Record<string, unknown>) => {
  const data = eventInput(body, false)
  try {
    await updateEvent(id, data)
  } catch (e) {
    throw new AdminError(e instanceof Error ? e.message : 'Could not save the event')
  }
  await audit(adminId, 'EVENT_UPDATED', 'Event', id, { fields: Object.keys(data) })
  return getEvent(id)
}

export const publishAdminEvent = async (adminId: string, id: string) => {
  const event = await prisma.event.findUnique({ where: { id }, include: { ticketCategories: true } })
  if (!event) throw new AdminError('Event not found', 404)
  if (event.status !== 'DRAFT') throw new AdminError('Only drafts can be published')
  if (!event.ticketCategories.length) throw new AdminError('Add at least one ticket type before publishing')
  if (event.startAt <= new Date()) throw new AdminError('The event date is in the past')
  await prisma.event.update({ where: { id }, data: { status: 'PUBLISHED', publishedAt: new Date() } })
  await audit(adminId, 'EVENT_PUBLISHED', 'Event', id)
  return getEvent(id)
}

/**
 * Cancelling an event: sales stop, unpaid orders are cancelled, and every valid ticket is refunded in
 * full, service fee included (BR-12). Paid-by-card tickets are refunded on Stripe automatically.
 */
export const cancelAdminEvent = async (adminId: string, id: string, reason: string) => {
  if (!text(reason)) throw new AdminError('Please give a reason; customers will see it')
  const event = await prisma.event.findUnique({ where: { id }, select: { status: true } })
  if (!event) throw new AdminError('Event not found', 404)
  if (event.status === 'CANCELLED') throw new AdminError('This event is already cancelled')
  await prisma.event.update({ where: { id }, data: { status: 'CANCELLED', cancelledAt: new Date(), cancellationReason: text(reason).slice(0, 1000) } })

  const pending = await prisma.order.findMany({ where: { eventId: id, status: 'PENDING' }, select: { id: true } })
  for (const o of pending) await failOrder(o.id, 'CANCELLED')

  const toRefund = await prisma.ticket.count({ where: { eventId: id, status: 'VALID' } })
  await audit(adminId, 'EVENT_CANCELLED', 'Event', id, { reason, ticketsToRefund: toRefund, ordersCancelled: pending.length })
  // A big event can have thousands of tickets, each refunded on Stripe and emailed: far longer than a web
  // request may take. The refunds run in the background; any that fail stay in the refund queue.
  void refundCancelledEvent(adminId, id, text(reason))
  return { ...(await getEvent(id)), ticketsToRefund: toRefund }
}

/** Full refunds (service fee included, BR-12) for every valid ticket of a cancelled event, one at a time */
const refundCancelledEvent = async (adminId: string, eventId: string, reason: string) => {
  let refunded = 0
  let failed = 0
  try {
    const tickets = await prisma.ticket.findMany({
      where: { eventId, status: 'VALID', refunds: { none: { status: { in: ['SUBMITTED', 'APPROVED', 'SETTLED'] } } } },
      select: { id: true, holderId: true, orderItem: { select: { unitPrice: true, serviceFeeAmount: true } } },
    })
    for (const t of tickets) {
      try {
        const refund = await prisma.refund.create({
          data: {
            ticketId: t.id, type: 'EVENT_CANCELLED', payeeId: t.holderId, reason: `Event cancelled: ${reason}`,
            amount: Number(t.orderItem.unitPrice) + Number(t.orderItem.serviceFeeAmount), serviceFeeRetained: 0,
          },
        })
        await approveRefund(adminId, refund.id)
        refunded++
      } catch (e) {
        failed++
        console.error(`Refund for ticket ${t.id} of cancelled event ${eventId} failed (it stays in the refund queue):`, e)
      }
    }
  } finally {
    await audit(adminId, 'EVENT_REFUNDS_FINISHED', 'Event', eventId, { refunded, failed }).catch(() => {})
  }
}

export const deleteAdminEvent = async (adminId: string, id: string) => {
  try {
    await deleteEvent(id)
  } catch (e) {
    throw new AdminError(e instanceof Error ? e.message : 'Could not delete the event')
  }
  await audit(adminId, 'EVENT_DELETED', 'Event', id)
}

// ─── Ticket types (per event) ───────────────────────────────────────────────

const money = (v: unknown, label: string, max = 1_000_000) => {
  const n = Number(v)
  if (!Number.isFinite(n) || n < 0 || n > max) throw new AdminError(`${label} is not valid`)
  return Math.round(n * 100) / 100
}

export const addCategory = async (adminId: string, eventId: string, body: Record<string, unknown>, log = true) => {
  const event = await prisma.event.findUnique({ where: { id: eventId }, select: { status: true, venue: { select: { slug: true } } } })
  if (!event) throw new AdminError('Event not found', 404)
  if (event.status === 'CANCELLED') throw new AdminError('This event is cancelled')
  const area = (await getVenueCategories(event.venue.slug)).find((c) => c.key === body.categoryKey)
  if (!area) throw new AdminError('Choose one of the venue areas')
  const exists = await prisma.ticketCategory.findUnique({ where: { eventId_categoryKey: { eventId, categoryKey: area.key } } })
  if (exists) throw new AdminError(`${area.label} already has a ticket type`)
  const created = await prisma.ticketCategory.create({
    data: {
      eventId, categoryKey: area.key, capacity: area.capacity,
      name: text(body.name) || area.label,
      description: text(body.description) || null,
      price: money(body.price, 'Price'),
      serviceFeePercent: money(body.serviceFeePercent ?? 5, 'Service fee', 50),
    },
  })
  if (log) await audit(adminId, 'TICKET_TYPE_ADDED', 'Event', eventId, { name: created.name, price: created.price.toString() })
  return created
}

export const updateCategory = async (adminId: string, id: string, body: Record<string, unknown>) => {
  const cat = await prisma.ticketCategory.findUnique({ where: { id } })
  if (!cat) throw new AdminError('Ticket type not found', 404)
  const data: Prisma.TicketCategoryUpdateInput = {}
  if (body.name !== undefined) data.name = text(body.name) || cat.name
  if (body.description !== undefined) data.description = text(body.description) || null
  // a price change only affects new purchases; tickets already sold keep the price paid
  if (body.price !== undefined) data.price = money(body.price, 'Price')
  if (body.serviceFeePercent !== undefined) data.serviceFeePercent = money(body.serviceFeePercent, 'Service fee', 50)
  const saved = await prisma.ticketCategory.update({ where: { id }, data })
  await audit(adminId, 'TICKET_TYPE_UPDATED', 'Event', cat.eventId, { name: saved.name, price: saved.price.toString() })
  return saved
}

export const deleteCategory = async (adminId: string, id: string) => {
  const cat = await prisma.ticketCategory.findUnique({ where: { id } })
  if (!cat) throw new AdminError('Ticket type not found', 404)
  if (cat.soldCount + cat.heldCount > 0) throw new AdminError('Tickets of this type are sold or reserved, so it cannot be removed')
  await prisma.ticketCategory.delete({ where: { id } })
  await audit(adminId, 'TICKET_TYPE_REMOVED', 'Event', cat.eventId, { name: cat.name })
}

// ─── Orders ─────────────────────────────────────────────────────────────────

export const listOrders = async (q: Record<string, unknown>) => {
  const search = text(q.q)
  const status = ['PENDING', 'PAID', 'FAILED', 'CANCELLED'].includes(String(q.status)) ? (q.status as 'PAID') : undefined
  const where: Prisma.OrderWhereInput = {
    ...(status && { status }),
    ...(text(q.eventId) && isUuid(text(q.eventId)) && { eventId: text(q.eventId) }),
    ...(text(q.userId) && isUuid(text(q.userId)) && { userId: text(q.userId) }),
    ...(search && {
      OR: [
        { reference: { contains: search, mode: 'insensitive' } },
        { user: { email: { contains: search, mode: 'insensitive' } } },
        { user: { fullName: { contains: search, mode: 'insensitive' } } },
        { event: { name: { contains: search, mode: 'insensitive' } } },
      ],
    }),
  }
  const current = page(q.page)
  const [total, rows, sum] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where, orderBy: { createdAt: 'desc' }, skip: (current - 1) * PAGE, take: PAGE,
      select: {
        id: true, reference: true, status: true, total: true, createdAt: true, paidAt: true,
        user: { select: { id: true, fullName: true, email: true } },
        event: { select: { id: true, name: true } },
        payment: { select: { provider: true, status: true } },
        items: { select: { quantity: true } },
      },
    }),
    prisma.order.aggregate({ where: { ...where, status: 'PAID' }, _sum: { total: true } }),
  ])
  return { ...paged(rows.map((o) => ({ ...o, tickets: o.items.reduce((n, i) => n + i.quantity, 0), items: undefined })), total, current), paidTotal: Number(sum._sum.total ?? 0) }
}

export const getOrder = async (id: string) => {
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, fullName: true, email: true, phone: true } },
      event: { select: { id: true, name: true, startAt: true, venue: { select: { name: true } } } },
      payment: { select: { provider: true, providerTxId: true, status: true, amount: true, paidAt: true, createdAt: true } },
      items: {
        include: {
          ticketCategory: { select: { name: true } },
          tickets: { select: { id: true, attendeeName: true, status: true, seat: { select: { section: true, row: true, number: true } }, holder: { select: { id: true, fullName: true, email: true } } } },
        },
      },
    },
  })
  if (!order) throw new AdminError('Order not found', 404)
  return order
}

export const cancelAdminOrder = async (adminId: string, id: string) => {
  const order = await prisma.order.findUnique({ where: { id }, select: { status: true, payment: { select: { providerTxId: true, provider: true } } } })
  if (!order) throw new AdminError('Order not found', 404)
  if (order.status !== 'PENDING') throw new AdminError('Only unpaid orders can be cancelled. Paid orders are refunded per ticket.')
  const txId = order.payment?.providerTxId
  if (txId) {
    const p = providerFor(order.payment?.provider)
    await p.cancel(txId)
    if ((await p.getStatus(txId)) === 'SUCCEEDED') throw new AdminError('This order was just paid', 409)
  }
  await failOrder(id, 'CANCELLED')
  await audit(adminId, 'ORDER_CANCELLED', 'Order', id)
  return getOrder(id)
}

// ─── Tickets ────────────────────────────────────────────────────────────────

export const listTickets = async (q: Record<string, unknown>) => {
  const search = text(q.q)
  const status = ['VALID', 'USED', 'REFUNDED', 'VOID'].includes(String(q.status)) ? (q.status as 'VALID') : undefined
  const where: Prisma.TicketWhereInput = {
    ...(status && { status }),
    ...(text(q.eventId) && isUuid(text(q.eventId)) && { eventId: text(q.eventId) }),
    ...(search && {
      OR: [
        ...(isUuid(search) ? [{ id: search }] : []),
        { attendeeName: { contains: search, mode: 'insensitive' } },
        { holder: { email: { contains: search, mode: 'insensitive' } } },
        { holder: { fullName: { contains: search, mode: 'insensitive' } } },
        { orderItem: { order: { reference: { contains: search, mode: 'insensitive' } } } },
        { event: { name: { contains: search, mode: 'insensitive' } } },
      ],
    }),
  }
  const current = page(q.page)
  const [total, rows] = await Promise.all([
    prisma.ticket.count({ where }),
    prisma.ticket.findMany({
      where, orderBy: { createdAt: 'desc' }, skip: (current - 1) * PAGE, take: PAGE,
      select: {
        id: true, attendeeName: true, status: true, transferCount: true, createdAt: true, usedAt: true,
        event: { select: { id: true, name: true, startAt: true } },
        ticketCategory: { select: { name: true } },
        seat: { select: { section: true, row: true, number: true } },
        holder: { select: { id: true, fullName: true, email: true } },
        orderItem: { select: { order: { select: { id: true, reference: true } } } },
      },
    }),
  ])
  return paged(rows, total, current)
}

export const getTicket = async (id: string) => {
  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: {
      event: { select: { id: true, name: true, startAt: true, status: true, venue: { select: { name: true } } } },
      ticketCategory: { select: { name: true } },
      seat: { select: { section: true, row: true, number: true } },
      orderItem: { select: { unitPrice: true, serviceFeeAmount: true, order: { select: { id: true, reference: true, paidAt: true } } } },
      refunds: { select: { id: true, status: true, type: true, amount: true, reason: true, rejectionReason: true, createdAt: true }, orderBy: { createdAt: 'desc' } },
      scanRecords: { select: { id: true, result: true, method: true, scannedAt: true }, orderBy: { scannedAt: 'desc' }, take: 10 },
    },
  })
  if (!ticket) throw new AdminError('Ticket not found', 404)
  const chain = await getTransferChain(id)
  const { qrToken: _secret, ...safe } = ticket
  return { ...safe, ...chain }
}

export const voidTicket = async (adminId: string, id: string, reason: string) => {
  if (!text(reason)) throw new AdminError('Please give a reason')
  // Voiding stops the ticket at the gate and puts its place back on sale. It does NOT refund anyone:
  // that is a deliberate choice (stolen, duplicate or fraudulent tickets); use Refunds to pay money back.
  await prisma.$transaction(async (tx) => {
    // conditional update: if two admins void the same ticket at once, only one succeeds,
    // so the sold count goes down exactly once
    const ticket = await tx.ticket.findUnique({ where: { id }, select: { ticketCategoryId: true } })
    if (!ticket) throw new AdminError('Ticket not found', 404)
    const { count } = await tx.ticket.updateMany({ where: { id, status: 'VALID' }, data: { status: 'VOID' } })
    if (count !== 1) throw new AdminError('Only valid tickets can be voided')
    await tx.$executeRaw`UPDATE ticket_categories SET sold_count = sold_count - 1 WHERE id = ${ticket.ticketCategoryId}::uuid`
  })
  await audit(adminId, 'TICKET_VOIDED', 'Ticket', id, { reason })
  return getTicket(id)
}

export const resendAdminTicket = async (adminId: string, id: string) => {
  const ticket = await prisma.ticket.findUnique({ where: { id }, select: { status: true } })
  if (!ticket) throw new AdminError('Ticket not found', 404)
  if (ticket.status !== 'VALID') throw new AdminError('Only valid tickets can be emailed')
  await sendTicketEmail(id).catch(() => { throw new AdminError('The email could not be sent right now', 502) })
  await audit(adminId, 'TICKET_EMAILED', 'Ticket', id)
}

// ─── Refunds ────────────────────────────────────────────────────────────────

export const listAdminRefunds = async (q: Record<string, unknown>) => {
  const status = ['SUBMITTED', 'APPROVED', 'REJECTED', 'SETTLED'].includes(String(q.status)) ? (q.status as 'SUBMITTED') : undefined
  const rows = await listRefunds(status)
  const counts = await prisma.refund.groupBy({ by: ['status'], _count: true })
  return { rows: rows.reverse(), counts: Object.fromEntries(counts.map((c) => [c.status, c._count])) }
}
export { approveRefund, rejectRefund, settleRefund }

// ─── Users ──────────────────────────────────────────────────────────────────

export const listUsers = async (q: Record<string, unknown>) => {
  const search = text(q.q)
  const where: Prisma.UserWhereInput = {
    email: { not: { endsWith: '@deleted.hafletna' } },
    ...(q.role === 'ADMIN' || q.role === 'USER' ? { role: q.role } : {}),
    ...(q.blocked === 'true' ? { isBlocked: true } : {}),
    ...(search && { OR: [{ fullName: { contains: search, mode: 'insensitive' } }, { email: { contains: search, mode: 'insensitive' } }, { phone: { contains: search } }] }),
  }
  const current = page(q.page)
  const [total, rows] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where, orderBy: { createdAt: 'desc' }, skip: (current - 1) * PAGE, take: PAGE,
      select: {
        id: true, fullName: true, email: true, phone: true, role: true, isBlocked: true, blockedReason: true, createdAt: true, googleId: true,
        _count: { select: { orders: true, heldTickets: { where: { status: 'VALID' } } } },
      },
    }),
  ])
  const spent = await prisma.order.groupBy({ by: ['userId'], where: { userId: { in: rows.map((r) => r.id) }, status: 'PAID' }, _sum: { total: true } })
  const spentBy = new Map(spent.map((s) => [s.userId, Number(s._sum.total ?? 0)]))
  return paged(rows.map(({ googleId, _count, ...u }) => ({ ...u, google: !!googleId, orders: _count.orders, tickets: _count.heldTickets, spent: spentBy.get(u.id) ?? 0 })), total, current)
}

export const getUser = async (id: string) => {
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true, fullName: true, email: true, phone: true, role: true, isBlocked: true, blockedReason: true, blockedAt: true, marketingOptIn: true, createdAt: true, googleId: true,
      blockedBy: { select: { fullName: true } },
      orders: { orderBy: { createdAt: 'desc' }, take: 20, select: { id: true, reference: true, status: true, total: true, createdAt: true, event: { select: { name: true } } } },
      heldTickets: { orderBy: { createdAt: 'desc' }, take: 30, select: { id: true, attendeeName: true, status: true, event: { select: { name: true, startAt: true } }, ticketCategory: { select: { name: true } } } },
      refundsPaid: { orderBy: { createdAt: 'desc' }, take: 20, select: { id: true, status: true, amount: true, createdAt: true, ticket: { select: { event: { select: { name: true } } } } } },
    },
  })
  if (!user) throw new AdminError('User not found', 404)
  const spent = await prisma.order.aggregate({ where: { userId: id, status: 'PAID' }, _sum: { total: true } })
  const { googleId, refundsPaid, ...rest } = user
  return { ...rest, refundsAsPayee: refundsPaid, google: !!googleId, spent: Number(spent._sum.total ?? 0) }
}

export const blockUser = async (adminId: string, id: string, reason: string) => {
  if (id === adminId) throw new AdminError('You cannot block your own account')
  if (!text(reason)) throw new AdminError('Please give a reason')
  const user = await prisma.user.findUnique({ where: { id }, select: { isBlocked: true } })
  if (!user) throw new AdminError('User not found', 404)
  await prisma.user.update({ where: { id }, data: { isBlocked: true, blockedReason: text(reason).slice(0, 500), blockedAt: new Date(), blockedById: adminId } })
  await audit(adminId, 'USER_BLOCKED', 'User', id, { reason })
  return getUser(id)
}

export const unblockUser = async (adminId: string, id: string) => {
  await prisma.user.update({ where: { id }, data: { isBlocked: false, blockedReason: null, blockedAt: null, blockedById: null } }).catch(() => { throw new AdminError('User not found', 404) })
  await audit(adminId, 'USER_UNBLOCKED', 'User', id)
  return getUser(id)
}

export const setUserRole = async (adminId: string, id: string, role: unknown) => {
  if (role !== 'ADMIN' && role !== 'USER') throw new AdminError('Role must be ADMIN or USER')
  if (id === adminId && role !== 'ADMIN') throw new AdminError('You cannot remove your own admin access')
  await prisma.user.update({ where: { id }, data: { role } }).catch(() => { throw new AdminError('User not found', 404) })
  await audit(adminId, role === 'ADMIN' ? 'USER_MADE_ADMIN' : 'USER_ADMIN_REMOVED', 'User', id)
  return getUser(id)
}

// ─── Venues ─────────────────────────────────────────────────────────────────

export const listAdminVenues = async () => {
  const venues = await getAllVenues()
  const counts = await prisma.event.groupBy({ by: ['venueId', 'status'], _count: true })
  return venues.map((v) => {
    const mine = counts.filter((c) => c.venueId === v.id)
    return { ...v, events: mine.reduce((n, c) => n + c._count, 0), published: mine.find((c) => c.status === 'PUBLISHED')?._count ?? 0 }
  })
}

export const getAdminVenue = async (slug: string) => {
  const layout = await getVenueLayout(slug).catch(() => { throw new AdminError('Venue not found', 404) })
  const row = await prisma.venue.findUnique({ where: { slug }, select: { layout: true } })
  const events = await prisma.event.findMany({
    where: { venueId: layout.venue.id }, orderBy: { startAt: 'asc' },
    select: { id: true, name: true, status: true, startAt: true, ticketCategories: { select: { soldCount: true, capacity: true } } },
  })
  const sold = await prisma.ticket.count({ where: { event: { venueId: layout.venue.id }, status: { in: ['VALID', 'USED'] } } })
  return {
    ...layout,
    definition: row?.layout ?? null,
    hasSales: sold > 0,
    events: events.map((e) => ({ ...e, sold: e.ticketCategories.reduce((n, c) => n + c.soldCount, 0), capacity: e.ticketCategories.reduce((n, c) => n + c.capacity, 0), ticketCategories: undefined })),
  }
}

const slugify = (name: string) =>
  name.toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').replace(/-+/g, '-').slice(0, 80) || 'venue'

const PALETTE = ['#C9A227', '#2E86AB', '#6C757D', '#8E44AD', '#16A085', '#D35400']

/**
 * Builds a full layout from the admin form:
 *  seated:   sections → rows (label, seats, category)
 *  standing: zones (label, capacity, category); rectangles are laid out top to bottom automatically
 * New categories, sections and zones get keys from their names (VIP → VIP, "General Admission" →
 * GENERAL_ADMISSION). When editing, the form sends the existing keys (and zone positions) back and they
 * are kept: events' ticket types, seats and zones are linked by those keys, so they must not change.
 */
const layoutFromForm = (body: Record<string, unknown>, slug: string, coords: { latitude: number; longitude: number }, mapUrl?: string) => {
  const keyOf = (s: string) => s.toUpperCase().normalize('NFKD').replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').replace(/^(\d)/, 'C_$1').slice(0, 40) || 'GENERAL'
  const validKey = (k: unknown) => (typeof k === 'string' && /^[A-Z][A-Z0-9_]{0,49}$/.test(k) ? k : null)
  const num = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback)
  const cats = (Array.isArray(body.categories) ? body.categories : []) as { key?: string; label?: string; color?: string }[]
  const categories = cats.filter((c) => text(c.label)).map((c, i) => ({
    key: validKey(c.key) ?? keyOf(text(c.label)), label: text(c.label), color: /^#[0-9a-f]{6}$/i.test(String(c.color)) ? String(c.color) : PALETTE[i % PALETTE.length],
  }))
  const catKey = (label: unknown) => categories.find((c) => c.label === text(label) || c.key === text(label))?.key ?? keyOf(text(label))
  const type = body.type === 'STANDING' ? 'STANDING' : 'SEATED'
  const base = {
    slug, name: text(body.name), address: text(body.address), city: text(body.city), country: 'Egypt',
    latitude: coords.latitude, longitude: coords.longitude,
    ...(text(body.image) && { image: text(body.image) }),
    ...(mapUrl && { mapUrl }),
    stage: { position: (['top', 'bottom', 'left', 'right'].includes(String(body.stage)) ? body.stage : 'top') as 'top' },
    categories,
  }
  if (type === 'SEATED') {
    const sections = ((body.sections ?? []) as { key?: string; label?: string; rows?: { label?: string; seats?: unknown; category?: string }[] }[]).map((s, i) => ({
      key: validKey(s.key) ?? keyOf(text(s.label) || `S${i + 1}`), label: text(s.label) || `Section ${i + 1}`,
      rows: (s.rows ?? []).map((r) => ({ label: text(r.label), seats: Number(r.seats), category: catKey(r.category) })),
    }))
    const capacity = sections.reduce((n, s) => n + s.rows.reduce((m, r) => m + (Number.isFinite(r.seats) ? r.seats : 0), 0), 0)
    return { ...base, type, capacity, sections }
  }
  const raw = (body.zones ?? []) as { key?: string; label?: string; capacity?: unknown; category?: string; x?: unknown; y?: unknown; width?: unknown; height?: unknown }[]
  const h = raw.length ? Math.floor(80 / raw.length) : 80
  const zones = raw.map((z, i) => ({
    key: validKey(z.key) ?? keyOf(text(z.label) || `Z${i + 1}`), label: text(z.label) || `Zone ${i + 1}`, category: catKey(z.category), capacity: Number(z.capacity),
    // an existing zone keeps where it is drawn; a new one is stacked below the stage
    x: num(z.x, 5), y: num(z.y, 15 + i * h), width: num(z.width, 90), height: num(z.height, Math.max(5, h - 3)),
  }))
  return { ...base, type, capacity: zones.reduce((n, z) => n + (Number.isFinite(z.capacity) ? z.capacity : 0), 0), zones }
}

const placeOf = async (body: Record<string, unknown>, fallback?: { latitude: number; longitude: number; mapUrl?: string | null }) => {
  if (text(body.mapUrl)) {
    const r = await resolveMapLink(text(body.mapUrl)).catch((e) => { throw new AdminError(e.message) })
    return { latitude: r.latitude, longitude: r.longitude, mapUrl: r.mapUrl }
  }
  if (fallback) return { latitude: fallback.latitude, longitude: fallback.longitude, mapUrl: fallback.mapUrl ?? undefined }
  throw new AdminError('Paste the venue’s Google Maps link so customers can find it')
}

const checkVenueForm = (body: Record<string, unknown>) => {
  if (!text(body.name) || !text(body.address)) throw new AdminError('Please fill in the venue name and address')
  if (!CITIES.includes(text(body.city) as never)) throw new AdminError('Choose Cairo, Giza or Alexandria')
}

export const createVenue = async (adminId: string, body: Record<string, unknown>) => {
  checkVenueForm(body)
  const place = await placeOf(body)
  let slug = slugify(text(body.name))
  for (let i = 2; await prisma.venue.findUnique({ where: { slug }, select: { id: true } }); i++) slug = `${slugify(text(body.name))}-${i}`
  const { layout, problems } = parseLayout(layoutFromForm(body, slug, place, place.mapUrl))
  if (!layout) throw new AdminError(`The layout is not complete: ${problems[0]}`)
  const { venue } = await saveVenue(layout)
  await audit(adminId, 'VENUE_CREATED', 'Venue', venue.id, { name: venue.name })
  return getAdminVenue(slug)
}

export const updateVenue = async (adminId: string, slug: string, body: Record<string, unknown>) => {
  checkVenueForm(body)
  const current = await getAdminVenue(slug)
  const place = await placeOf(body, { latitude: Number(current.venue.latitude), longitude: Number(current.venue.longitude), mapUrl: current.venue.mapUrl })
  const stored = parseLayout(current.definition)
  let layout: VenueLayout
  if (current.hasSales && stored.layout) {
    // Tickets are sold here: the seats, zones and areas stay exactly as they are. Only the venue's
    // description changes, so the stored layout is reused instead of being rebuilt from the form.
    const { image: _i, mapUrl: _m, ...shape } = stored.layout
    layout = {
      ...shape, name: text(body.name), address: text(body.address), city: text(body.city),
      latitude: place.latitude, longitude: place.longitude,
      ...(text(body.image) && { image: text(body.image) }), ...(place.mapUrl && { mapUrl: place.mapUrl }),
    }
  } else {
    const built = parseLayout(layoutFromForm(body, slug, place, place.mapUrl))
    if (!built.layout) throw new AdminError(`The layout is not complete: ${built.problems[0]}`)
    layout = built.layout
    // events sell tickets per area: an area some event already prices cannot disappear
    const priced = await prisma.ticketCategory.findMany({ where: { event: { venueId: current.venue.id } }, select: { categoryKey: true }, distinct: ['categoryKey'] })
    const missing = priced.map((c) => c.categoryKey).filter((k) => !layout.categories.some((c) => c.key === k))
    if (missing.length) throw new AdminError(`Events at this venue sell tickets for ${missing.join(', ')}, so that area cannot be removed or renamed.`)
  }
  const { venue } = await saveVenue(layout).catch((e) => {
    // a seat or zone still referenced by an old reservation or ticket cannot be deleted
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
      throw new AdminError('Some seats or zones you removed are still linked to reservations or tickets, so they must stay.')
    }
    throw e
  })
  await audit(adminId, 'VENUE_UPDATED', 'Venue', venue.id, { name: venue.name })
  return getAdminVenue(slug)
}

export const deleteVenue = async (adminId: string, slug: string) => {
  const venue = await prisma.venue.findUnique({ where: { slug }, select: { id: true, name: true, _count: { select: { events: true } } } })
  if (!venue) throw new AdminError('Venue not found', 404)
  if (venue._count.events > 0) throw new AdminError('This venue has events. Move or delete them first.')
  await prisma.$transaction([
    prisma.seat.deleteMany({ where: { venueId: venue.id } }),
    prisma.venueZone.deleteMany({ where: { venueId: venue.id } }),
    prisma.venue.delete({ where: { id: venue.id } }),
  ])
  await audit(adminId, 'VENUE_DELETED', 'Venue', venue.id, { name: venue.name })
}

export const previewMapLink = async (url: unknown) => resolveMapLink(text(url)).catch((e) => { throw new AdminError(e.message) })

// ─── Gate staff ─────────────────────────────────────────────────────────────

const staffSelect = {
  id: true, fullName: true, username: true, role: true, isBlocked: true, lastLoginAt: true, createdAt: true,
  assignments: { where: { revokedAt: null }, select: { id: true, event: { select: { id: true, name: true, startAt: true } } } },
  _count: { select: { scanRecords: true } },
} satisfies Prisma.StaffAccountSelect

export const listStaff = () => prisma.staffAccount.findMany({ select: staffSelect, orderBy: [{ role: 'desc' }, { fullName: 'asc' }] })

export const createStaff = async (adminId: string, body: Record<string, unknown>) => {
  const username = text(body.username).toLowerCase()
  if (!text(body.fullName) || !/^[a-z0-9._-]{3,40}$/.test(username)) throw new AdminError('Enter a name and a username (3–40 letters, numbers, dots or dashes)')
  if (String(body.password ?? '').length < 8) throw new AdminError('The password must be at least 8 characters: these accounts decide who gets into events')
  if (await prisma.staffAccount.findUnique({ where: { username } })) throw new AdminError('This username is taken')
  const staff = await prisma.staffAccount.create({
    data: { fullName: text(body.fullName), username, passwordHash: await bcrypt.hash(String(body.password), 10), role: body.role === 'APP_ADMIN' ? 'APP_ADMIN' : 'SCANNER' },
    select: staffSelect,
  })
  await audit(adminId, 'STAFF_CREATED', 'StaffAccount', staff.id, { username })
  return staff
}

export const setStaffBlocked = async (adminId: string, id: string, blocked: boolean) => {
  const staff = await prisma.staffAccount.update({ where: { id }, data: { isBlocked: blocked, blockedAt: blocked ? new Date() : null }, select: staffSelect })
    .catch(() => { throw new AdminError('Staff account not found', 404) })
  await audit(adminId, blocked ? 'STAFF_BLOCKED' : 'STAFF_UNBLOCKED', 'StaffAccount', id)
  return staff
}

export const assignStaff = async (adminId: string, staffId: string, eventId: string) => {
  // assignments are granted by a gate app administrator account; use the first one
  const grantor = await prisma.staffAccount.findFirst({ where: { role: 'APP_ADMIN' }, select: { id: true } })
  if (!grantor) throw new AdminError('Create a gate admin account first')
  if (!(await prisma.event.findUnique({ where: { id: eventId }, select: { id: true } }))) throw new AdminError('Event not found', 404)
  await prisma.staffEventAssignment.upsert({
    where: { staffId_eventId: { staffId, eventId } },
    create: { staffId, eventId, grantedById: grantor.id },
    update: { revokedAt: null },
  })
  await audit(adminId, 'STAFF_ASSIGNED', 'StaffAccount', staffId, { eventId })
  return prisma.staffAccount.findUnique({ where: { id: staffId }, select: staffSelect })
}

export const unassignStaff = async (adminId: string, staffId: string, eventId: string) => {
  await prisma.staffEventAssignment.updateMany({ where: { staffId, eventId, revokedAt: null }, data: { revokedAt: new Date() } })
  await audit(adminId, 'STAFF_UNASSIGNED', 'StaffAccount', staffId, { eventId })
  return prisma.staffAccount.findUnique({ where: { id: staffId }, select: staffSelect })
}

// ─── Activity log ───────────────────────────────────────────────────────────

export const listActivity = async (q: Record<string, unknown>) => {
  const current = page(q.page)
  const where: Prisma.AuditLogWhereInput = text(q.entityType) ? { entityType: text(q.entityType) } : {}
  const [total, rows] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where, orderBy: { createdAt: 'desc' }, skip: (current - 1) * PAGE * 2, take: PAGE * 2,
      select: { id: true, action: true, entityType: true, entityId: true, details: true, createdAt: true, actorUser: { select: { fullName: true } }, actorStaff: { select: { fullName: true } } },
    }),
  ])
  return { rows, total, page: current, pageCount: Math.max(1, Math.ceil(total / (PAGE * 2))) }
}

export const lookups = async () => ({
  categories: EVENT_CATEGORIES,
  cities: CITIES,
  venues: await prisma.venue.findMany({ select: { id: true, name: true, city: true, type: true, capacity: true }, orderBy: { name: 'asc' } }),
  events: await prisma.event.findMany({ where: { status: { not: 'CANCELLED' } }, select: { id: true, name: true, startAt: true }, orderBy: { startAt: 'asc' } }),
})
