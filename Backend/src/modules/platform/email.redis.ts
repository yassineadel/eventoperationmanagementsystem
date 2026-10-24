import IORedis, { type RedisOptions } from 'ioredis'

export function createEmailRedis(redisUrl: string, options: RedisOptions = {}) {
  // ioredis gives URL query options precedence over the second constructor argument.
  // Keep the app client's bounded retries, but BullMQ's blocking worker requires null.
  const url = new URL(redisUrl)
  url.searchParams.delete('maxRetriesPerRequest')
  return new IORedis(url.toString(), { ...options, maxRetriesPerRequest: null })
}
