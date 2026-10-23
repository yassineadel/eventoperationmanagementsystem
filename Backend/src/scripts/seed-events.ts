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
  // concerts (9)
  { name: 'Cairo Jazz Night', category: 'concerts', performer: 'Cairo Jazz Band', venue: 'cairo-opera-house-small-hall', days: 5, price: 600 },
  { name: 'Oud & Strings Evening', category: 'concerts', performer: 'Naseer Shamma', venue: 'cairo-opera-house-small-hall', days: 12, price: 450 },
  { name: 'Classical Piano Recital', category: 'concerts', performer: 'Ramzi Yassa', venue: 'cairo-opera-house-small-hall', days: 25, price: 400 },
  { name: 'Arabic Pop Night', category: 'concerts', performer: 'Various artists', venue: 'al-manara-arena', days: 35, price: 700 },
  { name: 'Mahraganat Live', category: 'concerts', performer: 'Various artists', venue: 'al-manara-arena', days: 42, price: 400 },
  { name: 'Sufi Music Evening', category: 'concerts', performer: 'Al Tannoura Troupe', venue: 'cairo-opera-house-small-hall', days: 48, price: 300 },
  { name: 'Student Band Showcase', category: 'concerts', performer: 'AASTMT Music Club', venue: 'cairo-opera-house-small-hall', days: 58, price: 0 },
  { name: 'Rock the Nile', category: 'concerts', performer: 'Cairokee', venue: 'al-manara-arena', days: 75, price: 900 },
  { name: 'Violin Under the Stars', category: 'concerts', performer: 'Cairo Symphony Orchestra', venue: 'cairo-opera-house-small-hall', days: 85, price: 550 },

  // festivals (8)
  { name: 'Summer Beats Festival', category: 'festivals', performer: 'Various artists', venue: 'al-manara-arena', days: 20, price: 350 },
  { name: 'Food Truck Festival', category: 'festivals', performer: null, venue: 'al-manara-arena', days: 45, price: 0 },
  { name: 'Winter Lights Festival', category: 'festivals', performer: null, venue: 'al-manara-arena', days: 52, price: 200 },
  { name: 'Ramadan Nights Festival', category: 'festivals', performer: null, venue: 'al-manara-arena', days: 60, price: 150 },
  { name: 'Coffee & Culture Fest', category: 'festivals', performer: null, venue: 'al-manara-arena', days: 66, price: 100 },
  { name: 'Film Week Opening', category: 'festivals', performer: null, venue: 'cairo-opera-house-small-hall', days: 80, price: 250 },
  { name: 'Kids Fun Day', category: 'festivals', performer: null, venue: 'al-manara-arena', days: 95, price: 0 },
  { name: 'Electronic Music Festival', category: 'festivals', performer: 'Various DJs', venue: 'al-manara-arena', days: 110, price: 650 },

  // arts (9)
  { name: 'Open Mic Poetry', category: 'arts', performer: null, venue: 'cairo-opera-house-small-hall', days: 2, price: 0 },
  { name: 'Stand-up Comedy Night', category: 'arts', performer: 'Various comedians', venue: 'al-manara-arena', days: 7, price: 250 },
  { name: 'Modern Dance Showcase', category: 'arts', performer: 'Cairo Contemporary Dance', venue: 'cairo-opera-house-small-hall', days: 9, price: 300 },
  { name: 'Theatre: The Last Letter', category: 'arts', performer: 'Hanager Theatre Troupe', venue: 'cairo-opera-house-small-hall', days: 40, price: 350 },
  { name: 'Ballet: Swan Lake', category: 'arts', performer: 'Cairo Opera Ballet', venue: 'cairo-opera-house-small-hall', days: 44, price: 500 },
  { name: 'Magic Show Night', category: 'arts', performer: 'The Great Karim', venue: 'al-manara-arena', days: 57, price: 200 },
  { name: 'Shadow Puppet Theatre', category: 'arts', performer: null, venue: 'cairo-opera-house-small-hall', days: 68, price: 150 },
  { name: 'Improv Comedy Battle', category: 'arts', performer: 'Various comedians', venue: 'al-manara-arena', days: 88, price: 220 },
  { name: 'Art Gallery Opening', category: 'arts', performer: null, venue: 'cairo-opera-house-small-hall', days: 100, price: 0 },

  // sports (8)
  { name: 'Esports Cup Final', category: 'sports', performer: null, venue: 'al-manara-arena', days: 15, price: 200 },
  { name: 'Futsal League Final', category: 'sports', performer: null, venue: 'al-manara-arena', days: 46, price: 120 },
  { name: 'Padel Open Cup', category: 'sports', performer: null, venue: 'al-manara-arena', days: 50, price: 100 },
  { name: 'Squash Masters', category: 'sports', performer: null, venue: 'al-manara-arena', days: 62, price: 180 },
  { name: 'Basketball Charity Match', category: 'sports', performer: null, venue: 'al-manara-arena', days: 70, price: 0 },
  { name: 'Handball Derby', category: 'sports', performer: null, venue: 'al-manara-arena', days: 78, price: 150 },
  { name: 'Volleyball Championship', category: 'sports', performer: null, venue: 'al-manara-arena', days: 92, price: 100 },
  { name: 'FIFA Gaming Tournament', category: 'sports', performer: null, venue: 'al-manara-arena', days: 105, price: 50 },

  // workshops (8)
  { name: 'Photography Workshop', category: 'workshops', performer: 'Lens Academy', venue: 'cairo-opera-house-small-hall', days: 3, price: 0 },
  { name: 'UI Design Bootcamp', category: 'workshops', performer: 'Design Hub', venue: 'cairo-opera-house-small-hall', days: 38, price: 800 },
  { name: 'Calligraphy Workshop', category: 'workshops', performer: 'Arabic Lines Studio', venue: 'cairo-opera-house-small-hall', days: 43, price: 300 },
  { name: 'Public Speaking Basics', category: 'workshops', performer: null, venue: 'cairo-opera-house-small-hall', days: 54, price: 0 },
  { name: 'Pottery for Beginners', category: 'workshops', performer: null, venue: 'cairo-opera-house-small-hall', days: 55, price: 250 },
  { name: 'Mobile Filmmaking', category: 'workshops', performer: 'Lens Academy', venue: 'cairo-opera-house-small-hall', days: 72, price: 450 },
  { name: 'Cooking Masterclass', category: 'workshops', performer: 'Chef Hana', venue: 'cairo-opera-house-small-hall', days: 84, price: 600 },
  { name: 'Guitar for Beginners', category: 'workshops', performer: null, venue: 'cairo-opera-house-small-hall', days: 115, price: 350 },

  // conferences (8)
  { name: 'Tech Founders Summit', category: 'conferences', performer: null, venue: 'al-manara-arena', days: 30, price: 500 },
  { name: 'Cybersecurity Summit', category: 'conferences', performer: null, venue: 'al-manara-arena', days: 47, price: 400 },
  { name: 'Women in Tech Meetup', category: 'conferences', performer: null, venue: 'cairo-opera-house-small-hall', days: 63, price: 0 },
  { name: 'AI in Healthcare Forum', category: 'conferences', performer: null, venue: 'al-manara-arena', days: 65, price: 0 },
  { name: 'E-commerce Growth Forum', category: 'conferences', performer: null, venue: 'al-manara-arena', days: 82, price: 350 },
  { name: 'Green Energy Conference', category: 'conferences', performer: null, venue: 'al-manara-arena', days: 98, price: 250 },
  { name: 'Startup Pitch Day', category: 'conferences', performer: null, venue: 'cairo-opera-house-small-hall', days: 90, price: 300 },
  { name: 'Graduation Projects Expo', category: 'conferences', performer: null, venue: 'cairo-opera-house-small-hall', days: 120, price: 0 },
]

async function main() {
  if (process.env.NODE_ENV === 'production') throw new Error('seed:events is for development databases only')

  // Events need a creator; a synthetic admin owns all the test events
  const admin = await prisma.user.upsert({
    where: { email: 'seed-admin@hafletna.test' },
    create: { email: 'seed-admin@hafletna.test', fullName: 'Seed Admin', role: 'ADMIN', isSynthetic: true },
    update: {},
  })

  for (const e of EVENTS) {
        // Safe to re-run: skip events this script already created
    const exists = await prisma.event.findFirst({ where: { name: e.name, createdById: admin.id } })
    if (exists) {
      console.log(`Skipped ${e.name} (already exists)`)
      continue
    }
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