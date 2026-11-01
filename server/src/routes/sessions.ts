import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import { prisma } from '../db.js'
import { currentUser, requireAuth } from '../middleware/requireAuth.js'
import { getRanking, isMode } from '../services/ranking.js'

export const sessionsRouter = Router()

// Reglas anti-trampas: nada que el juego no pueda producir de verdad
const MAX_POINTS_PER_SECOND = 60
const POINTS_MARGIN = 200 // una eliminación (+100) puede llegar en los primeros segundos
const KILL_POINTS = 100
const START_LENGTH = 4
const MAX_GROWTH_PER_FOOD = 3 // la comida dorada hace crecer 3
const MIN_DURATION_MS = 1000
const MAX_DURATION_MS = 3 * 60 * 60 * 1000

const isCount = (value: unknown, max = 1_000_000): value is number =>
  Number.isInteger(value) && (value as number) >= 0 && (value as number) <= max

// Como mucho 10 partidas por minuto y usuario
const saveLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  keyGenerator: (_req, res) => currentUser(res).id,
  message: { error: 'Demasiadas partidas seguidas, espera un momento' },
  standardHeaders: 'draft-8',
  legacyHeaders: false,
})

sessionsRouter.post('/', requireAuth, saveLimit, async (req, res) => {
  const user = currentUser(res)
  const { mode, score, length, botsKilled, foodsEaten, durationMs } = req.body ?? {}

  if (
    !isMode(mode) ||
    !isCount(score) ||
    !isCount(length, 5000) ||
    !isCount(botsKilled, 10_000) ||
    !isCount(foodsEaten, 100_000) ||
    !isCount(durationMs, MAX_DURATION_MS) ||
    durationMs < MIN_DURATION_MS
  ) {
    res.status(400).json({ error: 'Datos de la partida incompletos o no válidos' })
    return
  }

  const seconds = durationMs / 1000
  const impossible =
    score > seconds * MAX_POINTS_PER_SECOND + POINTS_MARGIN ||
    (mode === 'classic' && botsKilled > 0) ||
    botsKilled * KILL_POINTS > score ||
    length > START_LENGTH + foodsEaten * MAX_GROWTH_PER_FOOD

  const gameMode = await prisma.gameMode.findUnique({ where: { code: mode } })
  if (!gameMode) {
    res.status(400).json({ error: 'Modo de juego desconocido' })
    return
  }

  const finishedAt = new Date()
  await prisma.gameSession.create({
    data: {
      userId: user.id,
      modeId: gameMode.id,
      status: impossible ? 'rejected' : 'finished',
      score,
      length,
      botsKilled,
      foodsEaten,
      durationMs,
      startedAt: new Date(finishedAt.getTime() - durationMs),
      finishedAt,
    },
  })

  if (impossible) {
    res.status(422).json({ error: 'La partida no parece válida y no entra al ranking' })
    return
  }

  const { me } = await getRanking(mode, user.id)
  res.status(201).json({ saved: true, position: me?.position ?? null, best: me?.score ?? score })
})
