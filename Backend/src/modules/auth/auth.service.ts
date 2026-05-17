import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import prisma from '../../config/db'
import redis from '../../config/redis'
import { sendVerificationEmail } from '../../config/mailer'

const JWT_SECRET = process.env.JWT_SECRET as string

/**
 * Generates a random 6 digit verification code
 */
const generateVerificationCode = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

/**
 * Sends verification code to email without saving user yet
 */
export const registerUser = async (
  first_name: string,
  last_name: string,
  email: string,
  password: string,
  phone?: string
) => {
  // Check if email is already registered
  const existingUser = await prisma.users.findUnique({ where: { email } })
  if (existingUser) throw new Error('Email already in use')

  // Hash the password
  const password_hash = await bcrypt.hash(password, 10)

  // Store user data temporarily in Redis for 10 minutes
  await redis.set(
    `pending:${email}`,
    JSON.stringify({ first_name, last_name, email, password_hash, phone }),
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

  // Now save the user to the database
  const user = await prisma.users.create({
    data: {
      first_name: userData.first_name,
      last_name: userData.last_name,
      email: userData.email,
      password_hash: userData.password_hash,
      phone: userData.phone,
      role: 'customer',
      is_verified: true
    }
  })

  // Delete both keys from Redis
  await redis.del(`verify:${email}`)
  await redis.del(`pending:${email}`)

  return { message: 'Email verified successfully! You can now login.' }
}

/**
 * Logs in a user and returns a JWT token
 */
export const loginUser = async (email: string, password: string) => {
  // Find user by email
  const user = await prisma.users.findUnique({ where: { email } })
  if (!user) throw new Error('Invalid credentials')

  // Compare entered password with hashed password
  const isMatch = await bcrypt.compare(password, user.password_hash)
  if (!isMatch) throw new Error('Invalid credentials')

  // Generate JWT token
  const token = jwt.sign(
    { id: user.id, role: user.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  )

  return { token, user }
}

/**
 * Sends a password reset code to the user's email
 */
export const forgotPassword = async (email: string) => {
  // Check if user exists
  const user = await prisma.users.findUnique({ where: { email } })
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
  // Get the code from Redis
  const storedCode = await redis.get(`reset:${email}`)

  // Check if code exists
  if (!storedCode) throw new Error('Reset code expired or not found')

  // Check if code matches
  if (storedCode !== code) throw new Error('Invalid reset code')

  // Hash the new password
  const password_hash = await bcrypt.hash(newPassword, 10)

  // Update the password in database
  await prisma.users.update({
    where: { email },
    data: { password_hash }
  })

  // Delete the code from Redis
  await redis.del(`reset:${email}`)

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