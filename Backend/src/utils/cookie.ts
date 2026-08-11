import { Response } from 'express'
import { env } from '../config/env'

const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000

/** Sets the auth token as an httpOnly cookie */
export const setAuthCookie = (res: Response, token: string) => {
  res.cookie('token', token, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: SEVEN_DAYS,
    path: '/',
  })
}

/** Clears the auth cookie on logout */
export const clearAuthCookie = (res: Response) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
    path: '/',
  })
}