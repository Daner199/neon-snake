// Conexión con el servidor para las salas en línea (Socket.IO).
// La usan la pantalla "En línea" (crear o buscar sala), GameView (unirse, reaparecer, salir)
// y GameScene (recibe el estado de cada paso y envía los giros).
import { io, type Socket } from 'socket.io-client'
import { reactive } from 'vue'
import {
  NET,
  SOCKET_PATH,
  type ClientToServer,
  type CodeReply,
  type CreateRequest,
  type DiedStats,
  type DirIndex,
  type JoinReply,
  type NetColors,
  type SalaPublica,
  type ServerToClient,
} from './protocol'

export type GameClient = Socket<ServerToClient, ClientToServer>

const ACK_TIMEOUT_MS = 10_000
const PING_EVERY_MS = 2000

// Estado que se ve en Vue (HUD: código de sala y ping; Game Over: si se guardó)
export const online = reactive({
  code: '',
  you: 0, // id de mi serpiente en el servidor (cambia al reaparecer)
  tickMs: NET.TICK_MS as number,
  publica: false,
  conIA: true,
  joined: false,
  connected: false,
  reconnecting: false,
  ping: 0,
  guardada: null as DiedStats['guardada'] | null,
  position: null as number | null,
})

let socket: GameClient | null = null
let pingTimer: ReturnType<typeof setInterval> | undefined
// Para volver a entrar solo si se corta la conexión a mitad de partida
let lastJoin: { colors: NetColors; token: string } | null = null

export function getSocket(): GameClient {
  if (socket) return socket
  const s: GameClient = io({ path: SOCKET_PATH, transports: ['websocket', 'polling'] })
  s.on('connect', () => {
    online.connected = true
    // Se cortó y volvió: se entra otra vez a la misma sala (con una serpiente nueva)
    if (online.reconnecting && lastJoin && online.code) {
      online.reconnecting = false
      unirse(online.code, lastJoin.colors, lastJoin.token).catch(() => (online.joined = false))
    }
  })
  s.on('disconnect', () => {
    online.connected = false
    if (online.joined) online.reconnecting = true
  })
  s.on('evento', (e) => {
    if (e.type === 'died') {
      online.guardada = e.stats.guardada
      online.position = null
    } else if (e.type === 'saved') {
      online.guardada = e.guardada
      online.position = e.position
    }
  })
  socket = s
  return s
}

async function ask<T>(fn: (s: GameClient) => Promise<T>): Promise<T> {
  try {
    return await fn(getSocket().timeout(ACK_TIMEOUT_MS) as unknown as GameClient)
  } catch {
    throw new Error('El servidor no responde. Si estaba dormido, puede tardar hasta un minuto en despertar.')
  }
}

function unwrap<T extends { ok: boolean }>(r: T): Extract<T, { ok: true }> {
  if (!r.ok) throw new Error((r as unknown as { error: string }).error)
  return r as Extract<T, { ok: true }>
}

export async function crearSala(req: CreateRequest): Promise<string> {
  const r = await ask((s) => s.emitWithAck('sala:crear', req) as Promise<CodeReply>)
  return unwrap(r).code
}

export async function partidaRapida(): Promise<string> {
  const r = await ask((s) => s.emitWithAck('sala:rapida') as Promise<CodeReply>)
  return unwrap(r).code
}

// En línea siempre se juega con cuenta: el token identifica al jugador y su partida va al ranking
export async function unirse(code: string, colors: NetColors, token: string): Promise<void> {
  const r = unwrap(await ask((s) => s.emitWithAck('sala:unirse', { code, colors, token }) as Promise<JoinReply>))
  lastJoin = { colors, token }
  Object.assign(online, {
    code: r.code,
    you: r.you,
    tickMs: r.tickMs,
    publica: r.publica,
    conIA: r.conIA,
    joined: true,
    guardada: null,
    position: null,
  })
  startPing()
}

export async function reaparecer(): Promise<void> {
  const r = unwrap(await ask((s) => s.emitWithAck('reaparecer')))
  online.you = r.you
  online.guardada = null
  online.position = null
}

export function salir() {
  clearInterval(pingTimer)
  lastJoin = null
  online.joined = false
  online.reconnecting = false
  online.code = ''
  online.you = 0
  if (socket) {
    socket.emit('sala:salir')
    socket.disconnect()
    socket = null
  }
}

export const girar = (d: DirIndex) => socket?.emit('girar', d)
export const enviarSkin = (c: NetColors) => socket?.emit('skin', c)

// Ping: cuánto tarda el servidor en contestar (se ve en el HUD)
function startPing() {
  clearInterval(pingTimer)
  const measure = () => {
    if (!socket?.connected) return
    const t0 = performance.now()
    socket
      .timeout(5000)
      .emitWithAck('ping')
      .then(() => (online.ping = Math.round(performance.now() - t0)))
      .catch(() => undefined)
  }
  measure()
  pingTimer = setInterval(measure, PING_EVERY_MS)
}

export async function salasPublicas(): Promise<SalaPublica[]> {
  const res = await fetch('/api/online/salas')
  if (!res.ok) throw new Error('No se pudo cargar la lista de salas')
  return (await res.json()) as SalaPublica[]
}
