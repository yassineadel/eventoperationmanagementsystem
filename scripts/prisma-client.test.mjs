import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { hasCurrentPrismaClient } from './prisma-client.mjs'

const fixtures = mkdtempSync(join(tmpdir(), 'hafletna-prisma-check-'))
after(() => {
  const target = resolve(fixtures)
  if (dirname(target) !== resolve(tmpdir()) || !basename(target).startsWith('hafletna-prisma-check-')) {
    throw new Error('Refusing to remove a directory outside the test fixture location.')
  }
  rmSync(target, { recursive: true, force: true })
})
function fixture(name, { schema = 'model Event {\n  id String @id\n}', generatedSchema = schema, version = '5.22.0', generatedVersion = version, engine = true } = {}) {
  const backend = join(fixtures, name)
  const client = join(backend, 'node_modules/.prisma/client')
  mkdirSync(client, { recursive: true })
  mkdirSync(join(backend, 'node_modules/@prisma/client'), { recursive: true })
  mkdirSync(join(backend, 'prisma'), { recursive: true })
  writeFileSync(join(backend, 'prisma/schema.prisma'), schema)
  writeFileSync(join(client, 'schema.prisma'), generatedSchema)
  writeFileSync(join(backend, 'node_modules/@prisma/client/package.json'), JSON.stringify({ version }))
  writeFileSync(join(client, 'package.json'), JSON.stringify({ version: generatedVersion }))
  writeFileSync(join(client, 'index.js'), '')
  writeFileSync(join(client, 'index.d.ts'), '')
  if (engine) writeFileSync(join(client, 'query_engine-windows.dll.node'), '')
  return backend
}

test('an unchanged schema and client version reuse the Windows engine', () => {
  assert.equal(hasCurrentPrismaClient(fixture('current'), 'win32'), true)
})
test('Windows and Unix line endings do not cause unnecessary generation', () => {
  assert.equal(hasCurrentPrismaClient(fixture('line-endings', { schema: 'model Event {\r\n  id String @id\r\n}\r\n', generatedSchema: 'model Event {\n  id String @id\n}' }), 'win32'), true)
})
test('a schema or installed client version change requires generation', () => {
  assert.equal(hasCurrentPrismaClient(fixture('schema', { generatedSchema: 'model OldEvent {}' }), 'win32'), false)
  assert.equal(hasCurrentPrismaClient(fixture('version', { generatedVersion: '5.21.0' }), 'win32'), false)
})
test('missing or invalid generated files require generation', () => {
  assert.equal(hasCurrentPrismaClient(join(fixtures, 'missing'), 'win32'), false)
  assert.equal(hasCurrentPrismaClient(fixture('no-engine', { engine: false }), 'win32'), false)
  const corrupt = fixture('corrupt')
  writeFileSync(join(corrupt, 'node_modules/.prisma/client/package.json'), '{invalid')
  assert.equal(hasCurrentPrismaClient(corrupt, 'win32'), false)
})
