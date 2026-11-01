import 'dotenv/config'
import cors from 'cors'
import express, { type NextFunction, type Request, type Response } from 'express'
import { rateLimit } from 'express-rate-limit'
import helmet from 'helmet'
import { prisma } from './db.js'
import { authRouter } from './routes/auth.js'
import { rankingRouter } from './routes/ranking.js'
import { sessionsRouter } from './routes/sessions.js'

// Dominios que pueden llamar a la API desde otro origen, separados por comas.
// Sin valor no se permite ninguno (el juego llama a /api por el mismo dominio gracias a nginx).
const corsOrigins = (process.env.CORS_ORIGIN ?? '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean)

// Como mucho 20 intentos de login o registro cada 15 minutos por IP
const authLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  message: { error: 'Demasiados intentos, espera unos minutos' },
  standardHeaders: 'draft-8',
  legacyHeaders: false,
})

const app = express()
// Proxies delante de la API (nginx = 1; en Railway, su borde + nginx = 2).
// Con el número correcto el rate limit ve la IP real del jugador.
app.set('trust proxy', Number(process.env.TRUST_PROXY ?? 1))
app.use(helmet())
app.use(cors({ origin: corsOrigins.length > 0 ? corsOrigins : false }))
app.use(express.json({ limit: '10kb' }))

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

app.use('/api/auth', authLimit, authRouter)
app.use('/api/sessions', sessionsRouter)
app.use('/api/ranking', rankingRouter)

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' })
})

// Cualquier error no previsto: respuesta genérica en español, el detalle solo en el log
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const status = typeof err === 'object' && err && 'status' in err ? Number(err.status) : 500
  if (status >= 500) console.error(err)
  const message =
    status >= 500
      ? 'Error del servidor, inténtalo de nuevo'
      : status === 413
        ? 'La petición es demasiado grande'
        : 'Petición no válida'
  res.status(status).json({ error: message })
})

const port = Number(process.env.PORT ?? 3000)
app.listen(port, () => {
  console.log(`API de Neon Snake en http://localhost:${port}`)
})
