import prisma from '../../config/db'

const DELETION_GRACE_DAYS = 14
const DAY_MS = 24 * 60 * 60 * 1000

// Anonymised accounts get an email ending with this
export const DELETED_EMAIL_DOMAIN = '@deleted.hafletna'
/**
 * Anonymises every account whose deletion request is older than 14 days
 */
export const anonymiseDueAccounts = async () => {
  const cutoff = new Date(Date.now() - DELETION_GRACE_DAYS * DAY_MS)

  // Requests made before the cutoff have finished their 14 days
  const due = await prisma.user.findMany({
    where: { deletionRequestedAt: { lte: cutoff } },
    select: { id: true },
  })

  for (const { id } of due) {
    // Loophole: they bought a ticket during the 14 days, so keep the account and cancel the request
    const upcoming = await prisma.ticket.count({
      where: { holderId: id, status: 'VALID', event: { startAt: { gt: new Date() } } },
    })
    if (upcoming > 0) {
      await prisma.user.update({ where: { id }, data: { deletionRequestedAt: null } })
      console.log(`Deletion of ${id} cancelled: holds tickets for upcoming events`)
      continue
    }

    // Both happen together, or neither does
    await prisma.$transaction([
      prisma.user.update({
        where: { id },
        data: {
          fullName: 'Deleted user',
          email: `deleted-${id}${DELETED_EMAIL_DOMAIN}`, // still unique; frees their real email
          phone: null,
          passwordHash: null, // can't log in with a password anymore
          googleId: null,     // or with Google
          marketingOptIn: false,
          deletionRequestedAt: null,
        },
      }),
      // The user asked for it themselves, so they are the actor
      prisma.auditLog.create({
        data: { actorUserId: id, action: 'ACCOUNT_ANONYMISED', entityType: 'User', entityId: id },
      }),
    ])
    console.log(`Account ${id} anonymised`)
  }
}

/**
 * Runs once when the server starts, then every hour
 */
export const startAccountDeletionWorker = (intervalMs = 60 * 60 * 1000) => {
  let running = false
  const run = () => {
    if (running) return // a slow run must finish before the next one starts
    running = true
    anonymiseDueAccounts()
      .catch((e) => console.error('Account deletion failed:', e))
      .finally(() => { running = false })
  }
  run()
  const timer = setInterval(run, intervalMs)
  timer.unref()
  return timer
}