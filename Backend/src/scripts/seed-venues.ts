/// <reference types="node" />
// Loads every venue layout file into venues + seats / venue_zones. Run with: npm run seed:venues
// Safe to re-run: venues are matched by slug, seats by (venue, section, row, number), zones by (venue, key).
import prisma from '../config/db'
import { LayoutError, loadAllLayouts } from '../modules/venues/venues.layout'
import { saveVenue } from '../modules/venues/venues.service'

async function main() {
  const layouts = loadAllLayouts()
  for (const layout of layouts) {
    const { venue, count, removed } = await saveVenue(layout)
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
