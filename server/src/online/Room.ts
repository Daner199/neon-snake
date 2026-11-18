// Una sala en línea: su arena, las personas conectadas y el reloj que mueve el juego.
import type { Server, Socket } from 'socket.io'
import { prisma } from '../db.js'
import { getRanking } from '../services/ranking.js'
import type { TokenUser } from '../services/tokens.js'
import { Arena, type ArenaSnake } from './Arena.js'
import {
  NET,
  type CausaMuerteNet,
  type ClientToServer,
  type DiedStats,
  type DirIndex,
  type JoinReply,
  type NetColors,
  type ServerToClient,
} from './shared/protocol.js'

export type GameSocket = Socket<ClientToServer, ServerToClient>
export type GameServer = Server<ClientToServer, ServerToClient>

interface Player {
  socket: GameSocket
  snakeId: number
  name: string
  colors: NetColors
  user: TokenUser | null
  startedAt: number // cuándo empezó su vida actual (ms)
}

const MIN_SAVE_MS = 1000

export class Room {
  readonly arena: Arena
  private readonly players = new Map<string, Player>() // por id del socket
  private timer: ReturnType<typeof setInterval> | null = null
  private rosterDirty = false
  emptySince = Date.now()

  constructor(
    readonly code: string,
    readonly publica: boolean,
    conIA: boolean,
    private readonly io: GameServer,
  ) {
    this.arena = new Arena(conIA, {
      onEat: (s, puntos, dorada) => this.playerOf(s)?.socket.emit('evento', { type: 'eat', puntos, dorada, total: s.score }),
      onDeath: (victim, killer, causa) => {
        if (killer) this.playerOf(killer)?.socket.emit('evento', { type: 'kill', name: victim.name })
        const p = this.playerOf(victim)
        if (p) this.playerDied(p, victim, killer, causa)
      },
      onFeed: (text, ids) => this.io.to(this.code).emit('feed', { text, ids }),
      onRoster: () => (this.rosterDirty = true),
    })
  }

  get humanCount() {
    return this.players.size
  }

  get full() {
    return this.players.size >= NET.MAX_HUMANOS
  }

  private playerOf(s: ArenaSnake): Player | undefined {
    if (s.bot) return undefined
    for (const p of this.players.values()) if (p.snakeId === s.id) return p
    return undefined
  }

  // ---------- Personas ----------

  join(socket: GameSocket, name: string, colors: NetColors, user: TokenUser | null): JoinReply {
    if (this.full) return { ok: false, error: 'La sala está llena' }
    const snake = this.arena.addHuman(name, '', colors)
    if (!snake) return { ok: false, error: 'No hay espacio en la arena, prueba en unos segundos' }
    this.players.set(socket.id, { socket, snakeId: snake.id, name, colors, user, startedAt: Date.now() })
    socket.join(this.code)
    this.start()
    return { ok: true, code: this.code, you: snake.id, tickMs: NET.TICK_MS, publica: this.publica, conIA: this.arena.conIA }
  }

  // Después de morir: una serpiente nueva (con otro id) en otro lugar de la arena
  respawn(socket: GameSocket): number | null {
    const p = this.players.get(socket.id)
    if (!p) return null
    const old = this.arena.snakes.get(p.snakeId)
    if (old?.alive) return p.snakeId // sigue viva: no hace falta
    this.arena.remove(p.snakeId)
    const snake = this.arena.addHuman(p.name, '', p.colors)
    if (!snake) return null
    p.snakeId = snake.id
    p.startedAt = Date.now()
    return snake.id
  }

  leave(socket: GameSocket) {
    const p = this.players.get(socket.id)
    if (!p) return
    this.players.delete(socket.id)
    socket.leave(this.code)
    this.arena.remove(p.snakeId)
    this.io.to(this.code).emit('feed', { text: `${p.name} salió de la arena`, ids: [] })
    if (this.players.size === 0) {
      this.stop()
      this.emptySince = Date.now()
    }
  }

  turn(socket: GameSocket, d: DirIndex) {
    const p = this.players.get(socket.id)
    if (p) this.arena.turn(p.snakeId, d)
  }

  setColors(socket: GameSocket, colors: NetColors) {
    const p = this.players.get(socket.id)
    if (!p) return
    p.colors = colors
    this.arena.setColors(p.snakeId, colors)
  }

  sync(socket: GameSocket) {
    socket.emit('roster', this.arena.roster())
    socket.emit('estado', this.arena.state())
  }

  // ---------- Reloj ----------

  private start() {
    if (this.timer) return
    this.timer = setInterval(() => this.tick(), NET.TICK_MS)
  }

  stop() {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }

  private tick() {
    try {
      this.arena.step()
    } catch (err) {
      console.error(`Error en la sala ${this.code}`, err)
      return
    }
    if (this.rosterDirty) {
      this.rosterDirty = false
      this.io.to(this.code).emit('roster', this.arena.roster())
    }
    this.io.to(this.code).emit('estado', this.arena.state())
  }

  // ---------- Fin de una vida ----------

  private playerDied(p: Player, victim: ArenaSnake, killer: ArenaSnake | null, causa: CausaMuerteNet) {
    const durationMs = Date.now() - p.startedAt
    const { rank, players } = this.arena.rankOf(victim)
    const guardada: DiedStats['guardada'] = !p.user ? 'invitado' : durationMs < MIN_SAVE_MS ? 'muy-corta' : 'guardando'
    const stats: DiedStats = {
      score: victim.score,
      length: victim.cells.length,
      kills: victim.kills,
      foodsEaten: victim.foodsEaten,
      durationMs,
      killedBy: killer?.name ?? null,
      causa,
      rank,
      players,
      guardada,
      position: null,
    }
    p.socket.emit('evento', { type: 'died', stats })
    if (guardada === 'guardando' && p.user) this.save(p, p.user, stats)
  }

  // El servidor vio toda la partida: la guarda él mismo, sin las reglas anti-trampas del cliente
  private async save(p: Player, user: TokenUser, stats: DiedStats) {
    try {
      const mode = await prisma.gameMode.findUnique({ where: { code: 'online' } })
      if (!mode) throw new Error('Falta el modo "online" en la base de datos (npm run db:seed)')
      const finishedAt = new Date()
      await prisma.gameSession.create({
        data: {
          userId: user.id,
          modeId: mode.id,
          status: 'finished',
          score: stats.score,
          length: stats.length,
          botsKilled: stats.kills,
          foodsEaten: stats.foodsEaten,
          durationMs: stats.durationMs,
          startedAt: new Date(finishedAt.getTime() - stats.durationMs),
          finishedAt,
        },
      })
      const { me } = await getRanking('online', user.id)
      p.socket.emit('evento', { type: 'saved', guardada: 'guardada', position: me?.position ?? null })
    } catch (err) {
      console.error('No se pudo guardar la partida en línea', err)
      p.socket.emit('evento', { type: 'saved', guardada: 'error', position: null })
    }
  }
}
