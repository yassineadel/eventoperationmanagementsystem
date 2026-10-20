/// <reference types="node" />
// Creates test gate staff accounts. Run with: npm run seed:staff
import bcrypt from 'bcrypt'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Turn "1234" into a hash; 10 = how much work bcrypt does (higher = slower to crack)
  const passwordHash = await bcrypt.hash('1234', 10)

  // upsert = create it if missing, update it if it already exists,
  // so running the script twice doesn't fail
  const admin = await prisma.staffAccount.upsert({
    where: { username: 'gateadmin' },
    create: { username: 'gateadmin', fullName: 'Gate Admin', passwordHash, role: 'APP_ADMIN' },
    update: {},
  })

  const staff = await prisma.staffAccount.upsert({
    where: { username: 'staff' },
    create: { username: 'staff', fullName: 'Gate Staff', passwordHash, role: 'SCANNER', createdById: admin.id },
    update: {},
  })

  console.log('Created:', admin.username, '(APP_ADMIN) and', staff.username, '(SCANNER)')
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())