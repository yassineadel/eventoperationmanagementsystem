// Public contract fixtures matching Gelo's 85c52b2 summary and Prisma detail shapes.
export const eventId = '00000000-0000-4000-8000-000000000001'
export function summary(overrides = {}) {
  return { id: eventId, name: 'Cairo Jazz Night', category: 'concerts', performer: 'Cairo Jazz Band', image: null,
    startAt: '2030-10-25T17:00:00.000Z', venue: { name: 'Cairo Opera House — Small Hall', city: 'Cairo' },
    priceFrom: 600, soldOut: false, popularity: 9, ...overrides }
}
export function detail(overrides = {}) {
  return { id: eventId, name: 'Cairo Jazz Night', category: 'concerts', performer: 'Cairo Jazz Band',
    description: 'A public API contract fixture, used only to test the frontend connection.', about: null, images: [],
    startAt: '2030-10-25T17:00:00.000Z', doorsOpenAt: '2030-10-25T16:00:00.000Z', durationMinutes: 120,
    status: 'PUBLISHED', isSynthetic: true, policies: null, faqs: null,
    venue: { id: '00000000-0000-4000-8000-000000000002', name: 'Cairo Opera House — Small Hall', type: 'SEATED',
      address: 'Opera Square, Zamalek, Cairo', city: 'Cairo', country: 'Egypt', latitude: '30.042400', longitude: '31.224400', capacity: 500 },
    ticketCategories: [{ id: '00000000-0000-4000-8000-000000000003', name: 'VIP', price: '600', serviceFeePercent: '5', capacity: 100, heldCount: 2, soldCount: 7 }], ...overrides }
}
export function page(rows = [summary()], overrides = {}) {
  return { events: rows, total: rows.length, page: 1, pageCount: Math.max(1, Math.ceil(rows.length / 6)), pageSize: 6, sort: 'soonest', ...overrides }
}
