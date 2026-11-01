import Phaser from 'phaser'
import { cellIndex, inside, nextIsSafe, think, type Grid } from '../bots/BotBrain'
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
import { SpritePool } from '../SpritePool'
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

// Mezcla un color con otro (t = 0: el primero, t = 1: el segundo)
function mix(a: number, b: number, t: number): number {
  const r = ((a >> 16) & 255) + ((((b >> 16) & 255) - ((a >> 16) & 255)) * t)
  const g = ((a >> 8) & 255) + ((((b >> 8) & 255) - ((a >> 8) & 255)) * t)
  const bl = (a & 255) + (((b & 255) - (a & 255)) * t)
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(bl)
}

const WHITE = 0xffffff
const DISC = 64 // tamaño en píxeles de la textura del círculo
const GLOW = 128 // tamaño en píxeles de la textura del brillo
const SAMPLE_GAP = CELL * 0.3 // distancia entre los círculos que forman el cuerpo
const HEAD_RADIUS = CELL * 0.46
const TAIL_RADIUS = CELL * 0.2

// Escena principal: sirve para los dos modos.
// Arena: el jugador y varios bots con IA. Clásico: el jugador solo, cada 5 frutas va más rápido.
export class ArenaScene extends Phaser.Scene {
  private mode: GameMode = 'arena'
  private player!: Snake
  private bots: Snake[] = []
  private foods: Food[] = []
  // Todo se dibuja con imágenes reutilizables (sin crear ni destruir objetos en cada tick)
  private foodGlows!: SpritePool
  private foodDots!: SpritePool
  private headGlows!: SpritePool
  private bodies!: SpritePool
  private frozenDrawn = false
  // Puntos del cuerpo y muestras de círculos, reutilizados en cada fotograma
  private path: number[] = []
  private samples: number[] = []
  private labels = new Map<number, Phaser.GameObjects.Text>()
  private burst!: Phaser.GameObjects.Particles.ParticleEmitter
  private elapsed = 0
  private stepMs = START_STEP_MS
  private paused = false
  private over = false
  private startedAt = 0
  private colorIndex = 0
  private tick = 0

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
    this.tick = 0

    this.frozenDrawn = false
    this.makeTextures()
    this.add.image(0, 0, 'grid').setOrigin(0).setDepth(0)
    this.foodGlows = new SpritePool(this, 'glow', 1, true)
    this.foodDots = new SpritePool(this, 'disc', 2)
    this.headGlows = new SpritePool(this, 'glow', 3, true)
    this.bodies = new SpritePool(this, 'disc', 4)
    this.makeParticles()

    this.player = new Snake({ name: 'Tú', country: '', level: 1 }, COLORS.player, { x: 30, y: 20 }, DIRS.right, 4, true)

    if (this.mode === 'arena') {
      for (let i = 0; i < BOT_COUNT; i++) this.spawnBot(false)
    }
    this.fillFood()
    this.setupInput()
    this.setupEvents()
    this.renderFood()
    this.renderSnakes(1)
    this.emitHud()
    this.emitLeaderboard()
    EventBus.emit('scene-ready')
  }

  update(_time: number, delta: number) {
    const frozen = this.paused || this.over
    if (!frozen) {
      this.elapsed += delta
      if (this.elapsed >= this.stepMs) {
        this.elapsed -= this.stepMs
        if (this.elapsed > this.stepMs) this.elapsed = 0 // tras un parón no se recuperan pasos de golpe
        this.step()
      }
      this.frozenDrawn = false
    } else if (this.frozenDrawn) {
      return // en pausa o tras morir la imagen no cambia: no hace falta redibujar
    }
    // Movimiento suave: dibuja a mitad de camino entre el paso anterior y el actual
    this.renderSnakes(Math.min(1, this.elapsed / this.stepMs))
    if (frozen) this.frozenDrawn = true
  }

  // ---------- Un paso del juego ----------

  private step() {
    const all = [this.player, ...this.bots].filter((s) => s.alive)

    // 1. Los bots deciden hacia dónde ir. Para repartir el trabajo, cada uno piensa en ticks
    //    alternos; si va a chocar con lo que tiene delante, piensa en este mismo tick.
    this.tick++
    const grid = this.buildGrid(all)
    for (const bot of all) {
      if (bot.isPlayer) continue
      if ((this.tick + bot.id) % 2 === 0 || !nextIsSafe(bot, grid)) bot.turn(think(bot, grid, this.foods, this.player))
    }

    // 2. Nuevas cabezas; la cola avanza salvo que la serpiente esté creciendo
    const heads = new Map<Snake, Cell>()
    const tails = new Map<Snake, Cell>() // cola quitada en este paso, por si la serpiente muere
    for (const s of all) {
      s.dir = s.nextDir
      heads.set(s, s.nextHead())
      s.prevTail = s.cells[0]
      if (s.grow > 0) s.grow--
      else tails.set(s, s.cells.shift()!)
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

    // 5. Eliminaciones: quien muere no avanzó, así que recupera su cola (si no, perdería un segmento)
    for (const [victim, killer] of deaths) {
      const tail = tails.get(victim)
      if (tail) victim.cells.unshift(tail)
      this.kill(victim, killer)
    }

    this.fillFood()
    this.renderFood()
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
    this.explode(victim)

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
    let normal = this.foods.reduce((n, f) => (f.golden ? n : n + 1), 0)
    if (normal >= target) return
    const grid = this.buildGrid([this.player, ...this.bots].filter((s) => s.alive))
    const taken = new Set(this.foods.map(cellIndex))
    let tries = 0
    while (normal < target && tries++ < 500) {
      const c = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) }
      const i = cellIndex(c)
      if (grid[i] !== 0 || taken.has(i)) continue
      const golden = this.mode === 'arena' && Math.random() < 0.06
      this.foods.push({ ...c, golden })
      taken.add(i)
      if (!golden) normal++
    }
  }

  private buildGrid(snakes: Snake[]): Grid {
    const grid: Grid = new Int32Array(COLS * ROWS)
    for (const s of snakes) for (const c of s.cells) if (inside(c)) grid[cellIndex(c)] = s.id
    return grid
  }

  // ---------- Dibujo ----------

  // Texturas que se pintan una sola vez: círculo blanco (se tiñe), brillo, cuadrícula y partícula
  private makeTextures() {
    if (!this.textures.exists('disc')) {
      const t = this.textures.createCanvas('disc', DISC, DISC)!
      t.context.fillStyle = 'white'
      t.context.beginPath()
      t.context.arc(DISC / 2, DISC / 2, DISC / 2 - 1, 0, Math.PI * 2)
      t.context.fill()
      t.refresh()
    }
    if (!this.textures.exists('glow')) {
      const t = this.textures.createCanvas('glow', GLOW, GLOW)!
      const gradient = t.context.createRadialGradient(GLOW / 2, GLOW / 2, 0, GLOW / 2, GLOW / 2, GLOW / 2)
      gradient.addColorStop(0, 'rgba(255, 255, 255, 0.9)')
      gradient.addColorStop(0.35, 'rgba(255, 255, 255, 0.35)')
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0)')
      t.context.fillStyle = gradient
      t.context.fillRect(0, 0, GLOW, GLOW)
      t.refresh()
    }
    if (!this.textures.exists('grid')) {
      const g = this.make.graphics({ x: 0, y: 0 }, false)
      g.lineStyle(1, COLORS.grid, 0.06)
      for (let x = 0; x <= COLS; x++) g.lineBetween(x * CELL, 0, x * CELL, ROWS * CELL)
      for (let y = 0; y <= ROWS; y++) g.lineBetween(0, y * CELL, COLS * CELL, y * CELL)
      g.lineStyle(2, COLORS.grid, 0.35)
      g.strokeRect(1, 1, COLS * CELL - 2, ROWS * CELL - 2)
      g.generateTexture('grid', COLS * CELL, ROWS * CELL)
      g.destroy()
    }
  }

  // La comida solo cambia en los ticks: se coloca entonces, no en cada fotograma
  private renderFood() {
    this.foodGlows.begin()
    this.foodDots.begin()
    for (const f of this.foods) {
      const x = f.x * CELL + CELL / 2
      const y = f.y * CELL + CELL / 2
      const color = f.golden ? COLORS.golden : COLORS.food
      this.foodGlows.next().setPosition(x, y).setScale((CELL * (f.golden ? 1.6 : 1.2)) / GLOW).setTint(color).setAlpha(0.7)
      this.foodDots.next().setPosition(x, y).setScale(((f.golden ? 6 : 5) * 2) / DISC).setTint(color)
    }
    this.foodGlows.end()
    this.foodDots.end()
  }

  private renderSnakes(progress: number) {
    this.headGlows.begin()
    this.bodies.begin()
    for (const s of this.bots) if (s.alive) this.drawSnake(s, progress)
    if (this.player.alive) this.drawSnake(this.player, progress)
    this.headGlows.end()
    this.bodies.end()
  }

  // Línea del cuerpo (de la cola a la cabeza) en píxeles, interpolada entre el paso anterior y el actual
  private bodyPath(s: Snake, progress: number): number {
    const path = this.path
    const cells = s.cells
    const n = cells.length
    let k = 0
    const put = (x: number, y: number) => {
      path[k++] = x * CELL + CELL / 2
      path[k++] = y * CELL + CELL / 2
    }
    if (s.prevTail && n >= 2) {
      const t = s.prevTail
      put(t.x + (cells[0].x - t.x) * progress, t.y + (cells[0].y - t.y) * progress)
      for (let i = 0; i < n - 1; i++) put(cells[i].x, cells[i].y)
      const a = cells[n - 2]
      const b = cells[n - 1]
      put(a.x + (b.x - a.x) * progress, a.y + (b.y - a.y) * progress)
    } else {
      for (const c of cells) put(c.x, c.y)
    }
    return k / 2
  }

  // Cuerpo continuo: círculos solapados desde la cabeza hacia la cola, cada vez más finos
  private drawSnake(s: Snake, progress: number) {
    const count = this.bodyPath(s, progress)
    const path = this.path
    const samples = this.samples

    // Muestras cada SAMPLE_GAP píxeles, recorriendo la línea desde la cabeza
    let m = 0
    let walked = 0
    let nextAt = 0
    for (let i = count - 1; i > 0; i--) {
      const x1 = path[i * 2]
      const y1 = path[i * 2 + 1]
      const x0 = path[i * 2 - 2]
      const y0 = path[i * 2 - 1]
      const len = Math.abs(x1 - x0) + Math.abs(y1 - y0) // los tramos son rectos (horizontal o vertical)
      while (nextAt <= walked + len) {
        const f = len === 0 ? 0 : (nextAt - walked) / len
        samples[m++] = x1 + (x0 - x1) * f
        samples[m++] = y1 + (y0 - y1) * f
        samples[m++] = nextAt
        nextAt += SAMPLE_GAP
      }
      walked += len
    }
    if (m === 0) {
      samples[m++] = path[(count - 1) * 2]
      samples[m++] = path[(count - 1) * 2 + 1]
      samples[m++] = 0
    }
    const total = Math.max(walked, CELL)
    const stripe = mix(s.color, COLORS.background, 0.28)

    // Se dibuja de la cola a la cabeza para que la cabeza quede encima
    for (let j = m - 3; j >= 0; j -= 3) {
      const d = samples[j + 2]
      const t = d / total
      const radius = HEAD_RADIUS - (HEAD_RADIUS - TAIL_RADIUS) * t
      // Escamas: el tono alterna cada 2 segmentos; más claro cerca de la cabeza
      let color = Math.floor(d / (CELL * 2)) % 2 === 1 ? stripe : s.color
      const light = Math.max(0, 1 - d / (CELL * 2.5)) * 0.4
      if (light > 0) color = mix(color, WHITE, light)
      this.bodies.next().setPosition(samples[j], samples[j + 1]).setScale((radius * 2) / DISC).setTint(color)
    }

    // Cabeza: un poco más ancha y ovalada en la dirección de avance, con ojos y brillo neón
    const hx = samples[0]
    const hy = samples[1]
    const dir = s.dir
    const along = (CELL * 1.2) / DISC
    const across = (CELL * 1.05) / DISC
    this.headGlows.next().setPosition(hx, hy).setScale((CELL * 3.2) / GLOW).setTint(s.color).setAlpha(0.55)
    this.bodies
      .next()
      .setPosition(hx, hy)
      .setScale(dir.x !== 0 ? along : across, dir.x !== 0 ? across : along)
      .setTint(mix(s.color, WHITE, 0.35))
    const px = -dir.y
    const py = dir.x
    for (const side of [1, -1]) {
      const ex = hx + dir.x * CELL * 0.18 + px * side * CELL * 0.24
      const ey = hy + dir.y * CELL * 0.18 + py * side * CELL * 0.24
      this.bodies.next().setPosition(ex, ey).setScale((CELL * 0.34) / DISC).setTint(COLORS.eye)
      this.bodies
        .next()
        .setPosition(ex + dir.x * CELL * 0.07, ey + dir.y * CELL * 0.07)
        .setScale((CELL * 0.18) / DISC)
        .setTint(COLORS.background)
    }

    if (this.mode === 'arena') this.labelFor(s).setPosition(hx, hy - CELL * 0.7)
  }

  // La etiqueta de nombre se crea una vez por serpiente; después solo se mueve
  private labelFor(s: Snake): Phaser.GameObjects.Text {
    let label = this.labels.get(s.id)
    if (!label) {
      const text = s.isPlayer ? 'Tú' : `${s.tag.name} · Nv.${s.tag.level}`
      label = this.add
        .text(0, 0, text, { fontFamily: 'Inter, sans-serif', fontSize: '12px', fontStyle: '600', color: hex(s.color) })
        .setOrigin(0.5, 1)
        .setDepth(10)
      this.labels.set(s.id, label)
    }
    return label
  }

  private makeParticles() {
    if (!this.textures.exists('dot')) {
      const t = this.make.graphics({ x: 0, y: 0 }, false)
      t.fillStyle(WHITE, 1)
      t.fillCircle(4, 4, 4)
      t.generateTexture('dot', 8, 8)
      t.destroy()
    }
    this.burst = this.add.particles(0, 0, 'dot', {
      speed: { min: 30, max: 150 },
      lifespan: 700,
      scale: { start: 0.9, end: 0 },
      alpha: { start: 1, end: 0 },
      emitting: false,
    })
    this.burst.setDepth(20)
  }

  // Al morir, el cuerpo se deshace en partículas a lo largo de su forma
  private explode(s: Snake) {
    this.burst.setParticleTint(s.color)
    const cells = s.cells
    const every = Math.max(1, Math.floor(cells.length / 24))
    for (let i = cells.length - 1; i >= 0; i -= every) {
      const c = cells[i]
      this.burst.explode(i === cells.length - 1 ? 12 : 4, c.x * CELL + CELL / 2, c.y * CELL + CELL / 2)
    }
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
