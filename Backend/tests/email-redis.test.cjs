const { test } = require('node:test')
const assert = require('node:assert/strict')
const IORedis = require('ioredis').default
const { createEmailRedis } = require('../src/modules/platform/email.redis')

test('email Redis overrides URL retry limits without changing the regular application client', () => {
  const url = 'redis://127.0.0.1:6379?maxRetriesPerRequest=1'
  const regular = new IORedis(url, { lazyConnect: true })
  const email = createEmailRedis(url, { lazyConnect: true })
  try {
    assert.equal(String(regular.options.maxRetriesPerRequest), '1')
    assert.equal(email.options.maxRetriesPerRequest, null)
    assert.equal(email.status, 'wait')
  } finally { regular.disconnect(); email.disconnect() }
})

test('email Redis preserves TLS, credentials, database and unrelated URL options', () => {
  const client = createEmailRedis('rediss://test-user:test%40password@redis.example.test:6380/2?maxRetriesPerRequest=3&connectionName=email-test', { lazyConnect: true })
  try {
    assert.equal(client.options.maxRetriesPerRequest, null)
    assert.ok(client.options.tls)
    assert.equal(client.options.username, 'test-user')
    assert.equal(client.options.password, 'test@password')
    assert.equal(client.options.host, 'redis.example.test')
    assert.equal(client.options.port, 6380)
    assert.equal(client.options.db, 2)
    assert.equal(client.options.connectionName, 'email-test')
  } finally { client.disconnect() }
})

test('email Redis also supports a URL without query options', () => {
  const client = createEmailRedis('redis://127.0.0.1:6379', { lazyConnect: true })
  try { assert.equal(client.options.maxRetriesPerRequest, null) }
  finally { client.disconnect() }
})
