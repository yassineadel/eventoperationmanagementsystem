/// <reference types="node" />
import { Prisma } from '@prisma/client'
import prisma from '../../config/db'
import { VenueLayout, expandSeats, layoutSchema, loadAllLayouts } from './venues.layout'

export class NotFoundError extends Error {}

// Display data (stage position, category labels/colors, section labels) is the venue's layout.
// It is stored on the venue row (the admin console edits it); the files in layouts/ only seed the
// first venues, and are still read for a venue saved before layouts were stored.
let layoutsBySlug: Map<string, VenueLayout> | null = null
const getLayoutFile = (slug: string) => {
  if (!layoutsBySlug) layoutsBySlug = new Map(loadAllLayouts().map((l) => [l.slug, l]))
  return layoutsBySlug.get(slug)
}

const storedLayout = (raw: Prisma.JsonValue | null | undefined): VenueLayout | undefined => {
  const parsed = raw ? layoutSchema.safeParse(raw) : null
  return parsed?.success ? parsed.data : undefined
}

export const getLayout = async (slug: string): Promise<VenueLayout | undefined> => {
  const row = await prisma.venue.findUnique({ where: { slug }, select: { layout: true } })
  return storedLayout(row?.layout) ?? getLayoutFile(slug)
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
  image: true,
  mapUrl: true,
} as const

// null image means the website shows an illustrative photo
const withImage = <T extends { slug: string; image: string | null }>(venue: T) => ({
  ...venue,
  image: venue.image ?? getLayoutFile(venue.slug)?.image ?? null,
})

const findVenue = async (slug: string) => {
  const venue = await prisma.venue.findUnique({ where: { slug }, select: venueSummary })
  if (!venue) throw new NotFoundError('Venue not found')
  return venue
}

/**
 * All venues, optionally filtered by city (FR-HOM-03, FR-ADM-06)
 */
export const getAllVenues = async (city?: string) => {
  const venues = await prisma.venue.findMany({
    where: city ? { city: { equals: city, mode: 'insensitive' } } : undefined,
    select: venueSummary,
    orderBy: { name: 'asc' },
  })
  return venues.map(withImage)
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
  return { ...withImage(venue), upcomingEvents }
}

/**
 * Category keys a venue offers, with how many places each has.
 * The admin prices these per event (FR-ADM-06/07).
 */
export const getVenueCategories = async (slug: string) => {
  const venue = await findVenue(slug)
  const layout = await getLayout(slug)

  const counts =
    venue.type === 'SEATED'
      ? (await prisma.seat.groupBy({ by: ['categoryKey'], where: { venueId: venue.id }, _count: true })).map(
          (g) => ({ key: g.categoryKey, capacity: g._count }),
        )
      : (
          await prisma.venueZone.groupBy({ by: ['categoryKey'], where: { venueId: venue.id }, _sum: { capacity: true } })
        ).map((g) => ({ key: g.categoryKey, capacity: g._sum.capacity ?? 0 }))

  // keep the order the layout declares (e.g. VIP before Standard)
  const order = layout?.categories.map((m) => m.key) ?? []
  const rank = (key: string) => (order.includes(key) ? order.indexOf(key) : order.length)

  return counts
    .sort((a, b) => rank(a.key) - rank(b.key) || a.key.localeCompare(b.key))
    .map((c) => {
      const meta = layout?.categories.find((m) => m.key === c.key)
      return { key: c.key, label: meta?.label ?? c.key, color: meta?.color ?? null, capacity: c.capacity }
    })
}

/**
 * Everything the frontend needs to draw the venue map (FR-TKT-01/12/18/20).
 * Seats are grouped section → row, in the order the layout defines them.
 */
export const getVenueLayout = async (slug: string) => {
  const venue = withImage(await findVenue(slug))
  const layout = await getLayout(slug)
  const categories = await getVenueCategories(slug)
  const stage = layout?.stage ?? { position: 'top' as const }

  if (venue.type === 'STANDING') {
    const zones = await prisma.venueZone.findMany({
      where: { venueId: venue.id },
      select: { id: true, key: true, label: true, categoryKey: true, capacity: true, x: true, y: true, width: true, height: true },
      orderBy: { key: 'asc' },
    })
    const order = layout?.type === 'STANDING' ? layout.zones.map((z) => z.key) : []
    zones.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key))
    return { venue, stage, categories, zones }
  }

  const seats = await prisma.seat.findMany({
    where: { venueId: venue.id },
    select: { id: true, section: true, row: true, number: true, categoryKey: true },
    orderBy: [{ section: 'asc' }, { row: 'asc' }, { number: 'asc' }],
  })

  const layoutSections = layout?.type === 'SEATED' ? layout.sections : []
  const sectionKeys = [...new Set([...layoutSections.map((s) => s.key), ...seats.map((s) => s.section)])]

  const sections = sectionKeys.map((key) => {
    const layoutSection = layoutSections.find((s) => s.key === key)
    const inSection = seats.filter((s) => s.section === key)
    const rowLabels = [...new Set([...(layoutSection?.rows.map((r) => r.label) ?? []), ...inSection.map((s) => s.row)])]
    return {
      key,
      label: layoutSection?.label ?? key,
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

/**
 * Creates or updates a venue from a validated layout: the venue row (with the layout itself),
 * then its seats or zones. Seats/zones no longer in the layout are removed; that fails if a ticket
 * or hold still points at one, which is what we want. Used by seed:venues and the admin console.
 */
export const saveVenue = async (layout: VenueLayout) => {
  const { slug, image, mapUrl, ...rest } = layout
  const data = {
    name: rest.name,
    type: rest.type,
    address: rest.address,
    city: rest.city,
    country: rest.country,
    latitude: rest.latitude,
    longitude: rest.longitude,
    capacity: rest.capacity,
    layout: layout as unknown as Prisma.InputJsonValue,
    image: image ?? null,
    mapUrl: mapUrl ?? null,
  }

  return prisma.$transaction(async (tx) => {
    const venue = await tx.venue.upsert({ where: { slug }, create: { slug, ...data }, update: data })

    if (layout.type === 'SEATED') {
      const seats = expandSeats(layout)
      const existing = await tx.seat.findMany({ where: { venueId: venue.id }, select: { id: true, section: true, row: true, number: true, categoryKey: true } })
      const byLabel = new Map(existing.map((s) => [`${s.section}-${s.row}-${s.number}`, s]))
      const missing = seats.filter((s) => !byLabel.has(s.label))
      if (missing.length) {
        await tx.seat.createMany({ data: missing.map((s) => ({ venueId: venue.id, section: s.section, row: s.row, number: s.number, categoryKey: s.categoryKey })) })
      }
      for (const s of seats) {
        const old = byLabel.get(s.label)
        if (old && old.categoryKey !== s.categoryKey) await tx.seat.update({ where: { id: old.id }, data: { categoryKey: s.categoryKey } })
      }
      const keep = new Set(seats.map((s) => s.label))
      const stale = existing.filter((s) => !keep.has(`${s.section}-${s.row}-${s.number}`)).map((s) => s.id)
      if (stale.length > 0) await tx.seat.deleteMany({ where: { id: { in: stale } } })
      return { venue, count: seats.length, removed: stale.length }
    }

    for (const z of layout.zones) {
      const zone = { label: z.label, categoryKey: z.category, capacity: z.capacity, x: z.x, y: z.y, width: z.width, height: z.height }
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
  }, { timeout: 120_000, maxWait: 20_000 })
}
