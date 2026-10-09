import { Prisma } from '@prisma/client'

/**
 * First statement of every interactive transaction. If the app dies mid-transaction the
 * database still holds its row locks, and Supabase never times that out on its own, so
 * every later request for the same order queues behind it. These limits apply to this
 * transaction only:
 * - idle_in_transaction_session_timeout: the database ends an abandoned transaction after 30 s
 * - lock_timeout: waiting for a locked row fails after 10 s instead of piling up
 */
export const guardTx = (tx: Prisma.TransactionClient) =>
  tx.$executeRaw`SELECT set_config('lock_timeout', '10s', true), set_config('idle_in_transaction_session_timeout', '30s', true)`
