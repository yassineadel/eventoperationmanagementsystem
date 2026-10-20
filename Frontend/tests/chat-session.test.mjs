import test from 'node:test'
import assert from 'node:assert/strict'
import { createChatSession, chatInputLimit } from '../src/Components/Chatbot/chatSession.ts'

function deferred() {
  let resolve
  let reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

function until(session, predicate) {
  if (predicate(session.getSnapshot())) return Promise.resolve(session.getSnapshot())
  return new Promise((resolve) => {
    const unsubscribe = session.subscribe(() => {
      const snapshot = session.getSnapshot()
      if (predicate(snapshot)) { unsubscribe(); resolve(snapshot) }
    })
  })
}

const settled = (session) => until(session, (snapshot) => snapshot.status !== 'typing')
const nextTurn = () => new Promise((resolve) => setImmediate(resolve))

test('blank, over-limit, invalid display text and concurrent submissions never reach the adapter', async (t) => {
  const pending = deferred()
  const calls = []
  const session = createChatSession((message) => { calls.push(message); return pending.promise })
  t.after(() => session.cancel())
  assert.equal(chatInputLimit, 600)
  for (const message of ['', '  \n\t', 'x'.repeat(601)]) assert.equal(session.ask(message), false)
  assert.equal(session.ask('hello', ''), false)
  assert.equal(session.ask('hello', 'x'.repeat(601)), false)
  assert.deepEqual(calls, [])
  assert.deepEqual(session.getSnapshot().messages, [])
  assert.equal(session.ask('x'.repeat(600)), true)
  assert.equal(session.getSnapshot().status, 'typing')
  assert.equal(session.ask('another question'), false)
  assert.equal(calls.length, 1)
  assert.equal(session.getSnapshot().messages.length, 1)
  pending.resolve({ text: 'A public sample answer.' })
  await settled(session)
  assert.equal(session.getSnapshot().messages.length, 2)
})

test('subscribers observe asynchronous progress and can unsubscribe; server state stays empty', async (t) => {
  const pending = deferred()
  const seen = []
  let sentMessage
  let sentSignal
  const session = createChatSession((message, signal) => { sentMessage = message; sentSignal = signal; return pending.promise })
  t.after(() => session.cancel())
  const unsubscribe = session.subscribe(() => seen.push(session.getSnapshot()))
  assert.equal(session.ask('  Find music  ', '  ابحث عن موسيقى  '), true)
  assert.equal(sentMessage, 'Find music')
  assert.equal(sentSignal.aborted, false)
  assert.equal(session.getSnapshot().messages[0].text, 'ابحث عن موسيقى')
  assert.equal(seen.at(-1).status, 'typing')
  pending.resolve({ text: '  Music events.  ', links: [{ label: 'Concerts', to: '/events?category=concerts' }] })
  const complete = await settled(session)
  assert.equal(complete.status, 'idle')
  assert.equal(complete.error, null)
  assert.deepEqual(complete.messages.map(({ role, text }) => ({ role, text })), [{ role: 'user', text: 'ابحث عن موسيقى' }, { role: 'assistant', text: 'Music events.' }])
  assert.equal(complete.messages[1].links[0].to, '/events?category=concerts')
  assert.equal(new Set(complete.messages.map((message) => message.id)).size, 2)
  assert.equal(seen.at(-1), complete)
  const count = seen.length
  unsubscribe()
  session.reset()
  assert.equal(seen.length, count)
  assert.deepEqual(session.getServerSnapshot(), { messages: [], status: 'idle', error: null })
})

test('failed requests are retryable without adding a second user message', async (t) => {
  const first = deferred()
  const second = deferred()
  const calls = []
  const session = createChatSession((message) => { calls.push(message); return calls.length === 1 ? first.promise : second.promise })
  t.after(() => session.cancel())
  assert.equal(session.retry(), false)
  session.ask('  How do refunds work?  ')
  assert.equal(session.retry(), false)
  first.reject(new Error('Sample adapter unavailable'))
  const failure = await settled(session)
  assert.equal(failure.error, 'unavailable')
  assert.equal(failure.status, 'error')
  assert.equal(failure.messages.length, 1)
  const userId = failure.messages[0].id
  assert.equal(session.retry(), true)
  assert.equal(session.retry(), false)
  assert.equal(session.getSnapshot().messages.length, 1)
  second.resolve({ text: 'Review the sample refund policy.' })
  const success = await settled(session)
  assert.deepEqual(calls, ['How do refunds work?', 'How do refunds work?'])
  assert.equal(success.messages[0].id, userId)
  assert.deepEqual(success.messages.map((message) => message.role), ['user', 'assistant'])
  assert.equal(success.error, null)
  assert.equal(session.retry(), false)
})

test('timeout ends typing and aborts even when the adapter ignores its signal', { timeout: 1000 }, async (t) => {
  const ignored = deferred()
  let signal
  const session = createChatSession((_message, requestSignal) => { signal = requestSignal; return ignored.promise }, 15)
  t.after(() => session.cancel())
  session.ask('Find sample events')
  const result = await settled(session)
  assert.equal(result.status, 'error')
  assert.equal(result.error, 'timeout')
  assert.equal(signal.aborted, true)
  ignored.resolve({ text: 'This late answer must be ignored.' })
  await nextTurn()
  assert.equal(session.getSnapshot(), result)
  assert.equal(session.getSnapshot().messages.length, 1)
})

test('reset aborts pending work and discards its eventual reply and retry record', async (t) => {
  const ignored = deferred()
  let signal
  const session = createChatSession((_message, requestSignal) => { signal = requestSignal; return ignored.promise })
  t.after(() => session.cancel())
  session.ask('Find venues')
  session.reset()
  assert.equal(signal.aborted, true)
  assert.deepEqual(session.getSnapshot(), { messages: [], status: 'idle', error: null })
  assert.equal(session.retry(), false)
  ignored.resolve({ text: 'A stale venue answer.' })
  await nextTurn()
  assert.deepEqual(session.getSnapshot(), { messages: [], status: 'idle', error: null })
})

test('cancel returns to idle, permits a new request and cannot overwrite its answer', async (t) => {
  const old = deferred()
  const current = deferred()
  const signals = []
  const session = createChatSession((_message, signal) => { signals.push(signal); return signals.length === 1 ? old.promise : current.promise })
  t.after(() => session.cancel())
  session.ask('Old request')
  session.cancel()
  assert.equal(signals[0].aborted, true)
  assert.equal(session.getSnapshot().status, 'idle')
  assert.equal(session.getSnapshot().error, null)
  assert.equal(session.ask('New request'), true)
  old.resolve({ text: 'A stale answer.' })
  await nextTurn()
  assert.equal(session.getSnapshot().status, 'typing')
  assert.equal(session.getSnapshot().messages.some((message) => message.text === 'A stale answer.'), false)
  assert.equal(signals[1].aborted, false)
  current.resolve({ text: 'The current answer.' })
  const result = await settled(session)
  assert.equal(result.messages.at(-1).text, 'The current answer.')
  assert.deepEqual(result.messages.map((message) => message.role), ['user', 'user', 'assistant'])
})

test('history remains capped at forty messages and keeps the most recent complete exchanges', async (t) => {
  const session = createChatSession(async (message) => ({ text: `Answer to ${message}` }))
  t.after(() => session.cancel())
  for (let index = 0; index < 25; index++) {
    assert.equal(session.ask(`Question ${index}`), true)
    const snapshot = await settled(session)
    assert.ok(snapshot.messages.length <= 40)
    assert.equal(snapshot.messages.at(-1).text, `Answer to Question ${index}`)
  }
  const messages = session.getSnapshot().messages
  assert.equal(messages.length, 40)
  assert.equal(messages[0].role, 'user')
  assert.equal(messages[0].text, 'Question 5')
  assert.equal(messages.at(-1).text, 'Answer to Question 24')
  assert.equal(new Set(messages.map((message) => message.id)).size, 40)
  for (let index = 0; index < messages.length; index++) assert.equal(messages[index].role, index % 2 ? 'assistant' : 'user')
})

test('malicious and unknown adapter destinations are discarded while text stays plain', async (t) => {
  const plainText = '<script>alert("not executable")</script>\nUse the public guide.'
  const malicious = [
    { label: 'External', to: 'https://evil.example' },
    { label: 'Protocol-relative', to: '//evil.example' },
    { label: 'Script', to: 'javascript:alert(1)' },
    { label: 'Data', to: 'data:text/html,bad' },
    { label: 'Unknown', to: '/admin' },
    { label: 'Traversal', to: '/events/../profile' },
    { label: 'Backslash', to: '/events?x=\\evil' },
    { label: 'Newline', to: '/events?x=\nhttps://evil.example' },
    { label: '', to: '/events' },
    { label: 'x'.repeat(121), to: '/events' },
    { label: 'Wrong type', to: 7 },
    null,
  ]
  const valid = [
    { label: 'Event', to: '/events/cairo-after-dark' },
    { label: 'My Tickets', to: '/my-tickets' },
    { label: 'Music', to: '/events?category=concerts&city=cairo' },
    { label: 'Fourth valid link', to: '/cart' },
  ]
  const session = createChatSession(async () => ({ text: plainText, links: [...malicious, ...valid] }))
  t.after(() => session.cancel())
  session.ask('Show guidance')
  const result = await settled(session)
  assert.equal(result.status, 'idle')
  const answer = result.messages.at(-1)
  assert.equal(answer.text, plainText)
  assert.deepEqual(answer.links, valid.slice(0, 3))
})

test('empty or oversized adapter replies become retryable errors, not blank bubbles', async (t) => {
  for (const invalid of [{ text: '' }, { text: '  \n ' }, { text: 'x'.repeat(8001) }, null, { text: 17 }]) {
    let calls = 0
    const session = createChatSession(async () => ++calls === 1 ? invalid : { text: 'A valid replacement.' })
    t.after(() => session.cancel())
    session.ask('Please help')
    const failure = await settled(session)
    assert.equal(failure.status, 'error')
    assert.equal(failure.error, 'unavailable')
    assert.equal(failure.messages.length, 1)
    assert.equal(session.retry(), true)
    const recovered = await settled(session)
    assert.equal(recovered.status, 'idle')
    assert.equal(recovered.messages.length, 2)
    assert.equal(recovered.messages.at(-1).text, 'A valid replacement.')
  }
})
