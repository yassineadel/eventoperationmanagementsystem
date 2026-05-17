import { Request, Response } from 'express'
import { registerUser, loginUser, verifyEmail,forgotPassword, resetPassword ,logoutUser } from './auth.service'

/**
 * Handles user registration
 * POST /api/auth/register
 */
export const register = async (req: Request, res: Response) => {
  try {
    // Get data from request body
    const { first_name, last_name, email, password, phone } = req.body

    // Validate required fields
    if (!first_name || !last_name || !email || !password) {
      res.status(400).json({ message: 'Please fill all required fields' })
      return
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
    res.status(400).json({ message: 'Please provide a valid email address' })
    return
    }

    // Validate email domain
    const allowedDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com']
    const emailDomain = email.split('@')[1]

if (!allowedDomains.includes(emailDomain)) {
  res.status(400).json({ message: 'Please use a valid email provider (Gmail, Yahoo, Hotmail, Outlook, or iCloud)' })
  return
}

    // Call the register service
    const user = await registerUser(first_name, last_name, email, password, phone)

    // Return success response
    res.status(201).json({
      message: 'Registration successful! Please check your email for the verification code',
    })

  } catch (error: any) {
    res.status(400).json({ message: error.message })
  }
}

/**
 * Handles email verification
 * POST /api/auth/verify-email
 */
export const verify = async (req: Request, res: Response) => {
  try {
    // Get email and code from request body
    const { email, code } = req.body

    // Validate required fields
    if (!email || !code) {
      res.status(400).json({ message: 'Please provide email and verification code' })
      return
    }

    // Call the verify service
    const result = await verifyEmail(email, code)

    res.status(200).json(result)

  } catch (error: any) {
    res.status(400).json({ message: error.message })
  }
}

/**
 * Handles user login
 * POST /api/auth/login
 */
export const login = async (req: Request, res: Response) => {
  try {
    // Get data from request body
    const { email, password } = req.body

    // Validate required fields
    if (!email || !password) {
      res.status(400).json({ message: 'Please provide email and password' })
      return
    }

    // Call the login service
    const { token, user } = await loginUser(email, password)

    // Return token and user data
    res.status(200).json({
      message: 'Login successful',
      token,
      user
    })

  } catch (error: any) {
    res.status(400).json({ message: error.message })
  }
}

/**
 * Handles forgot password request
 * POST /api/auth/forgot-password
 */
export const forgotPasswordHandler = async (req: Request, res: Response) => {
  try {
    const { email } = req.body

    // Validate required fields
    if (!email) {
      res.status(400).json({ message: 'Please provide your email' })
      return
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      res.status(400).json({ message: 'Please provide a valid email address' })
      return
    }

    const result = await forgotPassword(email)
    res.status(200).json(result)

  } catch (error: any) {
    res.status(400).json({ message: error.message })
  }
}

/**
 * Handles password reset
 * POST /api/auth/reset-password
 */
export const resetPasswordHandler = async (req: Request, res: Response) => {
  try {
    const { email, code, newPassword } = req.body

    // Validate required fields
    if (!email || !code || !newPassword) {
      res.status(400).json({ message: 'Please provide email, code and new password' })
      return
    }

    const result = await resetPassword(email, code, newPassword)
    res.status(200).json(result)

  } catch (error: any) {
    res.status(400).json({ message: error.message })
  }
}

/**
 * Handles user logout
 * POST /api/auth/logout
 */
export const logout = async (req: Request, res: Response) => {
  try {
    // Get token from request headers
    const token = req.headers.authorization?.split(' ')[1]

    if (!token) {
      res.status(400).json({ message: 'No token provided' })
      return
    }

    const result = await logoutUser(token)
    res.status(200).json(result)

  } catch (error: any) {
    res.status(400).json({ message: error.message })
  }
}