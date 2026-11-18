import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { downsample, floatToPcm16, pcm16ToFloat } from '../src/Components/Chatbot/voiceAudio.ts'
import { createChatSession } from '../src/Components/Chatbot/chatSession.ts'

// voiceSession reads the API address from Vite's environment, so it is loaded through Vite
let server
let createVoiceController
before(async () => {
  server = await createServer({ cacheDir: 'node_modules/.vite-tests/voice', server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom' })
  createVoiceController = (await server.ssrLoadModule('/src/Components/Chatbot/voiceSession.ts')).createVoiceController
})
after(() => server?.close())

const nextTurn = () => new Promise((resolve) => setImmediate(resolve))

test('microphone audio is resampled to 16 kHz and converted to 16-bit PCM and back', () => {
  const input = new Float32Array(480).map((_, i) => (i % 3) / 2)
  const down = downsample(input, 48_000)
  assert.equal(down.length, 160)
  assert.ok(Math.abs(down[0] - 0.5) < 1e-6, 'each output sample is the average of three input samples')
  assert.equal(downsample(input, 16_000), input)
  const pcm = floatToPcm16(new Float32Array([0, 1, -1, 2, -2, 0.5]))
  assert.equal(pcm.byteLength, 12)
  const view = new DataView(pcm)
  assert.deepEqual([0, 1, 2, 3, 4].map((i) => view.getInt16(i * 2, true)), [0, 32767, -32768, 32767, -32768])
  const back = pcm16ToFloat(pcm)
  assert.ok(Math.abs(back[5] - 0.5) < 0.001)
})

test('spoken exchanges join the typed conversation with the same link checks', () => {
  const session = createChatSession(async () => ({ text: 'unused' }))
  assert.equal(session.addSpokenExchange('  When do the doors open?  ', { text: 'At 6:30.', links: [{ label: 'Event', to: '/events/abc' }, { label: 'Bad', to: 'https://evil.example' }] }), true)
  assert.equal(session.addSpokenExchange('', { text: 'Anything else?' }), true)
  assert.equal(session.addSpokenExchange('hi', { text: '   ' }), false, 'empty replies are not added')
  const messages = session.getSnapshot().messages
  assert.deepEqual(messages.map(({ role, text }) => ({ role, text })), [
    { role: 'user', text: 'When do the doors open?' },
    { role: 'assistant', text: 'At 6:30.' },
    { role: 'assistant', text: 'Anything else?' },
  ])
  assert.deepEqual(messages[1].links, [{ label: 'Event', to: '/events/abc' }])
  assert.deepEqual(session.history(), messages.map(({ role, text }) => ({ role, text })))
})

function fakes({ ticket = async () => 'T1', micFails = false } = {}) {
  const log = { sent: [], played: [], interrupted: 0, micStopped: 0, speakerClosed: 0, url: '' }
  let socket
  let setSpeaking
  const deps = {
    getTicket: ticket,
    openSocket(url) {
      log.url = url
      socket = { binaryType: 'blob', readyState: 1, onopen: null, onmessage: null, onclose: null, onerror: null,
        send: (data) => log.sent.push(data), close: () => { socket.readyState = 3 } }
      return socket
    },
    async startMicrophone(onChunk) {
      if (micFails) throw new Error('denied')
      log.mic = onChunk
      return { stop: () => log.micStopped++ }
    },
    createSpeaker(onSpeaking) {
      setSpeaking = onSpeaking
      return { play: (b) => log.played.push(b.byteLength), interrupt: () => log.interrupted++, isSpeaking: () => false, close: () => log.speakerClosed++ }
    },
  }
  return { deps, log, server: { open: () => socket.onopen(), say: (m) => socket.onmessage({ data: JSON.stringify(m) }), audio: (n) => socket.onmessage({ data: new ArrayBuffer(n) }), drop: () => socket.onclose() }, speaking: (v) => setSpeaking(v) }
}

function recorder() {
  const seen = { states: [], captions: [], turns: [], problems: [] }
  return { seen, callbacks: { onState: (s) => seen.states.push(s), onCaptions: (c) => seen.captions.push(c), onTurn: (u, r) => seen.turns.push({ u, r }), onProblem: (p) => seen.problems.push(p) } }
}

test('a voice conversation: ticket, start with history, microphone, speech, captions, turns and stop', async () => {
  const { deps, log, server: srv, speaking } = fakes()
  const { seen, callbacks } = recorder()
  const voice = createVoiceController(callbacks, deps)
  await voice.start([{ role: 'user', text: 'hi' }, { role: 'assistant', text: 'Hello!' }])
  assert.match(log.url, /^ws:\/\/localhost:3000\/api\/assistant\/voice\?ticket=T1$/)
  srv.open()
  assert.deepEqual(JSON.parse(log.sent[0]), { type: 'start', history: [{ role: 'user', text: 'hi' }, { role: 'assistant', text: 'Hello!' }] })
  srv.say({ type: 'ready' })
  await nextTurn()
  assert.deepEqual(seen.states, ['connecting', 'listening'])
  log.mic(new ArrayBuffer(3200))
  assert.equal(log.sent[1].byteLength, 3200, 'microphone audio goes to the socket')
  srv.say({ type: 'user_text', text: 'When does it start' })
  srv.audio(4800)
  speaking(true)
  srv.say({ type: 'assistant_text', text: 'At seven.' })
  assert.deepEqual(seen.captions.at(-1), { user: 'When does it start', assistant: 'At seven.' })
  assert.deepEqual(log.played, [4800])
  assert.equal(seen.states.at(-1), 'speaking')
  srv.say({ type: 'interrupted' })
  assert.equal(log.interrupted, 1)
  srv.say({ type: 'turn', user: 'When does it start', assistant: 'At seven.', links: [{ label: 'Art', to: '/events/a' }] })
  assert.deepEqual(seen.turns, [{ u: 'When does it start', r: { text: 'At seven.', links: [{ label: 'Art', to: '/events/a' }] } }])
  assert.deepEqual(seen.captions.at(-1), { user: '', assistant: '' })
  voice.stop()
  assert.deepEqual(JSON.parse(log.sent.at(-1)), { type: 'stop' })
  assert.equal(log.micStopped, 1)
  assert.equal(log.speakerClosed, 1)
  assert.equal(seen.states.at(-1), 'idle')
  assert.deepEqual(seen.problems, [])
})

test('voice reports why it stopped: microphone refused, busy, server limits, dropped connection', async () => {
  let r = recorder()
  let f = fakes({ micFails: true })
  let voice = createVoiceController(r.callbacks, f.deps)
  await voice.start([])
  f.server.open(); f.server.say({ type: 'ready' }); await nextTurn()
  assert.deepEqual(r.seen.problems, ['microphone']); assert.equal(voice.getState(), 'idle')

  r = recorder()
  const busy = Object.assign(new Error('Too many'), { status: 429 })
  const { ApiError } = await server.ssrLoadModule('/src/lib/api.ts')
  f = fakes({ ticket: async () => { throw new ApiError('Too many', 429) } })
  voice = createVoiceController(r.callbacks, f.deps)
  await voice.start([])
  assert.deepEqual(r.seen.problems, ['busy']); assert.equal(f.log.url, '', 'no socket without a ticket'); void busy

  for (const [reason, expected] of [['time_limit', 'time_limit'], ['idle', 'idle'], ['unavailable', 'unavailable']]) {
    r = recorder(); f = fakes()
    voice = createVoiceController(r.callbacks, f.deps)
    await voice.start([]); f.server.open(); f.server.say({ type: 'ready' }); await nextTurn()
    f.server.say({ type: 'ended', reason })
    assert.deepEqual(r.seen.problems, [expected]); assert.equal(voice.getState(), 'idle')
  }

  r = recorder(); f = fakes()
  voice = createVoiceController(r.callbacks, f.deps)
  await voice.start([]); f.server.drop()
  assert.deepEqual(r.seen.problems, ['busy'], 'refused while connecting')

  r = recorder(); f = fakes()
  voice = createVoiceController(r.callbacks, f.deps)
  await voice.start([]); f.server.open(); f.server.say({ type: 'ready' }); await nextTurn(); f.server.drop()
  assert.deepEqual(r.seen.problems, ['unavailable'], 'dropped mid-conversation')
  // nothing from a finished conversation reaches the widget
  f.server.say({ type: 'turn', user: 'late', assistant: 'late' })
  assert.deepEqual(r.seen.turns, [])
})
