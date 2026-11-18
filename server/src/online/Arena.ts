// Simulación de una arena en línea. No sabe nada de sockets: Room.ts la mueve paso a paso
// y reparte lo que pasa. Las reglas son las mismas del modo Arena del juego
// (client/src/scenes/GameScene.ts): cada serpiente atraviesa su propio cuerpo, muere contra
// los bordes y contra las demás, y en un choque de cabezas gana la más larga.
import { botName, BOT_COLORS } from './names.js'
import { newMemory, think, type BotFood, type BotMemory, type BotPersonality, type Cell } from './shared/BotBrain.js'
import {
  DIR_CELLS,
  NET,
  type CausaMuerteNet,
  type DirIndex,
  type NetColors,
  type RosterEntry,
  type StatePayload,
} from './shared/protocol.js'

const { COLS, ROWS } = NET
const GOLDEN_CHANCE = 0.06
const BOT_RESPAWN_TICKS = 23 // ~2,5 s
const POINTS = { food: 10, goldenFood: 50, kill: 100 } as const
const START_LENGTH = 4
const MAX_QUEUED_TURNS = 2
// Protección al aparecer: durante ~3 s la persona es un "fantasma" (no choca con nadie ni nadie con
// ella, solo con los bordes) y los bots no la cazan. Así nadie muere nada más entrar.
const SPAWN_GHOST_TICKS = 27

export interface ArenaSnake {
  id: number
  name: string
  country: string
  level: number
  colors: NetColors
  cells: Cell[]
  dir: Cell
  turns: Cell[] // giros pedidos por la persona, uno por paso (así dos teclas rápidas no se pierden)
  grow: number
  score: number
  kills: number
  foodsEaten: number
  alive: boolean
  ghost: boolean
  bornTick: number
  bot: { personality: BotPersonality; memory: BotMemory } | null
}

export interface ArenaListener {
  onEat(s: ArenaSnake, puntos: number, dorada: boolean): void
  onDeath(victim: ArenaSnake, killer: ArenaSnake | null, causa: CausaMuerteNet): void
  onFeed(text: string, ids: number[]): void
  onRoster(): void
}

const inside = (c: Cell) => c.x >= 0 && c.y >= 0 && c.x < COLS && c.y < ROWS
const idx = (c: Cell) => c.y * COLS + c.x


export class Arena {
  readonly snakes = new Map<number, ArenaSnake>()
  foods: BotFood[] = []
  tick = 0
  private nextId = 1
  private botRespawns: number[] = [] // pasos en los que entra un bot nuevo
  private colorIndex = 0

  constructor(
    readonly conIA: boolean,
    private readonly listener: ArenaListener,
  ) {
    if (conIA) for (let i = 0; i < NET.SERPIENTES; i++) this.spawnBot(false)
    this.fillFood()
  }

  get humans(): ArenaSnake[] {
    return [...this.snakes.values()].filter((s) => !s.bot)
  }

  // ---------- Entrar y salir ----------

  addHuman(name: string, country: string, colors: NetColors): ArenaSnake | null {
    const spot = this.findSpawn(START_LENGTH)
    if (!spot) return null
    const s = this.makeSnake(name, country, 1, colors, spot.cell, spot.dir, START_LENGTH, null)
    this.snakes.set(s.id, s)
    // Si la sala está llena de bots, uno se va para dejarle sitio a la persona
    this.trimBots()
    this.listener.onRoster()
    this.listener.onFeed(`${name} se unió a la arena`, [s.id])
    return s
  }

  remove(id: number) {
    const s = this.snakes.get(id)
    if (!s) return
    this.snakes.delete(id)
    if (s.alive && !s.bot) this.dropFood(s)
    if (this.conIA) this.queueBot()
    this.listener.onRoster()
  }

  turn(id: number, d: DirIndex) {
    const s = this.snakes.get(id)
    if (!s || !s.alive || s.bot) return
    const want = DIR_CELLS[d]
    // Se compara con el último giro en cola (o la dirección actual): nada de medias vueltas
    const last = s.turns.length > 0 ? s.turns[s.turns.length - 1] : s.dir
    if ((want.x === last.x && want.y === last.y) || (want.x === -last.x && want.y === -last.y)) return
    if (s.turns.length < MAX_QUEUED_TURNS) s.turns.push({ x: want.x, y: want.y })
  }

  setColors(id: number, colors: NetColors) {
    const s = this.snakes.get(id)
    if (!s || s.bot) return
    s.colors = colors
    this.listener.onRoster()
  }

  // ---------- Un paso ----------

  step() {
    this.tick++
    const all = [...this.snakes.values()].filter((s) => s.alive)
    for (const s of all) s.ghost = !s.bot && this.tick - s.bornTick < SPAWN_GHOST_TICKS
    const solid = all.filter((s) => !s.ghost) // los fantasmas no ocupan celdas

    // 1. Los bots piensan; las personas usan el siguiente giro que pidieron
    const world = {
      cols: COLS,
      rows: ROWS,
      grid: this.buildGrid(solid),
      foods: this.foods,
      snakes: all,
      passThroughSelf: true,
    }
    for (const s of all) {
      if (s.bot) {
        const d = think(s, s.bot.personality, s.bot.memory, world)
        if (d.x !== -s.dir.x || d.y !== -s.dir.y) s.dir = d
      } else if (s.turns.length > 0) {
        s.dir = s.turns.shift()!
      }
    }

    // 2. Nuevas cabezas; la cola avanza salvo que esté creciendo
    const heads = new Map<ArenaSnake, Cell>()
    const tails = new Map<ArenaSnake, Cell>()
    for (const s of all) {
      const h = s.cells[s.cells.length - 1]
      heads.set(s, { x: h.x + s.dir.x, y: h.y + s.dir.y })
      if (s.grow > 0) s.grow--
      else tails.set(s, s.cells.shift()!)
    }

    // 3. Choques
    const bodies = this.buildGrid(solid)
    const deaths = new Map<ArenaSnake, { killer: ArenaSnake | null; causa: CausaMuerteNet }>()
    for (const s of all) {
      const h = heads.get(s)!
      if (!inside(h)) {
        deaths.set(s, { killer: null, causa: 'pared' })
        continue
      }
      if (s.ghost) continue // un fantasma solo choca con los bordes
      const owner = bodies[idx(h)]
      if (owner !== 0 && owner !== s.id) {
        deaths.set(s, { killer: this.snakes.get(owner) ?? null, causa: 'jugador' })
        continue
      }
      for (const o of all) {
        if (o === s || o.ghost) continue
        const oh = heads.get(o)!
        if (oh.x === h.x && oh.y === h.y && o.cells.length >= s.cells.length) deaths.set(s, { killer: o, causa: 'jugador' })
      }
    }

    // 4. Avanzar y comer
    for (const s of all) {
      if (deaths.has(s)) continue
      const h = heads.get(s)!
      s.cells.push(h)
      const fi = this.foods.findIndex((f) => f.x === h.x && f.y === h.y)
      if (fi >= 0) {
        const food = this.foods.splice(fi, 1)[0]
        const puntos = food.golden ? POINTS.goldenFood : POINTS.food
        s.grow += food.golden ? 3 : 1
        s.score += puntos
        s.foodsEaten++
        this.listener.onEat(s, puntos, food.golden)
      }
    }

    // 5. Eliminaciones (quien muere no avanzó: recupera su cola)
    for (const [victim, death] of deaths) {
      const tail = tails.get(victim)
      if (tail) victim.cells.unshift(tail)
      this.kill(victim, death.killer, death.causa)
    }

    // 6. Bots que vuelven a entrar
    while (this.botRespawns.length > 0 && this.botRespawns[0] <= this.tick) {
      this.botRespawns.shift()
      if (this.botCount() + this.humans.length < NET.SERPIENTES) this.spawnBot(true)
    }

    this.fillFood()
  }

  private kill(victim: ArenaSnake, killer: ArenaSnake | null, causa: CausaMuerteNet) {
    victim.alive = false
    if (killer && killer !== victim) {
      killer.score += POINTS.kill
      killer.kills++
    }
    this.dropFood(victim)
    const real = killer && killer !== victim ? killer : null
    if (real) this.listener.onFeed(`${real.name} eliminó a ${victim.name}`, [real.id, victim.id])
    else this.listener.onFeed(`${victim.name} chocó`, [victim.id])
    this.listener.onDeath(victim, real, causa)

    if (victim.bot) {
      this.snakes.delete(victim.id)
      this.queueBot()
      this.listener.onRoster()
    }
  }

  // La serpiente eliminada deja comida a lo largo del cuerpo
  private dropFood(s: ArenaSnake) {
    const taken = new Set(this.foods.map(idx))
    s.cells.forEach((c, i) => {
      if (i % 2 === 0 && inside(c) && !taken.has(idx(c))) this.foods.push({ ...c, golden: i % 8 === 0 })
    })
  }

  // ---------- Bots ----------

  private botCount() {
    let n = 0
    for (const s of this.snakes.values()) if (s.bot) n++
    return n
  }

  private queueBot() {
    if (this.conIA) this.botRespawns.push(this.tick + BOT_RESPAWN_TICKS)
  }

  private trimBots() {
    if (!this.conIA) return
    while (this.botCount() + this.humans.length > NET.SERPIENTES) {
      // Se va el bot más pequeño (sin explotar: simplemente sale de la sala)
      const bots = [...this.snakes.values()].filter((s) => s.bot).sort((a, b) => a.cells.length - b.cells.length)
      const leaving = bots[0]
      if (!leaving) return
      this.snakes.delete(leaving.id)
      this.listener.onFeed(`${leaving.name} salió de la arena`, [leaving.id])
    }
  }

  private spawnBot(announce: boolean) {
    const taken = new Set([...this.snakes.values()].map((s) => s.name))
    const tag = botName(taken)
    const startScore = Math.floor(Math.random() * 600)
    const length = START_LENGTH + Math.floor(startScore / 80)
    const spot = this.findSpawn(length)
    if (!spot) return
    const base = BOT_COLORS[this.colorIndex++ % BOT_COLORS.length]
    const s = this.makeSnake(tag.name, tag.country, tag.level, base, spot.cell, spot.dir, length, {
      personality: { aggression: 0.3 + Math.random() * 0.45, skill: 0.7 + Math.random() * 0.3 },
      memory: newMemory(),
    })
    s.score = startScore
    this.snakes.set(s.id, s)
    if (announce) {
      this.listener.onRoster()
      this.listener.onFeed(`${tag.name} se unió a la arena`, [s.id])
    }
  }

  private makeSnake(
    name: string,
    country: string,
    level: number,
    colors: NetColors,
    head: Cell,
    dir: Cell,
    length: number,
    bot: ArenaSnake['bot'],
  ): ArenaSnake {
    const cells: Cell[] = []
    for (let i = length - 1; i >= 0; i--) cells.push({ x: head.x - dir.x * i, y: head.y - dir.y * i })
    return {
      id: this.nextId++,
      name,
      country,
      level,
      colors,
      cells,
      dir,
      turns: [],
      grow: 0,
      score: 0,
      kills: 0,
      foodsEaten: 0,
      alive: true,
      ghost: !bot,
      bornTick: this.tick,
      bot,
    }
  }

  // Un lugar libre, lejos de las cabezas de los demás, con espacio delante para no chocar al entrar
  private findSpawn(length: number): { cell: Cell; dir: Cell } | null {
    const alive = [...this.snakes.values()].filter((s) => s.alive)
    const grid = this.buildGrid(alive)
    const heads = alive.map((s) => s.cells[s.cells.length - 1])
    for (let tries = 0; tries < 300; tries++) {
      const cell = { x: 4 + Math.floor(Math.random() * (COLS - 8)), y: 4 + Math.floor(Math.random() * (ROWS - 8)) }
      // Mirando hacia el centro: así no aparece de cara a una pared
      const dir =
        Math.abs(cell.x - COLS / 2) > Math.abs(cell.y - ROWS / 2)
          ? { x: cell.x < COLS / 2 ? 1 : -1, y: 0 }
          : { x: 0, y: cell.y < ROWS / 2 ? 1 : -1 }
      const minDist = tries < 200 ? 10 : 5
      if (heads.some((h) => Math.abs(h.x - cell.x) + Math.abs(h.y - cell.y) < minDist)) continue
      let ok = true
      for (let i = -length; i <= 6 && ok; i++) {
        const c = { x: cell.x + dir.x * i, y: cell.y + dir.y * i }
        if (!inside(c) || grid[idx(c)] !== 0) ok = false
      }
      if (ok) return { cell, dir }
    }
    return null
  }

  private fillFood() {
    let normal = this.foods.reduce((n, f) => (f.golden ? n : n + 1), 0)
    if (normal >= NET.COMIDA) return
    const grid = this.buildGrid([...this.snakes.values()].filter((s) => s.alive))
    const taken = new Set(this.foods.map(idx))
    let tries = 0
    while (normal < NET.COMIDA && tries++ < 500) {
      const c = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) }
      const i = idx(c)
      if (grid[i] !== 0 || taken.has(i)) continue
      const golden = Math.random() < GOLDEN_CHANCE
      this.foods.push({ ...c, golden })
      taken.add(i)
      if (!golden) normal++
    }
  }

  private buildGrid(snakes: ArenaSnake[]): Int32Array {
    const grid = new Int32Array(COLS * ROWS)
    for (const s of snakes) for (const c of s.cells) if (inside(c)) grid[idx(c)] = s.id
    return grid
  }

  // ---------- Lo que se manda a los navegadores ----------

  state(): StatePayload {
    const s: number[][] = []
    for (const snake of this.snakes.values()) {
      if (!snake.alive) continue
      const d = DIR_CELLS.findIndex((c) => c.x === snake.dir.x && c.y === snake.dir.y)
      const row = [snake.id, d + (snake.ghost ? 4 : 0), snake.score, snake.kills]
      for (const c of snake.cells) row.push(idx(c))
      s.push(row)
    }
    return { t: this.tick, s, f: this.foods.map((f) => (f.golden ? -(idx(f) + 1) : idx(f))) }
  }

  roster(): RosterEntry[] {
    return [...this.snakes.values()].map((s) => ({
      id: s.id,
      name: s.name,
      country: s.country,
      level: s.level,
      colors: s.colors,
      bot: s.bot !== null,
    }))
  }

  // Puesto de cada serpiente viva por puntaje (para el Game Over)
  rankOf(target: ArenaSnake): { rank: number; players: number } {
    const list = [...this.snakes.values()].filter((s) => s.alive || s === target).sort((a, b) => b.score - a.score)
    return { rank: list.indexOf(target) + 1, players: list.length }
  }
}

