import jwt from 'jsonwebtoken'

export interface TokenUser {
  id: string
  username: string
}

const TOKEN_LIFETIME = '7d'

function secret(): string {
  const value = process.env.JWT_SECRET
  if (!value) throw new Error('Falta la variable JWT_SECRET')
  return value
}

export function signToken(user: TokenUser): string {
  return jwt.sign({ username: user.username }, secret(), { subject: user.id, expiresIn: TOKEN_LIFETIME })
}

// Devuelve el usuario del token o null si es inválido o caducó
export function verifyToken(token: string): TokenUser | null {
  try {
    const payload = jwt.verify(token, secret())
    if (typeof payload === 'string' || !payload.sub || typeof payload.username !== 'string') return null
    return { id: payload.sub, username: payload.username }
  } catch {
    return null
  }
}
