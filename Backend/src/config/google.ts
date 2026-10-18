import passport from 'passport'
import { Strategy as GoogleStrategy } from 'passport-google-oauth20'
import prisma from './db'
import { env } from './env'
import { BLOCKED_MESSAGE } from '../modules/auth/auth.service'

passport.use(
  new GoogleStrategy(
    {
      clientID: env.GOOGLE_CLIENT_ID ,
      clientSecret: env.GOOGLE_CLIENT_SECRET ,
      callbackURL: env.GOOGLE_CALLBACK_URL
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0].value as string
        const fullName = profile.displayName || email

        // Match by Google id first, then by email so an existing password account is linked (FR-AUT-08)
        let user =
          (await prisma.user.findUnique({ where: { googleId: profile.id } })) ??
          (await prisma.user.findUnique({ where: { email } }))

        if (!user) {
          // Google has already verified the address, so no code is needed (FR-AUT-07)
          user = await prisma.user.create({
            data: { fullName, email, googleId: profile.id }
          })
        } else if (!user.googleId) {
          user = await prisma.user.update({
            where: { id: user.id },
            data: { googleId: profile.id }
          })
        }

        if (user.isBlocked) return done(null, false, { message: BLOCKED_MESSAGE })

        return done(null, user)
      } catch (error) {
        return done(error, undefined)
      }
    }
  )
)

export default passport