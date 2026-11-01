import Phaser from 'phaser'
import { cellIndex, inside, think, type Grid } from '../bots/BotBrain'
import {
  BOT_COUNT,
  BOT_RESPAWN_MS,
  CELL,
  COLORS,
  COLS,
  FOOD_COUNT,
  MIN_STEP_MS,
  POINTS,
  ROWS,
  START_STEP_MS,
  type GameMode,
} from '../constants'
import { EventBus } from '../EventBus'
import { randomTag } from '../names'
import { DIRS, Snake, type Cell } from '../Snake'

type Food = Cell & { golden: boolean }

export interface LeaderboardRow {
  id: number
  name: string
  country: string
  level: number
  score: number
  color: string
  isPlayer: boolean
}

export interface GameOverStats {
  mode: GameMode
  score: number
  length: number
  botsKilled: number
  foodsEaten: number
  durationMs: number
  killedBy: string | null
  rank: number
  players: number
}

const hex = (n: number) => '#' + n.toString(16).padStart(6, '0')

// Escena principal: sirve para los dos modos.
// Arena: el jugador y varios bots con IA. Clásico: el jugador solo, cada 5 frutas va más rápido.
export class ArenaScene extends Phaser.Scene {
  private mode: GameMode = 'arena'
  private player!: Snake
  private bots: Snake[] = []
  private foods: Food[] = []
  private gfx!: Phaser.GameObjects.Graphics
  private labels = new Map<number, Phaser.GameObjects.Text>()
  private burst!: Phaser.GameObjects.Particles.ParticleEmitter
  private elapsed = 0
  private stepMs = START_STEP_MS
  private paused = false
  private over = false
  private startedAt = 0
  private colorIndex = 0

  constructor() {
    super('ArenaScene')
  }

  create() {
    this.mode = this.registry.get('mode') === 'classic' ? 'classic' : 'arena'
    this.bots = []
    this.foods = []
    this.labels.clear()
    this.elapsed = 0
    this.stepMs = START_STEP_MS
    this.paused = false
    this.over = false
    this.startedAt = this.time.now

    this.gfx = this.add.graphics()
    this.makeParticles()

    this.player = new Snake({ name: 'Tú', country: '', level: 1 }, COLORS.player, { x: 30, y: 20 }, DIRS.right, 4, true)

    if (this.mode === 'arena') {
      for (let i = 0; i < BOT_COUNT; i++) this.spawnBot(false)
    }
    this.fillFood()
    this.setupInput()
    this.setupEvents()
    this.draw()
    this.emitHud()
    this.emitLeaderboard()
    EventBus.emit('scene-ready')
  }

  update(_time: number, delta: number) {
    if (this.paused || this.over) return
    this.elapsed += delta
    if (this.elapsed < this.stepMs) return
    this.elapsed = 0
    this.step()
    this.draw()
  }

  // ---------- Un paso del juego ----------

  private step() {
    const all = [this.player, ...this.bots].filter((s) => s.alive)

    // 1. Los bots deciden hacia dónde ir
    const grid = this.buildGrid(all)
    for (const bot of all) {
      if (!bot.isPlayer) bot.turn(think(bot, grid, this.foods, this.player))
    }

    // 2. Nuevas cabezas; la cola avanza salvo que la serpiente esté creciendo
    const heads = new Map<Snake, Cell>()
    for (const s of all) {
      s.dir = s.nextDir
      heads.set(s, s.nextHead())
      if (s.grow > 0) s.grow--
      else s.cells.shift()
    }

    // 3. Choques contra paredes, cuerpos y cabezas
    const bodies = this.buildGrid(all)
    const deaths = new Map<Snake, Snake | null>() // víctima -> quién la mató
    for (const s of all) {
      const h = heads.get(s)!
      if (!inside(h)) {
        deaths.set(s, null)
        continue
      }
      const owner = bodies[cellIndex(h)]
      if (owner !== 0) {
        const other = all.find((o) => o.id === owner) ?? null
        deaths.set(s, other && other !== s ? other : null)
        continue
      }
      for (const o of all) {
        if (o === s) continue
        const oh = heads.get(o)!
        if (oh.x === h.x && oh.y === h.y && o.length >= s.length) deaths.set(s, o)
      }
    }

    // 4. Mover a los que siguen vivos y comer
    for (const s of all) {
      if (deaths.has(s)) continue
      const h = heads.get(s)!
      s.cells.push(h)
      const fi = this.foods.findIndex((f) => f.x === h.x && f.y === h.y)
      if (fi >= 0) this.eat(s, this.foods.splice(fi, 1)[0])
    }

    // 5. Eliminaciones
    for (const [victim, killer] of deaths) this.kill(victim, killer)

    this.fillFood()
    this.emitHud()
    this.emitLeaderboard()
  }

  private eat(s: Snake, food: Food) {
    s.grow += food.golden ? 3 : 1
    s.score += food.golden ? POINTS.goldenFood : POINTS.food
    s.foodsEaten++
    if (s.isPlayer) EventBus.emit('food-eaten', food.golden)
    if (s.isPlayer && this.mode === 'classic' && s.foodsEaten % 5 === 0) {
      this.stepMs = Math.max(MIN_STEP_MS, this.stepMs - 8)
    }
  }

  private kill(victim: Snake, killer: Snake | null) {
    victim.alive = false
    this.explode(victim.head, victim.color)

    if (killer) {
      killer.score += POINTS.kill
      killer.kills++
    }

    if (victim.isPlayer) {
      this.feed(killer ? `${killer.tag.name} te eliminó` : 'Chocaste')
      this.gameOver(killer)
      return
    }

    // El bot muerto deja comida a lo largo de su cuerpo
    victim.cells.forEach((c, i) => {
      if (i % 2 === 0 && inside(c)) this.foods.push({ ...c, golden: i % 8 === 0 })
    })
    this.labels.get(victim.id)?.destroy()
    this.labels.delete(victim.id)

    if (killer?.isPlayer) {
      this.feed(`Eliminaste a ${victim.tag.name}  +${POINTS.kill}`, true)
      EventBus.emit('bot-killed', victim.tag.name)
    } else if (killer) {
      this.feed(`${killer.tag.name} eliminó a ${victim.tag.name}`)
    } else {
      this.feed(`${victim.tag.name} chocó`)
    }

    // Otro "jugador" entra a la arena un momento después
    this.time.delayedCall(BOT_RESPAWN_MS, () => {
      this.bots = this.bots.filter((b) => b !== victim)
      if (!this.over) this.spawnBot(true)
    })
  }

  private gameOver(killer: Snake | null) {
    this.over = true
    this.cameras.main.shake(250, 0.01)
    EventBus.emit('player-died')
    const ranking = this.rankingRows()
    const stats: GameOverStats = {
      mode: this.mode,
      score: this.player.score,
      length: this.player.length,
      botsKilled: this.player.kills,
      foodsEaten: this.player.foodsEaten,
      durationMs: Math.round(this.time.now - this.startedAt),
      killedBy: killer?.tag.name ?? null,
      rank: ranking.findIndex((r) => r.isPlayer) + 1,
      players: ranking.length,
    }
    this.time.delayedCall(600, () => EventBus.emit('game-over', stats))
  }

  // ---------- Bots y comida ----------

  private spawnBot(announce: boolean) {
    const taken = new Set(this.bots.map((b) => b.tag.name))
    const tag = randomTag(taken)
    const color = COLORS.bots[this.colorIndex++ % COLORS.bots.length]
    const startScore = Math.floor(Math.random() * 600)
    const length = 4 + Math.floor(startScore / 80)
    const spot = this.findSpawn(length)
    if (!spot) return
    const bot = new Snake(tag, color, spot.cell, spot.dir, length, false, {
      aggression: 0.15 + Math.random() * 0.5,
      mistakes: 0.004 + Math.random() * 0.012,
    }, startScore)
    this.bots.push(bot)
    if (announce) this.feed(`${tag.name} se unió a la arena`)
  }

  // Busca un lugar libre, lejos del jugador, con espacio para el cuerpo del bot
  private findSpawn(length: number): { cell: Cell; dir: Cell } | null {
    const grid = this.buildGrid([this.player, ...this.bots].filter((s) => s.alive))
    const dirs = Object.values(DIRS)
    for (let tries = 0; tries < 200; tries++) {
      const dir = dirs[Math.floor(Math.random() * dirs.length)]
      const cell = { x: 3 + Math.floor(Math.random() * (COLS - 6)), y: 3 + Math.floor(Math.random() * (ROWS - 6)) }
      if (Math.abs(cell.x - this.player.head.x) + Math.abs(cell.y - this.player.head.y) < 12) continue
      let ok = true
      for (let i = -length; i <= 6 && ok; i++) {
        const c = { x: cell.x + dir.x * i, y: cell.y + dir.y * i }
        if (!inside(c) || grid[cellIndex(c)] !== 0) ok = false
      }
      if (ok) return { cell, dir }
    }
    return null
  }

  private fillFood() {
    const target = FOOD_COUNT[this.mode]
    const grid = this.buildGrid([this.player, ...this.bots].filter((s) => s.alive))
    let tries = 0
    while (this.foods.filter((f) => !f.golden).length < target && tries++ < 500) {
      const c = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) }
      if (grid[cellIndex(c)] !== 0 || this.foods.some((f) => f.x === c.x && f.y === c.y)) continue
      this.foods.push({ ...c, golden: this.mode === 'arena' && Math.random() < 0.06 })
    }
  }

  private buildGrid(snakes: Snake[]): Grid {
    const grid: Grid = new Int32Array(COLS * ROWS)
    for (const s of snakes) for (const c of s.cells) if (inside(c)) grid[cellIndex(c)] = s.id
    return grid
  }

  // ---------- Dibujo ----------

  private draw() {
    const g = this.gfx
    g.clear()

    g.lineStyle(1, COLORS.grid, 0.06)
    for (let x = 0; x <= COLS; x++) g.lineBetween(x * CELL, 0, x * CELL, ROWS * CELL)
    for (let y = 0; y <= ROWS; y++) g.lineBetween(0, y * CELL, COLS * CELL, y * CELL)
    g.lineStyle(2, COLORS.grid, 0.35)
    g.strokeRect(1, 1, COLS * CELL - 2, ROWS * CELL - 2)

    for (const f of this.foods) {
      const color = f.golden ? COLORS.golden : COLORS.food
      g.fillStyle(color, 0.25)
      g.fillCircle(f.x * CELL + CELL / 2, f.y * CELL + CELL / 2, f.golden ? 10 : 8)
      g.fillStyle(color, 1)
      g.fillCircle(f.x * CELL + CELL / 2, f.y * CELL + CELL / 2, f.golden ? 6 : 5)
    }

    for (const s of [...this.bots, this.player]) {
      if (!s.alive) continue
      const n = s.cells.length
      s.cells.forEach((c, i) => {
        const isHead = i === n - 1
        if (isHead) {
          g.fillStyle(s.color, 0.25)
          g.fillRoundedRect(c.x * CELL - 3, c.y * CELL - 3, CELL + 6, CELL + 6, 9)
        }
        g.fillStyle(s.color, 0.45 + (0.55 * i) / Math.max(1, n - 1))
        g.fillRoundedRect(c.x * CELL + 1, c.y * CELL + 1, CELL - 2, CELL - 2, isHead ? 7 : 5)
      })
      this.drawEyes(s)
      if (this.mode === 'arena') this.drawLabel(s)
    }
  }

  private drawEyes(s: Snake) {
    const h = s.head
    const cx = h.x * CELL + CELL / 2 + s.dir.x * 3
    const cy = h.y * CELL + CELL / 2 + s.dir.y * 3
    const px = s.dir.y * 4
    const py = s.dir.x * 4
    this.gfx.fillStyle(0x0b0f1a, 1)
    this.gfx.fillCircle(cx + px, cy + py, 2)
    this.gfx.fillCircle(cx - px, cy - py, 2)
  }

  private drawLabel(s: Snake) {
    let label = this.labels.get(s.id)
    if (!label) {
      const text = s.isPlayer ? 'Tú' : `${s.tag.name} · Nv.${s.tag.level}`
      label = this.add
        .text(0, 0, text, { fontFamily: 'Inter, sans-serif', fontSize: '12px', fontStyle: '600', color: hex(s.color) })
        .setOrigin(0.5, 1)
        .setDepth(10)
      this.labels.set(s.id, label)
    }
    label.setPosition(s.head.x * CELL + CELL / 2, s.head.y * CELL - 4)
  }

  private makeParticles() {
    if (!this.textures.exists('dot')) {
      const t = this.make.graphics({ x: 0, y: 0 }, false)
      t.fillStyle(0xffffff, 1)
      t.fillCircle(4, 4, 4)
      t.generateTexture('dot', 8, 8)
      t.destroy()
    }
    this.burst = this.add.particles(0, 0, 'dot', {
      speed: { min: 60, max: 220 },
      lifespan: 600,
      scale: { start: 0.9, end: 0 },
      alpha: { start: 1, end: 0 },
      emitting: false,
    })
    this.burst.setDepth(20)
  }

  private explode(c: Cell, color: number) {
    this.burst.setParticleTint(color)
    this.burst.explode(24, c.x * CELL + CELL / 2, c.y * CELL + CELL / 2)
  }

  // ---------- Controles y comunicación con Vue ----------

  private setupInput() {
    const keys = this.input.keyboard!
    const bind = (names: string[], d: Cell) => names.forEach((k) => keys.on(`keydown-${k}`, () => this.player.turn(d)))
    bind(['UP', 'W'], DIRS.up)
    bind(['DOWN', 'S'], DIRS.down)
    bind(['LEFT', 'A'], DIRS.left)
    bind(['RIGHT', 'D'], DIRS.right)

    // Deslizar el dedo en el celular
    let start: { x: number; y: number } | null = null
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => (start = { x: p.x, y: p.y }))
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (!start) return
      const dx = p.x - start.x
      const dy = p.y - start.y
      start = null
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) return
      if (Math.abs(dx) > Math.abs(dy)) this.player.turn(dx > 0 ? DIRS.right : DIRS.left)
      else this.player.turn(dy > 0 ? DIRS.down : DIRS.up)
    })
  }

  private setupEvents() {
    const onPause = () => (this.paused = true)
    const onResume = () => (this.paused = false)
    const onRestart = () => this.scene.restart()
    const onTurn = (d: keyof typeof DIRS) => this.player.turn(DIRS[d])
    EventBus.on('pause', onPause)
    EventBus.on('resume', onResume)
    EventBus.on('restart', onRestart)
    EventBus.on('turn', onTurn)
    this.events.once('shutdown', () => {
      EventBus.off('pause', onPause)
      EventBus.off('resume', onResume)
      EventBus.off('restart', onRestart)
      EventBus.off('turn', onTurn)
    })
  }

  private feed(text: string, mine = false) {
    EventBus.emit('feed', { text, mine })
  }

  private emitHud() {
    EventBus.emit('score-changed', {
      score: this.player.score,
      length: this.player.length,
      botsKilled: this.player.kills,
    })
  }

  private rankingRows(): LeaderboardRow[] {
    return [this.player, ...this.bots.filter((b) => b.alive)]
      .map((s) => ({
        id: s.id,
        name: s.tag.name,
        country: s.tag.country,
        level: s.tag.level,
        score: s.score,
        color: hex(s.color),
        isPlayer: s.isPlayer,
      }))
      .sort((a, b) => b.score - a.score)
  }

  private emitLeaderboard() {
    if (this.mode === 'arena') EventBus.emit('leaderboard', this.rankingRows())
  }
}
