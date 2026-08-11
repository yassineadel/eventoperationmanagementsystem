import { z } from 'zod'

const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email('Please provide a valid email address'))

const password = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[a-z]/, 'Password must contain a lowercase letter')
  .regex(/[A-Z]/, 'Password must contain an uppercase letter')
  .regex(/[0-9]/, 'Password must contain a number')

export const registerSchema = z.object({
  first_name: z.string().trim().min(2, 'First name must be at least 2 characters').max(50),
  last_name: z.string().trim().min(2, 'Last name must be at least 2 characters').max(50),
  email,
  password,
  phone: z
    .string()
    .trim()
    .regex(/^01[0125][0-9]{8}$/, 'Please provide a valid Egyptian phone number')
    .optional(),
})

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Password is required'),
})

export const verifyEmailSchema = z.object({
  email,
  code: z.string().trim().length(6, 'Verification code must be 6 digits'),
})

export const forgotPasswordSchema = z.object({ email })

export const resetPasswordSchema = z.object({
  email,
  code: z.string().trim().length(6, 'Verification code must be 6 digits'),
  newPassword: password,
})