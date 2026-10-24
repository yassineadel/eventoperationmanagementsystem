import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import prisma from '../../config/db'
import redis from '../../config/redis'
import { sendVerificationEmail, sendPasswordResetEmail, sendEmailChangeCode } from '../../config/mailer'
import { env } from '../../config/env'

const JWT_SECRET = env.JWT_SECRET

export const BLOCKED_MESSAGE =
  'Your account has been blocked. Please contact support@hafletna.com if you think this is a mistake.'

/**
 * Generates a random 6 digit verification code
 */
const generateVerificationCode = (): string => {
  return crypto.randomInt(100000, 1000000).toString()
}

/**
 * Sends verification code to email without saving user yet
 */
export const registerUser = async (
  fullName: string,
  email: string,
  password: string,
  phone?: string
) => {
  // Check if email is already registered
  const existingUser = await prisma.user.findUnique({ where: { email } })
  if (existingUser) throw new Error('Email already in use')

  // Hash the password
  const passwordHash = await bcrypt.hash(password, 10)

  // Store user data temporarily in Redis for 10 minutes
  await redis.set(
    `pending:${email}`,
    JSON.stringify({ fullName, email, passwordHash, phone }),
    'EX',
    600
  )

  // Generate a 6 digit verification code
  const code = generateVerificationCode()

  // Store the code in Redis for 10 minutes
  await redis.set(`verify:${email}`, code, 'EX', 600)

  // Send the code to the user's email
  await sendVerificationEmail(email, code)

  return { message: 'Verification code sent to your email' }
}

/**
 * Verifies the code and saves the user to the database
 */
export const verifyEmail = async (email: string, code: string) => {
  // Count failed attempts — max 5 per registration
  const attemptKey = `verify_attempts:${email}`
  const attempts = await redis.incr(attemptKey)
  if (attempts === 1) await redis.expire(attemptKey, 600)
  if (attempts > 5) {
    throw new Error('Too many incorrect attempts. Please register again.')
  }

  // Get the code from Redis
  const storedCode = await redis.get(`verify:${email}`)

  // Check if code exists
  if (!storedCode) throw new Error('Verification code expired or not found')

  // Check if code matches
  if (storedCode !== code) throw new Error('Invalid verification code')

  // Get the pending user data from Redis
  const pendingUser = await redis.get(`pending:${email}`)
  if (!pendingUser) throw new Error('Registration data expired please register again')

  // Parse the user data
  const userData = JSON.parse(pendingUser)

  // Now save the user to the database — the row existing is what "verified" means (FR-AUT-03)
  await prisma.user.create({
    data: {
      fullName: userData.fullName,
      email: userData.email,
      passwordHash: userData.passwordHash,
      phone: userData.phone,
    }
  })

  // Delete all keys from Redis
  await redis.del(`verify:${email}`)
  await redis.del(`pending:${email}`)
  await redis.del(attemptKey)

  return { message: 'Email verified successfully! You can now login.' }
}

/**
 * Logs in a user and returns a JWT token
 */
export const loginUser = async (email: string, password: string) => {
  // Ask for exactly the columns we need — nothing more
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      fullName: true,
      email: true,
      role: true,
      isBlocked: true,
      passwordHash: true,   // needed to compare, stripped before returning
    },
  })

  // Google-only accounts have no password
  if (!user || !user.passwordHash) throw new Error('Invalid credentials')

  const isMatch = await bcrypt.compare(password, user.passwordHash)
  if (!isMatch) throw new Error('Invalid credentials')

  // Only reveal the block AFTER the password is confirmed correct (FR-AUT-13)
  if (user.isBlocked) {
    throw new Error(BLOCKED_MESSAGE)
  }

  // Separate the hash from everything else
  const { passwordHash, isBlocked, ...safeUser } = user

  const token = jwt.sign(
    { id: user.id, role: user.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  )

  return { token, user: safeUser }
}

/**
 * Sends a password reset code to the user's email
 */
export const forgotPassword = async (email: string) => {
  // Check if user exists
  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) throw new Error('No account found with this email')

  // Generate a 6 digit code
  const code = generateVerificationCode()

  // Store the code in Redis for 10 minutes
  await redis.set(`reset:${email}`, code, 'EX', 600)

  // Send the code to the user's email
  await sendPasswordResetEmail(email, code)

  return { message: 'Password reset code sent to your email' }
}

/**
 * Resets the user's password after verifying the code
 */
export const resetPassword = async (email: string, code: string, newPassword: string) => {
  // Count failed attempts — max 5 per reset code
  const attemptKey = `reset_attempts:${email}`
  const attempts = await redis.incr(attemptKey)
  if (attempts === 1) await redis.expire(attemptKey, 600)
  if (attempts > 5) {
    throw new Error('Too many incorrect attempts. Please request a new code.')
  }

  // Get the code from Redis
  const storedCode = await redis.get(`reset:${email}`)

  // Check if code exists
  if (!storedCode) throw new Error('Reset code expired or not found')

  // Check if code matches
  if (storedCode !== code) throw new Error('Invalid reset code')

  // Hash the new password
  const passwordHash = await bcrypt.hash(newPassword, 10)

  // Update the password in database
  await prisma.user.update({
    where: { email },
    data: { passwordHash }
  })

  // Delete the code and attempt counter from Redis
  await redis.del(`reset:${email}`)
  await redis.del(attemptKey)

  return { message: 'Password reset successfully! You can now login.' }
}

/**
 * Logs out a user by blacklisting their token
 */
export const logoutUser = async (token: string) => {
  // Blacklist the token in Redis for 7 days
  await redis.set(`blacklist:${token}`, 'blacklisted', 'EX', 60 * 60 * 24 * 7)

  return { message: 'Logged out successfully' }
}

/**
 * Returns the logged-in user's profile
 */
export const getCurrentUser = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      fullName: true,
      email: true,
      phone: true,
      role: true,
      marketingOptIn: true,
      deletionRequestedAt: true,
    },
  })

  if (!user) throw new Error('User not found')
  return user
}

/**
 * Updates the logged-in user's name and phone
 */
export const updateProfile = async (userId: string, data: { fullName: string; phone?: string }) => {
  return prisma.user.update({
    where: { id: userId },
    data: {
      fullName: data.fullName,
      // phone not sent → leave it; '' → remove it
      phone: data.phone === undefined ? undefined : data.phone || null,
    },
    select: { id: true, fullName: true, email: true, phone: true, role: true },
  })
}

/**
 * Changes the password of a logged-in user after checking the current one
 */
export const changePassword = async (userId: string, currentPassword: string, newPassword: string) => {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) throw new Error('User not found')

  // Google-only accounts have no password to check
  if (!user.passwordHash) {
    throw new Error('This account signs in with Google and has no password. Use "Forgot password" to create one.')
  }

  // Check the current password
  const isMatch = await bcrypt.compare(currentPassword, user.passwordHash)
  if (!isMatch) throw new Error('Current password is incorrect')

  if (currentPassword === newPassword) throw new Error('New password must be different from the current one')

  // Save the new password, hashed (never store the plain text)
  const passwordHash = await bcrypt.hash(newPassword, 10)
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } })

  return { message: 'Password changed successfully' }
}

/**
 * Step 1 of changing email: send a code to the new address
 */
export const requestEmailChange = async (userId: string, newEmail: string) => {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) throw new Error('User not found')
  if (user.email === newEmail) throw new Error('This is already your email')

  const taken = await prisma.user.findUnique({ where: { email: newEmail } })
  if (taken) throw new Error('Email already in use')

  // Save the new email and its code together for 10 minutes
  const code = generateVerificationCode()
  await redis.set(`email-change:${userId}`, JSON.stringify({ newEmail, code }), 'EX', 600)

  await sendEmailChangeCode(newEmail, code)
  return { message: 'Verification code sent to your new email' }
}

/**
 * Step 2 of changing email: check the code and save the new address
 */
export const verifyEmailChange = async (userId: string, code: string) => {
  const saved = await redis.get(`email-change:${userId}`)
  if (!saved) throw new Error('Code expired or not requested. Please request a new one.')

  const { newEmail, code: savedCode } = JSON.parse(saved) as { newEmail: string; code: string }
  if (code !== savedCode) throw new Error('Invalid verification code')

  // Check again: someone may have signed up with this email in the last 10 minutes
  const taken = await prisma.user.findUnique({ where: { email: newEmail } })
  if (taken) throw new Error('Email already in use')

  const user = await prisma.user.update({
    where: { id: userId },
    data: { email: newEmail },
    select: { id: true, fullName: true, email: true, phone: true, role: true },
  })

  // The code is used up
  await redis.del(`email-change:${userId}`)
  return { user: { ...user, emailVerified: true } }
}

/**
 * Turns marketing emails on or off for the logged-in user
 */
export const updatePreferences = async (userId: string, marketingOptIn: boolean) => {
  return prisma.user.update({
    where: { id: userId },
    data: { marketingOptIn },
    select: { marketingOptIn: true },
  })
}

const DELETION_GRACE_DAYS = 14

// When the account will actually be removed
const deletionDate = (requestedAt: Date) =>
  new Date(requestedAt.getTime() + DELETION_GRACE_DAYS * 24 * 60 * 60 * 1000)

/**
 * Asks to delete the account. Nothing is removed for 14 days, and the user can cancel.
 */
export const requestAccountDeletion = async (userId: string, confirmEmail: string) => {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) throw new Error('User not found')
  if (user.email !== confirmEmail) throw new Error('The email you typed does not match your account')
  if (user.deletionRequestedAt) throw new Error('Deletion has already been requested')
    // no deletion while the user holds tickets for upcoming events
  const lastTicket = await prisma.ticket.findFirst({
    where: {
      holderId: userId,                      // tickets this user holds now (after transfers too)
      status: 'VALID',                       // not used, refunded or cancelled
      event: { startAt: { gt: new Date() } }, // event hasn't started yet
    },
    orderBy: { event: { startAt: 'desc' } }, // the latest one first
    select: { event: { select: { startAt: true } } },
  })

  if (lastTicket) {
    const date = lastTicket.event.startAt.toLocaleDateString('en-GB', {
      timeZone: 'Africa/Cairo', day: 'numeric', month: 'short', year: 'numeric',
    })
    throw new Error(`You have tickets for upcoming events. You can delete your account after your last event on ${date}.`)
  }

  const { deletionRequestedAt } = await prisma.user.update({
    where: { id: userId },
    data: { deletionRequestedAt: new Date() },
    select: { deletionRequestedAt: true },
  })
  return { deletionRequestedAt, deletesAt: deletionDate(deletionRequestedAt!) }
}

/**
 * Cancels a deletion request during the grace period
 */
export const cancelAccountDeletion = async (userId: string) => {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) throw new Error('User not found')
  if (!user.deletionRequestedAt) throw new Error('There is no deletion request to cancel')

  await prisma.user.update({ where: { id: userId }, data: { deletionRequestedAt: null } })
  return { message: 'Deletion request cancelled' }
}