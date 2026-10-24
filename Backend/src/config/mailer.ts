import nodemailer from 'nodemailer'
import { env } from './env'
import { queueEmail } from '../modules/platform/email.queue'

// An explicit SMTP host supports local mail testing; existing Gmail setups still work.
export const transporter = nodemailer.createTransport(env.MAIL_HOST ? {
  host: env.MAIL_HOST,
  port: env.MAIL_PORT,
  secure: env.MAIL_SECURE,
  ...(env.MAIL_AUTH ? { auth: { user: env.MAIL_USER, pass: env.MAIL_PASS } } : {}),
} : {
  service: 'gmail',
  auth: { user: env.MAIL_USER, pass: env.MAIL_PASS },
})

/**
 * Sends a verification code to the user's email
 * @param to - user's email address
 * @param code - 6 digit verification code
 */
export const sendVerificationEmail = async (to: string, code: string) => {
  await queueEmail({
    to,
    subject: 'Verify your Hafletna account',
    html: `
      <h2>Welcome to Hafletna!</h2>
      <p>Your verification code is:</p>
      <h1 style="color: #4F46E5; letter-spacing: 8px;">${code}</h1>
      <p>This code expires in 10 minutes.</p>
    `
  })
}

/**
 * Sends a password reset code to the user's email
 * @param to - user's email address
 * @param code - 6 digit reset code
 */
export const sendPasswordResetEmail = async (to: string, code: string) => {
  await queueEmail({
    to,
    subject: 'Reset your Hafletna password',
    html: `
      <h2>Reset your password</h2>
      <p>Your password reset code is:</p>
      <h1 style="color: #4F46E5; letter-spacing: 8px;">${code}</h1>
      <p>This code expires in 10 minutes.</p>
      <p>If you didn't ask to reset your password, you can ignore this email.</p>
    `
  })
}

/**
 * Sends the code that confirms a new email address
 */
export const sendEmailChangeCode = async (to: string, code: string) => {
  await queueEmail({
    to,
    subject: 'Confirm your new Hafletna email',
    html: `
      <h2>Confirm your new email</h2>
      <p>Use this code to finish changing your Hafletna email to this address:</p>
      <h1 style="color: #4F46E5; letter-spacing: 8px;">${code}</h1>
      <p>This code expires in 10 minutes.</p>
      <p>If you didn't ask for this, you can ignore this email.</p>
    `
  })
}

/**
 * Tells the user their account will be deleted, and how to cancel
 */
export const sendDeletionRequestedEmail = async (to: string, deletesAt: Date) => {
  const date = deletesAt.toLocaleDateString('en-GB', {
    timeZone: 'Africa/Cairo', day: 'numeric', month: 'long', year: 'numeric',
  })
  const cancelLink = `${env.FRONTEND_URL}/profile/settings#account-deletion`

  await queueEmail({
    to,
    subject: 'Your Hafletna account will be deleted',
    html: `
      <h2>We received your request to delete your account</h2>
      <p>Your account and personal details will be deleted on <strong>${date}</strong>.</p>
      <p>Changed your mind? Sign in and cancel before that date:</p>
      <p><a href="${cancelLink}">Cancel the deletion</a></p>
      <p>If you didn't ask for this, sign in and cancel it straight away, then change your password.</p>
    `
  })
}