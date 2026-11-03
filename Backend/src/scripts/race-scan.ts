/// <reference types="node" />
// Checks the "two gates at once" case: scans the same QR code several times in parallel
// and expects exactly one ACCEPTED. Use only with a local backend and a development database.
//
// Run with (PowerShell):
//   $env:TOKEN="<staff token>"; $env:EVENT_ID="<event id>"; $env:CODE="<qr token>"; npx ts-node src/scripts/race-scan.ts
// Optional: $env:BASE_URL (default http://localhost:3000), $env:COUNT (default 2)
import crypto from 'crypto'

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000'
const { TOKEN, EVENT_ID, CODE } = process.env
const COUNT = Number(process.env.COUNT ?? 2)

async function scanOnce(gate: number) {
  const res = await fetch(`${BASE_URL}/api/gate/scan`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${TOKEN}`,
      'X-Device-Id': `race-test-gate-${gate}`, // each "gate" is a different device
    },
    // a new clientScanId each time, so these count as different scans, not re-sends
    body: JSON.stringify({ clientScanId: crypto.randomUUID(), eventId: EVENT_ID, code: CODE }),
  })
  return { gate, status: res.status, body: await res.json() }
}

async function main() {
  // Safety: this marks a real ticket as used, so never point it at a deployed server
  const host = new URL(BASE_URL).hostname
  if (host !== 'localhost' && host !== '127.0.0.1') {
    throw new Error(`Refusing to run against ${host}. Only a local backend is allowed.`)
  }
  if (!TOKEN || !EVENT_ID || !CODE) throw new Error('Set TOKEN, EVENT_ID and CODE first')

  // Start all scans at the same moment, then wait for all of them
  const results = await Promise.all(Array.from({ length: COUNT }, (_, i) => scanOnce(i + 1)))
  for (const r of results) console.log(`gate ${r.gate}: HTTP ${r.status}`, r.body)

  const acceptedCount = results.filter((r) => r.body.result === 'ACCEPTED').length
  console.log(acceptedCount === 1 ? 'PASS: exactly one ACCEPTED' : `FAIL: ${acceptedCount} ACCEPTED (expected 1)`)
  if (acceptedCount !== 1) process.exitCode = 1
}

main().catch((e) => {
  console.error(e.message)
  process.exitCode = 1
})
