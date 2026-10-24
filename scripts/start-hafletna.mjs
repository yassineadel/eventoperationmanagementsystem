import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { ensurePrismaClient } from './prisma-client.mjs'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const backend = join(root, 'Backend')
const frontend = join(root, 'Frontend')
const localRunner = join(frontend, 'node_modules/.hafletna-local/start.mjs')
const dotenvFile = join(backend, 'node_modules/dotenv/lib/main.js')
const backendEnv = join(backend, '.env')
const settings = existsSync(dotenvFile) && existsSync(backendEnv)
  ? createRequire(import.meta.url)(dotenvFile).parse(readFileSync(backendEnv)) : {}
const backendPort = process.env.PORT || settings.PORT || '3000'
async function responds(url, json = false) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(1200) })
    const body = json ? await response.json() : await response.text()
    return response.ok && (!json || body.status === 'ok')
  } catch { return false }
}
const [backendRunning, frontendRunning] = await Promise.all([
  responds(`http://localhost:${backendPort}/health`, true),
  responds('http://localhost:5173/'),
])

// Reuse an existing machine-local setup, including its database, when available.
// Those tools, credentials and database files are intentionally not versioned.
if (backendRunning && frontendRunning) {
  console.log('Hafletna is already running: http://localhost:5173')
} else if (backendRunning || frontendRunning) {
  console.error(`A Hafletna ${backendRunning ? `backend is still running on port ${backendPort}` : 'frontend is still running on port 5173'}. Stop that server before starting the full launcher. No client generation or database changes were started.`)
  process.exitCode = 1
} else if (existsSync(localRunner)) {
  await import(pathToFileURL(localRunner).href)
} else {
  const backendRunner = join(backend, 'node_modules/ts-node/dist/bin.js')
  const frontendRunner = join(frontend, 'node_modules/vite/bin/vite.js')
  const prerequisites = [join(backend, '.env'), backendRunner, frontendRunner]
  if (prerequisites.some((file) => !existsSync(file))) {
    console.error('Complete LOCAL-DEVELOPMENT.md first: configure Backend/.env and install both projects with npm ci.')
    process.exitCode = 1
  } else {
    const children = new Set()
    let stopping = false
    const stop = () => {
      if (stopping) return
      stopping = true
      for (const child of children) child.kill()
    }
    process.once('SIGINT', stop)
    process.once('SIGTERM', stop)

    const start = (script, args, cwd) => new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [script, ...args], {
        cwd, stdio: 'inherit', windowsHide: true,
      })
      children.add(child)
      child.once('error', reject)
      child.once('exit', (code) => {
        children.delete(child)
        if (stopping || code === 0) resolve()
        else reject(new Error(`A Hafletna server stopped with exit code ${code}.`))
      })
    })

    console.log('Starting Hafletna. PostgreSQL and Redis must already be running; see LOCAL-DEVELOPMENT.md.')
    console.log('Frontend: http://localhost:5173 | Backend: configured by Backend/.env (default port 3000).')
    try {
      await ensurePrismaClient(backend)
      await Promise.all([
        start(backendRunner, ['src/server.ts'], backend),
        start(frontendRunner, ['--host', 'localhost', '--port', '5173', '--strictPort'], frontend),
      ])
    } catch (error) {
      console.error(error.message)
      process.exitCode = 1
    } finally {
      stop()
    }
  }
}
