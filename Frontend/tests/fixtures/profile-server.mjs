// Isolated browser QA fixture. In-memory request metadata only; no database, SMTP or account deletion.
import { createServer } from 'node:http'

const user = { id: 'profile-qa-user', fullName: 'QA Member', email: 'member@example.test', phone: '01012345678', role: 'USER', emailVerified: true, marketingOptIn: false, deletionRequestedAt: null }
let pendingEmail
let failPreferences = process.env.PROFILE_FIXTURE_FAIL_PREFERENCES === '1'
let failCancel = process.env.PROFILE_FIXTURE_FAIL_CANCEL === '1'
const server = createServer(async (req, res) => {
  const origin = req.headers.origin
  if (origin && /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) res.setHeader('Access-Control-Allow-Origin', origin)
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Content-Type', 'application/json')
  const send = (status, value) => { res.writeHead(status); res.end(JSON.stringify(value)) }
  if (req.method === 'OPTIONS') return send(204, {})
  const route = `${req.method} ${new URL(req.url, 'http://127.0.0.1').pathname}`
  let raw = ''
  for await (const chunk of req) raw += chunk
  const body = raw ? JSON.parse(raw) : {}
  if (route === 'GET /api/auth/me') return send(200, { user })
  if (route === 'PATCH /api/auth/me/preferences') {
    if (failPreferences) { failPreferences = false; return send(503, { message: 'Fixture outage' }) }
    if (typeof body.marketingOptIn !== 'boolean') return send(400, { message: 'Invalid preference' })
    user.marketingOptIn = body.marketingOptIn
    return send(200, { marketingOptIn: user.marketingOptIn })
  }
  if (route === 'POST /api/auth/me/deletion') {
    if (body.confirmEmail?.trim().toLowerCase() !== user.email.toLowerCase()) return send(400, { message: 'The email you typed does not match your account' })
    if (user.deletionRequestedAt) return send(400, { message: 'Deletion has already been requested' })
    user.deletionRequestedAt = new Date().toISOString()
    return send(200, { deletionRequestedAt: user.deletionRequestedAt, deletesAt: new Date(Date.parse(user.deletionRequestedAt) + 14 * 24 * 60 * 60 * 1000).toISOString() })
  }
  if (route === 'DELETE /api/auth/me/deletion') {
    if (failCancel) { failCancel = false; return send(503, { message: 'Fixture outage' }) }
    if (!user.deletionRequestedAt) return send(400, { message: 'There is no deletion request to cancel' })
    user.deletionRequestedAt = null
    return send(200, { message: 'Deletion request cancelled' })
  }
  if (route === 'PATCH /api/auth/me') {
    if (body.fullName === 'Network failure') return send(503, { message: 'Fixture outage' })
    if (body.fullName === 'Slow request') await new Promise((resolve) => setTimeout(resolve, 800))
    user.fullName = body.fullName; user.phone = body.phone || null
    return send(200, { user: { id: user.id, fullName: user.fullName, email: user.email, phone: user.phone, role: user.role } })
  }
  if (route === 'POST /api/auth/change-password') return body.currentPassword === 'FixtureCurrent1'
    ? send(200, { message: 'Password changed successfully' }) : send(400, { message: 'Current password is incorrect' })
  if (route === 'POST /api/auth/change-email/request') {
    if (body.newEmail === 'taken@example.test') return send(400, { message: 'Email already in use' })
    pendingEmail = body.newEmail
    return send(200, { message: 'Verification code sent to your new email' })
  }
  if (route === 'POST /api/auth/change-email/verify') {
    if (!pendingEmail) return send(400, { message: 'Code expired or not requested. Please request a new one.' })
    if (body.code !== '123456') return send(400, { message: 'Invalid verification code' })
    user.email = pendingEmail; pendingEmail = undefined
    return send(200, { user })
  }
  return send(404, { message: 'Fixture route not found' })
})
server.listen(Number(process.env.PROFILE_FIXTURE_PORT ?? 3002), '127.0.0.1', () => console.log('Isolated profile QA fixture on http://127.0.0.1:3002'))
