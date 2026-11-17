/**
 * Functions for administrators: sales, revenue, events, orders, customers, refunds, staff and the
 * activity log, read through the same services as the admin console, so the assistant and the
 * console always agree.
 *
 * Read-only by design: nothing here approves, cancels, blocks or changes anything. Those actions
 * stay in the admin console, behind its confirmations, because a misunderstood sentence must never
 * refund money or cancel an event.
 *
 * Offered only when the signed-in user is an administrator (role ADMIN, read from the database by
 * the auth middleware). Customer details (names, emails, phones) are sent to Gemini when asked for;
 * see the chatbot design notes about enabling billing before real customer data is used.
 */
import { Prisma } from '@prisma/client'
import prisma from '../../../config/db'
import { getDashboard, getEvent, getOrder, getUser, listActivity, listAdminRefunds, listEvents, listOrders, listStaff, listUsers } from '../../admin/admin.service'
import type { ToolDeclaration } from '../llm'

const CAIRO = 'Africa/Cairo'
const when = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: CAIRO })
const day = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: CAIRO })
const egp = (n: unknown) => `${Number(n ?? 0).toLocaleString('en-US', { maximumFractionDigits: 2 })} EGP`
const isDay = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v))
const text = (v: unknown, max = 100) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined)
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const oneOf = <T extends string>(v: unknown, values: readonly T[]) => (values.includes(v as T) ? (v as T) : undefined)

/** Midnight in Cairo at the start of a YYYY-MM-DD day, as a UTC instant (Egypt is UTC+2 or +3) */
const cairoMidnight = (yyyyMmDd: string) => {
  const guess = new Date(`${yyyyMmDd}T00:00:00Z`)
  const offset = Number(
    new Intl.DateTimeFormat('en-US', { timeZone: CAIRO, timeZoneName: 'shortOffset' })
      .formatToParts(guess)
      .find((p) => p.type === 'timeZoneName')
      ?.value.replace('GMT', '') || 0,
  )
  return new Date(guess.getTime() - offset * 3_600_000)
}

/** What the admin functions showed, so the reply can link to the right console pages */
export type AdminSeen = {
  events: Map<string, string>
  orders: Map<string, string>
  customers: Map<string, string>
  usedRefunds: boolean
}

export const adminTools: ToolDeclaration[] = [
  {
    name: 'admin_sales_overview',
    description:
      'Administrator only. The admin dashboard: total revenue, service fees, money refunded, tickets sold, customers, upcoming ' +
      'events, refunds waiting for review, orders and events by status, sales per day for the last 14 days, and the best-selling ' +
      'events. Use it for "how are sales", "how much have we made", "what sells best".',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'admin_revenue',
    description:
      'Administrator only. Revenue for any period (Cairo dates, inclusive), optionally for one event: paid orders, tickets, ' +
      'revenue, service fees, and the split per ticket type. Use it for "revenue this week / last month / in October", ' +
      '"how much did event X make".',
    parameters: {
      type: 'object',
      properties: {
        date_from: { type: 'string', description: 'First day, YYYY-MM-DD; omit for since the beginning' },
        date_to: { type: 'string', description: 'Last day, YYYY-MM-DD; omit for up to today' },
        event_id: { type: 'string', description: 'Only this event (an event_id from admin_find_events)' },
      },
    },
  },
  {
    name: 'admin_find_events',
    description:
      'Administrator only. Lists events of any status (draft, published, cancelled; past or upcoming) with tickets sold, ' +
      'capacity and starting price. Filter by words in the name or performer, status, and upcoming/past.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Words in the event name or performer' },
        status: { type: 'string', enum: ['DRAFT', 'PUBLISHED', 'CANCELLED'] },
        when: { type: 'string', enum: ['upcoming', 'past'] },
      },
    },
  },
  {
    name: 'admin_event_report',
    description:
      'Administrator only. Everything about one event: status, dates, venue, revenue, orders and tickets by status (USED = ' +
      'checked in at the gate), each ticket type with price, sold, held and capacity, unpriced venue areas, and the gate staff ' +
      'assigned.',
    parameters: { type: 'object', properties: { event_id: { type: 'string' } }, required: ['event_id'] },
  },
  {
    name: 'admin_find_orders',
    description:
      'Administrator only. Searches orders (newest first, 15 per page) by order reference, customer name or email, or event ' +
      'name, and by status. Also gives the paid total of all matches.',
    parameters: {
      type: 'object',
      properties: {
        search: { type: 'string', description: 'Order reference (e.g. HF-7K2Q9M), customer name or email, or event name' },
        status: { type: 'string', enum: ['PENDING', 'PAID', 'FAILED', 'CANCELLED'] },
        event_id: { type: 'string' },
        page: { type: 'number' },
      },
    },
  },
  {
    name: 'admin_order_details',
    description:
      'Administrator only. One order by its reference: customer (name, email, phone), event, payment, ticket types, and each ' +
      'ticket with attendee, seat, status and current holder.',
    parameters: { type: 'object', properties: { reference: { type: 'string', description: 'e.g. HF-7K2Q9M' } }, required: ['reference'] },
  },
  {
    name: 'admin_find_customers',
    description:
      'Administrator only. Searches accounts (15 per page) by name, email or phone, optionally only blocked ones, with orders, ' +
      'valid tickets held and money spent.',
    parameters: {
      type: 'object',
      properties: {
        search: { type: 'string' },
        blocked_only: { type: 'boolean' },
        role: { type: 'string', enum: ['USER', 'ADMIN'] },
        page: { type: 'number' },
      },
    },
  },
  {
    name: 'admin_customer_details',
    description:
      'Administrator only. One account by email or customer_id: contact details, blocked status and reason, money spent, ' +
      'recent orders, tickets held and refunds.',
    parameters: {
      type: 'object',
      properties: { email: { type: 'string' }, customer_id: { type: 'string', description: 'A customer_id from admin_find_customers' } },
    },
  },
  {
    name: 'admin_refunds',
    description:
      'Administrator only. Refunds by status with counts per status. SUBMITTED = waiting for review (oldest first, so requests ' +
      'near their event are not missed), APPROVED = money on its way, SETTLED = paid back, REJECTED = declined.',
    parameters: { type: 'object', properties: { status: { type: 'string', enum: ['SUBMITTED', 'APPROVED', 'REJECTED', 'SETTLED'] } } },
  },
  {
    name: 'admin_staff',
    description: 'Administrator only. Gate staff accounts: role, blocked or not, and the events each is assigned to.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'admin_activity',
    description:
      'Administrator only. The latest 30 entries of the activity log (who did what, when): event changes, refunds, blocks, ' +
      'staff changes. Optionally only one kind of record.',
    parameters: {
      type: 'object',
      properties: { record_type: { type: 'string', enum: ['Event', 'Order', 'Ticket', 'Refund', 'User', 'Venue', 'StaffAccount'] } },
    },
  },
]

export const ADMIN_TOOL_NAMES = new Set(adminTools.map((t) => t.name))

/** Runs one admin function. Only call this for a signed-in administrator. */
export const runAdminTool = async (name: string, args: Record<string, unknown>, seen: AdminSeen): Promise<Record<string, unknown>> => {
  switch (name) {
    case 'admin_sales_overview': {
      const d = await getDashboard()
      for (const e of d.topEvents) seen.events.set(e.id, e.name)
      return {
        revenue_paid_orders: egp(d.revenue),
        of_which_service_fees: egp(d.serviceFees),
        refunded_so_far: egp(d.refunded),
        tickets_sold: d.ticketsSold,
        customers: d.customers,
        upcoming_published_events: d.upcomingEvents,
        refunds_waiting_for_review: d.pendingRefunds,
        orders_by_status: d.orders,
        events_by_status: d.events,
        last_14_days: d.sales.map((s) => ({ day: s.day, revenue: egp(s.revenue), orders: s.orders, tickets: s.tickets })),
        best_selling_events: d.topEvents.map((e) => ({ event_id: e.id, name: e.name, sold: e.sold, capacity: e.capacity, revenue: egp(e.revenue) })),
      }
    }

    case 'admin_revenue': {
      const from = isDay(args.date_from) ? cairoMidnight(args.date_from) : undefined
      const to = isDay(args.date_to) ? new Date(cairoMidnight(args.date_to).getTime() + 86_400_000) : undefined
      const eventId = typeof args.event_id === 'string' && UUID.test(args.event_id) ? args.event_id : undefined
      const where: Prisma.OrderWhereInput = {
        status: 'PAID',
        ...(eventId && { eventId }),
        ...((from || to) && { paidAt: { ...(from && { gte: from }), ...(to && { lt: to }) } }),
      }
      const [sum, perType] = await Promise.all([
        prisma.order.aggregate({ where, _sum: { total: true, serviceFeeTotal: true }, _count: true }),
        prisma.orderItem.groupBy({
          by: ['ticketCategoryId'],
          where: { order: where },
          _sum: { quantity: true },
        }),
      ])
      const categories = await prisma.ticketCategory.findMany({
        where: { id: { in: perType.map((p) => p.ticketCategoryId) } },
        select: { id: true, name: true, event: { select: { id: true, name: true } } },
      })
      const byId = new Map(categories.map((c) => [c.id, c]))
      for (const c of categories) seen.events.set(c.event.id, c.event.name)
      const tickets = perType.reduce((n, p) => n + (p._sum.quantity ?? 0), 0)
      return {
        period: `${isDay(args.date_from) ? args.date_from : 'the beginning'} to ${isDay(args.date_to) ? args.date_to : 'today'} (Cairo dates)`,
        event: eventId ? categories[0]?.event.name ?? 'no paid orders for this event in the period' : 'all events',
        paid_orders: sum._count,
        tickets,
        revenue: egp(sum._sum.total),
        of_which_service_fees: egp(sum._sum.serviceFeeTotal),
        tickets_per_type: perType
          .map((p) => ({ event: byId.get(p.ticketCategoryId)?.event.name, ticket_type: byId.get(p.ticketCategoryId)?.name, tickets: p._sum.quantity ?? 0 }))
          .sort((a, b) => b.tickets - a.tickets)
          .slice(0, 20),
      }
    }

    case 'admin_find_events': {
      const result = await listEvents({ q: text(args.query), status: oneOf(args.status, ['DRAFT', 'PUBLISHED', 'CANCELLED'] as const), when: oneOf(args.when, ['upcoming', 'past'] as const) })
      for (const e of result.rows) seen.events.set(e.id, e.name)
      return {
        total: result.total,
        events: result.rows.map((e) => ({
          event_id: e.id,
          name: e.name,
          status: e.status,
          starts: when.format(e.startAt),
          past: e.isPast,
          venue: `${e.venue.name}, ${e.venue.city}`,
          sold: e.sold,
          capacity: e.capacity,
          from_price: e.fromPrice === null ? 'no ticket types yet' : egp(e.fromPrice),
        })),
      }
    }

    case 'admin_event_report': {
      const id = typeof args.event_id === 'string' ? args.event_id.trim() : ''
      if (!UUID.test(id)) return { error: 'event_id must come from admin_find_events or admin_sales_overview' }
      const e = await getEvent(id).catch(() => null)
      if (!e) return { error: 'No such event' }
      seen.events.set(e.id, e.name)
      return {
        name: e.name,
        status: e.status,
        cancellation_reason: e.cancellationReason ?? undefined,
        starts: when.format(e.startAt),
        doors: when.format(e.doorsOpenAt),
        venue: `${e.venue.name}, ${e.venue.city} (capacity ${e.venue.capacity})`,
        created_by: e.createdBy.fullName,
        revenue: egp(e.stats.revenue),
        orders_by_status: e.stats.orders,
        tickets_by_status: e.stats.tickets,
        ticket_types: e.ticketCategories.map((c) => ({
          name: c.name,
          price: egp(c.price),
          service_fee: `${Number(c.serviceFeePercent)}%`,
          sold: c.soldCount,
          held_in_checkout: c.heldCount,
          capacity: c.capacity,
          left: Math.max(0, c.capacity - c.soldCount - c.heldCount),
        })),
        venue_areas_without_tickets: e.availableCategories.map((c: { key: string }) => c.key),
        gate_staff: e.staffAssignments.map((a) => a.staff.fullName),
      }
    }

    case 'admin_find_orders': {
      const result = await listOrders({
        q: text(args.search),
        status: oneOf(args.status, ['PENDING', 'PAID', 'FAILED', 'CANCELLED'] as const),
        eventId: typeof args.event_id === 'string' && UUID.test(args.event_id) ? args.event_id : undefined,
        page: typeof args.page === 'number' ? args.page : undefined,
      })
      for (const o of result.rows) {
        seen.orders.set(o.id, o.reference)
        seen.events.set(o.event.id, o.event.name)
      }
      return {
        total: result.total,
        page: `${result.page} of ${result.pageCount}`,
        paid_total_of_matches: egp(result.paidTotal),
        orders: result.rows.map((o) => ({
          reference: o.reference,
          status: o.status,
          customer: `${o.user.fullName} <${o.user.email}>`,
          event: o.event.name,
          tickets: o.tickets,
          total: egp(o.total),
          placed: when.format(o.createdAt),
          paid: o.paidAt ? when.format(o.paidAt) : undefined,
          payment: o.payment ? `${o.payment.provider} ${o.payment.status}` : undefined,
        })),
      }
    }

    case 'admin_order_details': {
      const reference = text(args.reference, 20)?.toUpperCase()
      if (!reference) return { error: 'Give the order reference' }
      const found = await prisma.order.findUnique({ where: { reference }, select: { id: true } })
      if (!found) return { error: `No order has the reference ${reference}` }
      const o = await getOrder(found.id)
      seen.orders.set(o.id, o.reference)
      seen.events.set(o.event.id, o.event.name)
      seen.customers.set(o.user.id, o.user.fullName)
      return {
        reference: o.reference,
        status: o.status,
        customer: { name: o.user.fullName, email: o.user.email, phone: o.user.phone },
        event: `${o.event.name}, ${when.format(o.event.startAt)}, ${o.event.venue.name}`,
        subtotal: egp(o.subtotal),
        service_fees: egp(o.serviceFeeTotal),
        total: egp(o.total),
        placed: when.format(o.createdAt),
        paid: o.paidAt ? when.format(o.paidAt) : undefined,
        payment: o.payment ? { provider: o.payment.provider, status: o.payment.status, amount: egp(o.payment.amount) } : 'no payment yet',
        tickets: o.items.flatMap((i) =>
          i.tickets.map((t) => ({
            ticket_type: i.ticketCategory.name,
            attendee: t.attendeeName,
            status: t.status,
            seat: t.seat ? `${t.seat.section}-${t.seat.row}-${t.seat.number}` : undefined,
            held_by: t.holder.id === o.user.id ? 'the buyer' : `${t.holder.fullName} <${t.holder.email}> (transferred)`,
          })),
        ),
      }
    }

    case 'admin_find_customers': {
      const result = await listUsers({
        q: text(args.search),
        blocked: args.blocked_only === true ? 'true' : undefined,
        role: oneOf(args.role, ['USER', 'ADMIN'] as const),
        page: typeof args.page === 'number' ? args.page : undefined,
      })
      for (const u of result.rows) seen.customers.set(u.id, u.fullName)
      return {
        total: result.total,
        page: `${result.page} of ${result.pageCount}`,
        accounts: result.rows.map((u) => ({
          customer_id: u.id,
          name: u.fullName,
          email: u.email,
          phone: u.phone ?? undefined,
          role: u.role,
          blocked: u.isBlocked ? `yes${u.blockedReason ? ` (${u.blockedReason})` : ''}` : 'no',
          orders: u.orders,
          valid_tickets: u.tickets,
          spent: egp(u.spent),
          joined: day.format(u.createdAt),
        })),
      }
    }

    case 'admin_customer_details': {
      const email = text(args.email, 200)?.toLowerCase()
      let id = typeof args.customer_id === 'string' && UUID.test(args.customer_id) ? args.customer_id : undefined
      if (!id && email) id = (await prisma.user.findUnique({ where: { email }, select: { id: true } }))?.id
      if (!id) return { error: email ? `No account uses ${email}` : 'Give an email or a customer_id' }
      const u = await getUser(id).catch(() => null)
      if (!u) return { error: 'No such account' }
      seen.customers.set(u.id, u.fullName)
      for (const o of u.orders) seen.orders.set(o.id, o.reference)
      return {
        name: u.fullName,
        email: u.email,
        phone: u.phone ?? undefined,
        role: u.role,
        signs_in_with_google: u.google,
        marketing_emails: u.marketingOptIn,
        joined: day.format(u.createdAt),
        blocked: u.isBlocked ? { since: u.blockedAt ? when.format(u.blockedAt) : undefined, reason: u.blockedReason, by: u.blockedBy?.fullName } : 'no',
        spent: egp(u.spent),
        recent_orders: u.orders.map((o) => ({ reference: o.reference, status: o.status, total: egp(o.total), event: o.event.name, placed: day.format(o.createdAt) })),
        tickets: u.heldTickets.map((t) => ({ event: t.event.name, starts: day.format(t.event.startAt), type: t.ticketCategory.name, attendee: t.attendeeName, status: t.status })),
        refunds: u.refundsAsPayee.map((r) => ({ event: r.ticket.event.name, status: r.status, amount: egp(r.amount), requested: day.format(r.createdAt) })),
      }
    }

    case 'admin_refunds': {
      seen.usedRefunds = true
      const result = await listAdminRefunds({ status: oneOf(args.status, ['SUBMITTED', 'APPROVED', 'REJECTED', 'SETTLED'] as const) })
      // the console shows newest first; the review queue reads best oldest first
      const rows = args.status === 'SUBMITTED' ? [...result.rows].reverse() : result.rows
      for (const r of rows.slice(0, 20)) seen.events.set(r.ticket.event.id, r.ticket.event.name)
      return {
        counts_by_status: result.counts,
        shown: Math.min(20, rows.length),
        refunds: rows.slice(0, 20).map((r) => ({
          status: r.status,
          kind: r.type,
          customer: `${r.payee.fullName} <${r.payee.email}>`,
          event: `${r.ticket.event.name} (${day.format(r.ticket.event.startAt)})`,
          ticket_type: r.ticket.ticketCategory.name,
          order_reference: r.ticket.orderItem.order.reference,
          amount: egp(r.amount),
          service_fee_kept: egp(r.serviceFeeRetained),
          customer_reason: r.reason ?? undefined,
          requested: when.format(r.createdAt),
          reviewed: r.reviewedAt ? `${when.format(r.reviewedAt)} by ${r.reviewedBy?.fullName ?? 'an administrator'}` : undefined,
          rejection_message: r.rejectionReason ?? undefined,
        })),
      }
    }

    case 'admin_staff': {
      const staff = await listStaff()
      return { staff: JSON.parse(JSON.stringify(staff, (key, value) => (key === 'id' || key === 'passwordHash' ? undefined : value))) }
    }

    case 'admin_activity': {
      const result = await listActivity({ entityType: text(args.record_type) })
      return {
        total: result.total,
        latest: result.rows.map((a) => ({
          when: when.format(a.createdAt),
          who: a.actorUser?.fullName ?? a.actorStaff?.fullName ?? 'system',
          action: a.action,
          record: a.entityType,
          details: a.details ?? undefined,
        })),
      }
    }
  }
  return { error: `Unknown function ${name}` }
}
