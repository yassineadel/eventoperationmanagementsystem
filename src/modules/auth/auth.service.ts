import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import prisma from '../../config/db'

const JWT_SECRET = process.env.JWT_SECRET as string
const JWT_EXPIRES_IN = '7d'

export const registerUser = async (
  first_name: string,
  last_name: string,
  email: string,
  password: string,
  phone?: string
) => {
  const existingUser = await prisma.users.findUnique({ where: { email } })
  if (existingUser) throw new Error('Email already in use')

  const password_hash = await bcrypt.hash(password, 10) //this is how many times the password crambles

  const user = await prisma.users.create({
    data: {
      first_name,
      last_name,
      email,
      password_hash,
      phone,
      role: 'customer'
    }
  })

  return user
}

export const loginUser = async (email: string, password: string) => {
  const user = await prisma.users.findUnique({ where: { email } })
  if (!user) throw new Error('Wrong Email!')

  const isMatch = await bcrypt.compare(password, user.password_hash)
  if (!isMatch) throw new Error('Password Incorrect!')

 const token = jwt.sign(
  { id: user.id, role: user.role },
  JWT_SECRET,
  { expiresIn: '7d' }
)

  return { token, user }
}