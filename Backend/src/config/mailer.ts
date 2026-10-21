import nodemailer from 'nodemailer'
import { env } from './env'

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
  await transporter.sendMail({
    from: `"Hafletna" <${env.MAIL_USER}>`,
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
