import { Worker } from 'bullmq'
import { createEmailRedis } from './email.redis'
import { env } from '../../config/env'
import { transporter } from '../../config/mailer'
import type { EmailJob } from './email.queue'

export const startEmailWorker = () => {
  // A worker needs its own Redis connection (it waits on Redis while the queue is empty)
  const connection = createEmailRedis(env.REDIS_URL)

  const worker = new Worker<EmailJob>(
    'email',
    // This runs once per email job. If it throws, BullMQ retries it later.
    async (job) => {
      const { to, subject, html } = job.data
      await transporter.sendMail({ from: `"Hafletna" <${env.MAIL_USER}>`, to, subject, html })
    },
    // drainDelay: when the queue is empty, check Redis every 30s instead of every 5s.
    // This saves your Upstash free-plan request limit.
    { connection, drainDelay: 30 },
  )

  worker.on('completed', (job) => {
    console.log(`Email sent to ${job.data.to} (try ${job.attemptsMade})`)
  })

  worker.on('failed', (job, err) => {
    if (!job) return
    const tries = job.opts.attempts ?? 1
    if (job.attemptsMade < tries) {
      console.warn(`Email to ${job.data.to} failed (try ${job.attemptsMade}/${tries}), retrying: ${err.message}`)
    } else {
      console.error(`Email to ${job.data.to} failed ${tries} times, moved to the failed list: ${err.message}`)
    }
  })
}
