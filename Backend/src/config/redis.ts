import Redis from 'ioredis'
import { env } from './env'

const redis = new Redis(env.REDIS_URL)

redis.on('connect', () => {
  console.log('Redis connected!')
})

redis.on('error', (err) => {
  console.error('Redis error:', err)
})

export default redis