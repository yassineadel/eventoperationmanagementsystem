// Users for the admin console.
//
// The admin console runs on sample data until its endpoints are wired: accounts shaped
// like the User model (role, block state with the reason and who blocked, sign-in method,
// marketing consent). The customers are the people in the sample orders, linked by user
// ID, so their order and ticket counts line up. Blocking, unblocking and role changes
// update the sample data in memory until the page reloads. When the API exists, replace
// the bodies of `usersApi.*` with calls from './api'.

import { AdminApiError } from './adminErrors.ts'
import { now } from './adminTime.ts'
import { ordersApi, ticketsApi, type Localized, type Order } from './ordersApi.ts'

export type UserRole = 'user' | 'admin'

export type AdminUser = {
  id: string
  fullName: string
  email: string
  phone?: string
  role: UserRole
  provider: 'email' | 'google'
  marketingOptIn: boolean
  createdAt: string
  isBlocked: boolean
  blockedReason?: Localized
  blockedBy?: string
  blockedAt?: string
  /** Counted from the sample orders and tickets. */
  orders: number
  tickets: number
}

export type UserDetail = { user: AdminUser; orders: Order[] }

/** Who is acting: the signed-in admin. Nobody can block themselves or change their own role. */
export type Actor = { id: string; email: string; name: string }

export function isSelf(user: Pick<AdminUser, 'id' | 'email'>, actor: Actor) {
  return user.id === actor.id || user.email.toLowerCase() === actor.email.toLowerCase()
}

/* ----------------------------------------------------------- sample data */

type Seed = Omit<AdminUser, 'orders' | 'tickets'>

const user = (id: string, fullName: string, email: string, createdAt: string, extra: Partial<Seed> = {}): Seed => ({
  id,
  fullName,
  email,
  role: 'user',
  provider: 'email',
  marketingOptIn: false,
  createdAt,
  isBlocked: false,
  ...extra,
})

/** The sample admin; used as "you" when the console is previewed without signing in. */
export const SAMPLE_ADMIN: Actor = { id: '9e1d4c7a-0b2f-4a6e-8c3d-1f2e3a4b5c60', email: 'admin@hafletna.com', name: 'Hafletna Admin' }

let USERS: Seed[] = [
  user(SAMPLE_ADMIN.id, SAMPLE_ADMIN.name, SAMPLE_ADMIN.email, '2026-01-05T09:00', { role: 'admin', phone: '+20 100 000 0001' }),
  user('2a7f5e1b-3c8d-4b9e-9f0a-1b2c3d4e5f61', 'Nadine Farouk', 'nadine.farouk@hafletna.com', '2026-03-14T10:30', { role: 'admin', phone: '+20 102 555 8812' }),
  user('3b8a6f2c-4d9e-4c0f-8a1b-2c3d4e5f6a72', 'Mariam Hassan', 'mariam.hassan@example.com', '2026-05-02T18:12', { phone: '+20 100 123 4567', marketingOptIn: true }),
  user('4c9b7a3d-5e0f-4d1a-9b2c-3d4e5f6a7b83', 'Omar Khaled', 'omar.khaled@example.com', '2026-06-20T21:40', { phone: '+20 111 482 9031', provider: 'google' }),
  user('5d0c8b4e-6f1a-4e2b-8c3d-4e5f6a7b8c94', 'Salma Adel', 'salma.adel@example.com', '2026-07-08T12:05', { phone: '+20 122 905 1176', marketingOptIn: true }),
  user('6e1d9c5f-7a2b-4f3c-9d4e-5f6a7b8c9da5', 'Youssef Tarek', 'youssef.tarek@example.com', '2026-07-30T16:55', { phone: '+20 101 377 6402' }),
  user('7f2e0d6a-8b3c-4a4d-8e5f-6a7b8c9d0eb6', 'Habiba Mostafa', 'habiba.mostafa@example.com', '2026-08-11T09:20', { phone: '+20 155 640 2218', provider: 'google', marketingOptIn: true }),
  user('8a3f1e7b-9c4d-4b5e-9f6a-7b8c9d0e1fc7', 'Karim Fathy', 'karim.fathy@example.com', '2026-09-04T22:18', {
    phone: '+20 128 214 7750',
    isBlocked: true,
    blockedAt: '2026-10-10T12:00',
    blockedBy: 'Nadine Farouk',
    blockedReason: {
      en: 'Several orders paid with cards that were later reported stolen. Blocked until the bank finishes its review.',
      ar: 'عدة طلبات دُفعت ببطاقات أُبلغ لاحقًا عن سرقتها. محظور حتى ينتهي البنك من المراجعة.',
    },
  }),
  user('9b4a2f8c-0d5e-4c6f-8a7b-8c9d0e1f2ad8', 'Laila Samir', 'laila.samir@example.com', '2026-09-19T14:47', { phone: '+20 106 831 5524' }),
  user('0c5b3a9d-1e6f-4d7a-9b8c-9d0e1f2a3be9', 'Nour El-Din Ali', 'nour.ali@example.com', '2026-10-02T17:03', { phone: '+20 114 270 6698', provider: 'google' }),
  user('1d6c4b0e-2f7a-4e8b-8c9d-0e1f2a3b4cfa', 'Rana Magdy', 'rana.magdy@example.com', '2026-10-06T11:31', {
    isBlocked: true,
    blockedAt: '2026-10-15T09:45',
    blockedBy: 'Hafletna Admin',
    blockedReason: {
      en: 'Reselling transferred tickets above face value on social media.',
      ar: 'إعادة بيع تذاكر محوّلة بأعلى من سعرها على وسائل التواصل الاجتماعي.',
    },
  }),
  user('2e7d5c1f-3a8b-4f9c-9d0e-1f2a3b4c5d0b', 'Ahmed Sherif', 'ahmed.sherif@example.com', '2026-10-15T20:26', { provider: 'google', marketingOptIn: true }),
]

/* ------------------------------------------------------------------- api */

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export class UserNotFoundError extends Error {
  constructor() {
    super('User not found')
    this.name = 'UserNotFoundError'
  }
}

async function withCounts(seeds: Seed[]): Promise<AdminUser[]> {
  const [orders, tickets] = await Promise.all([ordersApi.list(), ticketsApi.list()])
  return seeds.map((u) => {
    const own = orders.filter((o) => o.customer.userId === u.id)
    return { ...u, orders: own.length, tickets: tickets.filter((t) => own.some((o) => o.id === t.orderId)).length }
  })
}

function update(id: string, changes: Partial<Seed>) {
  if (!USERS.some((u) => u.id === id)) throw new UserNotFoundError()
  USERS = USERS.map((u) => (u.id === id ? { ...u, ...changes } : u))
}

function find(id: string) {
  const seed = USERS.find((u) => u.id === id)
  if (!seed) throw new UserNotFoundError()
  return seed
}

async function detail(id: string): Promise<UserDetail> {
  const seed = find(id)
  const [user] = await withCounts([seed])
  const orders = (await ordersApi.list()).filter((o) => o.customer.userId === seed.id)
  return { user, orders }
}

export const usersApi = {
  async list(): Promise<AdminUser[]> {
    return withCounts(USERS)
  },
  async get(id: string): Promise<UserDetail> {
    return detail(id)
  },
  async block(id: string, reason: string, actor: Actor): Promise<UserDetail> {
    await delay(400)
    if (isSelf(find(id), actor)) throw new AdminApiError('self-block')
    const text = reason.trim()
    update(id, { isBlocked: true, blockedReason: { en: text, ar: text }, blockedBy: actor.name, blockedAt: now() })
    return detail(id)
  },
  async unblock(id: string): Promise<UserDetail> {
    await delay(300)
    update(id, { isBlocked: false, blockedReason: undefined, blockedBy: undefined, blockedAt: undefined })
    return detail(id)
  },
  async setRole(id: string, role: UserRole, actor: Actor): Promise<UserDetail> {
    await delay(300)
    if (isSelf(find(id), actor)) throw new AdminApiError('self-role')
    update(id, { role })
    return detail(id)
  },
}
