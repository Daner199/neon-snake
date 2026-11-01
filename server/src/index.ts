import 'dotenv/config'
import cors from 'cors'
import express, { type NextFunction, type Request, type Response } from 'express'
import { prisma } from './db.js'
import { authRouter } from './routes/auth.js'

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

app.use('/api/auth', authRouter)

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' })
})

// Cualquier error no previsto: respuesta genérica en español, el detalle solo en el log
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const status = typeof err === 'object' && err && 'status' in err ? Number(err.status) : 500
  if (status >= 500) console.error(err)
  res.status(status).json({ error: status >= 500 ? 'Error del servidor, inténtalo de nuevo' : 'Petición no válida' })
})

const port = Number(process.env.PORT ?? 3000)
app.listen(port, () => {
  console.log(`API de Neon Snake en http://localhost:${port}`)
})
