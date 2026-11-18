// IA de los jugadores controlados por la computadora.
//
// ESTE ARCHIVO ESTÁ COPIADO TAL CUAL en server/src/online/shared/BotBrain.ts (el servidor lo usa
// en las salas en línea). Si lo cambias, copia el archivo al otro lado: una prueba de Vitest
// (client/src/game/bots/BotBrain.test.ts) avisa si las dos copias no son iguales.
// Por eso no importa nada: todo lo que necesita llega en "world".
//
// Cómo piensa un bot en cada paso:
//   1. Descarta las direcciones que chocan seguro (borde, otra serpiente).
//   2. Para cada dirección cuenta el espacio libre que le quedaría (flood fill). Si es menor que su
//      cuerpo, esa dirección es una trampa: solo la toma si no hay nada mejor.
//   3. Evita las celdas donde una serpiente igual o más grande podría meter la cabeza (choque frontal).
//   4. Busca el mejor objetivo con un BFS desde su cabeza: la comida más cercana por el camino real
//      (no en línea recta), la dorada vale más, y a veces cortarle el paso a una serpiente cercana.
//      El BFS prueba primero seguir recto: así el camino tiene pocas curvas y no zigzaguea.
//   5. Recuerda su objetivo unos pasos para no cambiar de idea en cada tick (eso parecía un error).
// Nunca hace giros al azar hacia una pared: los "errores" solo son dudar un paso o no ver una comida.

export type Cell = { x: number; y: number }

export interface BotFood extends Cell {
  golden: boolean
}

// Lo que el bot ve de cada serpiente (la cabeza es el último elemento de "cells")
export interface BotView {
  id: number
  cells: Cell[]
  dir: Cell
  alive: boolean
  ghost?: boolean // recién aparecida (en línea): todavía no choca con nadie y no se la caza
}

export interface BotPersonality {
  aggression: number // 0..1: ganas de cortarle el paso a otra serpiente
  skill: number // 0..1: cuánto mira hacia adelante y qué tan seguido duda
}

// Memoria corta del bot entre un paso y otro
export interface BotMemory {
  target: Cell | null
  huntId: number // id de la serpiente que está cazando (0 = ninguna)
  huntTicks: number // pasos que le quedan cazando antes de volver a la comida
  cooldown: number // pasos antes de poder cazar otra vez
}

export interface BotWorld {
  cols: number
  rows: number
  grid: Int32Array // 0 = libre; si no, el id de la serpiente que ocupa la celda
  foods: BotFood[]
  snakes: BotView[]
  passThroughSelf: boolean // true: cada serpiente puede pasar por encima de su propio cuerpo
}

export const newMemory = (): BotMemory => ({ target: null, huntId: 0, huntTicks: 0, cooldown: 0 })

const DIR_LIST: Cell[] = [
  { x: 0, y: -1 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
  { x: 1, y: 0 },
]

const BFS_MAX_NODES = 1400 // celdas que recorre como mucho buscando objetivo
const HUNT_RANGE = 12 // distancia a la que empieza a cazar
const HUNT_TICKS = 18
const HUNT_COOLDOWN = 25

// Arreglos reutilizados: marcar una celda como vista es escribir el número de la búsqueda actual
let stamp = new Uint32Array(0)
let firstDir = new Int8Array(0)
let distance = new Int16Array(0)
let queue = new Int32Array(0)
let generation = 0

function ensureBuffers(size: number) {
  if (stamp.length !== size) {
    stamp = new Uint32Array(size)
    firstDir = new Int8Array(size)
    distance = new Int16Array(size)
    queue = new Int32Array(size)
    generation = 0
  }
}

function nextGeneration(): number {
  generation++
  if (generation === 0xffffffff) {
    stamp.fill(0)
    generation = 1
  }
  return generation
}

// Paso en el que cada celda queda libre: el segmento i (contando desde la cola) de otra serpiente
// se va después de i + 1 pasos; se suma 1 por si esa serpiente come y crece. 0 = ya está libre.
// Se calcula una vez por paso del juego y lo comparten todos los bots.
const freeAtCache = new WeakMap<Int32Array, Int16Array>()
function freeAtFor(world: BotWorld): Int16Array {
  let freeAt = freeAtCache.get(world.grid)
  if (freeAt) return freeAt
  freeAt = new Int16Array(world.cols * world.rows)
  for (const s of world.snakes) {
    if (!s.alive || s.ghost) continue
    for (let i = 0; i < s.cells.length; i++) {
      const c = s.cells[i]
      if (c.x < 0 || c.y < 0 || c.x >= world.cols || c.y >= world.rows) continue
      freeAt[c.y * world.cols + c.x] = Math.min(i + 2, 32000)
    }
  }
  freeAtCache.set(world.grid, freeAt)
  return freeAt
}

// ¿Podrá entrar el bot en la celda (x, y) dentro de "step" pasos? El cuerpo de los demás se va
// retirando desde la cola, así que una celda ocupada ahora puede estar libre cuando llegue.
function reachableAt(world: BotWorld, freeAt: Int16Array, botId: number, x: number, y: number, step: number): boolean {
  if (x < 0 || y < 0 || x >= world.cols || y >= world.rows) return false
  const i = y * world.cols + x
  const owner = world.grid[i]
  if (owner === 0 || (world.passThroughSelf && owner === botId)) return true
  return step >= freeAt[i]
}

// Primeros pasos del flood fill: una celda a la que otra cabeza puede llegar antes o a la vez no cuenta
// como espacio seguro (así no se mete por un hueco que otra serpiente está por cerrar)
const CONTEST_STEPS = 6
function contested(rivals: Cell[], x: number, y: number, step: number): boolean {
  for (const h of rivals) if (Math.abs(h.x - x) + Math.abs(h.y - y) <= step) return true
  return false
}

const manhattan = (a: Cell, b: Cell) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y)
const same = (a: Cell, b: Cell) => a.x === b.x && a.y === b.y

// ¿Puede el bot entrar en esta celda en el próximo paso?
function freeFor(world: BotWorld, botId: number, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= world.cols || y >= world.rows) return false
  const owner = world.grid[y * world.cols + x]
  return owner === 0 || (world.passThroughSelf && owner === botId)
}

// Cuántas celdas puede alcanzar a partir de "start" (contando hasta "limit"), teniendo en cuenta
// que los cuerpos de los demás se retiran y evitando las celdas a las que puede llegar otra cabeza
function floodSpace(world: BotWorld, freeAt: Int16Array, botId: number, start: Cell, limit: number, rivals: Cell[]): number {
  const g = nextGeneration()
  const cols = world.cols
  let head = 0
  let tail = 0
  queue[tail++] = start.y * cols + start.x
  stamp[start.y * cols + start.x] = g
  distance[start.y * cols + start.x] = 1
  while (head < tail && tail < limit) {
    const i = queue[head++]
    const x = i % cols
    const y = (i - x) / cols
    const step = distance[i] + 1
    for (const d of DIR_LIST) {
      const nx = x + d.x
      const ny = y + d.y
      if (!reachableAt(world, freeAt, botId, nx, ny, step)) continue
      const ni = ny * cols + nx
      if (stamp[ni] === g || (step <= CONTEST_STEPS && contested(rivals, nx, ny, step))) continue
      stamp[ni] = g
      distance[ni] = step
      queue[tail++] = ni
    }
  }
  return tail
}

// Celda delante de la cabeza de otra serpiente: el lugar ideal para cortarle el paso
function cutoffCell(world: BotWorld, prey: BotView, dist: number): Cell {
  const head = prey.cells[prey.cells.length - 1]
  const ahead = Math.max(2, Math.min(5, Math.floor(dist / 2)))
  return {
    x: Math.max(0, Math.min(world.cols - 1, head.x + prey.dir.x * ahead)),
    y: Math.max(0, Math.min(world.rows - 1, head.y + prey.dir.y * ahead)),
  }
}

// Elige a quién cazar (o a nadie). Solo caza si es lo bastante largo para cerrarle el paso.
function chooseHunt(bot: BotView, mem: BotMemory, p: BotPersonality, world: BotWorld): BotView | null {
  const head = bot.cells[bot.cells.length - 1]
  if (mem.huntTicks > 0) {
    const prey = world.snakes.find((s) => s.id === mem.huntId && s.alive)
    if (prey && manhattan(head, prey.cells[prey.cells.length - 1]) <= HUNT_RANGE + 4) {
      mem.huntTicks--
      return prey
    }
  }
  mem.huntTicks = 0
  mem.huntId = 0
  if (mem.cooldown > 0) {
    mem.cooldown--
    return null
  }
  if (bot.cells.length < 7) return null
  let best: BotView | null = null
  let bestDist = Infinity
  for (const s of world.snakes) {
    if (s.id === bot.id || !s.alive || s.ghost) continue
    const d = manhattan(head, s.cells[s.cells.length - 1])
    if (d < bestDist) {
      bestDist = d
      best = s
    }
  }
  // La probabilidad es por paso: con aggression 0.5 empieza a cazar en pocos pasos si hay alguien cerca
  if (!best || bestDist > HUNT_RANGE || Math.random() > p.aggression * 0.25) return null
  mem.huntId = best.id
  mem.huntTicks = HUNT_TICKS
  mem.cooldown = HUNT_COOLDOWN
  return best
}

// BFS desde la cabeza: devuelve la dirección del primer paso hacia el mejor objetivo y su celda
function findGoal(
  bot: BotView,
  mem: BotMemory,
  world: BotWorld,
  freeAt: Int16Array,
  huntCell: Cell | null,
  maxNodes: number,
): { dir: number; cell: Cell } | null {
  const cols = world.cols
  const head = bot.cells[bot.cells.length - 1]
  const g = nextGeneration()
  const hi = head.y * cols + head.x
  stamp[hi] = g
  distance[hi] = 0
  let qh = 0
  let qt = 0

  // Orden de búsqueda: primero recto, después los giros (así el camino sale con pocas curvas)
  const order = [...DIR_LIST.keys()].sort((a, b) => {
    const sa = same(DIR_LIST[a], bot.dir) ? 0 : 1
    const sb = same(DIR_LIST[b], bot.dir) ? 0 : 1
    return sa - sb
  })
  for (const k of order) {
    const d = DIR_LIST[k]
    if (d.x === -bot.dir.x && d.y === -bot.dir.y) continue
    const nx = head.x + d.x
    const ny = head.y + d.y
    if (!freeFor(world, bot.id, nx, ny)) continue
    const ni = ny * cols + nx
    stamp[ni] = g
    distance[ni] = 1
    firstDir[ni] = k
    queue[qt++] = ni
  }

  // Valor de cada objetivo en celdas de distancia (menos = mejor)
  const goals = new Map<number, number>()
  for (const f of world.foods) goals.set(f.y * cols + f.x, f.golden ? -8 : 0)
  if (mem.target) {
    const ti = mem.target.y * cols + mem.target.x
    if (goals.has(ti)) goals.set(ti, goals.get(ti)! - 3) // seguir con la misma comida evita dudar
  }
  if (huntCell) goals.set(huntCell.y * cols + huntCell.x, -10)

  let bestIdx = -1
  let bestValue = Infinity
  while (qh < qt && qh < maxNodes) {
    const i = queue[qh++]
    const dist = distance[i]
    if (dist - 10 > bestValue) break // ya no puede aparecer nada mejor
    const bonus = goals.get(i)
    if (bonus !== undefined && dist + bonus < bestValue) {
      bestValue = dist + bonus
      bestIdx = i
    }
    const x = i % cols
    const y = (i - x) / cols
    for (const k of order) {
      const d = DIR_LIST[k]
      const nx = x + d.x
      const ny = y + d.y
      if (!reachableAt(world, freeAt, bot.id, nx, ny, dist + 1)) continue
      const ni = ny * cols + nx
      if (stamp[ni] === g) continue
      stamp[ni] = g
      distance[ni] = dist + 1
      firstDir[ni] = firstDir[i]
      queue[qt++] = ni
    }
  }
  if (bestIdx < 0) return null
  const x = bestIdx % cols
  return { dir: firstDir[bestIdx], cell: { x, y: (bestIdx - x) / cols } }
}

// Decide hacia dónde va el bot en este paso
export function think(bot: BotView, p: BotPersonality, mem: BotMemory, world: BotWorld): Cell {
  ensureBuffers(world.cols * world.rows)
  const freeAt = freeAtFor(world)
  const head = bot.cells[bot.cells.length - 1]
  const length = bot.cells.length

  // Celdas peligrosas: donde una serpiente igual o más grande puede meter la cabeza en este paso.
  // Las de una más pequeña son una oportunidad: en un choque de cabezas gana la más larga.
  const danger = new Set<number>()
  const chance = new Set<number>()
  const rivals: Cell[] = [] // cabezas cercanas de las demás serpientes
  for (const s of world.snakes) {
    if (s.id === bot.id || !s.alive || s.ghost) continue
    const sh = s.cells[s.cells.length - 1]
    if (manhattan(head, sh) <= 8) rivals.push(sh)
    if (manhattan(head, sh) > 3) continue
    for (const d of DIR_LIST) {
      if (d.x === -s.dir.x && d.y === -s.dir.y) continue
      const x = sh.x + d.x
      const y = sh.y + d.y
      if (x < 0 || y < 0 || x >= world.cols || y >= world.rows) continue
      ;(s.cells.length >= length ? danger : chance).add(y * world.cols + x)
    }
  }

  // Cuánto mira hacia adelante: más habilidad = detecta antes los callejones
  const limit = Math.round(80 + p.skill * 120)
  const need = Math.min(limit, length + 6)

  const prey = chooseHunt(bot, mem, p, world)
  const huntCell = prey ? cutoffCell(world, prey, manhattan(head, prey.cells[prey.cells.length - 1])) : null
  // Duda: a veces no recalcula el objetivo en este paso y sigue como iba (nunca hacia un choque)
  const hesitate = Math.random() < (1 - p.skill) * 0.12
  const goal = hesitate ? null : findGoal(bot, mem, world, freeAt, huntCell, Math.round(BFS_MAX_NODES * (0.6 + p.skill * 0.4)))
  if (goal) mem.target = goal.cell

  let best = bot.dir
  let bestScore = -Infinity
  for (let k = 0; k < DIR_LIST.length; k++) {
    const d = DIR_LIST[k]
    if (d.x === -bot.dir.x && d.y === -bot.dir.y) continue // no puede dar media vuelta
    const n = { x: head.x + d.x, y: head.y + d.y }
    let score: number
    if (!freeFor(world, bot.id, n.x, n.y)) {
      score = -1e9 // choque seguro
    } else {
      const space = floodSpace(world, freeAt, bot.id, n, limit, rivals)
      const ni = n.y * world.cols + n.x
      if (space < need) score = -1e6 + space * 100 // callejón: solo si no queda otra, y el más grande
      else score = Math.min(space, limit) * 0.5
      if (danger.has(ni)) score -= 2e5
      if (chance.has(ni) && p.aggression > 0.4) score += 40
      if (goal) score += goal.dir === k ? 300 : -manhattan(n, goal.cell) * 2
      else if (mem.target) score -= manhattan(n, mem.target)
      if (same(d, bot.dir)) score += 12 // seguir recto: movimiento más natural
      score += Math.random() * 3
    }
    if (score > bestScore) {
      bestScore = score
      best = d
    }
  }
  return best
}
