/// <reference types="node" />
// Loads every venue layout file into venues + seats / venue_zones. Run with: npm run seed:venues
// Safe to re-run: venues are matched by slug, seats by (venue, section, row, number), zones by (venue, key).
import { PrismaClient } from '@prisma/client'
import { LayoutError, VenueLayout, expandSeats, loadAllLayouts } from '../modules/venues/venues.layout'

const prisma = new PrismaClient()

async function seedVenue(layout: VenueLayout) {
  const data = {
    name: layout.name,
    type: layout.type,
    address: layout.address,
    city: layout.city,
    country: layout.country,
    latitude: layout.latitude,
    longitude: layout.longitude,
    capacity: layout.capacity,
  }

  return prisma.$transaction(async (tx) => {
    const venue = await tx.venue.upsert({
      where: { slug: layout.slug },
      create: { slug: layout.slug, ...data },
      update: data,
    })

    if (layout.type === 'SEATED') {
      const seats = expandSeats(layout)
      for (const s of seats) {
        await tx.seat.upsert({
          where: {
            venueId_section_row_number: { venueId: venue.id, section: s.section, row: s.row, number: s.number },
          },
          create: { venueId: venue.id, section: s.section, row: s.row, number: s.number, categoryKey: s.categoryKey },
          update: { categoryKey: s.categoryKey },
        })
      }
      // seats removed from the file; fails if a ticket or hold still points at one, which is what we want
      const keep = new Set(seats.map((s) => s.label))
      const existing = await tx.seat.findMany({ where: { venueId: venue.id } })
      const stale = existing.filter((s) => !keep.has(`${s.section}-${s.row}-${s.number}`)).map((s) => s.id)
      if (stale.length > 0) await tx.seat.deleteMany({ where: { id: { in: stale } } })
      return { venue, count: seats.length, removed: stale.length }
    }

    for (const z of layout.zones) {
      const zone = {
        label: z.label,
        categoryKey: z.category,
        capacity: z.capacity,
        x: z.x,
        y: z.y,
        width: z.width,
        height: z.height,
      }
      await tx.venueZone.upsert({
        where: { venueId_key: { venueId: venue.id, key: z.key } },
        create: { venueId: venue.id, key: z.key, ...zone },
        update: zone,
      })
    }
    const { count: removed } = await tx.venueZone.deleteMany({
      where: { venueId: venue.id, key: { notIn: layout.zones.map((z) => z.key) } },
    })
    return { venue, count: layout.zones.length, removed }
  }, { timeout: 60_000 })
}

async function main() {
  const layouts = loadAllLayouts()
  for (const layout of layouts) {
    const { venue, count, removed } = await seedVenue(layout)
    const unit = layout.type === 'SEATED' ? 'seats' : 'zones'
    console.log(`OK  ${venue.slug} (${layout.type}): ${count} ${unit}${removed ? `, ${removed} removed` : ''}`)
  }

  const [venues, seats, zones] = await Promise.all([
    prisma.venue.count(),
    prisma.seat.count(),
    prisma.venueZone.count(),
  ])
  console.log(`\nDatabase now has ${venues} venues, ${seats} seats, ${zones} zones.`)
}

main()
  .catch((err) => {
    console.error(err instanceof LayoutError ? `FAIL ${err.message}` : err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
