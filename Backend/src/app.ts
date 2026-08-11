import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import passport from 'passport'
import { env } from './config/env'
import { generalLimiter } from './middleware/rateLimit.middleware'
import authRoutes from './modules/auth/auth.routes'
import eventRoutes from './modules/events/events.routes'
import ticketCategoryRoutes from './modules/tickets-categories/ticket-categories.routes'
import './config/google'

const app = express()

// Behind a proxy (Railway, Render, nginx) so rate limiting sees the real client IP
app.set('trust proxy', 1)

// Security headers
app.use(helmet())

// Allow only our own frontend to call this API from a browser
app.use(
  cors({
    origin: env.FRONTEND_URL,
    credentials: true,
  })
)

// Parse JSON, with a size cap so nobody can send a 500MB body
app.use(express.json({ limit: '10kb' }))
app.use(cookieParser())

app.use(generalLimiter)
app.use(passport.initialize())

app.get('/health', (req, res) => {
  res.json({ status: 'ok', environment: env.NODE_ENV })
})

app.use('/api/auth', authRoutes)
app.use('/api/events', eventRoutes)
app.use('/api/ticket-categories', ticketCategoryRoutes)

// Unknown route
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' })
})

export default app