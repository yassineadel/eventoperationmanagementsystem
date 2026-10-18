/// <reference types="node" />
import prisma from '../../config/db'
import { VenueLayout, loadAllLayouts } from './venues.layout'

export class NotFoundError extends Error {}

// Display-only data (stage position, category labels/colors, section labels) lives in the
// layout files; seat and zone rows (with the ids checkout needs) live in the database.
let layoutsBySlug: Map<string, VenueLayout> | null = null
const getLayoutFile = (slug: string) => {
  if (!layoutsBySlug) layoutsBySlug = new Map(loadAllLayouts().map((l) => [l.slug, l]))
  return layoutsBySlug.get(slug)
}

const venueSummary = {
  id: true,
  slug: true,
  name: true,
  type: true,
  address: true,
  city: true,
  country: true,
  latitude: true,
  longitude: true,
  capacity: true,
} as const

const findVenue = async (slug: string) => {
  const venue = await prisma.venue.findUnique({ where: { slug }, select: venueSummary })
  if (!venue) throw new NotFoundError('Venue not found')
  return venue
}

/**
 * All venues, optionally filtered by city (FR-HOM-03, FR-ADM-06)
 */
export const getAllVenues = async (city?: string) => {
  return prisma.venue.findMany({
    where: city ? { city: { equals: city, mode: 'insensitive' } } : undefined,
    select: venueSummary,
    orderBy: { name: 'asc' },
  })
}

/**
 * One venue with its upcoming published events (FR-EVT-02, FR-HOM-03)
 */
export const getVenueBySlug = async (slug: string) => {
  const venue = await findVenue(slug)
  const upcomingEvents = await prisma.event.findMany({
    where: { venueId: venue.id, status: 'PUBLISHED', startAt: { gte: new Date() } },
    select: { id: true, name: true, category: true, startAt: true, images: true },
    orderBy: { startAt: 'asc' },
  })
  return { ...venue, upcomingEvents }
}

/**
 * Category keys a venue offers, with how many places each has.
 * The admin prices these per event (FR-ADM-06/07).
 */
export const getVenueCategories = async (slug: string) => {
  const venue = await findVenue(slug)
  const file = getLayoutFile(slug)

  const counts =
    venue.type === 'SEATED'
      ? (await prisma.seat.groupBy({ by: ['categoryKey'], where: { venueId: venue.id }, _count: true })).map(
          (g) => ({ key: g.categoryKey, capacity: g._count }),
        )
      : (
          await prisma.venueZone.groupBy({ by: ['categoryKey'], where: { venueId: venue.id }, _sum: { capacity: true } })
        ).map((g) => ({ key: g.categoryKey, capacity: g._sum.capacity ?? 0 }))

  // keep the order the layout file declares (e.g. VIP before Standard)
  const order = file?.categories.map((m) => m.key) ?? []
  const rank = (key: string) => (order.includes(key) ? order.indexOf(key) : order.length)

  return counts
    .sort((a, b) => rank(a.key) - rank(b.key) || a.key.localeCompare(b.key))
    .map((c) => {
      const meta = file?.categories.find((m) => m.key === c.key)
      return { key: c.key, label: meta?.label ?? c.key, color: meta?.color ?? null, capacity: c.capacity }
    })
}

/**
 * Everything the frontend needs to draw the venue map (FR-TKT-01/12/18/20).
 * Seats are grouped section → row, in the order the layout file defines them.
 */
export const getVenueLayout = async (slug: string) => {
  const venue = await findVenue(slug)
  const file = getLayoutFile(slug)
  const categories = await getVenueCategories(slug)
  const stage = file?.stage ?? { position: 'top' as const }

  if (venue.type === 'STANDING') {
    const zones = await prisma.venueZone.findMany({
      where: { venueId: venue.id },
      select: { id: true, key: true, label: true, categoryKey: true, capacity: true, x: true, y: true, width: true, height: true },
      orderBy: { key: 'asc' },
    })
    const order = file?.type === 'STANDING' ? file.zones.map((z) => z.key) : []
    zones.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key))
    return { venue, stage, categories, zones }
  }

  const seats = await prisma.seat.findMany({
    where: { venueId: venue.id },
    select: { id: true, section: true, row: true, number: true, categoryKey: true },
    orderBy: [{ section: 'asc' }, { row: 'asc' }, { number: 'asc' }],
  })

  const fileSections = file?.type === 'SEATED' ? file.sections : []
  const sectionKeys = [...new Set([...fileSections.map((s) => s.key), ...seats.map((s) => s.section)])]

  const sections = sectionKeys.map((key) => {
    const fileSection = fileSections.find((s) => s.key === key)
    const inSection = seats.filter((s) => s.section === key)
    const rowLabels = [...new Set([...(fileSection?.rows.map((r) => r.label) ?? []), ...inSection.map((s) => s.row)])]
    return {
      key,
      label: fileSection?.label ?? key,
      rows: rowLabels.map((label) => ({
        label,
        seats: inSection
          .filter((s) => s.row === label)
          .map((s) => ({ id: s.id, number: s.number, label: `${key}-${label}-${s.number}`, categoryKey: s.categoryKey })),
      })),
    }
  })

  return { venue, stage, categories, sections }
}
