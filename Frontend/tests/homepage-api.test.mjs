import { test } from 'node:test'
import assert from 'node:assert/strict'
import { homepageQuery, parsePublicVenues } from '../src/lib/homepageApi.ts'
import { listingApiQuery } from '../src/lib/eventsModel.ts'

const empty = { query: '', city: '', category: '', date: '' }
const preferences = { interests: [], city: '' }
const id = '00000000-0000-4000-8000-000000000001'

test('homepage search uses backend filters, an inclusive date and server sorting', () => {
  const result = homepageQuery({ query: '  Jazz  ', city: 'cairo', category: 'concerts', date: '2030-10-25' }, 'upcoming', preferences)
  const query = new URLSearchParams(listingApiQuery(result.filters))
  assert.equal(query.get('q'), 'Jazz')
  assert.equal(query.get('city'), 'cairo')
  assert.deepEqual(query.getAll('category'), ['concerts'])
  assert.equal(query.get('from'), '2030-10-25')
  assert.equal(query.get('to'), '2030-10-25')
  assert.equal(query.get('sort'), 'soonest')
  assert.equal(homepageQuery(empty, 'trending', preferences).filters.sort, 'popular')
})

test('recommendations query every matching category and city, not just already loaded cards', () => {
  const next = { interests: ['concerts', 'arts'], city: 'giza' }
  const result = homepageQuery(empty, 'for-you', next)
  assert.deepEqual(result.filters.categories, ['concerts', 'arts'])
  assert.equal(result.filters.city, 'giza')
  assert.equal(result.filters.sort, 'popular')
  assert.equal(result.conflict, false)
  assert.equal(homepageQuery({ ...empty, city: 'cairo' }, 'for-you', next).conflict, true)
  assert.equal(homepageQuery({ ...empty, category: 'sports' }, 'for-you', next).conflict, true)
  assert.deepEqual(homepageQuery({ ...empty, category: 'arts' }, 'for-you', next).filters.categories, ['arts'])
  assert.deepEqual(next, { interests: ['concerts', 'arts'], city: 'giza' })
})

test('public venue mapping preserves database identity and translates cities without invented venue names', () => {
  const [venue] = parsePublicVenues([{ id, name: 'Opera Hall', city: 'Cairo', type: 'SEATED' }])
  assert.equal(venue.id, id)
  assert.deepEqual(venue.name, { en: 'Opera Hall', ar: 'Opera Hall' })
  assert.deepEqual(venue.city, { en: 'Cairo', ar: 'القاهرة' })
  assert.equal(venue.searchCity, 'cairo')
  assert.equal(venue.illustrativeImage, true)
})

test('optional Arabic content and safe uploaded photos are retained while unsafe URLs use a labelled fallback', () => {
  const row = { id, name: 'Hall', nameAr: 'قاعة', city: 'Luxor', image: '/uploads/hall.jpg' }
  const [venue] = parsePublicVenues([row], 'http://localhost:3000')
  assert.equal(venue.name.ar, 'قاعة')
  assert.equal(venue.image, 'http://localhost:3000/uploads/hall.jpg')
  assert.equal(venue.illustrativeImage, false)
  assert.equal(venue.searchCity, '')
  assert.equal(venue.city.ar, 'Luxor')
  for (const image of ['javascript:alert(1)', '//unsafe.test/photo.jpg', 'data:image/png,example']) {
    assert.equal(parsePublicVenues([{ ...row, image }])[0].illustrativeImage, true)
  }
})

test('an empty venue response stays empty and malformed or duplicate records are not accepted', () => {
  assert.deepEqual(parsePublicVenues([]), [])
  const row = { id, name: 'Hall', city: 'Giza' }
  for (const data of [null, {}, [null], [{ ...row, name: '' }], [{ ...row, id: 'not-a-uuid' }], [row, row]]) assert.throws(() => parsePublicVenues(data))
})
