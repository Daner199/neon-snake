import { BOT_FLOOD_LIMIT, COLS, ROWS } from '../constants'
import { DIRS, type Cell, type Snake } from '../Snake'

// Mapa de ocupación: 0 = libre, otro número = id de la serpiente que ocupa la celda
export type Grid = Int32Array

export const cellIndex = (c: Cell) => c.y * COLS + c.x
export const inside = (c: Cell) => c.x >= 0 && c.y >= 0 && c.x < COLS && c.y < ROWS

const ALL_DIRS = Object.values(DIRS)

// Cuántas celdas libres hay a partir de "start" (hasta "limit"). Sirve para no meterse en callejones.
function freeSpace(grid: Grid, start: Cell, limit: number): number {
  const seen = new Set<number>([cellIndex(start)])
  const queue: Cell[] = [start]
  let head = 0
  while (head < queue.length && seen.size < limit) {
    const c = queue[head++]
    for (const d of ALL_DIRS) {
      const n = { x: c.x + d.x, y: c.y + d.y }
      const i = cellIndex(n)
      if (inside(n) && grid[i] === 0 && !seen.has(i)) {
        seen.add(i)
        queue.push(n)
      }
    }
  }
  return seen.size
}

const dist = (a: Cell, b: Cell) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y)

// ¿La siguiente celda en la dirección actual está libre? Si no, el bot tiene que pensar ya.
export function nextIsSafe(bot: Snake, grid: Grid): boolean {
  const n = bot.nextHead()
  return inside(n) && grid[cellIndex(n)] === 0
}

// Decide hacia dónde gira un bot en este paso: buscar comida, esquivar o cazar al jugador.
export function think(bot: Snake, grid: Grid, foods: Cell[], player: Snake | null): Cell {
  const p = bot.personality!
  const options = ALL_DIRS.filter((d) => d.x !== -bot.dir.x || d.y !== -bot.dir.y)

  // A veces se equivoca, como un jugador humano
  if (Math.random() < p.mistakes) return options[Math.floor(Math.random() * options.length)]

  // Objetivo: cortarle el paso al jugador si está cerca, o la comida más cercana
  let target: Cell | null = null
  if (player?.alive && dist(bot.head, player.head) < 14 && Math.random() < p.aggression) {
    target = { x: player.head.x + player.dir.x * 4, y: player.head.y + player.dir.y * 4 }
  } else if (foods.length > 0) {
    target = foods.reduce((best, f) => (dist(bot.head, f) < dist(bot.head, best) ? f : best))
  }

  const limit = Math.min(bot.length + 20, BOT_FLOOD_LIMIT)
  let best = bot.dir
  let bestScore = -Infinity
  for (const d of options) {
    const n = { x: bot.head.x + d.x, y: bot.head.y + d.y }
    let score: number
    if (!inside(n) || grid[cellIndex(n)] !== 0) {
      score = -10000 // choque seguro
    } else {
      const space = freeSpace(grid, n, limit)
      score = space < Math.min(bot.length, limit) ? -5000 + space : 0
      if (target) score -= dist(n, target) * 3
      score += Math.random() * 2
    }
    if (score > bestScore) {
      bestScore = score
      best = d
    }
  }
  return best
}
