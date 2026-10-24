import { Request, Response } from 'express'
import { setAuthCookie, clearAuthCookie } from '../../utils/cookie'
import {
  registerUser,
  loginUser,
  verifyEmail,
  forgotPassword,
  resetPassword,
  logoutUser,
  getCurrentUser,
  updateProfile,
  changePassword,
  requestEmailChange,
  verifyEmailChange,
  updatePreferences,
  requestAccountDeletion,
  cancelAccountDeletion,
} from './auth.service'

export const register = async (req: Request, res: Response) => {
  try {
    const { fullName, email, password, phone } = req.body
    const result = await registerUser(fullName, email, password, phone)
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
      // Accounts are only created after email verification (or via Google), so always true
  res.status(200).json({ user: { ...user, emailVerified: true } })
  } catch (error: any) {
    res.status(404).json({ message: error.message })
  }
}

export const updateMe = async (req: Request, res: Response) => {
  try {
    const user = await updateProfile(req.user!.id, req.body)
    res.status(200).json({ user })
  } catch (error: any) {
    res.status(400).json({ message: error.message })
  }
}

export const changePasswordHandler = async (req: Request, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body
    const result = await changePassword(req.user!.id, currentPassword, newPassword)
    res.status(200).json(result)
  } catch (error: any) {
    res.status(400).json({ message: error.message })
  }
}

export const requestEmailChangeHandler = async (req: Request, res: Response) => {
  try {
    const result = await requestEmailChange(req.user!.id, req.body.newEmail)
    res.status(200).json(result)
  } catch (error: any) {
    res.status(400).json({ message: error.message })
  }
}

export const verifyEmailChangeHandler = async (req: Request, res: Response) => {
  try {
    const result = await verifyEmailChange(req.user!.id, req.body.code)
    res.status(200).json(result)
  } catch (error: any) {
    res.status(400).json({ message: error.message })
  }
}

export const updatePreferencesHandler = async (req: Request, res: Response) => {
  try {
    const result = await updatePreferences(req.user!.id, req.body.marketingOptIn)
    res.status(200).json(result)
  } catch (error: any) {
    res.status(400).json({ message: error.message })
  }
}

export const requestDeletionHandler = async (req: Request, res: Response) => {
  try {
    const result = await requestAccountDeletion(req.user!.id, req.body.confirmEmail)
    res.status(200).json(result)
  } catch (error: any) {
    res.status(400).json({ message: error.message })
  }
}

export const cancelDeletionHandler = async (req: Request, res: Response) => {
  try {
    const result = await cancelAccountDeletion(req.user!.id)
    res.status(200).json(result)
  } catch (error: any) {
    res.status(400).json({ message: error.message })
  }
}