import nodemailer from 'nodemailer'

// Create a transporter using Gmail
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS
  }
})

/**
 * Sends a verification code to the user's email
 * @param to - user's email address
 * @param code - 6 digit verification code
 */
export const sendVerificationEmail = async (to: string, code: string) => {
  await transporter.sendMail({
    from: `"Hafletna" <${process.env.MAIL_USER}>`,
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