// Audio for voice chat. Gemini Live takes 16-bit PCM, mono, 16 kHz from the microphone and
// speaks back in 16-bit PCM, mono, 24 kHz. Browsers record at their own rate (usually 48 kHz),
// so the microphone is resampled here before sending.

export const INPUT_RATE = 16_000
export const OUTPUT_RATE = 24_000
// About 100 ms of audio per message: small enough to feel live, large enough not to flood the socket
const CHUNK_SAMPLES = INPUT_RATE / 10

/** Resamples mono float audio to 16 kHz by averaging (also a simple low-pass filter) */
export function downsample(input: Float32Array, inputRate: number, outputRate = INPUT_RATE): Float32Array {
  if (inputRate === outputRate) return input
  const ratio = inputRate / outputRate
  const out = new Float32Array(Math.floor(input.length / ratio))
  for (let i = 0; i < out.length; i++) {
    const start = Math.floor(i * ratio)
    const end = Math.min(input.length, Math.floor((i + 1) * ratio))
    let sum = 0
    for (let j = start; j < end; j++) sum += input[j]
    out[i] = end > start ? sum / (end - start) : 0
  }
  return out
}

/** Float samples (-1…1) to 16-bit little-endian PCM bytes */
export function floatToPcm16(samples: Float32Array): ArrayBuffer {
  const view = new DataView(new ArrayBuffer(samples.length * 2))
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true)
  }
  return view.buffer
}

/** 16-bit little-endian PCM bytes to float samples (-1…1) */
export function pcm16ToFloat(bytes: ArrayBuffer): Float32Array {
  const view = new DataView(bytes)
  const out = new Float32Array(Math.floor(bytes.byteLength / 2))
  for (let i = 0; i < out.length; i++) out[i] = view.getInt16(i * 2, true) / 0x8000
  return out
}

// Runs on the audio thread and hands each block of microphone samples to the page
const micWorklet = `
class HafletnaMic extends AudioWorkletProcessor {
  process(inputs) {
    const channel = inputs[0] && inputs[0][0]
    if (channel) this.port.postMessage(channel.slice(0))
    return true
  }
}
registerProcessor('hafletna-mic', HafletnaMic)
`

export function voiceSupported() {
  return typeof window !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof AudioWorkletNode !== 'undefined' && typeof WebSocket !== 'undefined'
}

export type Microphone = { stop(): void }

/**
 * Starts the microphone and calls `onChunk` with ~100 ms of 16 kHz PCM at a time.
 * Echo cancellation keeps the assistant's own voice, coming out of the speakers, from being sent back.
 * Throws if the user refuses microphone access.
 */
export async function startMicrophone(onChunk: (pcm: ArrayBuffer) => void): Promise<Microphone> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  })
  const context = new AudioContext()
  const moduleUrl = URL.createObjectURL(new Blob([micWorklet], { type: 'application/javascript' }))
  try {
    await context.audioWorklet.addModule(moduleUrl)
  } finally {
    URL.revokeObjectURL(moduleUrl)
  }
  const source = context.createMediaStreamSource(stream)
  const node = new AudioWorkletNode(context, 'hafletna-mic')
  let pending: Float32Array[] = []
  let pendingLength = 0
  node.port.onmessage = (event: MessageEvent<Float32Array>) => {
    const resampled = downsample(event.data, context.sampleRate)
    pending.push(resampled)
    pendingLength += resampled.length
    if (pendingLength < CHUNK_SAMPLES) return
    const joined = new Float32Array(pendingLength)
    let offset = 0
    for (const part of pending) { joined.set(part, offset); offset += part.length }
    pending = []
    pendingLength = 0
    onChunk(floatToPcm16(joined))
  }
  source.connect(node)
  return {
    stop() {
      node.port.onmessage = null
      source.disconnect()
      node.disconnect()
      for (const track of stream.getTracks()) track.stop()
      void context.close()
    },
  }
}

export type Speaker = {
  /** Queues a piece of the assistant's speech right after what is already playing */
  play(pcm: ArrayBuffer): void
  /** Stops at once and drops everything queued (the user interrupted) */
  interrupt(): void
  /** True while speech is playing */
  isSpeaking(): boolean
  close(): void
}

/** Plays the assistant's 24 kHz speech, gaplessly, in the order it arrives */
export function createSpeaker(onSpeakingChange: (speaking: boolean) => void): Speaker {
  const context = new AudioContext()
  let playUntil = 0
  let speaking = false
  const sources = new Set<AudioBufferSourceNode>()
  const update = () => {
    const now = sources.size > 0
    if (now !== speaking) { speaking = now; onSpeakingChange(now) }
  }
  return {
    play(pcm) {
      const samples = pcm16ToFloat(pcm)
      if (!samples.length) return
      if (context.state === 'suspended') void context.resume()
      const buffer = context.createBuffer(1, samples.length, OUTPUT_RATE)
      buffer.getChannelData(0).set(samples)
      const source = context.createBufferSource()
      source.buffer = buffer
      source.connect(context.destination)
      const startAt = Math.max(context.currentTime + 0.02, playUntil)
      source.start(startAt)
      playUntil = startAt + buffer.duration
      sources.add(source)
      source.onended = () => { sources.delete(source); update() }
      update()
    },
    interrupt() {
      for (const source of sources) { source.onended = null; try { source.stop() } catch { /* already stopped */ } }
      sources.clear()
      playUntil = 0
      update()
    },
    isSpeaking: () => speaking,
    close() {
      this.interrupt()
      void context.close()
    },
  }
}
