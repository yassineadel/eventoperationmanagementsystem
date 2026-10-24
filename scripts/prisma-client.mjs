import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { spawn } from 'node:child_process'

const normaliseSchema = (text) => text.replace(/\r\n/g, '\n').trim()

export function hasCurrentPrismaClient(backend, platform = process.platform) {
  const generated = join(backend, 'node_modules/.prisma/client')
  try {
    for (const file of ['index.js', 'index.d.ts']) {
      if (!existsSync(join(generated, file))) return false
    }
    if (platform === 'win32' && !existsSync(join(generated, 'query_engine-windows.dll.node'))) return false
    const installed = JSON.parse(readFileSync(join(backend, 'node_modules/@prisma/client/package.json'), 'utf8'))
    const client = JSON.parse(readFileSync(join(generated, 'package.json'), 'utf8'))
    return Boolean(installed.version) && installed.version === client.version
      && normaliseSchema(readFileSync(join(backend, 'prisma/schema.prisma'), 'utf8'))
        === normaliseSchema(readFileSync(join(generated, 'schema.prisma'), 'utf8'))
  } catch {
    return false
  }
}

export async function ensurePrismaClient(backend) {
  if (hasCurrentPrismaClient(backend)) {
    console.log('Prisma Client is up to date; reusing the existing engine.')
    return
  }
  console.log('Generating Prisma Client for the installed version and schema…')
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [join(backend, 'node_modules/prisma/build/index.js'), 'generate'], {
      cwd: backend, stdio: 'inherit', windowsHide: true,
    })
    child.once('error', reject)
    child.once('exit', (code) => code === 0 ? resolve() : reject(new Error(
      'Prisma Client generation failed. Stop other Hafletna backend processes before retrying so Windows can replace the engine file.',
    )))
  })
}
