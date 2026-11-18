// Multijugador en línea con Socket.IO: crear salas, unirse con un código y jugar.
// Socket.IO vive en /api/socket.io para pasar por el mismo proxy de nginx que la API.
import type { Server as HttpServer } from 'node:http'
import { Router } from 'express'
import { Server } from 'socket.io'
import { verifyToken } from '../services/tokens.js'
import { Room, type GameServer, type GameSocket } from './Room.js'
import { NET, NET_ERRORS, SOCKET_PATH, type DirIndex, type NetColors, type SalaPublica } from './shared/protocol.js'

const MAX_ROOMS = 50
const EMPTY_ROOM_TTL_MS = 60_000 // una sala sin nadie se cierra al minuto
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789' // sin O/0 ni I/1 para no confundirse al dictarlo
const MAX_TURNS_PER_SECOND = 25
const MAX_JOINS_PER_MINUTE = 20

const rooms = new Map<string, Room>()

function newCode(): string {
  for (;;) {
    let code = ''
    for (let i = 0; i < NET.CODIGO_LARGO; i++) code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
    if (!rooms.has(code)) return code
  }
}

function createRoom(io: GameServer, publica: boolean, conIA: boolean): Room | null {
  if (rooms.size >= MAX_ROOMS) return null
  const room = new Room(newCode(), publica, conIA, io)
  rooms.set(room.code, room)
  return room
}

// ---------- Validación de lo que manda el navegador (nunca confiar en él) ----------

const isColor = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0 && (v as number) <= 0xffffff

function cleanColors(v: unknown): NetColors | null {
  if (!v || typeof v !== 'object') return null
  const c = v as Record<string, unknown>
  if (!isColor(c.head) || !isColor(c.body) || !isColor(c.stripe) || !isColor(c.glow)) return null
  return { head: c.head, body: c.body, stripe: c.stripe, glow: c.glow }
}

const cleanCode = (v: unknown) => (typeof v === 'string' ? v.trim().toUpperCase().slice(0, 8) : '')

export function publicRooms(): SalaPublica[] {
  return [...rooms.values()]
    .filter((r) => r.publica && !r.full)
    .map((r) => ({ code: r.code, humanos: r.humanCount, max: NET.MAX_HUMANOS }))
    .sort((a, b) => b.humanos - a.humanos)
    .slice(0, 10)
}

// GET /api/online/salas: salas públicas con lugar, para la pantalla "En línea"
export const onlineRouter = Router()
onlineRouter.get('/salas', (_req, res) => {
  res.json(publicRooms())
})

export function attachOnline(httpServer: HttpServer, corsOrigins: string[]) {
  const io: GameServer = new Server(httpServer, {
    path: SOCKET_PATH,
    cors: corsOrigins.length > 0 ? { origin: corsOrigins } : undefined,
    maxHttpBufferSize: 4096, // los mensajes del navegador son muy pequeños
    pingInterval: 10_000,
    pingTimeout: 8_000,
  })

  // Cierra las salas que llevan un rato vacías
  setInterval(() => {
    const now = Date.now()
    for (const [code, room] of rooms) {
      if (room.humanCount === 0 && now - room.emptySince > EMPTY_ROOM_TTL_MS) {
        room.stop()
        rooms.delete(code)
      }
    }
  }, 10_000).unref()

  io.on('connection', (socket: GameSocket) => {
    let room: Room | null = null
    let turnsWindow = Date.now()
    let turns = 0
    let joins: number[] = []

    const tooManyJoins = () => {
      const now = Date.now()
      joins = joins.filter((t) => now - t < 60_000)
      joins.push(now)
      return joins.length > MAX_JOINS_PER_MINUTE
    }

    const leaveRoom = () => {
      room?.leave(socket)
      room = null
    }

    socket.on('sala:crear', (req, ack) => {
      if (typeof ack !== 'function') return
      if (tooManyJoins()) return ack({ ok: false, error: 'Demasiados intentos, espera un momento' })
      const r = createRoom(io, req?.publica === true, req?.conIA !== false)
      if (!r) return ack({ ok: false, error: 'El servidor está lleno, inténtalo más tarde' })
      ack({ ok: true, code: r.code })
    })

    // Partida rápida: la sala pública con más gente que tenga lugar, o una nueva
    socket.on('sala:rapida', (ack) => {
      if (typeof ack !== 'function') return
      if (tooManyJoins()) return ack({ ok: false, error: 'Demasiados intentos, espera un momento' })
      const best = publicRooms()[0]
      const r = best ? rooms.get(best.code)! : createRoom(io, true, true)
      if (!r) return ack({ ok: false, error: 'El servidor está lleno, inténtalo más tarde' })
      ack({ ok: true, code: r.code })
    })

    socket.on('sala:unirse', (req, ack) => {
      if (typeof ack !== 'function') return
      if (tooManyJoins()) return ack({ ok: false, error: 'Demasiados intentos, espera un momento' })
      const target = rooms.get(cleanCode(req?.code))
      if (!target) return ack({ ok: false, error: 'No existe una sala con ese código' })
      const colors = cleanColors(req?.colors)
      if (!colors) return ack({ ok: false, error: 'Datos no válidos' })
      // En línea solo se juega con cuenta: se usa su nombre y la partida entra al ranking
      const user = typeof req?.token === 'string' ? verifyToken(req.token) : null
      if (!user) return ack({ ok: false, error: NET_ERRORS.SESION })
      leaveRoom()
      const reply = target.join(socket, user.username, colors, user)
      if (reply.ok) room = target
      ack(reply)
    })

    socket.on('sala:salir', leaveRoom)

    socket.on('girar', (d) => {
      if (!room || !Number.isInteger(d) || d < 0 || d > 3) return
      const now = Date.now()
      if (now - turnsWindow > 1000) {
        turnsWindow = now
        turns = 0
      }
      if (++turns > MAX_TURNS_PER_SECOND) return
      room.turn(socket, d as DirIndex)
    })

    socket.on('reaparecer', (ack) => {
      if (typeof ack !== 'function') return
      const you = room?.respawn(socket) ?? null
      ack(you === null ? { ok: false, error: 'No se pudo volver a entrar, prueba en un momento' } : { ok: true, you })
    })

    socket.on('skin', (c) => {
      const colors = cleanColors(c)
      if (room && colors) room.setColors(socket, colors)
    })

    socket.on('sync', () => room?.sync(socket))

    // Para medir el ping: el navegador mide cuánto tarda en volver la respuesta
    socket.on('ping', (ack) => {
      if (typeof ack === 'function') ack()
    })

    socket.on('disconnect', leaveRoom)
  })

  return io
}
