-- AlterEnum
ALTER TYPE "PaymentStatus" ADD VALUE 'REFUNDED';

-- AlterTable
ALTER TABLE "holds" ADD COLUMN     "attendee_names" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "expires_at" TIMESTAMPTZ(6),
ADD COLUMN     "policy_accepted_at" TIMESTAMPTZ(6);
