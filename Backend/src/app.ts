import express from 'express'
import authRoutes from './modules/auth/auth.routes'
import eventRoutes from './modules/events/events.routes'
import ticketCategoryRoutes from './modules/tickets-categories/ticket-categories.routes'
import passport from 'passport'
import './config/google'

const app = express()

app.use(express.json())
app.use(passport.initialize())

app.get('/', (req, res) => {
  res.send('Hafletna API is running!')
})

// Auth routes
app.use('/api/auth', authRoutes)

// Event routes
app.use('/api/events', eventRoutes)

// Ticket category routes
app.use('/api/ticket-categories', ticketCategoryRoutes)

export default app