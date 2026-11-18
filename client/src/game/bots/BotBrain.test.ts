import { describe, expect, it } from 'vitest'
import serverProtocol from '../../../../server/src/online/shared/protocol.ts?raw'
import serverBrain from '../../../../server/src/online/shared/BotBrain.ts?raw'
import clientProtocol from '../../online/protocol.ts?raw'
import clientBrain from './BotBrain.ts?raw'
import { newMemory, think, type BotFood, type BotView, type Cell } from './BotBrain'

const COLS = 20
const ROWS = 12

// Mundo pequeño de prueba: celdas ocupadas por serpientes y comida
function world(snakes: BotView[], foods: BotFood[] = []) {
  const grid = new Int32Array(COLS * ROWS)
  for (const s of snakes) for (const c of s.cells) grid[c.y * COLS + c.x] = s.id
  return { cols: COLS, rows: ROWS, grid, foods, snakes, passThroughSelf: true }
}

const line = (from: Cell, dir: Cell, n: number): Cell[] =>
  Array.from({ length: n }, (_, i) => ({ x: from.x + dir.x * i, y: from.y + dir.y * i }))

const right = { x: 1, y: 0 }
const calm = { aggression: 0, skill: 1 }

describe('BotBrain', () => {
  it('nunca elige chocar contra el borde si hay otra salida', () => {
    // Va a la derecha pegado al borde derecho
    const bot: BotView = { id: 1, cells: line({ x: COLS - 4, y: 5 }, right, 4), dir: right, alive: true }
    for (let i = 0; i < 50; i++) {
      const d = think(bot, calm, newMemory(), world([bot]))
      expect(d).not.toEqual(right)
    }
  })

  it('va hacia la comida por el camino más corto', () => {
    const bot: BotView = { id: 1, cells: line({ x: 2, y: 5 }, right, 4), dir: right, alive: true }
    const d = think(bot, calm, newMemory(), world([bot], [{ x: 5, y: 1, golden: false }]))
    expect(d).toEqual({ x: 0, y: -1 }) // la comida está arriba: gira hacia ella
  })

  it('no se mete en un callejón aunque haya comida dentro', () => {
    // Otra serpiente larga forma un bolsillo de 4 celdas (x 6..9, y 5) abierto hacia el bot.
    // Su cola está lejos (fila 11), así que las paredes del bolsillo tardan mucho en irse.
    const tail = line({ x: 0, y: 11 }, right, 20)
    const pocket = [...line({ x: 6, y: 4 }, right, 5), { x: 10, y: 5 }, ...line({ x: 10, y: 6 }, { x: -1, y: 0 }, 5)]
    const wall: BotView = { id: 2, cells: [...tail, ...pocket], dir: { x: -1, y: 0 }, alive: true }
    // El bot (6 de largo) va a la derecha justo hacia la entrada, con una comida dorada dentro
    const bot: BotView = { id: 1, cells: line({ x: 0, y: 5 }, right, 6), dir: right, alive: true }
    const w = world([bot, wall], [{ x: 8, y: 5, golden: true }])
    for (let i = 0; i < 30; i++) {
      const d = think(bot, calm, newMemory(), w)
      expect(d).not.toEqual(right) // dentro no cabe: gira arriba o abajo
    }
  })
})

// El servidor usa la misma IA en las salas en línea: las dos copias tienen que ser iguales
describe('copias compartidas con el servidor', () => {
  it('BotBrain.ts es igual en client y server', () => {
    expect(serverBrain).toBe(clientBrain)
  })

  it('protocol.ts es igual en client y server', () => {
    expect(serverProtocol).toBe(clientProtocol)
  })
})
