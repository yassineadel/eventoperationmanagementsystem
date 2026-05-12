import { Request, Response } from 'express'
import { registerUser, loginUser } from './auth.service'

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

    // Call the register service
    const user = await registerUser(first_name, last_name, email, password, phone)

    // Return success response
    res.status(201).json({
      message: 'User registered successfully',
      user
    })

  } catch (error: any) {
    // Handle errors
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
    // Handle errors
    res.status(400).json({ message: error.message })
  }
}