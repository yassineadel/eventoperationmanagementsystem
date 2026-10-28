// Optional local HTTP fixture for browser QA. Never connects to a database.
// Run: node tests/fixtures/events-server.mjs
import { createServer } from 'node:http'
import { detail, summary, eventId } from './events-api.mjs'

const definitions = [
  ['Cairo Jazz Night', 'concerts', 600], ['Oud & Strings Evening', 'concerts', 450],
  ['Summer Beats Festival', 'festivals', 350], ['Modern Dance Showcase', 'arts', 300],
  ['Esports Cup Final', 'sports', 200], ['Photography Workshop', 'workshops', 0],
  ['Tech Founders Summit', 'conferences', 500], ['Classical Piano Recital', 'concerts', 400],
  ['Stand-up Comedy Night', 'arts', 250], ['Open Mic Poetry', 'arts', null],
]
const summaries = definitions.map(([name, category, priceFrom], index) => summary({ id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`, name, category, priceFrom, startAt: `2030-10-${String(21 + index).padStart(2, '0')}T17:00:00.000Z`, soldOut: index === 9, popularity: index * 2 }))
let failNextPage = process.env.FIXTURE_FAIL_NEXT_PAGE === '1'
let failVenues = process.env.FIXTURE_FAIL_VENUES === '1'
const server = createServer(async (req, res) => {
  const origin = req.headers.origin
  if (origin && /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) res.setHeader('Access-Control-Allow-Origin', origin)
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Content-Type', 'application/json')
  const url = new URL(req.url, 'http://127.0.0.1:3001')
  const send = (status, data) => { res.writeHead(status); res.end(JSON.stringify(data)) }
  if (url.pathname === '/api/events') {
    const p = url.searchParams, query = (p.get('q') ?? '').toLowerCase()
    if (p.get('page') === '2' && failNextPage) { failNextPage = false; return send(503, { message: 'Fixture page outage' }) }
    if (query === 'api-error') return send(503, { message: 'Fixture outage' })
    if (query === 'slow') await new Promise((resolve) => setTimeout(resolve, 900))
    const matches = summaries.filter((event) => (!query || `${event.name} ${event.performer} ${event.category} ${event.venue.name}`.toLowerCase().includes(query))
      && (!p.has('category') || p.getAll('category').includes(event.category))
      && (!p.get('city') || event.venue.city.toLowerCase() === p.get('city').toLowerCase())
      && (!p.get('from') || event.startAt.slice(0, 10) >= p.get('from'))
      && (!p.get('to') || event.startAt.slice(0, 10) <= p.get('to'))
      && (p.get('price') !== 'free' || event.priceFrom === 0)
      && (p.get('price') !== 'paid' || event.priceFrom > 0))
    const sort = p.get('sort') ?? 'soonest'
    matches.sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name) : sort === 'popular' ? b.popularity - a.popularity : sort === 'price-low' ? (a.priceFrom ?? 0) - (b.priceFrom ?? 0) : sort === 'price-high' ? (b.priceFrom ?? 0) - (a.priceFrom ?? 0) : a.startAt.localeCompare(b.startAt))
    const pageCount = Math.max(1, Math.ceil(matches.length / 6)), page = Math.min(Math.max(Number(p.get('page')) || 1, 1), pageCount)
    return send(200, { events: matches.slice((page - 1) * 6, page * 6), total: matches.length, page, pageCount, pageSize: 6, sort })
  }
  if (url.pathname === '/api/venues') {
    if (failVenues) { failVenues = false; return send(503, { message: 'Fixture venue outage' }) }
    return send(200, process.env.FIXTURE_EMPTY_VENUES === '1' ? [] : [detail().venue])
  }
  if (url.pathname.startsWith('/api/events/')) {
    const id = url.pathname.split('/').at(-1)
    if (id === '00000000-0000-4000-8000-000000000998') return send(503, { message: 'Fixture detail outage' })
    const found = summaries.find((event) => event.id === id)
    if (id === '00000000-0000-4000-8000-000000000999') return send(200, detail({ id, name: 'Cancelled API fixture', status: 'CANCELLED' }))
    if (!found) return send(404, { message: 'Event not found' })
    const value = detail({ ...found, description: 'A public API contract fixture used for browser verification.', images: [],
      doorsOpenAt: found.startAt.replace('17:00', '16:00'), status: 'PUBLISHED',
      ticketCategories: found.priceFrom === null ? [] : [{ ...detail().ticketCategories[0], price: String(found.priceFrom) }],
    })
    // Detail has a full venue, not the summary's short venue object.
    value.venue = detail().venue
    return send(200, value)
  }
  if (url.pathname === '/health') return send(200, { status: 'fixture', eventId })
  return send(401, { message: 'Not signed in' })
})
server.listen(Number(process.env.FIXTURE_PORT ?? 3001), '127.0.0.1', () => console.log('Public API fixture on http://127.0.0.1:3001'))
