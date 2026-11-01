import bcrypt from 'bcrypt'
import { Router } from 'express'
import { prisma } from '../db.js'
import { signToken } from '../services/tokens.js'

export const authRouter = Router()

const USERNAME = /^[A-Za-z0-9_]{3,16}$/
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MIN_PASSWORD = 8
const MAX_PASSWORD = 72 // bcrypt ignora lo que pase de 72 bytes
const SALT_ROUNDS = 10

const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '')

authRouter.post('/register', async (req, res) => {
  const username = text(req.body?.username)
  const email = text(req.body?.email).toLowerCase()
  const password = typeof req.body?.password === 'string' ? req.body.password : ''

  if (!USERNAME.test(username)) {
    res.status(400).json({ error: 'El usuario debe tener de 3 a 16 caracteres: letras, números o _' })
    return
  }
  if (!EMAIL.test(email) || email.length > 254) {
    res.status(400).json({ error: 'Escribe un correo válido' })
    return
  }
  if (password.length < MIN_PASSWORD || password.length > MAX_PASSWORD) {
    res.status(400).json({ error: `La contraseña debe tener de ${MIN_PASSWORD} a ${MAX_PASSWORD} caracteres` })
    return
  }

  const taken = await prisma.user.findFirst({
    where: { OR: [{ username: { equals: username, mode: 'insensitive' } }, { email }] },
    select: { username: true },
  })
  if (taken) {
    const sameName = taken.username.toLowerCase() === username.toLowerCase()
    res.status(409).json({ error: sameName ? 'Ese usuario ya existe' : 'Ese correo ya está registrado' })
    return
  }

  const user = await prisma.user.create({
    data: { username, email, passwordHash: await bcrypt.hash(password, SALT_ROUNDS) },
    select: { id: true, username: true },
  })
  res.status(201).json({ token: signToken(user), user })
})

authRouter.post('/login', async (req, res) => {
  const username = text(req.body?.username)
  const password = typeof req.body?.password === 'string' ? req.body.password : ''

  const user = username
    ? await prisma.user.findFirst({ where: { username: { equals: username, mode: 'insensitive' } } })
    : null
  const ok = user ? await bcrypt.compare(password, user.passwordHash) : false
  if (!user || !ok) {
    res.status(401).json({ error: 'Usuario o contraseña incorrectos' })
    return
  }
  res.json({ token: signToken(user), user: { id: user.id, username: user.username } })
})
