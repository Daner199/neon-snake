import type { PlayerTag } from './names'

export type Cell = { x: number; y: number }

export const DIRS: Record<'up' | 'down' | 'left' | 'right', Cell> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
}

export interface BotPersonality {
  aggression: number // 0..1: cuánto le gusta cazar al jugador
  mistakes: number // probabilidad de hacer un giro torpe en cada paso
}

let nextId = 1

// Una serpiente: el jugador o un bot. La cabeza es el último elemento de "cells".
export class Snake {
  readonly id = nextId++
  cells: Cell[]
  dir: Cell
  nextDir: Cell
  grow = 0
  score: number
  kills = 0
  foodsEaten = 0
  alive = true

  tag: PlayerTag
  color: number
  isPlayer: boolean
  personality: BotPersonality | null

  constructor(
    tag: PlayerTag,
    color: number,
    start: Cell,
    dir: Cell,
    length: number,
    isPlayer = false,
    personality: BotPersonality | null = null,
    startScore = 0,
  ) {
    this.tag = tag
    this.color = color
    this.isPlayer = isPlayer
    this.personality = personality
    this.dir = dir
    this.nextDir = dir
    this.score = startScore
    this.cells = []
    for (let i = length - 1; i >= 0; i--) {
      this.cells.push({ x: start.x - dir.x * i, y: start.y - dir.y * i })
    }
  }

  get head(): Cell {
    return this.cells[this.cells.length - 1]
  }

  get length(): number {
    return this.cells.length
  }

  // Cambia de dirección si no es un giro de 180 grados
  turn(d: Cell) {
    if (d.x !== -this.dir.x || d.y !== -this.dir.y) this.nextDir = d
  }

  nextHead(): Cell {
    return { x: this.head.x + this.nextDir.x, y: this.head.y + this.nextDir.y }
  }
}
