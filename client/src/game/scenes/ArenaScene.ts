import Phaser from 'phaser'
import { CELL, COLS, ROWS } from '../constants'
import { EventBus } from '../EventBus'

type Cell = { x: number; y: number }

// Escena base: dibuja la cuadrícula y una serpiente que se mueve con flechas o WASD.
// Día 2: comida, colisiones y crecimiento. Día 3: bots con IA.
export class ArenaScene extends Phaser.Scene {
  private snake: Cell[] = []
  private dir: Cell = { x: 1, y: 0 }
  private nextDir: Cell = { x: 1, y: 0 }
  private gfx!: Phaser.GameObjects.Graphics
  private elapsed = 0
  private stepMs = 110
  private paused = false

  constructor() {
    super('ArenaScene')
  }

  create() {
    this.gfx = this.add.graphics()
    this.snake = [
      { x: 10, y: 20 },
      { x: 11, y: 20 },
      { x: 12, y: 20 },
    ]

    const keys = this.input.keyboard!
    const turn = (x: number, y: number) => {
      // no se puede girar 180 grados
      if (x !== -this.dir.x || y !== -this.dir.y) this.nextDir = { x, y }
    }
    keys.on('keydown-UP', () => turn(0, -1))
    keys.on('keydown-W', () => turn(0, -1))
    keys.on('keydown-DOWN', () => turn(0, 1))
    keys.on('keydown-S', () => turn(0, 1))
    keys.on('keydown-LEFT', () => turn(-1, 0))
    keys.on('keydown-A', () => turn(-1, 0))
    keys.on('keydown-RIGHT', () => turn(1, 0))
    keys.on('keydown-D', () => turn(1, 0))

    const onPause = () => (this.paused = true)
    const onResume = () => (this.paused = false)
    EventBus.on('pause', onPause)
    EventBus.on('resume', onResume)
    this.events.once('shutdown', () => {
      EventBus.off('pause', onPause)
      EventBus.off('resume', onResume)
    })

    this.draw()
  }

  update(_time: number, delta: number) {
    if (this.paused) return
    this.elapsed += delta
    if (this.elapsed < this.stepMs) return
    this.elapsed = 0

    this.dir = this.nextDir
    const head = this.snake[this.snake.length - 1]
    const next = {
      x: (head.x + this.dir.x + COLS) % COLS,
      y: (head.y + this.dir.y + ROWS) % ROWS,
    }
    this.snake.push(next)
    this.snake.shift()
    this.draw()
  }

  private draw() {
    const g = this.gfx
    g.clear()

    g.lineStyle(1, 0x39ff14, 0.06)
    for (let x = 0; x <= COLS; x++) g.lineBetween(x * CELL, 0, x * CELL, ROWS * CELL)
    for (let y = 0; y <= ROWS; y++) g.lineBetween(0, y * CELL, COLS * CELL, y * CELL)

    this.snake.forEach((c, i) => {
      const alpha = 0.45 + (0.55 * i) / (this.snake.length - 1)
      g.fillStyle(0x39ff14, alpha)
      g.fillRoundedRect(c.x * CELL + 1, c.y * CELL + 1, CELL - 2, CELL - 2, 5)
    })
  }
}
