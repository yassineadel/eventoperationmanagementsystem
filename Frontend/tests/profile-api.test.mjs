import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { accountErrorKey } from '../src/Components/Profile/accountErrors.ts'
import { normaliseSessionUser } from '../src/lib/sessionUser.ts'

let server, profileApi, ApiError
before(async () => {
  server = await createServer({ cacheDir: 'node_modules/.vite-tests/profile-api', server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom' })
  profileApi = (await server.ssrLoadModule('/src/lib/profileApi.ts')).profileApi
  ApiError = (await server.ssrLoadModule('/src/lib/api.ts')).ApiError
})
after(async () => { await server?.close() })

function mockResponse(t, response, status = 200) {
  const calls = []
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    calls.push({ path: new URL(url).pathname, ...init, body: init.body === undefined ? undefined : JSON.parse(init.body) })
    return new Response(JSON.stringify(response), { status, headers: { 'Content-Type': 'application/json' } })
  })
  return calls
}

test('details use the cookie-backed PATCH contract, including clearing the phone', async (t) => {
  const user = { id: 'qa-user', fullName: 'يوسف خالد', email: 'member@example.test', role: 'USER', phone: null }
  const calls = mockResponse(t, { user })
  const signal = new AbortController().signal
  const result = await profileApi.updateDetails('  يوسف خالد  ', ' ', signal)
  assert.deepEqual(result, { user })
  assert.deepEqual(calls[0].body, { fullName: 'يوسف خالد', phone: '' })
  assert.equal(calls[0].path, '/api/auth/me')
  assert.equal(calls[0].method, 'PATCH')
  assert.equal(calls[0].credentials, 'include')
  assert.equal(calls[0].signal, signal)
})

test('password change sends only the server-required fields with the signed-in session', async (t) => {
  const calls = mockResponse(t, { message: 'Password changed successfully' })
  await profileApi.changePassword('ExampleCurrent1', 'ExampleNew123')
  assert.equal(calls[0].path, '/api/auth/change-password')
  assert.equal(calls[0].method, 'POST')
  assert.equal(calls[0].credentials, 'include')
  assert.deepEqual(calls[0].body, { currentPassword: 'ExampleCurrent1', newPassword: 'ExampleNew123' })
})

test('email request sends the new address only; verification receives the authoritative account', async (t) => {
  const calls = mockResponse(t, { message: 'Verification code sent to your new email' })
  const result = await profileApi.requestEmail(' NEW@Example.test ')
  assert.equal('user' in result, false)
  assert.deepEqual(calls[0].body, { newEmail: 'new@example.test' })
  assert.equal(calls[0].path, '/api/auth/change-email/request')
  const verified = { id: 'qa-user', fullName: 'Member', email: 'new@example.test', phone: '', role: 'USER', emailVerified: true }
  const verifyCalls = mockResponse(t, { user: verified })
  assert.deepEqual(await profileApi.verifyEmail('123456'), { user: verified })
  assert.equal(verifyCalls[0].path, '/api/auth/change-email/verify')
  assert.deepEqual(verifyCalls[0].body, { code: '123456' })
  assert.equal(verifyCalls[0].credentials, 'include')
})

test('HTTP failures are not accepted as successful saves', async (t) => {
  mockResponse(t, { message: 'Current password is incorrect' }, 400)
  await assert.rejects(profileApi.changePassword('Incorrect1', 'NewPassword123'), (error) => {
    assert.ok(error instanceof ApiError)
    assert.equal(accountErrorKey(error), 'incorrectPassword')
    return true
  })
})

test('errors map to translatable keys for Google-only accounts, expired sessions, codes, and outages', () => {
  const cases = [
    [400, 'This account signs in with Google and has no password.', 'googlePassword'],
    [400, 'Email already in use', 'emailTaken'], [400, 'Invalid verification code', 'invalidCode'],
    [400, 'Code expired or not requested. Please request a new one.', 'expiredCode'],
    [401, 'No session', 'sessionExpired'], [403, 'Blocked', 'sessionExpired'],
    [429, 'Too many attempts', 'requestLimited'], [0, 'Network error', 'requestNetwork'],
    [500, 'Private database diagnostic', 'requestFailed'],
    [400, 'Deletion has already been requested', 'deletionAlreadyRequested'],
    [400, 'There is no deletion request to cancel', 'deletionNotPending'],
    [400, 'The email you typed does not match your account', 'deletionError'],
  ]
  for (const [status, message, expected] of cases) assert.equal(accountErrorKey({ status, message }), expected)
})

test('marketing opt-in uses the single boolean preference contract for both choices', async (t) => {
  for (const marketingOptIn of [true, false]) {
    const calls = mockResponse(t, { marketingOptIn })
    const signal = new AbortController().signal
    assert.deepEqual(await profileApi.preferences(marketingOptIn, signal), { marketingOptIn })
    assert.equal(calls[0].path, '/api/auth/me/preferences')
    assert.equal(calls[0].method, 'PATCH')
    assert.equal(calls[0].credentials, 'include')
    assert.equal(calls[0].signal, signal)
    assert.deepEqual(calls[0].body, { marketingOptIn })
  }
})

test('a malformed preference response cannot be treated as a saved opt-out', async (t) => {
  for (const response of [{}, { marketingOptIn: 'false' }, null]) {
    mockResponse(t, response)
    await assert.rejects(profileApi.preferences(false))
  }
})

test('deletion requests send the confirmed address and receive the server deadline', async (t) => {
  const response = { deletionRequestedAt: '2026-10-24T12:00:00.000Z', deletesAt: '2026-11-07T12:00:00.000Z' }
  const calls = mockResponse(t, response)
  const signal = new AbortController().signal
  assert.deepEqual(await profileApi.requestDeletion(' Member@Example.test ', signal), response)
  assert.equal(calls[0].path, '/api/auth/me/deletion')
  assert.equal(calls[0].method, 'POST')
  assert.equal(calls[0].credentials, 'include')
  assert.equal(calls[0].signal, signal)
  assert.deepEqual(calls[0].body, { confirmEmail: 'member@example.test' })
})

test('cancelling deletion uses authenticated DELETE without a fabricated request body', async (t) => {
  const calls = mockResponse(t, { message: 'Deletion request cancelled' })
  const signal = new AbortController().signal
  await profileApi.cancelDeletion(signal)
  assert.equal(calls[0].path, '/api/auth/me/deletion')
  assert.equal(calls[0].method, 'DELETE')
  assert.equal(calls[0].body, undefined)
  assert.equal(calls[0].credentials, 'include')
  assert.equal(calls[0].signal, signal)
})

test('invalid deletion metadata and failed cancellation are rejected before updating the account', async (t) => {
  for (const response of [{}, { deletionRequestedAt: 'bad', deletesAt: 'bad' }, { deletionRequestedAt: '2026-11-07', deletesAt: '2026-10-24' }]) {
    mockResponse(t, response)
    await assert.rejects(profileApi.requestDeletion('member@example.test'))
  }
  mockResponse(t, { message: 'Service unavailable' }, 503)
  await assert.rejects(profileApi.cancelDeletion(), (error) => error instanceof ApiError && error.status === 503)
})

test('partial mutation results preserve session metadata without retaining secrets', () => {
  const current = normaliseSessionUser({ id: 'qa', email: 'old@example.test', fullName: 'Member', emailVerified: true, marketingOptIn: true, deletionRequestedAt: null })
  const next = normaliseSessionUser({ ...current, fullName: 'Updated Member', phone: null, passwordHash: 'never-keep', code: 'never-keep' })
  assert.equal(next.emailVerified, true)
  assert.equal(next.marketingOptIn, true)
  assert.equal(next.phone, '')
  assert.equal('passwordHash' in next || 'code' in next, false)
})
