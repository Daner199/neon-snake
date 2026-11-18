// Mensajes entre el juego (navegador) y el servidor en las salas en línea.
//
// ESTE ARCHIVO ESTÁ COPIADO TAL CUAL en client/src/online/protocol.ts y server/src/online/shared/protocol.ts.
// Si lo cambias, copia el archivo al otro lado: una prueba de Vitest avisa si no son iguales.
//
// El servidor es quien manda: mueve todas las serpientes, revisa los choques y reparte la comida.
// El navegador solo envía hacia dónde quiere girar y dibuja lo que le llega en cada paso.

export const NET = {
  COLS: 64,
  ROWS: 40,
  TICK_MS: 110, // un paso del juego, igual que el modo Arena
  MAX_HUMANOS: 8, // personas por sala
  SERPIENTES: 8, // con "jugadores IA" activado, la sala se completa hasta este número
  COMIDA: 45,
  CODIGO_LARGO: 4,
} as const

// Errores que el navegador reconoce para actuar (por ejemplo, mandar a iniciar sesión)
export const NET_ERRORS = {
  SESION: 'Inicia sesión para jugar en línea',
} as const

// Socket.IO va bajo /api para pasar por el mismo proxy de nginx (y de Vite en desarrollo)
export const SOCKET_PATH = '/api/socket.io'

// Direcciones como número para que los mensajes pesen poco: 0 arriba, 1 abajo, 2 izquierda, 3 derecha
export type DirIndex = 0 | 1 | 2 | 3
export const DIR_CELLS = [
  { x: 0, y: -1 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
  { x: 1, y: 0 },
] as const

export interface NetColors {
  head: number // 0xrrggbb
  body: number
  stripe: number
  glow: number
}

// Datos que no cambian en cada paso: se mandan solo cuando alguien entra o sale
export interface RosterEntry {
  id: number
  name: string
  country: string
  level: number
  colors: NetColors
  bot: boolean
}

// Una serpiente en un paso: [id, dirección, puntaje, eliminados, ...celdas]
// Cada celda es y * COLS + x, de la cola a la cabeza. Si la dirección es 4 o más, la serpiente acaba
// de aparecer y es un "fantasma" (dirección + 4): todavía no choca con nadie.
export type SnakeRow = number[]

export interface StatePayload {
  t: number // número de paso
  s: SnakeRow[] // serpientes vivas
  f: number[] // comida: índice de la celda; la dorada va en negativo: -(índice + 1)
}

export interface JoinRequest {
  code: string
  colors: NetColors
  token: string // obligatorio: en línea siempre se juega con cuenta y la partida entra al ranking
}

export type Reply<T> = ({ ok: true } & T) | { ok: false; error: string }
export type JoinReply = Reply<{ code: string; you: number; tickMs: number; publica: boolean; conIA: boolean }>
export type CodeReply = Reply<{ code: string }>

export interface CreateRequest {
  publica: boolean // aparece en la lista de salas abiertas y en "Partida rápida"
  conIA: boolean // completar la sala con jugadores controlados por la computadora
}

export type CausaMuerteNet = 'pared' | 'cuerpo' | 'jugador'

// Estadísticas al morir. El servidor guarda la partida él mismo (no se puede hacer trampa)
export interface DiedStats {
  score: number
  length: number
  kills: number
  foodsEaten: number
  durationMs: number
  killedBy: string | null
  causa: CausaMuerteNet
  rank: number
  players: number
  guardada: 'invitado' | 'guardando' | 'guardada' | 'error' | 'muy-corta'
  position: number | null // puesto en el ranking "En línea"
}

export type GameEvent =
  | { type: 'eat'; puntos: number; dorada: boolean; total: number }
  | { type: 'kill'; name: string }
  | { type: 'died'; stats: DiedStats }
  | { type: 'saved'; guardada: DiedStats['guardada']; position: number | null }

export interface FeedMsg {
  text: string
  ids: number[] // serpientes de las que habla (si una es la tuya, se resalta)
}

export interface SalaPublica {
  code: string
  humanos: number
  max: number
}

export interface ServerToClient {
  estado: (s: StatePayload) => void
  roster: (r: RosterEntry[]) => void
  evento: (e: GameEvent) => void
  feed: (f: FeedMsg) => void
}

export interface ClientToServer {
  'sala:crear': (req: CreateRequest, ack: (r: CodeReply) => void) => void
  'sala:rapida': (ack: (r: CodeReply) => void) => void
  'sala:unirse': (req: JoinRequest, ack: (r: JoinReply) => void) => void
  'sala:salir': () => void
  girar: (d: DirIndex) => void
  reaparecer: (ack: (r: Reply<{ you: number }>) => void) => void
  skin: (c: NetColors) => void
  sync: () => void
  ping: (ack: () => void) => void
}
