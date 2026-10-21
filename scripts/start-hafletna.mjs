import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { spawn } from 'node:child_process'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const backend = join(root, 'Backend')
const frontend = join(root, 'Frontend')
const localRunner = join(frontend, 'node_modules/.hafletna-local/start.mjs')

// Reuse an existing machine-local setup, including its database, when available.
// Those tools, credentials and database files are intentionally not versioned.
if (existsSync(localRunner)) {
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
