import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { events } from '../src/Components/Homepage/data/events.ts'
import { getListingResults, listingSearchParams, parseListingFilters } from '../src/Components/Discovery/listing.ts'
import { getEventDetails, venueMapLinks } from '../src/Components/Discovery/eventDetails.ts'
import { createSavedEventsStore, parseSavedEventIds, savedEventsKey } from '../src/Components/Discovery/savedEventsStore.ts'

const filters = (query = '') => parseListingFilters(new URLSearchParams(query))
const ids = (result) => result.events.map((event) => event.id)

test('combined Arabic search, category, city, date, and price select the matching event', () => {
  const query = new URLSearchParams({ q: 'القاهرة', category: 'concerts', city: 'cairo', from: '2026-11-20', to: '2026-11-20', price: 'paid' })
  assert.deepEqual(ids(getListingResults(events, parseListingFilters(query), 'ar')), ['sunset-beats'])
})

test('multiple categories use OR while city and price still narrow the results', () => {
  const result = getListingResults(events, filters('category=concerts&category=arts&city=cairo&price=paid'), 'en')
  assert.equal(result.total, 3)
  assert.deepEqual(new Set(ids(result)), new Set(['cairo-after-dark', 'creative-canvas', 'sunset-beats']))
})

test('date boundaries are inclusive and the homepage date parameter is supported', () => {
  const result = getListingResults(events, filters('date=2026-11-13'), 'en')
  assert.deepEqual(ids(result), ['coastal-weekender', 'nile-nights'])
  assert.equal(getListingResults(events, filters('from=2026-12-01'), 'en').total, 0)
})

test('an inverted date range is explained, and impossible dates are ignored', () => {
  const result = getListingResults(events, filters('from=2026-11-20&to=2026-11-01'), 'en')
  assert.equal(result.invalidDates, true)
  assert.equal(result.total, 0)
  const parsed = filters('from=2026-02-31&to=invalid')
  assert.equal(parsed.from, '')
  assert.equal(parsed.to, '')
})

test('price and popularity sorts use sample values without mutating the catalogue', () => {
  const original = events.map((event) => event.id)
  assert.equal(ids(getListingResults(events, filters('sort=price-low'), 'en'))[0], 'coastal-weekender')
  assert.equal(ids(getListingResults(events, filters('sort=price-high'), 'en'))[0], 'next-perspectives')
  assert.deepEqual(ids(getListingResults(events, filters('sort=popular'), 'en')).slice(0, 3), ['cairo-after-dark', 'creative-canvas', 'coastal-weekender'])
  assert.deepEqual(events.map((event) => event.id), original)
})

test('pagination has no gaps or duplicates and bounds invalid page numbers', () => {
  const first = getListingResults(events, filters(), 'en')
  const second = getListingResults(events, filters('page=2'), 'en')
  assert.equal(first.events.length, 6)
  assert.equal(second.events.length, 2)
  assert.equal(first.start, 1)
  assert.equal(first.end, 6)
  assert.equal(second.start, 7)
  assert.equal(second.end, 8)
  assert.equal(new Set([...ids(first), ...ids(second)]).size, events.length)
  assert.equal(getListingResults(events, filters('page=999'), 'en').page, 2)
  for (const page of ['-2', '0', 'NaN', 'Infinity', '1.5', '99999999999999999']) assert.equal(filters(`page=${page}`).page, 1)
})

test('unknown URL values are safe and bilingual filter URLs round-trip', () => {
  const parsed = filters('category=bad&category=arts&category=arts&city=bad&sort=bad&price=bad')
  assert.deepEqual(parsed.categories, ['arts'])
  assert.equal(parsed.city, '')
  assert.equal(parsed.price, 'all')
  assert.equal(parsed.sort, 'soonest')
  const original = { ...filters(), query: 'فن & music', categories: ['arts', 'concerts'], city: 'cairo', from: '2026-11-01', to: '2026-11-30', price: 'paid', sort: 'price-low', page: 2 }
  assert.deepEqual(parseListingFilters(listingSearchParams(original)), original)
})

test('free events and no-match searches produce correct empty or filtered results', () => {
  assert.deepEqual(ids(getListingResults(events, filters('price=free'), 'en')), ['coastal-weekender'])
  const result = getListingResults(events, filters('q=no-such-event'), 'en')
  assert.equal(result.total, 0)
  assert.equal(result.start, 0)
  assert.equal(result.end, 0)
})

test('every event has complete bilingual details, coherent timing, and local gallery assets', () => {
  for (const event of events) {
    const details = getEventDetails(event)
    assert.equal(new Date(event.date).getTime() - new Date(details.doorsOpen).getTime(), 30 * 60_000)
    assert.ok(details.duration > 0)
    assert.ok(details.capacity > 0)
    assert.ok(details.gallery.length >= 3)
    assert.equal(new Set(details.gallery).size, details.gallery.length)
    for (const image of details.gallery) assert.ok(existsSync(fileURLToPath(new URL(`../public${image}`, import.meta.url))), image)
    for (const lang of ['en', 'ar']) {
      assert.ok(details.address[lang])
      assert.ok(details.organiser[lang])
      assert.ok(details.policies.length >= 3)
      assert.ok(details.faqs.length >= 3)
      details.policies.forEach((policy) => { assert.ok(policy.title[lang]); assert.ok(policy.body[lang]) })
      details.faqs.forEach((faq) => { assert.ok(faq.question[lang]); assert.ok(faq.answer[lang]) })
      const links = venueMapLinks(details.coordinates, lang)
      const map = new URL(links.embed)
      assert.equal(map.hostname, 'www.google.com')
      assert.equal(map.searchParams.get('q'), details.coordinates.join(','))
      assert.equal(map.searchParams.get('hl'), lang)
      assert.equal(map.searchParams.get('output'), 'embed')
      const external = new URL(links.external)
      assert.equal(external.hostname, 'www.google.com')
      assert.equal(external.pathname, '/maps/search/')
      assert.equal(external.searchParams.get('api'), '1')
      assert.equal(external.searchParams.get('query'), details.coordinates.join(','))
    }
  }
})

function memoryStorage(initial = []) {
  const values = new Map([[savedEventsKey, JSON.stringify(initial)]])
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value) } }
}

test('saved events persist across reloads and can be removed without duplicate bookmarks', () => {
  const storage = memoryStorage()
  const store = createSavedEventsStore(storage)
  assert.deepEqual(store.toggle('cairo-after-dark'), { saved: true, persisted: true })
  assert.deepEqual(createSavedEventsStore(storage).getSnapshot().savedIds, ['cairo-after-dark'])
  assert.deepEqual(store.toggle('sunset-beats'), { saved: true, persisted: true })
  assert.deepEqual(store.toggle('cairo-after-dark'), { saved: false, persisted: true })
  assert.deepEqual(createSavedEventsStore(storage).getSnapshot().savedIds, ['sunset-beats'])
})

test('saving publishes one shared snapshot to every subscribed page control', () => {
  const store = createSavedEventsStore(memoryStorage())
  const observed = []
  const stop = store.subscribe(() => observed.push([...store.getSnapshot().savedIds]))
  let otherControl = []
  store.subscribe(() => { otherControl = [...store.getSnapshot().savedIds] })
  store.toggle('cairo-after-dark')
  assert.deepEqual(otherControl, ['cairo-after-dark'])
  stop()
  store.toggle('cairo-after-dark')
  assert.deepEqual(observed, [['cairo-after-dark']])
  assert.deepEqual(otherControl, [])
})

test('saved-event storage discards corrupt data, duplicates, and missing event IDs', () => {
  for (const raw of ['broken JSON', '{}', 'null', '42']) assert.deepEqual(parseSavedEventIds(raw), [])
  assert.deepEqual(parseSavedEventIds('["cairo-after-dark","cairo-after-dark",null,42,"missing-event",{},"nile-nights"]'), ['cairo-after-dark', 'nile-nights'])
  const store = createSavedEventsStore(memoryStorage())
  store.toggle('missing-event')
  assert.deepEqual(store.getSnapshot().savedIds, [])
})

test('blocked storage and quota failures preserve bookmarks for the current visit', () => {
  const blocked = { getItem() { throw new Error('blocked') }, setItem() { throw new Error('quota') } }
  const store = createSavedEventsStore(blocked)
  assert.equal(store.getSnapshot().isPersistent, false)
  assert.deepEqual(store.toggle('cairo-after-dark'), { saved: true, persisted: false })
  store.refresh()
  assert.deepEqual(store.getSnapshot().savedIds, ['cairo-after-dark'])
  assert.deepEqual(store.toggle('cairo-after-dark'), { saved: false, persisted: false })
  const inMemory = createSavedEventsStore()
  inMemory.toggle('nile-nights')
  assert.deepEqual(inMemory.getSnapshot().savedIds, ['nile-nights'])
  assert.equal(inMemory.getSnapshot().isPersistent, false)
})

test('an external storage change updates saved controls and a clear removes bookmarks', () => {
  const storage = memoryStorage(['cairo-after-dark'])
  const store = createSavedEventsStore(storage)
  storage.setItem(savedEventsKey, JSON.stringify(['sunset-beats']))
  store.refresh()
  assert.deepEqual(store.getSnapshot().savedIds, ['sunset-beats'])
  storage.setItem(savedEventsKey, '[]')
  store.refresh()
  assert.deepEqual(store.getSnapshot().savedIds, [])
})

test('Saved filter combines with search, category, city, price and date filters', () => {
  const saved = ['cairo-after-dark', 'creative-canvas', 'sunset-beats', 'nile-nights']
  const selected = filters('saved=1&category=concerts&city=cairo&price=paid&from=2026-11-20&to=2026-11-20&q=الغروب')
  assert.deepEqual(ids(getListingResults(events, selected, 'ar', saved)), ['sunset-beats'])
  assert.equal(getListingResults(events, filters('saved=1'), 'en').total, 0)
  assert.equal(getListingResults(events, filters('saved=invalid'), 'en', saved).total, events.length)
  assert.equal(parseListingFilters(listingSearchParams(selected)).savedOnly, true)
})

test('unsaving on the last saved page bounds pagination and handles the final removal', () => {
  const saved = events.map((event) => event.id)
  assert.equal(getListingResults(events, filters('saved=1&page=2'), 'en', saved).page, 2)
  const reduced = saved.slice(0, 6)
  const result = getListingResults(events, filters('saved=1&page=2'), 'en', reduced)
  assert.equal(result.page, 1)
  assert.equal(result.total, 6)
  assert.equal(getListingResults(events, filters('saved=1&page=2'), 'en', []).total, 0)
})

test('sample statuses cover available, sold-out and cancelled, and remain visible in saved results', () => {
  assert.deepEqual(new Set(events.map((event) => event.status)), new Set(['available', 'sold-out', 'cancelled']))
  const result = getListingResults(events, filters('saved=1'), 'en', ['creative-canvas', 'nile-nights'])
  assert.deepEqual(new Set(result.events.map((event) => event.status)), new Set(['sold-out', 'cancelled']))
})
