import test from 'node:test'
import assert from 'node:assert/strict'
import {
  beginEmailChange, canRequestDeletion, defaultPreviewProfile, deletionGraceEnds, previewPassword, previewStorageKey,
  readPreviewProfile, validateDetails, validatePasswordChange, verifySampleEmail, writePreviewProfile,
} from '../src/Components/Profile/profileModel.ts'
import { accountReturnPath, normaliseSessionUser } from '../src/lib/sessionUser.ts'

function storage(initial) {
  let value = initial === undefined ? null : JSON.stringify(initial)
  return { getItem: () => value, setItem: (_key, next) => { value = next } }
}

test('a pending deletion displays fourteen elapsed days across the Cairo daylight-saving change', () => {
  assert.equal(deletionGraceEnds('2026-10-24T23:30:00.000Z'), '2026-11-07T23:30:00.000Z')
  assert.equal(deletionGraceEnds(null), null)
  assert.equal(deletionGraceEnds('invalid'), null)
})

test('personal details accept Arabic names, an optional phone, and Egyptian mobile numbers', () => {
  assert.deepEqual(validateDetails('يوسف أحمد', ''), { fullName: false, phone: false })
  assert.deepEqual(validateDetails('  Youssef Hassan  ', ' 01012345678 '), { fullName: false, phone: false })
  assert.deepEqual(validateDetails('Y', '123'), { fullName: true, phone: true })
  assert.equal(validateDetails('x'.repeat(201), '').fullName, true)
})

test('password changes validate presence and strength; the server checks the actual current password', () => {
  assert.deepEqual(validatePasswordChange(previewPassword, 'NewSample123', 'NewSample123'), { current: false, password: false, confirm: false })
  assert.equal(validatePasswordChange('not-the-demo-password', 'NewSample123', 'NewSample123').current, false)
  assert.equal(validatePasswordChange('', 'NewSample123', 'NewSample123').current, true)
  assert.equal(validatePasswordChange(previewPassword, previewPassword, previewPassword).password, true)
  assert.equal(validatePasswordChange(previewPassword, 'weak', 'weak').password, true)
  assert.equal(validatePasswordChange(previewPassword, 'NewSample123', 'Other123').confirm, true)
})

test('sample profile reload preserves only supported data and excludes secrets', () => {
  const memory = storage()
  const profile = { ...defaultPreviewProfile, fullName: 'يوسف أحمد', phone: '', email: 'new@example.com', communications: { eventNews: true, personalisedOffers: false, password: 'never-store' }, password: 'never-store', code: '482913', token: 'never-store' }
  assert.equal(writePreviewProfile(profile, memory), true)
  assert.equal(readPreviewProfile(memory).fullName, 'يوسف أحمد')
  assert.equal(readPreviewProfile(memory).phone, '')
  assert.equal(readPreviewProfile(memory).email, 'new@example.com')
  assert.deepEqual(readPreviewProfile(memory).communications, { eventNews: true, personalisedOffers: false })
  assert.doesNotMatch(memory.getItem(previewStorageKey), /never-store|password|token|482913/)
})

test('corrupt, stale or blocked preview storage does not create a real account or break rendering', () => {
  assert.deepEqual(readPreviewProfile({ getItem: () => '{broken' }), defaultPreviewProfile)
  const invalid = readPreviewProfile(storage({ fullName: '', phone: null, email: 'bad', communications: { eventNews: 'yes' }, deletionRequestedAt: 'invalid' }))
  assert.deepEqual(invalid, defaultPreviewProfile)
  const blocked = { getItem() { throw new Error('Blocked') }, setItem() { throw new Error('Quota') } }
  assert.deepEqual(readPreviewProfile(blocked), defaultPreviewProfile)
  assert.equal(writePreviewProfile(defaultPreviewProfile, blocked), false)
})

test('email preview rejects unchanged addresses and does not mutate the current profile before verification', () => {
  const current = { ...defaultPreviewProfile }
  assert.equal(beginEmailChange(current.email, ' YOUSSEF@example.com '), null)
  assert.equal(beginEmailChange(current.email, 'invalid'), null)
  const pending = beginEmailChange(current.email, ' next@example.com ', 1000)
  assert.equal(pending.email, 'next@example.com')
  assert.match(pending.code, /^\d{6}$/)
  assert.equal(pending.resendAt, 31_000)
  assert.equal(pending.expiresAt, 301_000)
  assert.equal(verifySampleEmail(pending, pending.code, 2000).status, 'verified')
  assert.equal(current.email, defaultPreviewProfile.email)
})

test('email verification expires, locks after five wrong attempts, and a new code resets the attempt budget', () => {
  let pending = beginEmailChange('old@example.com', 'next@example.com', 1000)
  assert.equal(verifySampleEmail(pending, pending.code, pending.expiresAt).status, 'expired')
  for (let attempt = 1; attempt <= 5; attempt++) {
    const result = verifySampleEmail(pending, '000000', 2000)
    assert.equal(result.status, attempt === 5 ? 'locked' : 'invalid')
    pending = result.change
  }
  assert.equal(verifySampleEmail(pending, pending.code, 2000).status, 'locked')
  const resent = beginEmailChange('old@example.com', pending.email, pending.resendAt)
  assert.equal(resent.attempts, 0)
  assert.equal(verifySampleEmail(resent, resent.code, resent.resendAt).status, 'verified')
})

test('deletion requests require both current-email confirmation and acknowledgement, retaining profile data', () => {
  assert.equal(canRequestDeletion('a@example.com', ' A@example.com ', true), true)
  assert.equal(canRequestDeletion('a@example.com', 'other@example.com', true), false)
  assert.equal(canRequestDeletion('a@example.com', 'a@example.com', false), false)
  const memory = storage()
  const pending = { ...defaultPreviewProfile, deletionRequestedAt: '2026-10-17T12:00:00.000Z' }
  writePreviewProfile(pending, memory)
  assert.equal(readPreviewProfile(memory).deletionRequestedAt, pending.deletionRequestedAt)
  assert.equal(readPreviewProfile(memory).email, pending.email)
  writePreviewProfile({ ...pending, deletionRequestedAt: null }, memory)
  assert.equal(readPreviewProfile(memory).deletionRequestedAt, null)
})

test('session normalisation supports both schema formats without retaining credential fields', () => {
  const old = normaliseSessionUser({ id: 'user-1', first_name: 'Youssef', last_name: 'Hassan', email: 'a@example.com', is_verified: true, password_hash: 'hidden' })
  assert.equal(old.fullName, 'Youssef Hassan')
  assert.equal(old.emailVerified, true)
  assert.equal('password_hash' in old, false)
  assert.equal(normaliseSessionUser({ id: '1', fullName: 'يوسف', email: 'a@example.com', isVerified: false }).emailVerified, false)
  assert.equal(normaliseSessionUser({ id: '1', email: 'a@example.com' }).emailVerified, null)
  for (const invalid of [null, {}, { id: '1' }, { id: 1, email: 'a@example.com' }]) assert.throws(() => normaliseSessionUser(invalid))
})

test('sign-in return destinations are restricted to the two account screens', () => {
  assert.equal(accountReturnPath('/profile'), '/profile')
  assert.equal(accountReturnPath('/profile/settings'), '/profile/settings')
  for (const path of [null, 'https://example.com', '//example.com', '/profile/../admin', '/profile?preview=1', '/admin', 'javascript:alert(1)']) assert.equal(accountReturnPath(path), '/')
})
