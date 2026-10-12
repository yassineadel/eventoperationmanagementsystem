import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import prisma from '../../config/db'
import redis from '../../config/redis'
import { sendVerificationEmail } from '../../config/mailer'
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
  await sendVerificationEmail(email, code)

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
    },
  })

  if (!user) throw new Error('User not found')
  return user
}