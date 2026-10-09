import prisma from '../../config/db'
import { getEventOnSale } from '../events/events.service'

// The governing rule: the database decides availability. A hold is ONE call to a PostgreSQL
// function (migration 20261007120000_hold_functions) that checks the user's limit, does
// "add n, but only if there is room" and writes the hold, all atomically. Keeping it to one
// round trip means a category's counter row is locked for milliseconds, not network round trips.
// A CHECK constraint on ticket_categories and the partial unique index on holds back this up.

export const HOLD_MINUTES = 10 // FR-TKT-10
export const MAX_TICKETS_PER_USER_PER_EVENT = 8 // FR-TKT-05, BR-01

export class InventoryError extends Error {
  constructor(message: string, public status = 400) {
    super(message)
  }
}

const holdSelect = {
  id: true,
  eventId: true,
  ticketCategoryId: true,
  seatId: true,
  quantity: true,
  status: true,
  expiresAt: true,
} as const

// Turns the database function's HF_* errors into messages for the buyer
const toInventoryError = (e: unknown): unknown => {
  const text = e instanceof Error ? e.message : String(e)
  const limit = text.match(/HF_USER_LIMIT:(\d+)/)
  if (limit) {
    return new InventoryError(
      `You can hold at most ${MAX_TICKETS_PER_USER_PER_EVENT} tickets for this event. You can add ${limit[1]} more.`,
    )
  }
  if (text.includes('HF_SOLD_OUT')) return new InventoryError('Not enough tickets left in this category', 409) // FR-TKT-04
  if (text.includes('HF_CATEGORY_NOT_FOUND')) return new InventoryError('Ticket category not found', 404)
  if (text.includes('HF_NOT_STANDING')) return new InventoryError('Choose specific seats for this event')
  if (text.includes('HF_SEAT_NOT_IN_VENUE')) return new InventoryError('One or more seats do not belong to this venue')
  if (text.includes('HF_SEAT_SOLD')) return new InventoryError('One or more of these seats is already sold', 409)
  if (text.includes('HF_SEAT_NOT_ON_SALE')) return new InventoryError('One or more of these seats is not on sale for this event')
  if (text.includes('uidx_holds_seat_active') || text.includes('23505')) {
    return new InventoryError('One or more of these seats is being held by someone else', 409) // FR-TKT-15
  }
  return e
}

const getEventOrFail = async (eventId: string) => {
  try {
    return await getEventOnSale(eventId)
  } catch (e) {
    throw new InventoryError((e as Error).message, (e as Error).message === 'Event not found' ? 404 : 400)
  }
}

/**
 * Standing venues: hold `quantity` places in one category (FR-TKT-19).
 */
export const holdStanding = async (userId: string, eventId: string, ticketCategoryId: string, quantity: number) => {
  if (!Number.isInteger(quantity) || quantity < 1) throw new InventoryError('Quantity must be at least 1')
  await getEventOrFail(eventId)

  let holdId: string
  try {
    const [row] = await prisma.$queryRaw<{ id: string }[]>`
      SELECT hf_hold_standing(${userId}::uuid, ${eventId}::uuid, ${ticketCategoryId}::uuid,
        ${quantity}::int, ${HOLD_MINUTES}::int, ${MAX_TICKETS_PER_USER_PER_EVENT}::int) AS id`
    holdId = row.id
  } catch (e) {
    throw toInventoryError(e)
  }
  return prisma.hold.findUniqueOrThrow({ where: { id: holdId }, select: holdSelect })
}

/**
 * Seated venues: hold specific seats, one hold row per seat (FR-TKT-14/15).
 * All-or-nothing: if any seat is taken, nothing is held.
 */
export const holdSeats = async (userId: string, eventId: string, seatIds: string[]) => {
  const ids = [...new Set(seatIds)]
  if (ids.length === 0) throw new InventoryError('Choose at least one seat')
  const event = await getEventOrFail(eventId)

  let holdIds: string[]
  try {
    const rows = await prisma.$queryRaw<{ id: string }[]>`
      SELECT hf_hold_seats(${userId}::uuid, ${eventId}::uuid, ${event.venueId}::uuid, ${ids}::uuid[],
        ${HOLD_MINUTES}::int, ${MAX_TICKETS_PER_USER_PER_EVENT}::int) AS id`
    holdIds = rows.map((r) => r.id)
  } catch (e) {
    throw toInventoryError(e)
  }
  return prisma.hold.findMany({ where: { id: { in: holdIds } }, select: holdSelect })
}

/**
 * The user removes an item from their selection (FR-TKT-09).
 * One atomic statement: end the hold only if still ACTIVE, and give its places back.
 */
export const releaseHold = async (userId: string, holdId: string) => {
  const [{ released }] = await prisma.$queryRaw<{ released: number }[]>`
    WITH h AS (
      UPDATE holds SET status = 'RELEASED'
      WHERE id = ${holdId}::uuid AND user_id = ${userId}::uuid AND status = 'ACTIVE'
      RETURNING ticket_category_id, quantity
    ), c AS (
      UPDATE ticket_categories tc SET held_count = tc.held_count - h.quantity
      FROM h WHERE tc.id = h.ticket_category_id
      RETURNING 1
    )
    SELECT (SELECT COUNT(*) FROM c)::int AS released`
  if (released !== 1) throw new InventoryError('Hold not found or already ended', 404)
}

/**
 * Releases every hold whose time is up (FR-TKT-10), in one atomic statement. Safe to run
 * from several places at once: a hold can only move out of ACTIVE once.
 */
export const expireHolds = async () => {
  const [{ expired }] = await prisma.$queryRaw<{ expired: number }[]>`
    WITH h AS (
      UPDATE holds SET status = 'EXPIRED'
      WHERE status = 'ACTIVE' AND expires_at <= now()
      RETURNING ticket_category_id, quantity
    ), per_category AS (
      SELECT ticket_category_id, SUM(quantity)::int AS q FROM h GROUP BY ticket_category_id
    ), c AS (
      UPDATE ticket_categories tc SET held_count = tc.held_count - p.q
      FROM per_category p WHERE tc.id = p.ticket_category_id
      RETURNING 1
    )
    SELECT (SELECT COUNT(*) FROM h)::int AS expired`
  return expired
}

/**
 * Runs expireHolds on a timer. Redis/BullMQ can replace this later; correctness does not depend
 * on it, because an overdue hold only delays a seat's release, it never oversells.
 */
export const startHoldExpiryWorker = (intervalMs = 30_000) => {
  let running = false
  const timer = setInterval(() => {
    // a slow run must finish before the next starts, or runs pile up and use every connection
    if (running) return
    running = true
    expireHolds()
      .catch((e) => console.error('Hold expiry failed:', e))
      .finally(() => { running = false })
  }, intervalMs)
  timer.unref()
  return timer
}

/**
 * The user's active holds for an event, for the cart and the countdown
 */
export const getMyHolds = async (userId: string, eventId: string) => {
  return prisma.hold.findMany({
    where: { userId, eventId, status: 'ACTIVE', expiresAt: { gt: new Date() } },
    select: holdSelect,
    orderBy: { createdAt: 'asc' },
  })
}

/**
 * Live availability for an event: free count per category (FR-TKT-02), and for seated venues
 * which seats are held or sold so the seat map can grey them out (FR-TKT-15).
 */
export const getAvailability = async (eventId: string) => {
  const event = await prisma.event.findFirst({
    where: { id: eventId, status: { not: 'DRAFT' } },
    select: { id: true, venue: { select: { type: true } } },
  })
  if (!event) throw new InventoryError('Event not found', 404)

  const categories = await prisma.ticketCategory.findMany({
    where: { eventId },
    select: { id: true, categoryKey: true, name: true, price: true, capacity: true, heldCount: true, soldCount: true },
    orderBy: { price: 'desc' },
  })

  const result = {
    eventId,
    categories: categories.map((c) => {
      const available = c.capacity - c.heldCount - c.soldCount
      return { id: c.id, categoryKey: c.categoryKey, name: c.name, price: c.price, capacity: c.capacity, available, soldOut: available <= 0 }
    }),
    heldSeatIds: [] as string[],
    soldSeatIds: [] as string[],
  }

  if (event.venue.type === 'SEATED') {
    const [held, sold] = await Promise.all([
      prisma.hold.findMany({ where: { eventId, status: 'ACTIVE', seatId: { not: null } }, select: { seatId: true } }),
      prisma.ticket.findMany({
        where: { eventId, status: { in: ['VALID', 'USED'] }, seatId: { not: null } },
        select: { seatId: true },
      }),
    ])
    result.heldSeatIds = held.map((h) => h.seatId!)
    result.soldSeatIds = sold.map((t) => t.seatId!)
  }

  return result
}

// ─── Used by ordering and payments ──────────────────────────────────────────

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

/**
 * The user's live holds for an event that are not yet part of an order, with what checkout needs
 */
export const getCheckoutHolds = async (userId: string, eventId: string) => {
  return prisma.hold.findMany({
    where: { userId, eventId, status: 'ACTIVE', orderId: null, expiresAt: { gt: new Date() } },
    select: {
      id: true,
      quantity: true,
      seatId: true,
      seat: { select: { section: true, row: true, number: true } },
      ticketCategory: { select: { id: true, name: true, categoryKey: true, price: true, serviceFeePercent: true } },
    },
    orderBy: { createdAt: 'asc' },
  })
}

/**
 * Attaches holds to a new order, stores attendee names, and keeps them held until the payment
 * deadline. Fails if any hold expired or was used in the meantime.
 */
export const attachHoldsToOrder = async (
  tx: Tx,
  userId: string,
  orderId: string,
  expiresAt: Date,
  holds: { id: string; attendeeNames: string[] }[],
) => {
  for (const h of holds) {
    const { count } = await tx.hold.updateMany({
      where: { id: h.id, userId, status: 'ACTIVE', orderId: null, expiresAt: { gt: new Date() } },
      data: { orderId, attendeeNames: h.attendeeNames, expiresAt },
    })
    if (count !== 1) throw new InventoryError('Your hold on some tickets has expired. Please select them again.', 409)
  }
}

/**
 * Payment succeeded: the order's holds become sold (hf_convert_order_holds).
 * Raises HF_SOLD_OUT if a hold had expired and its places were taken meanwhile.
 */
export const convertOrderHolds = (tx: Tx, orderId: string) =>
  tx.$executeRaw`SELECT hf_convert_order_holds(${orderId}::uuid)`

/**
 * Payment failed or the order was abandoned: give its places back
 */
export const releaseOrderHolds = (tx: Tx, orderId: string) =>
  tx.$executeRaw`SELECT hf_release_order_holds(${orderId}::uuid)`
