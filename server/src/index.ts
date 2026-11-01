import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import { prisma } from './db.js'

const app = express()
app.use(cors())
app.use(express.json())

// Comprueba que el servidor y la base de datos responden
app.get('/api/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`
    res.json({ ok: true, db: 'conectada' })
  } catch {
    res.status(500).json({ ok: false, db: 'sin conexión' })
  }
})

// Lista los modos de juego guardados en PostgreSQL
app.get('/api/modes', async (_req, res) => {
  const modes = await prisma.gameMode.findMany({ orderBy: { id: 'asc' } })
  res.json(modes)
})

// Día 5: /api/auth/register, /api/auth/login, /api/games/start,
// /api/games/:id/finish y /api/leaderboard

const port = Number(process.env.PORT ?? 3000)
app.listen(port, () => {
  console.log(`API de Neon Snake en http://localhost:${port}`)
})
