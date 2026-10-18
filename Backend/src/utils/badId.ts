import { Prisma } from '@prisma/client'

/**
 * True when the database rejected an id because it is not a valid UUID
 * (Prisma P2023, or Postgres 22P02 from our SQL functions). Callers answer 404, not 500.
 */
export const isBadId = (error: unknown) =>
  (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2023') ||
  (error instanceof Error && /22P02|invalid input syntax for type uuid/i.test(error.message))
