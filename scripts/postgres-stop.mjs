import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'

// The embedded-postgres Windows default force-kills the process tree. Ask the
// server to checkpoint and stop its workers instead, including on exit hooks.
export function useGracefulPostgresStop(pg, databaseDir) {
  const originalStop = pg.stop.bind(pg)
  let pending
  pg.stop = () => {
    if (process.platform !== 'win32') return originalStop()
    if (pending) return pending
    const server = pg.process
    if (!server) return Promise.resolve()
    if (server.exitCode !== null || server.signalCode !== null) {
      pg.process = undefined
      return Promise.resolve()
    }
    pending = new Promise((resolve, reject) => {
      const cli = spawn(join(dirname(server.spawnfile), 'pg_ctl.exe'), [
        'stop', '-D', databaseDir, '-m', 'fast', '-w', '-t', '15',
      ], { windowsHide: true, stdio: 'ignore' })
      const timer = setTimeout(() => {
        cli.kill()
        reject(new Error('PostgreSQL shutdown timed out. Do not start another instance yet.'))
      }, 20000)
      cli.once('error', (error) => { clearTimeout(timer); reject(error) })
      cli.once('exit', (code) => {
        clearTimeout(timer)
        if (code !== 0) reject(new Error('PostgreSQL could not confirm a clean shutdown.'))
        else { pg.process = undefined; resolve() }
      })
    }).finally(() => { pending = undefined })
    return pending
  }
}
