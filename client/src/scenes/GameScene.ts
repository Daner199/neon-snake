import Phaser from 'phaser'
import { think } from '../game/bots/BotBrain'
import { cellIndex, inside, type Grid } from '../game/grid'
import { buscarModo, MODOS, SKINS, type Modo } from '../data'
import { closestColor, colorsFromBase, colorsFromSkin, hex, mix } from '../game/colors'
import {
  BOT_RESPAWN_MS,
  CELL,
  COLORS,
  COLS,
  DISC_PX as DISC,
  GLOW_PX as GLOW,
  GOLDEN_CHANCE,
  MAX_ZOOM,
  MIN_CELL_PX,
  MINIMAP,
  POINTS,
  ROWS,
  SPEEDUP_MS,
  TARGET_CELL_PX,
  TEXTURES,
} from '../game/constants'
import { explodeBody, makeBurst } from '../game/effects'
import { randomTag } from '../game/names'
import { SpritePool } from '../game/SpritePool'
import { DIRS, Snake, type Cell } from '../game/Snake'
import { EventBus } from '../events/EventBus'
import {
  EVENTS,
  type CausaMuerte,
  type Direction,
  type GameOverStats,
  type LeaderboardRow,
  type SkinChangedPayload,
} from '../events/names'
import type { GameOverData } from './GameOverScene'
import { DIR_CELLS, type DiedStats, type DirIndex, type FeedMsg, type GameEvent, type RosterEntry, type StatePayload } from '../online/protocol'
import { enviarSkin, getSocket, girar, online } from '../online/session'

type Food = Cell & { golden: boolean }
type Death = { killer: Snake | null; causa: CausaMuerte } // killer: la otra serpiente, si la hubo

const WHITE = 0xffffff
const SAMPLE_GAP = CELL * 0.3 // distancia entre los círculos que forman el cuerpo
const HEAD_RADIUS = CELL * 0.46
const TAIL_RADIUS = CELL * 0.2

// Escena de la partida: sirve para todos los modos de src/data/modos.json.
// Del modo lee cuánta comida hay, cuántos rivales con IA y la velocidad.
// Las texturas las crea BootScene; al morir el jugador se pausa y lanza GameOverScene encima.
export class GameScene extends Phaser.Scene {
  private modo: Modo = MODOS[0]
  private rivals = true // hay jugadores con IA: nombres, ranking en vivo y comida dorada
  private player!: Snake
  private bots: Snake[] = []
  private foods: Food[] = []
  // Todo se dibuja con imágenes reutilizables (sin crear ni destruir objetos en cada tick)
  private foodGlows!: SpritePool
  private foodDots!: SpritePool
  private headGlows!: SpritePool
  private bodies!: SpritePool
  private frozenDrawn = false
  // Punto que sigue la cámara (la cabeza del jugador) y minimapa, solo en pantallas pequeñas
  private follow!: Phaser.GameObjects.Zone
  private minimap: Phaser.Cameras.Scene2D.Camera | null = null
  // Puntos del cuerpo y muestras de círculos, reutilizados en cada fotograma
  private path: number[] = []
  private samples: number[] = []
  private labels = new Map<number, Phaser.GameObjects.Text>()
  private burst!: Phaser.GameObjects.Particles.ParticleEmitter
  private elapsed = 0
  private stepMs = 0
  private paused = false
  private over = false
  private startedAt = 0
  private colorIndex = 0
  // Colores de los bots: los de COLORS.bots menos el que más se parece a la skin del jugador
  private botPalette: number[] = [...COLORS.bots]
  private tick = 0
  // Partida en línea: el servidor mueve todo y aquí solo se dibuja lo que llega en cada paso
  private online = false
  private remote = new Map<number, Snake>() // id en el servidor -> serpiente que se dibuja
  private roster = new Map<number, RosterEntry>()
  private playerServerId = 0

  constructor() {
    super('GameScene')
  }

  create() {
    this.online = this.registry.get('online') === true
    this.modo = buscarModo(this.registry.get('mode')) ?? MODOS[0]
    this.rivals = this.online || this.modo.jugadores > 0
    this.bots = []
    this.foods = []
    this.labels.clear()
    this.elapsed = 0
    this.stepMs = this.online ? online.tickMs : this.modo.pasoInicialMs
    this.paused = false
    this.over = false
    this.startedAt = this.time.now
    this.tick = 0
    this.remote.clear()
    this.roster.clear()
    this.playerServerId = 0

    this.frozenDrawn = false
    this.add.image(0, 0, TEXTURES.grid).setOrigin(0).setDepth(0)
    this.foodGlows = new SpritePool(this, TEXTURES.glow, 1, true)
    this.foodDots = new SpritePool(this, TEXTURES.disc, 2)
    this.headGlows = new SpritePool(this, TEXTURES.glow, 3, true)
    this.bodies = new SpritePool(this, TEXTURES.disc, 4)
    this.burst = makeBurst(this)

    // Hasta que Vue mande la skin elegida (evento skin-changed), el jugador usa la primera del JSON
    this.botPalette = [...COLORS.bots]
    const skin = colorsFromSkin(SKINS[0])
    this.player = new Snake({ name: 'Tú', country: '', level: 1 }, skin, { x: 30, y: 20 }, DIRS.right, 4, true)

    if (this.online) {
      this.player.alive = false // hasta que llegue el primer estado del servidor
      this.setupNet()
    } else {
      for (let i = 0; i < this.modo.jugadores; i++) this.spawnBot(false)
      this.fillFood()
    }
    this.follow = this.add.zone(this.player.head.x * CELL + CELL / 2, this.player.head.y * CELL + CELL / 2, 1, 1)
    this.minimap = null
    this.updateCamera()
    this.scale.on('resize', this.updateCamera, this)
    this.onExit(() => this.scale.off('resize', this.updateCamera, this))
    this.setupInput()
    this.setupEvents()
    this.watchRenderer()
    this.renderFood()
    this.renderSnakes(1)
    this.emitHud()
    this.emitLeaderboard()
    EventBus.emit(EVENTS.SCENE_READY)
  }

  update(_time: number, delta: number) {
    if (this.online) {
      // En línea la partida no se pausa: el mundo sigue aunque abras el menú
      this.elapsed += delta
      this.renderSnakes(Math.min(1, this.elapsed / this.stepMs))
      return
    }
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

    // 1. Los bots deciden hacia dónde ir (src/game/bots/BotBrain.ts). Piensan en cada paso:
    //    su búsqueda está limitada, así que es barato y no se quedan "dormidos" un tick.
    this.tick++
    const world = {
      cols: COLS,
      rows: ROWS,
      grid: this.buildGrid(all),
      foods: this.foods,
      snakes: all,
      passThroughSelf: this.modo.atraviesaCuerpo,
    }
    for (const bot of all) {
      if (!bot.isPlayer && bot.personality) bot.turn(think(bot, bot.personality, bot.memory, world))
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
    const deaths = new Map<Snake, Death>() // víctima -> quién la mató y por qué
    for (const s of all) {
      const h = heads.get(s)!
      if (!inside(h)) {
        deaths.set(s, { killer: null, causa: 'pared' })
        continue
      }
      const owner = bodies[cellIndex(h)]
      // Con "atraviesaCuerpo" (modos.json) cada serpiente pasa por encima de su propio cuerpo
      const ownBody = owner === s.id && this.modo.atraviesaCuerpo
      if (owner !== 0 && !ownBody) {
        const other = all.find((o) => o.id === owner) ?? null
        deaths.set(s, other && other !== s ? { killer: other, causa: 'jugador' } : { killer: null, causa: 'cuerpo' })
        continue
      }
      for (const o of all) {
        if (o === s) continue
        const oh = heads.get(o)!
        if (oh.x === h.x && oh.y === h.y && o.length >= s.length) deaths.set(s, { killer: o, causa: 'jugador' })
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
    for (const [victim, death] of deaths) {
      const tail = tails.get(victim)
      if (tail) victim.cells.unshift(tail)
      this.kill(victim, death)
    }

    this.fillFood()
    this.renderFood()
    this.emitHud()
    this.emitLeaderboard()
  }

  private eat(s: Snake, food: Food) {
    const puntos = food.golden ? POINTS.goldenFood : POINTS.food
    s.grow += food.golden ? 3 : 1
    s.score += puntos
    s.foodsEaten++
    if (s.isPlayer) EventBus.emit(EVENTS.FOOD_EATEN, { puntos, dorada: food.golden, total: s.score })
    const every = this.modo.aceleraCadaFrutas
    if (s.isPlayer && every > 0 && s.foodsEaten % every === 0) {
      this.stepMs = Math.max(this.modo.pasoMinimoMs, this.stepMs - SPEEDUP_MS)
    }
  }

  private kill(victim: Snake, death: Death) {
    const killer = death.killer
    victim.alive = false
    // El jugador explota en GameOverScene (esta escena se pausa y sus partículas se quedarían quietas)
    if (!victim.isPlayer) explodeBody(this.burst, victim.cells, victim.color.body)

    if (killer) {
      killer.score += POINTS.kill
      killer.kills++
    }

    if (victim.isPlayer) {
      this.feed(killer ? `${killer.tag.name} te eliminó` : 'Chocaste')
      this.gameOver(death)
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
      EventBus.emit(EVENTS.BOT_KILLED, victim.tag.name)
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

  // El jugador murió: la escena se detiene y GameOverScene hace el efecto final y avisa a Vue
  private gameOver({ killer, causa }: Death) {
    this.over = true
    const { score: puntos, length: tamano } = this.player
    EventBus.emit(
      EVENTS.SNAKE_DIED,
      killer ? { puntos, tamano, causa: 'jugador', eliminadoPor: killer.tag.name } : { puntos, tamano, causa: causa === 'jugador' ? 'cuerpo' : causa },
    )
    const ranking = this.rankingRows()
    const stats: GameOverStats = {
      mode: this.modo.id,
      score: this.player.score,
      length: this.player.length,
      botsKilled: this.player.kills,
      foodsEaten: this.player.foodsEaten,
      durationMs: Math.round(this.time.now - this.startedAt),
      killedBy: killer?.tag.name ?? null,
      rank: ranking.findIndex((r) => r.isPlayer) + 1,
      players: ranking.length,
    }
    const data: GameOverData = { stats, body: [...this.player.cells], color: this.player.color.body }
    this.scene.launch('GameOverScene', data)
    this.scene.pause()
  }

  // ---------- Bots y comida ----------

  private spawnBot(announce: boolean) {
    const taken = new Set(this.bots.map((b) => b.tag.name))
    const tag = randomTag(taken)
    const color = colorsFromBase(this.botPalette[this.colorIndex++ % this.botPalette.length])
    const startScore = Math.floor(Math.random() * 600)
    const length = 4 + Math.floor(startScore / 80)
    const spot = this.findSpawn(length)
    if (!spot) return
    // Nivel intermedio-avanzado: todos juegan bien, unos más agresivos y otros más prudentes
    const bot = new Snake(tag, color, spot.cell, spot.dir, length, false, {
      aggression: 0.3 + Math.random() * 0.45,
      skill: 0.7 + Math.random() * 0.3,
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
    const target = this.modo.comida
    let normal = this.foods.reduce((n, f) => (f.golden ? n : n + 1), 0)
    if (normal >= target) return
    const grid = this.buildGrid([this.player, ...this.bots].filter((s) => s.alive))
    const taken = new Set(this.foods.map(cellIndex))
    let tries = 0
    while (normal < target && tries++ < 500) {
      const c = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) }
      const i = cellIndex(c)
      if (grid[i] !== 0 || taken.has(i)) continue
      const golden = this.rivals && Math.random() < GOLDEN_CHANCE
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
    const { head, body, stripe, glow } = s.color
    // Recién aparecida en línea: parpadea mientras no choca con nadie
    const alpha = s.ghost ? 0.35 + 0.25 * Math.sin(this.time.now / 90) : 1

    // Se dibuja de la cola a la cabeza para que la cabeza quede encima
    for (let j = m - 3; j >= 0; j -= 3) {
      const d = samples[j + 2]
      const t = d / total
      const radius = HEAD_RADIUS - (HEAD_RADIUS - TAIL_RADIUS) * t
      // Escamas: el tono alterna cada 2 segmentos; más claro cerca de la cabeza
      let color = Math.floor(d / (CELL * 2)) % 2 === 1 ? stripe : body
      const light = Math.max(0, 1 - d / (CELL * 2.5)) * 0.4
      if (light > 0) color = mix(color, WHITE, light)
      this.bodies.next().setPosition(samples[j], samples[j + 1]).setScale((radius * 2) / DISC).setTint(color).setAlpha(alpha)
    }

    // Cabeza: un poco más ancha y ovalada en la dirección de avance, con ojos y brillo neón
    const hx = samples[0]
    const hy = samples[1]
    const dir = s.dir
    const along = (CELL * 1.2) / DISC
    const across = (CELL * 1.05) / DISC
    this.headGlows.next().setPosition(hx, hy).setScale((CELL * 3.2) / GLOW).setTint(glow).setAlpha(0.55)
    this.bodies
      .next()
      .setPosition(hx, hy)
      .setScale(dir.x !== 0 ? along : across, dir.x !== 0 ? across : along)
      .setTint(head)
      .setAlpha(alpha)
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

    if (s.isPlayer) this.follow.setPosition(hx, hy)
    if (this.rivals) this.labelFor(s).setPosition(hx, hy - CELL * 0.7)
  }

  // Si las celdas se ven muy pequeñas (celular en horizontal), la cámara se acerca y sigue al jugador
  private updateCamera() {
    const cam = this.cameras.main
    const width = COLS * CELL
    const height = ROWS * CELL
    const cellPx = CELL * (this.scale.displaySize.width / this.scale.gameSize.width)
    if (cellPx > 0 && cellPx < MIN_CELL_PX) {
      cam.setZoom(Math.min(MAX_ZOOM, TARGET_CELL_PX / cellPx))
      cam.setBounds(0, 0, width, height)
      cam.startFollow(this.follow, false, 0.1, 0.1)
      if (!this.minimap) {
        const { width: w, height: h, margin } = MINIMAP
        this.minimap = this.cameras
          .add(width - w - margin, height - h - margin, w, h)
          .setZoom(w / width)
          .setBackgroundColor(COLORS.surface)
          .setAlpha(0.9)
        this.minimap.centerOn(width / 2, height / 2)
        this.minimap.ignore([...this.labels.values()])
      }
    } else {
      cam.stopFollow()
      cam.removeBounds()
      cam.setZoom(1)
      cam.centerOn(width / 2, height / 2)
      if (this.minimap) {
        this.cameras.remove(this.minimap)
        this.minimap = null
      }
    }
  }

  // La etiqueta de nombre se crea una vez por serpiente; después solo se mueve
  private labelFor(s: Snake): Phaser.GameObjects.Text {
    let label = this.labels.get(s.id)
    if (!label) {
      const text = s.isPlayer ? 'Tú' : s.tag.level > 0 ? `${s.tag.name} · Nv.${s.tag.level}` : s.tag.name
      label = this.add
        .text(0, 0, text, { fontFamily: 'Inter, sans-serif', fontSize: '12px', fontStyle: '600', color: hex(s.color.body) })
        .setOrigin(0.5, 1)
        .setDepth(10)
      this.minimap?.ignore(label)
      this.labels.set(s.id, label)
    }
    return label
  }

  // ---------- Partida en línea ----------

  // Girar: sin conexión se gira aquí mismo; en línea se le pide al servidor
  private steer(d: Cell) {
    if (!this.online) {
      this.player.turn(d)
      return
    }
    if (!this.player.alive) return
    const i = DIR_CELLS.findIndex((c) => c.x === d.x && c.y === d.y)
    if (i >= 0) girar(i as DirIndex)
  }

  private setupNet() {
    const socket = getSocket()
    const onState = (st: StatePayload) => this.applyState(st)
    const onRoster = (r: RosterEntry[]) => this.applyRoster(r)
    const onFeed = (f: FeedMsg) => this.feed(f.text, f.ids.includes(online.you))
    const onEvent = (e: GameEvent) => this.applyEvent(e)
    socket.on('estado', onState)
    socket.on('roster', onRoster)
    socket.on('feed', onFeed)
    socket.on('evento', onEvent)
    socket.emit('sync') // pide la lista de jugadores y el estado actual
    this.onExit(() => {
      socket.off('estado', onState)
      socket.off('roster', onRoster)
      socket.off('feed', onFeed)
      socket.off('evento', onEvent)
    })
  }

  private applyRoster(list: RosterEntry[]) {
    this.roster.clear()
    for (const r of list) this.roster.set(r.id, r)
    for (const [id, s] of this.remote) {
      const r = this.roster.get(id)
      if (!r) continue
      s.color = { ...r.colors }
      if (s.tag.name !== r.name) {
        // Llegó el estado antes que la lista de jugadores: ahora se pone el nombre de verdad
        s.tag = { name: r.name, country: r.country, level: r.bot ? r.level : 0 }
        this.labels.get(s.id)?.destroy()
        this.labels.delete(s.id)
      } else {
        this.labels.get(s.id)?.setColor(hex(s.color.body))
      }
    }
    this.emitLeaderboard()
  }

  private applyState(st: StatePayload) {
    const seen = new Set<number>()
    for (const row of st.s) {
      const id = row[0]
      seen.add(id)
      const cells: Cell[] = []
      for (let i = 4; i < row.length; i++) cells.push({ x: row[i] % COLS, y: Math.floor(row[i] / COLS) })
      if (cells.length === 0) continue

      let s: Snake
      if (id === online.you) {
        s = this.player
        if (this.playerServerId !== id) {
          // Serpiente nueva (al entrar o al reaparecer): sin movimiento suave desde la anterior
          this.playerServerId = id
          s.cells = cells
          s.prevTail = null
          s.alive = true
        }
      } else {
        let found = this.remote.get(id)
        if (!found) {
          const r = this.roster.get(id)
          const tag = r ? { name: r.name, country: r.country, level: r.bot ? r.level : 0 } : { name: '…', country: '', level: 0 }
          const color = r ? { ...r.colors } : colorsFromBase(COLORS.bots[id % COLORS.bots.length])
          found = new Snake(tag, color, cells[cells.length - 1], DIRS.right, 1, false)
          found.cells = cells
          this.remote.set(id, found)
        }
        s = found
      }
      // Movimiento suave: la cola anterior permite dibujar el paso a medio camino
      if (s.cells !== cells) {
        const oldTail = s.cells[0]
        const oldHead = s.cells[s.cells.length - 1]
        const head = cells[cells.length - 1]
        s.prevTail = oldHead.x !== head.x || oldHead.y !== head.y ? oldTail : null
        s.cells = cells
      }
      s.dir = DIR_CELLS[row[1] & 3] ?? s.dir
      s.ghost = row[1] >= 4
      s.nextDir = s.dir
      s.score = row[2]
      s.kills = row[3]
    }

    // Las que ya no están murieron o salieron de la sala
    for (const [id, s] of this.remote) {
      if (seen.has(id)) continue
      explodeBody(this.burst, s.cells, s.color.body)
      this.labels.get(s.id)?.destroy()
      this.labels.delete(s.id)
      this.remote.delete(id)
    }
    this.bots = [...this.remote.values()]

    this.foods = st.f.map((v) => {
      const golden = v < 0
      const i = golden ? -v - 1 : v
      return { x: i % COLS, y: Math.floor(i / COLS), golden }
    })
    this.elapsed = 0
    this.renderFood()
    this.emitHud()
    this.emitLeaderboard()
  }

  private applyEvent(e: GameEvent) {
    if (e.type === 'eat') {
      this.player.foodsEaten++
      EventBus.emit(EVENTS.FOOD_EATEN, { puntos: e.puntos, dorada: e.dorada, total: e.total })
    } else if (e.type === 'kill') {
      EventBus.emit(EVENTS.BOT_KILLED, e.name)
    } else if (e.type === 'died') {
      this.gameOverOnline(e.stats)
    }
  }

  private gameOverOnline(st: DiedStats) {
    if (this.over) return
    this.over = true
    this.player.alive = false
    this.labels.get(this.player.id)?.destroy()
    this.labels.delete(this.player.id)
    const { score: puntos, length: tamano } = st
    EventBus.emit(
      EVENTS.SNAKE_DIED,
      st.killedBy ? { puntos, tamano, causa: 'jugador', eliminadoPor: st.killedBy } : { puntos, tamano, causa: st.causa === 'jugador' ? 'cuerpo' : st.causa },
    )
    const stats: GameOverStats = {
      mode: 'online',
      score: st.score,
      length: st.length,
      botsKilled: st.kills,
      foodsEaten: st.foodsEaten,
      durationMs: st.durationMs,
      killedBy: st.killedBy,
      rank: st.rank,
      players: st.players,
    }
    const data: GameOverData = { stats, body: [...this.player.cells], color: this.player.color.body }
    this.scene.launch('GameOverScene', data)
    this.scene.pause()
  }

  // ---------- Controles y comunicación con Vue ----------

  private setupInput() {
    const keys = this.input.keyboard!
    const bind = (names: string[], d: Cell) => names.forEach((k) => keys.on(`keydown-${k}`, () => this.steer(d)))
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
      if (Math.abs(dx) > Math.abs(dy)) this.steer(dx > 0 ? DIRS.right : DIRS.left)
      else this.steer(dy > 0 ? DIRS.down : DIRS.up)
    })
  }

  private setupEvents() {
    const onPause = () => (this.paused = true)
    const onResume = () => (this.paused = false)
    const onTurn = (d: Direction) => this.steer(DIRS[d])
    const onSkin = (skin: SkinChangedPayload) => this.applySkin(skin)
    EventBus.on(EVENTS.PAUSE, onPause)
    EventBus.on(EVENTS.RESUME, onResume)
    EventBus.on(EVENTS.TURN, onTurn)
    EventBus.on(EVENTS.SKIN_CHANGED, onSkin)
    this.onExit(() => {
      EventBus.off(EVENTS.PAUSE, onPause)
      EventBus.off(EVENTS.RESUME, onResume)
      EventBus.off(EVENTS.TURN, onTurn)
      EventBus.off(EVENTS.SKIN_CHANGED, onSkin)
    })
  }

  // Pinta al jugador con su skin al instante (también en pausa, sin reiniciar).
  // Los bots dejan de usar el color que más se parece al de la skin, para que nadie se confunda.
  private applySkin(skin: SkinChangedPayload) {
    this.player.color = colorsFromSkin(skin)
    if (this.online) {
      // Los demás jugadores verán tu skin; los colores de los otros los decide el servidor
      enviarSkin(this.player.color)
      this.labels.get(this.player.id)?.setColor(hex(this.player.color.body))
      this.emitLeaderboard()
      return
    }
    const avoid = closestColor(COLORS.bots, this.player.color.body)
    this.botPalette = COLORS.bots.filter((c) => c !== avoid)
    for (const bot of this.bots) {
      if (bot.color.body !== avoid) continue
      bot.color = colorsFromBase(this.botPalette[this.colorIndex++ % this.botPalette.length])
      this.labels.get(bot.id)?.setColor(hex(bot.color.body))
    }
    this.labels.get(this.player.id)?.setColor(hex(this.player.color.body))
    this.frozenDrawn = false // si está en pausa, se vuelve a dibujar una vez con los colores nuevos
    this.emitLeaderboard() // el punto de color del jugador en el ranking en vivo
  }

  // Si el navegador pierde el contexto WebGL (poca memoria, app en segundo plano), Vue avisa y ofrece reintentar
  private watchRenderer() {
    const canvas = this.game.canvas
    const onLost = () => EventBus.emit(EVENTS.RENDER_LOST)
    canvas.addEventListener('webglcontextlost', onLost)
    this.onExit(() => canvas.removeEventListener('webglcontextlost', onLost))
  }

  // Limpieza al salir de la escena. Al destruir el juego (Salir, Jugar otra vez) Phaser emite
  // "destroy" y no "shutdown": se escuchan los dos para no dejar oyentes colgados en el EventBus.
  private onExit(fn: () => void) {
    let done = false
    const once = () => {
      if (done) return
      done = true
      fn()
    }
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, once)
    this.events.once(Phaser.Scenes.Events.DESTROY, once)
  }

  private feed(text: string, mine = false) {
    EventBus.emit(EVENTS.FEED, { text, mine })
  }

  private emitHud() {
    EventBus.emit(EVENTS.SCORE_CHANGED, {
      score: this.player.score,
      length: this.player.length,
      botsKilled: this.player.kills,
    })
  }

  private rankingRows(): LeaderboardRow[] {
    const me = this.online && !this.player.alive && !this.over ? [] : [this.player]
    return [...me, ...this.bots.filter((b) => b.alive)]
      .map((s) => ({
        id: s.id,
        name: s.tag.name,
        country: s.tag.country,
        level: s.tag.level,
        score: s.score,
        color: hex(s.color.body),
        isPlayer: s.isPlayer,
      }))
      .sort((a, b) => b.score - a.score)
  }

  private emitLeaderboard() {
    if (this.rivals) EventBus.emit(EVENTS.LEADERBOARD, this.rankingRows())
  }
}
