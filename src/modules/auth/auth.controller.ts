import { Request, Response } from 'express'
import { setAuthCookie, clearAuthCookie } from '../../utils/cookie'
import {
  registerUser,
  loginUser,
  verifyEmail,
  forgotPassword,
  resetPassword,
  logoutUser,
  getCurrentUser
} from './auth.service'

export const register = async (req: Request, res: Response) => {
  try {
    const { first_name, last_name, email, password, phone } = req.body
    const result = await registerUser(first_name, last_name, email, password, phone)
    res.status(201).json(result)
  } catch (error: any) {
    res.status(400).json({ message: error.message })
  }
}

export const verify = async (req: Request, res: Response) => {
  try {
    const { email, code } = req.body
    const result = await verifyEmail(email, code)
    res.status(200).json(result)
  } catch (error: any) {
    res.status(400).json({ message: error.message })
  }
}

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body
    const { token, user } = await loginUser(email, password)

    setAuthCookie(res, token)

    res.status(200).json({ message: 'Login successful', user })
  } catch (error: any) {
    res.status(401).json({ message: error.message })
  }
}
export const forgotPasswordHandler = async (req: Request, res: Response) => {
  try {
    const { email } = req.body
    const result = await forgotPassword(email)
    res.status(200).json(result)
  } catch (error: any) {
    res.status(400).json({ message: error.message })
  }
}

export const resetPasswordHandler = async (req: Request, res: Response) => {
  try {
    const { email, code, newPassword } = req.body
    const result = await resetPassword(email, code, newPassword)
    res.status(200).json(result)
  } catch (error: any) {
    res.status(400).json({ message: error.message })
  }
}

export const logout = async (req: Request, res: Response) => {
  try {
    const token = req.cookies?.token || req.headers.authorization?.split(' ')[1]

    if (token) await logoutUser(token)

    clearAuthCookie(res)

    res.status(200).json({ message: 'Logged out successfully' })
  } catch (error: any) {
    res.status(400).json({ message: error.message })
  }
}

export const me = async (req: Request, res: Response) => {
  try {
    const user = await getCurrentUser(req.user!.id)
    res.status(200).json({ user })
  } catch (error: any) {
    res.status(404).json({ message: error.message })
  }
}