/// <reference types="node" />
// Test events for building the events listing. Run AFTER seed:venues:  npm run seed:events
// Every row is marked isSynthetic, so it never counts as real revenue (BRD §7.2).
import { PrismaClient } from '@prisma/client'
import { getVenueCategories } from '../modules/venues/venues.service'

const prisma = new PrismaClient()

const day = 24 * 60 * 60 * 1000
const inDays = (n: number, hour = 20) => {
  const d = new Date(Date.now() + n * day)
  d.setHours(hour, 0, 0, 0)
  return d
}

// Category keys match the website's: concerts, festivals, arts, sports, workshops, conferences
const EVENTS = [
  { name: 'Cairo Jazz Night', category: 'concerts', performer: 'Cairo Jazz Band', venue: 'cairo-opera-house-small-hall', days: 5, price: 600 },
  { name: 'Oud & Strings Evening', category: 'concerts', performer: 'Naseer Shamma', venue: 'cairo-opera-house-small-hall', days: 12, price: 450 },
  { name: 'Summer Beats Festival', category: 'festivals', performer: 'Various artists', venue: 'al-manara-arena', days: 20, price: 350 },
  { name: 'Modern Dance Showcase', category: 'arts', performer: 'Cairo Contemporary Dance', venue: 'cairo-opera-house-small-hall', days: 9, price: 300 },
  { name: 'Esports Cup Final', category: 'sports', performer: null, venue: 'al-manara-arena', days: 15, price: 200 },
  { name: 'Photography Workshop', category: 'workshops', performer: 'Lens Academy', venue: 'cairo-opera-house-small-hall', days: 3, price: 0 },
  { name: 'Tech Founders Summit', category: 'conferences', performer: null, venue: 'al-manara-arena', days: 30, price: 500 },
  { name: 'Classical Piano Recital', category: 'concerts', performer: 'Ramzi Yassa', venue: 'cairo-opera-house-small-hall', days: 25, price: 400 },
  { name: 'Stand-up Comedy Night', category: 'arts', performer: 'Various comedians', venue: 'al-manara-arena', days: 7, price: 250 },
  { name: 'Open Mic Poetry', category: 'arts', performer: null, venue: 'cairo-opera-house-small-hall', days: 2, price: 0 },
]

async function main() {
  if (process.env.NODE_ENV === 'production') throw new Error('seed:events is for development databases only')

  // Events need a creator; a synthetic admin owns all the test events
  const admin = await prisma.user.upsert({
    where: { email: 'seed-admin@hafletna.test' },
    create: { email: 'seed-admin@hafletna.test', fullName: 'Seed Admin', role: 'ADMIN', isSynthetic: true },
    update: {},
  })

  // Safe to re-run: skip if this script already created events
  if (await prisma.event.count({ where: { createdById: admin.id } })) {
    console.log('Test events already exist — nothing to do.')
    return
  }

  for (const e of EVENTS) {
    const venue = await prisma.venue.findUnique({ where: { slug: e.venue } })
    if (!venue) throw new Error(`Venue ${e.venue} missing. Run npm run seed:venues first.`)

    const startAt = inDays(e.days)
    const event = await prisma.event.create({
      data: {
        name: e.name,
        category: e.category,
        performer: e.performer,
        description: `${e.name} — a test event for the listing page.`,
        startAt,
        doorsOpenAt: new Date(startAt.getTime() - 60 * 60 * 1000),
        durationMinutes: 120,
        venueId: venue.id,
        createdById: admin.id,
        status: 'PUBLISHED',
        publishedAt: new Date(),
        isSynthetic: true,
      },
    })

    // One ticket category per venue category; the cheapest is the event's listed price
    const venueCategories = await getVenueCategories(e.venue)
    for (const [i, c] of venueCategories.entries()) {
      await prisma.ticketCategory.create({
        data: {
          eventId: event.id,
          categoryKey: c.key,
          name: c.key,
          price: e.price === 0 ? 0 : e.price * (venueCategories.length - i),
          serviceFeePercent: e.price === 0 ? 0 : 5,
          capacity: c.capacity,
        },
      })
    }
    console.log(`Created ${e.name} (${e.category}) on ${startAt.toDateString()}`)
  }

  console.log(`\nDone: ${EVENTS.length} published test events.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())