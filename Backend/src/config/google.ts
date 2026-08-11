import passport from 'passport'
import { Strategy as GoogleStrategy } from 'passport-google-oauth20'
import prisma from './db'
import { env } from './env'

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
        const first_name = profile.name?.givenName as string
        const last_name = profile.name?.familyName as string

        // Check if user already exists
        let user = await prisma.users.findUnique({ where: { email } })

        if (!user) {
          // Create new user if doesn't exist
          user = await prisma.users.create({
            data: {
              first_name,
              last_name,
              email,
              password_hash: '',
              role: 'customer',
              is_verified: true
            }
          })
        }

        return done(null, user)
      } catch (error) {
        return done(error, undefined)
      }
    }
  )
)

export default passport