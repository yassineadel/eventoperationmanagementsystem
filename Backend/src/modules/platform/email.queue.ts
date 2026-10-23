import { Queue } from 'bullmq'
import IORedis from 'ioredis'
import { env } from '../../config/env'

// What one email job carries
export type EmailJob = { to: string; subject: string; html: string }

// BullMQ needs its own Redis connection with maxRetriesPerRequest: null
export const queueConnection = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null })

// The queue: a waiting list of emails stored in Redis
export const emailQueue = new Queue<EmailJob>('email', { connection: queueConnection })

// Call this instead of sending the email directly
export const queueEmail = (email: EmailJob) =>
  emailQueue.add('send', email, {
    attempts: 5, // try up to 5 times (NFR-10)
    backoff: { type: 'exponential', delay: 10_000 }, // wait 10s, 20s, 40s, 80s between tries
    removeOnComplete: 1000, // keep only the last 1000 sent jobs
    removeOnFail: false, // keep failed jobs: this is the dead-letter list
  })