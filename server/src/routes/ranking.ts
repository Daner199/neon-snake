import { Router } from 'express'
import { getRanking, isMode } from '../services/ranking.js'
import { verifyToken } from '../services/tokens.js'

export const rankingRouter = Router()

// Público. Si llega un token válido, también devuelve la fila del jugador aunque esté fuera del top 10.
rankingRouter.get('/:mode', async (req, res) => {
  const { mode } = req.params
  if (!isMode(mode)) {
    res.status(404).json({ error: 'Modo de juego desconocido' })
    return
  }
  const header = req.headers.authorization ?? ''
  const user = header.startsWith('Bearer ') ? verifyToken(header.slice(7)) : null
  res.json(await getRanking(mode, user?.id ?? null))
})
