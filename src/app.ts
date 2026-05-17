import express from 'express'
import authRoutes from './modules/auth/auth.routes'
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

export default app