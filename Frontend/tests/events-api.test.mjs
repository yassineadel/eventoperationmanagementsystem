import test from 'node:test'
import assert from 'node:assert/strict'
import { summary, detail, page, eventId } from './fixtures/events-api.mjs'
import { decimal, mapEventSummary, mapEventDetail, parseEventsPage, listingApiQuery } from '../src/lib/eventsModel.ts'
import { createEventsClient, loadSavedEvents } from '../src/lib/eventsApi.ts'
import { eventRequest } from '../src/lib/eventRequests.ts'
import { parseListingFilters, getListingResults } from '../src/Components/Discovery/listing.ts'
import { createSavedEventsStore, parseSavedEventIds } from '../src/Components/Discovery/savedEventsStore.ts'
import { existsSync } from 'node:fs'

const filters = (query = '') => parseListingFilters(new URLSearchParams(query))

test('temporary photos vary by event, exist locally and match across listing and detail', () => {
  const names = ['Cairo Jazz Night', 'Classical Piano Recital', 'Oud & Strings Evening', 'Electronic Music Festival', 'Photography Workshop']
  const photos = names.map((name) => {
    const card = mapEventSummary(summary({ name }))
    const page = mapEventDetail(detail({ name }))
    assert.equal(card.image, page.event.image)
    assert.equal(page.details.gallery[0], card.image)
    assert.equal(page.details.fallbackImage, true)
    assert.ok(existsSync(new URL(`../public${card.image}`, import.meta.url)))
    return card.image
  })
  assert.equal(new Set(photos).size, names.length)
  const uploaded = mapEventDetail(detail({ image: '/uploads/cover.jpg', images: [] }))
  assert.equal(uploaded.event.image, '/uploads/cover.jpg')
  assert.equal(uploaded.details.fallbackImage, false)
})

test('summary mapping preserves unknown prices, real UUIDs, performer and language fallback', () => {
  const mapped = mapEventSummary(summary({ priceFrom: null }))
  assert.equal(mapped.id, eventId)
  assert.equal(mapped.price, null)
  assert.deepEqual(mapped.title, { en: 'Cairo Jazz Night', ar: 'Cairo Jazz Night' })
  assert.equal(mapped.performer.en, 'Cairo Jazz Band')
  assert.equal(mapped.city, 'cairo')
  assert.equal(mapped.source, 'api')
  assert.equal(mapped.image, '/event-images/jazz.jpg')
  assert.equal(mapEventSummary(summary({ priceFrom: 0 })).price, 0)
  assert.equal(mapEventSummary(summary({ soldOut: true })).status, 'sold-out')
  assert.equal(mapEventSummary(summary({ nameAr: 'ليلة الجاز', performerAr: 'فرقة الجاز' })).title.ar, 'ليلة الجاز')
})

test('unknown price is never free or paid and sorts after known prices in saved results', () => {
  const unknown = mapEventSummary(summary({ priceFrom: null }))
  const paid = mapEventSummary(summary({ id: '00000000-0000-4000-8000-000000000004', priceFrom: 50 }))
  const free = mapEventSummary(summary({ id: '00000000-0000-4000-8000-000000000005', priceFrom: 0 }))
  assert.equal(getListingResults([unknown, paid, free], filters('price=free'), 'en').total, 1)
  assert.equal(getListingResults([unknown, paid, free], filters('price=paid'), 'en').total, 1)
  for (const sort of ['price-low', 'price-high']) assert.equal(getListingResults([unknown, paid, free], filters(`sort=${sort}`), 'en').events.at(-1).id, unknown.id)
  assert.equal(getListingResults([paid], filters('q=Jazz+Band'), 'en').total, 1)
})

test('invalid records and unsafe image URLs cannot reach rendering as unchecked casts', () => {
  for (const change of [{ id: '../../private' }, { category: '__proto__' }, { venue: { name: 'Venue', city: 'unknown' } }, { startAt: 'bad-date' }, { priceFrom: -1 }, { popularity: -1 }, { soldOut: 'false' }]) assert.throws(() => mapEventSummary(summary(change)))
  assert.equal(mapEventSummary(summary({ image: 'javascript:alert(1)' })).image, '/event-images/jazz.jpg')
  assert.equal(mapEventSummary(summary({ image: 'https://example.org/event.jpg' })).image, 'https://example.org/event.jpg')
  for (const value of [null, undefined, '']) assert.equal(decimal(value), null)
  assert.equal(decimal('600.50'), 600.5)
  for (const value of [Infinity, {}, 'no-price', '-1', false]) assert.throws(() => decimal(value))
})

test('successful zero results remain an empty API page and pagination is checked', () => {
  const result = parseEventsPage(page([]))
  assert.equal(result.total, 0)
  assert.deepEqual(result.events, [])
  assert.equal(result.start, 0)
  assert.equal(result.end, 0)
  assert.throws(() => parseEventsPage({ events: [] }))
  assert.throws(() => parseEventsPage(page([], { total: 10 })))
  assert.throws(() => parseEventsPage(page([summary()], { pageSize: 20 })))
  const last = parseEventsPage(page([summary()], { total: 7, page: 2, pageCount: 2 }))
  assert.equal(last.start, 7)
  assert.equal(last.end, 7)
  assert.equal(parseEventsPage(page([], { categoryCounts: { concerts: 3, arts: 2 } })).categoryCounts.arts, 2)
})

test('API queries preserve repeated categories and inclusive dates, excluding browser-only saved mode', () => {
  const f = filters('q=Jazz+%26+Oud&category=concerts&category=arts&city=cairo&from=2030-10-01&to=2030-10-31&price=paid&sort=popular&page=2&saved=1')
  const query = new URLSearchParams(listingApiQuery(f))
  assert.equal(query.get('q'), 'Jazz & Oud')
  assert.deepEqual(query.getAll('category'), ['concerts', 'arts'])
  for (const key of ['city', 'from', 'to', 'price', 'sort']) assert.equal(query.get(key), f[key])
  assert.equal(query.get('page'), '2')
  assert.equal(query.has('saved'), false)
  const facet = new URLSearchParams(listingApiQuery(f, true))
  assert.equal(facet.has('category'), false)
  assert.equal(facet.get('page'), '1')
  assert.equal(facet.get('sort'), 'soonest')
  assert.equal(facet.get('q'), 'Jazz & Oud')
})

test('detail mapping uses actual door time, venue, decimals, capacity and inventory without sample facts', () => {
  const result = mapEventDetail(detail())
  assert.equal(result.event.price, 600)
  assert.equal(result.details.doorsOpen, '2030-10-25T16:00:00.000Z')
  assert.deepEqual(result.details.coordinates, [30.0424, 31.2244])
  assert.equal(result.details.address.en, 'Opera Square, Zamalek, Cairo')
  assert.equal(result.details.capacity, 500)
  assert.equal(result.details.ticketCategories[0].remaining, 91)
  assert.equal(result.details.ticketCategories[0].feePercent, 5)
  assert.equal(result.details.organiser, null)
  assert.deepEqual(result.details.policies, [])
  assert.deepEqual(result.details.faqs, [])
  assert.deepEqual(result.details.gallery, ['/event-images/jazz.jpg'])
  assert.equal(result.details.fallbackImage, true)
})

test('cancelled details stay visible, drafts are rejected and zero categories mean unknown price', () => {
  assert.equal(mapEventDetail(detail({ status: 'CANCELLED' })).event.status, 'cancelled')
  assert.throws(() => mapEventDetail(detail({ status: 'DRAFT' })))
  const noTickets = mapEventDetail(detail({ ticketCategories: [] }))
  assert.equal(noTickets.event.price, null)
  const noCoords = mapEventDetail(detail({ venue: { ...detail().venue, latitude: null, longitude: null } }))
  assert.equal(noCoords.details.coordinates, null)
  const invalidInventory = detail()
  invalidInventory.ticketCategories[0].soldCount = 500
  assert.throws(() => mapEventDetail(invalidInventory))
})

test('provided policies/FAQs and optional Arabic content map without rendering raw objects', () => {
  const result = mapEventDetail(detail({ nameAr: 'ليلة الجاز', descriptionAr: 'وصف الفعالية',
    policies: [{ title: { en: 'Admission', ar: 'الدخول' }, body: { en: 'Age 16+', ar: '١٦ عامًا فأكثر' } }],
    faqs: [{ question: 'When?', answer: 'At the published time.' }, { invalid: true }],
  }))
  assert.equal(result.event.title.ar, 'ليلة الجاز')
  assert.equal(result.event.description.ar, 'وصف الفعالية')
  assert.equal(result.details.policies[0].body.ar, '١٦ عامًا فأكثر')
  assert.equal(result.details.faqs.length, 1)
  assert.equal(mapEventDetail(detail({ policies: { ageRestrictions: '18+', refundPolicy: 'No returns' } })).details.policies.length, 2)
})

test('client requests the public UUID endpoint and rejects a mismatched response ID', async () => {
  const paths = [], signal = new AbortController().signal
  const client = createEventsClient(async (path, init) => { paths.push(path); assert.equal(init.signal, signal); return path.includes('?') ? page() : detail() })
  assert.equal((await client.listing(filters('q=Jazz&page=1'), signal)).total, 1)
  assert.equal((await client.detail(eventId, signal)).event.id, eventId)
  assert.equal(paths[1], `/api/events/${eventId}`)
  const wrong = createEventsClient(async () => detail({ id: '00000000-0000-4000-8000-000000000009' }))
  await assert.rejects(wrong.detail(eventId, signal), /does not match/)
})

test('uploaded image paths resolve against the API while frontend fallback images remain local', async () => {
  const signal = new AbortController().signal
  const client = createEventsClient(async (path) => path.includes('?') ? page([summary({ image: '/uploads/event.jpg' })]) : detail({ images: ['/uploads/event.jpg'] }), 'http://localhost:3000')
  assert.equal((await client.listing(filters(), signal)).events[0].image, 'http://localhost:3000/uploads/event.jpg')
  assert.equal((await client.detail(eventId, signal)).details.gallery[0], 'http://localhost:3000/uploads/event.jpg')
  const fallback = createEventsClient(async () => page(), 'http://localhost:3000')
  assert.equal((await fallback.listing(filters(), signal)).events[0].image, '/event-images/jazz.jpg')
})

test('category totals ignore category selection, page and sort while respecting other filters', async () => {
  const queries = []
  const client = createEventsClient(async (path) => { const q = new URLSearchParams(path.split('?')[1]); queries.push(q); return page(q.get('category') === 'arts' ? [summary({ category: 'arts' })] : []) })
  const counts = await client.counts(filters('q=Jazz&category=concerts&city=cairo&price=paid&from=2030-10-01&to=2030-10-31&page=8&sort=popular'), new AbortController().signal)
  assert.equal(queries.length, 6)
  assert.equal(counts.arts, 1)
  assert.equal(counts.concerts, 0)
  assert.equal(new Set(queries.map((q) => q.get('category'))).size, 6)
  for (const query of queries) {
    assert.equal(query.getAll('category').length, 1)
    assert.equal(query.get('q'), 'Jazz')
    assert.equal(query.get('city'), 'cairo')
    assert.equal(query.get('price'), 'paid')
    assert.equal(query.get('from'), '2030-10-01')
    assert.equal(query.get('to'), '2030-10-31')
    assert.equal(query.get('sort'), 'soonest')
    assert.equal(query.get('page'), '1')
  }
})

test('API UUID bookmarks survive reload alongside sample bookmarks and canonicalise duplicates', () => {
  let stored = null
  const storage = { getItem: () => stored, setItem: (_key, value) => { stored = value } }
  const store = createSavedEventsStore(storage)
  store.toggle(eventId)
  store.toggle('cairo-after-dark')
  assert.deepEqual(createSavedEventsStore(storage).getSnapshot().savedIds, [eventId, 'cairo-after-dark'])
  assert.deepEqual(parseSavedEventIds(JSON.stringify([eventId, eventId.toUpperCase(), 'missing-event', '../../bad'])), [eventId])
  store.toggle(eventId)
  assert.deepEqual(createSavedEventsStore(storage).getSnapshot().savedIds, ['cairo-after-dark'])
})

test('saved loading hides only 404 events, retains cancelled events, and propagates outages for retry', async () => {
  const missingId = '00000000-0000-4000-8000-000000000099'
  const client = createEventsClient(async (path) => { if (path.endsWith(missingId)) throw { status: 404 }; return detail({ status: 'CANCELLED' }) })
  const ids = [eventId, missingId, 'cairo-after-dark']
  const result = await loadSavedEvents(client, ids, new AbortController().signal)
  assert.deepEqual(result.missing, [missingId])
  assert.equal(result.events[0].status, 'cancelled')
  assert.deepEqual(ids, [eventId, missingId, 'cairo-after-dark'])
  const down = createEventsClient(async () => { throw new Error('Network offline') })
  await assert.rejects(loadSavedEvents(down, ids, new AbortController().signal), /Network offline/)
})

test('saved loading is bounded to four requests and aborts queued work', async () => {
  let active = 0, maximum = 0
  const ids = Array.from({ length: 10 }, (_, i) => `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`)
  const client = createEventsClient(async (path) => {
    active++; maximum = Math.max(maximum, active)
    await new Promise((resolve) => setImmediate(resolve))
    active--
    return detail({ id: path.split('/').at(-1) })
  })
  const result = await loadSavedEvents(client, ids, new AbortController().signal)
  assert.equal(result.events.length, 10)
  assert.equal(maximum, 4)
  const aborted = new AbortController(); aborted.abort()
  await assert.rejects(loadSavedEvents(client, ids, aborted.signal), { name: 'AbortError' })
})

test('timeouts and cancellation settle even if the transport ignores abort', async () => {
  let late, child
  const parent = new AbortController()
  const request = eventRequest((signal) => { child = signal; return new Promise((resolve) => { late = resolve }) }, parent.signal, 10)
  await assert.rejects(request, /timed out/)
  assert.equal(child.aborted, true)
  late('Late data')
  const cancelled = new AbortController()
  const pending = eventRequest(() => new Promise(() => {}), cancelled.signal)
  cancelled.abort()
  await assert.rejects(pending, { name: 'AbortError' })
})
