import type { NextFunction, Request, Response } from 'express'
import { verifyToken, type TokenUser } from '../services/tokens.js'

// Exige un token válido en "Authorization: Bearer <token>" y deja el usuario en res.locals.user
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  const user = token ? verifyToken(token) : null
  if (!user) {
    res.status(401).json({ error: 'Inicia sesión para continuar' })
    return
  }
  res.locals.user = user
  next()
}

export const currentUser = (res: Response): TokenUser => res.locals.user as TokenUser
