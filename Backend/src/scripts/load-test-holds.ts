/// <reference types="node" />
// Concurrency proof for inventory holds (FR-TKT-11, NFR-04, NFR-05). Run with: npm run loadtest:holds
//
// Fires N buyers at once at a category of C places, and M buyers at once at one seat, then checks
// the database: exactly C and exactly 1 must succeed, and the counters must match the hold rows.
// Creates its own synthetic fixtures (isSynthetic = true) and deletes them afterwards.
// Results are appended to load-tests/holds.md so they can be quoted in the report.
import fs from 'fs'
import path from 'path'
import prisma from '../config/db'
import { holdSeats, holdStanding } from '../modules/inventory/inventory.service'

const BUYERS = Number(process.env['BUYERS'] ?? 200)
const PLACES = Number(process.env['PLACES'] ?? 100)
const SEAT_BUYERS = Number(process.env['SEAT_BUYERS'] ?? 20)

if (process.env['NODE_ENV'] === 'production') {
  console.error('Refusing to run a load test against production.')
  process.exit(1)
}

const tag = `loadtest-${Date.now()}`

const fire = async (requests: (() => Promise<unknown>)[]) => {
  const started = Date.now()
  const latencies: number[] = []
  const results = await Promise.allSettled(
    requests.map(async (r) => {
      const t = Date.now()
      try {
        return await r()
      } finally {
        latencies.push(Date.now() - t)
      }
    }),
  )
  const reasons: Record<string, number> = {}
  for (const r of results) {
    if (r.status === 'rejected') {
      const m = (r.reason as Error).message.trim().split('\n').pop()!.slice(0, 100)
      reasons[m] = (reasons[m] ?? 0) + 1
    }
  }
  latencies.sort((a, b) => a - b)
  return {
    succeeded: results.filter((r) => r.status === 'fulfilled').length,
    failed: reasons,
    totalMs: Date.now() - started,
    p50: latencies[Math.floor(latencies.length * 0.5)],
    p95: latencies[Math.floor(latencies.length * 0.95)],
  }
}

async function main() {
  await prisma.$queryRaw`SELECT 1` // wake the database before timing anything

  const admin = await prisma.user.create({
    data: { fullName: 'Load test admin', email: `${tag}-admin@test.local`, role: 'ADMIN', isSynthetic: true },
  })
  await prisma.user.createMany({
    data: Array.from({ length: BUYERS }, (_, i) => ({
      fullName: `Buyer ${i}`,
      email: `${tag}-${String(i).padStart(4, '0')}@test.local`,
      isSynthetic: true,
    })),
  })
  const buyers = await prisma.user.findMany({ where: { email: { startsWith: `${tag}-0` } }, orderBy: { email: 'asc' } })

  const arena = await prisma.venue.findUniqueOrThrow({ where: { slug: 'al-manara-arena' } })
  const opera = await prisma.venue.findUniqueOrThrow({ where: { slug: 'cairo-opera-house-small-hall' } })
  const event = (venueId: string, name: string) =>
    prisma.event.create({
      data: {
        venueId, createdById: admin.id, name, category: 'Load test', description: 'Synthetic load test event',
        startAt: new Date(Date.now() + 30 * 86_400_000), doorsOpenAt: new Date(Date.now() + 30 * 86_400_000 - 3_600_000),
        durationMinutes: 120, status: 'PUBLISHED', isSynthetic: true,
      },
    })
  const standing = await event(arena.id, `${tag} standing`)
  const seated = await event(opera.id, `${tag} seated`)

  try {
    // A category deliberately smaller than the venue zone, so it sells out under the rush
    const category = await prisma.ticketCategory.create({
      data: { eventId: standing.id, categoryKey: 'GENERAL', name: 'General', price: 300, serviceFeePercent: 10, capacity: PLACES },
    })
    await prisma.ticketCategory.create({
      data: { eventId: seated.id, categoryKey: 'VIP', name: 'VIP', price: 1500, serviceFeePercent: 10, capacity: 48 },
    })
    const seat = await prisma.seat.findFirstOrThrow({ where: { venueId: opera.id, section: 'ORC', row: 'A', number: 1 } })

    console.log(`Test 1: ${BUYERS} buyers at once, 1 ticket each, ${PLACES} places`)
    const t1 = await fire(buyers.map((b) => () => holdStanding(b.id, standing.id, category.id, 1)))
    const after = await prisma.ticketCategory.findUniqueOrThrow({ where: { id: category.id } })
    const holdRows = await prisma.hold.aggregate({ where: { ticketCategoryId: category.id, status: 'ACTIVE' }, _sum: { quantity: true } })

    console.log(`Test 2: ${SEAT_BUYERS} buyers at once, the same seat`)
    const t2 = await fire(buyers.slice(0, SEAT_BUYERS).map((b) => () => holdSeats(b.id, seated.id, [seat.id])))
    const seatHolds = await prisma.hold.count({ where: { eventId: seated.id, seatId: seat.id, status: 'ACTIVE' } })

    const pass1 = t1.succeeded === PLACES && after.heldCount === PLACES && (holdRows._sum.quantity ?? 0) === PLACES
    const pass2 = t2.succeeded === 1 && seatHolds === 1
    const verdict = pass1 && pass2 ? 'PASS' : 'FAIL'

    const report = [
      `## ${new Date().toISOString()} — ${verdict}`,
      '',
      `Database: ${new URL(process.env['DATABASE_URL']!).hostname.replace(/^[^.]+/, '***')}`,
      '',
      '| Test | Requests | Succeeded | Expected | Counter / rows | Total time | p50 | p95 | Refusals |',
      '|---|---|---|---|---|---|---|---|---|',
      `| ${BUYERS} buyers vs ${PLACES} places | ${BUYERS} | ${t1.succeeded} | ${PLACES} | held_count ${after.heldCount}, hold rows ${holdRows._sum.quantity ?? 0} | ${t1.totalMs} ms | ${t1.p50} ms | ${t1.p95} ms | ${JSON.stringify(t1.failed)} |`,
      `| ${SEAT_BUYERS} buyers vs 1 seat | ${SEAT_BUYERS} | ${t2.succeeded} | 1 | active holds on seat ${seatHolds} | ${t2.totalMs} ms | ${t2.p50} ms | ${t2.p95} ms | ${JSON.stringify(t2.failed)} |`,
      '',
    ].join('\n')

    console.log('\n' + report)
    const out = path.join(__dirname, '..', '..', 'load-tests', 'holds.md')
    fs.mkdirSync(path.dirname(out), { recursive: true })
    if (!fs.existsSync(out)) fs.writeFileSync(out, '# Inventory hold load tests (FR-TKT-11, NFR-04, NFR-05)\n\n')
    fs.appendFileSync(out, report + '\n')
    console.log(`Saved to ${path.relative(process.cwd(), out)}`)
    if (verdict === 'FAIL') process.exitCode = 1
  } finally {
    const events = [standing.id, seated.id]
    await prisma.hold.deleteMany({ where: { eventId: { in: events } } })
    await prisma.ticketCategory.deleteMany({ where: { eventId: { in: events } } })
    await prisma.event.deleteMany({ where: { id: { in: events } } })
    await prisma.user.deleteMany({ where: { email: { startsWith: tag } } })
    await prisma.$disconnect()
  }
}

main().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
