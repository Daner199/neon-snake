<script setup lang="ts">
// Pantalla de juego: arma la pantalla (lienzo de Phaser, HUD, mensajes, pausa y Game Over),
// escucha el EventBus y pasa los datos a Pinia y a los componentes. No toca nada de Phaser.
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { api, ApiError } from '../api'
import AvisoSkin from '../components/AvisoSkin.vue'
import GameCanvas from '../components/GameCanvas.vue'
import HudJuego from '../components/HudJuego.vue'
import MenuPausa from '../components/MenuPausa.vue'
import PantallaGameOver, { type SaveStatus } from '../components/PantallaGameOver.vue'
import { buscarModo, MODOS } from '../data'
import { EventBus, EVENTS } from '../events/EventBus'
import type {
  Direction,
  FeedPayload,
  FoodEatenPayload,
  GameOverStats,
  LeaderboardRow,
  ScorePayload,
  SnakeDiedPayload,
} from '../events/names'
import { colorsFromSkin } from '../game/colors'
import { nombreGuardado, online, reaparecer, salir, unirse } from '../online/session'
import { enterGameScreen, leaveGameScreen } from '../screen'
import { sounds } from '../sound'
import { useAuthStore } from '../stores/auth'
import { useGameStore } from '../stores/game'
import { useSettingsStore } from '../stores/settings'
import { useSkinsStore } from '../stores/skins'

const route = useRoute()
// En línea (/online/K7Q2): el servidor mueve la partida; las reglas son las del modo Arena
const enLinea = route.name === 'online-partida'
const codigo = String(route.params.codigo ?? '').toUpperCase()
// El router ya comprobó que el modo existe en src/data/modos.json
const modo = enLinea ? buscarModo('arena')! : (buscarModo(route.params.modo) ?? MODOS[0])
const mode = enLinea ? 'online' : modo.id
const conRivales = enLinea || modo.jugadores > 0
const store = useGameStore()
const auth = useAuthStore()
const settings = useSettingsStore()
const skins = useSkinsStore()
const paused = ref(false)
// Entrada a la sala en línea
const conexion = ref<'conectando' | 'lista' | 'error'>(enLinea ? 'conectando' : 'lista')
const conexionError = ref('')
const copiado = ref(false)
const saveStatus = ref<SaveStatus>('idle')
const saveMessage = ref('')

store.start(mode)
skins.limpiarNuevas()

// Celular o ventana estrecha: HUD en una fila, píldora de puesto en vez del panel y feed abajo
const compactQuery = window.matchMedia('(pointer: coarse), (max-width: 767px)')
const compact = ref(compactQuery.matches)
const updateCompact = () => (compact.value = compactQuery.matches)

// En pantallas táctiles la partida se juega en horizontal: en vertical se pausa y se pide girar
const touchQuery = window.matchMedia('(pointer: coarse)')
const portraitQuery = window.matchMedia('(orientation: portrait)')
const touch = ref(touchQuery.matches)
const portrait = ref(portraitQuery.matches)
const mustRotate = computed(() => touch.value && portrait.value)
const landscapeTouch = computed(() => touch.value && !portrait.value)
function updateOrientation() {
  touch.value = touchQuery.matches
  portrait.value = portraitQuery.matches
  if (mustRotate.value) pauseGame()
}

const playersText = computed(() => {
  const n = store.leaderboard.length
  return `${n} ${n === 1 ? 'jugador' : 'jugadores'}`
})
const feedItems = computed(() => (compact.value ? store.feed.slice(0, 2) : store.feed))

// En línea el servidor guarda la partida él solo; aquí se muestra cómo quedó
const SAVE_ONLINE: Record<string, [SaveStatus, string]> = {
  invitado: ['guest', ''],
  guardando: ['saving', 'Guardando partida…'],
  guardada: ['saved', 'Partida guardada'],
  error: ['error', 'No se pudo guardar la partida'],
  'muy-corta': ['saved', 'La partida fue muy corta para el ranking'],
}
watch(
  () => [online.guardada, online.position] as const,
  ([g, pos]) => {
    if (!enLinea || !g || !store.gameOver) return
    const [status, text] = SAVE_ONLINE[g]
    saveStatus.value = status
    saveMessage.value = g === 'guardada' && pos ? `Partida guardada · Puesto ${pos}.º en el ranking En línea` : text
  },
)

// Guarda la partida en el servidor si hay sesión; los invitados no entran al ranking
async function saveGame(stats: GameOverStats) {
  if (enLinea) {
    const g = online.guardada ?? 'guardando'
    const [status, text] = SAVE_ONLINE[g]
    saveStatus.value = status
    saveMessage.value = g === 'guardada' && online.position ? `Partida guardada · Puesto ${online.position}.º en el ranking En línea` : text
    return
  }
  if (!auth.loggedIn) {
    saveStatus.value = 'guest'
    return
  }
  saveStatus.value = 'saving'
  saveMessage.value = 'Guardando partida…'
  try {
    const result = await api<{ position: number | null }>('/sessions', {
      method: 'POST',
      token: auth.token,
      body: {
        mode: stats.mode,
        score: stats.score,
        length: stats.length,
        botsKilled: stats.botsKilled,
        foodsEaten: stats.foodsEaten,
        durationMs: stats.durationMs,
      },
    })
    saveStatus.value = 'saved'
    saveMessage.value = result.position
      ? `Partida guardada · Puesto ${result.position}.º en el ranking`
      : 'Partida guardada'
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) {
      auth.logout()
      saveStatus.value = 'guest'
      return
    }
    saveStatus.value = 'error'
    saveMessage.value = e instanceof Error ? e.message : 'No se pudo guardar la partida'
  }
}

function pauseGame() {
  if (store.gameOver || paused.value) return
  if (enLinea) {
    paused.value = true // en línea no se pausa el mundo: solo se abre el menú
    return
  }
  paused.value = true
  EventBus.emit(EVENTS.PAUSE)
}

function togglePause() {
  if (store.gameOver) return
  paused.value = !paused.value
  if (!enLinea) EventBus.emit(paused.value ? EVENTS.PAUSE : EVENTS.RESUME)
}

// "Jugar otra vez" crea el juego de cero (como al entrar desde el menú), cambiando la key de GameCanvas.
// Reiniciar la escena de Phaser podía dejar la partida parada en el celular al cambiar a pantalla completa.
const round = ref(0)
async function playAgain() {
  if (enLinea) {
    // Otra serpiente en la misma sala
    try {
      await reaparecer()
    } catch (e) {
      saveStatus.value = 'error'
      saveMessage.value = e instanceof Error ? e.message : 'No se pudo volver a entrar'
      return
    }
  }
  enterGameScreen()
  store.start(mode)
  skins.limpiarNuevas()
  paused.value = false
  saveStatus.value = 'idle'
  round.value++
}

function turn(d: Direction) {
  EventBus.emit(EVENTS.TURN, d)
}

// La skin elegida llega a Phaser solo por evento: al estar lista la escena y cada vez que se elige otra
// (desde la pausa o con "Usarla" en el Game Over)
function sendSkin() {
  const { id, colorCabeza, colorCuerpo, colorFranja, colorBrillo } = skins.skinActual
  EventBus.emit(EVENTS.SKIN_CHANGED, { id, colorCabeza, colorCuerpo, colorFranja, colorBrillo })
}
watch(() => skins.elegida, sendSkin)

// ---------- Lo que avisa Phaser ----------

// Al terminar create() la escena pide la skin; si arranca con la partida ya pausada (celular en vertical), se lo recuerda
const onSceneReady = () => {
  sendSkin()
  if (paused.value && !enLinea) EventBus.emit(EVENTS.PAUSE)
}

// ---------- En línea ----------

async function entrarSala() {
  conexion.value = 'conectando'
  conexionError.value = ''
  const { colorCabeza, colorCuerpo, colorFranja, colorBrillo } = skins.skinActual
  const colors = colorsFromSkin({ colorCabeza, colorCuerpo, colorFranja, colorBrillo })
  try {
    await unirse(codigo, auth.user?.username ?? nombreGuardado(), colors, auth.token)
    conexion.value = 'lista'
  } catch (e) {
    conexion.value = 'error'
    conexionError.value = e instanceof Error ? e.message : 'No se pudo entrar a la sala'
  }
}

// Enlace para invitar: quien lo abre entra directo a esta sala
async function copiarEnlace() {
  const url = `${location.origin}/online/${codigo}`
  try {
    if (navigator.share && touch.value) await navigator.share({ title: 'Neon Snake', text: `¡Entra a mi sala ${codigo}!`, url })
    else await navigator.clipboard.writeText(url)
    copiado.value = true
    setTimeout(() => (copiado.value = false), 2000)
  } catch {
    // el jugador canceló o el navegador no deja copiar: el código sigue a la vista
  }
}
const onScore = (hud: ScorePayload) => {
  store.score = hud.score
  store.length = hud.length
  store.botsKilled = hud.botsKilled
  skins.comprobar(hud.score)
}
const onLeaderboard = (rows: LeaderboardRow[]) => (store.leaderboard = rows)
const onFeed = (f: FeedPayload) => store.pushFeed(f.text, f.mine)
const onGameOver = (stats: GameOverStats) => {
  store.finish(stats)
  saveGame(stats)
}

// Sonidos: Phaser avisa por el EventBus y aquí se reproducen si no está silenciado
const ifSound = (fn: () => void) => () => {
  if (!settings.muted) fn()
}
const onFoodEaten = (e: FoodEatenPayload) => ifSound(e.dorada ? sounds.golden : sounds.eat)()
const onBotKilled = ifSound(sounds.kill)
const onSnakeDied = (e: SnakeDiedPayload) => {
  store.muerte = e
  ifSound(sounds.die)()
}

const onKey = (e: KeyboardEvent) => {
  if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') togglePause()
  if (e.key === 'Enter' && store.gameOver) void playAgain()
}

if (mustRotate.value) paused.value = true

onMounted(() => {
  if (enLinea) entrarSala()
  EventBus.on(EVENTS.SCENE_READY, onSceneReady)
  EventBus.on(EVENTS.SCORE_CHANGED, onScore)
  EventBus.on(EVENTS.LEADERBOARD, onLeaderboard)
  EventBus.on(EVENTS.FEED, onFeed)
  EventBus.on(EVENTS.GAME_OVER, onGameOver)
  EventBus.on(EVENTS.FOOD_EATEN, onFoodEaten)
  EventBus.on(EVENTS.BOT_KILLED, onBotKilled)
  EventBus.on(EVENTS.SNAKE_DIED, onSnakeDied)
  window.addEventListener('keydown', onKey)
  compactQuery.addEventListener('change', updateCompact)
  touchQuery.addEventListener('change', updateOrientation)
  portraitQuery.addEventListener('change', updateOrientation)
})

onBeforeUnmount(() => {
  leaveGameScreen()
  if (enLinea) salir()
  EventBus.off(EVENTS.SCENE_READY, onSceneReady)
  EventBus.off(EVENTS.SCORE_CHANGED, onScore)
  EventBus.off(EVENTS.LEADERBOARD, onLeaderboard)
  EventBus.off(EVENTS.FEED, onFeed)
  EventBus.off(EVENTS.GAME_OVER, onGameOver)
  EventBus.off(EVENTS.FOOD_EATEN, onFoodEaten)
  EventBus.off(EVENTS.BOT_KILLED, onBotKilled)
  EventBus.off(EVENTS.SNAKE_DIED, onSnakeDied)
  window.removeEventListener('keydown', onKey)
  compactQuery.removeEventListener('change', updateCompact)
  touchQuery.removeEventListener('change', updateOrientation)
  portraitQuery.removeEventListener('change', updateOrientation)
})
</script>

<template>
  <div class="juego" :class="{ compacto: compact, horizontal: landscapeTouch }">
    <HudJuego :con-rivales="conRivales" :compact="compact" :paused="paused" @pausa="togglePause" />

    <div class="escenario">
      <GameCanvas v-if="conexion === 'lista'" :key="round" :mode="mode" :online="enLinea" />

      <!-- En línea: código de la sala (para invitar), ping y estado de la conexión -->
      <div v-if="enLinea" class="sala" :class="{ 'sala--compacta': compact }">
        <button class="sala__codigo" type="button" :title="'Copiar enlace de la sala'" @click="copiarEnlace">
          <span class="sala__etiqueta">SALA</span> {{ codigo }}
          <span class="sala__copiar">{{ copiado ? '¡Copiado!' : 'Invitar' }}</span>
        </button>
        <span v-if="online.joined && online.connected" class="ping" :class="{ alto: online.ping > 150 }">{{ online.ping }} ms</span>
        <span v-if="online.reconnecting" class="ping alto">Reconectando…</span>
      </div>
      <div v-if="conexion !== 'lista'" class="conexion" role="status">
        <img src="/logo.svg" alt="" width="64" height="64" />
        <template v-if="conexion === 'conectando'">
          <p>Entrando a la sala {{ codigo }}…</p>
          <p class="suave">Si el servidor estaba dormido, puede tardar hasta un minuto.</p>
        </template>
        <template v-else>
          <p>{{ conexionError }}</p>
          <div class="fila-botones">
            <button class="btn btn--primario" type="button" @click="entrarSala">Reintentar</button>
            <RouterLink class="btn" to="/online">Otras salas</RouterLink>
          </div>
        </template>
      </div>

      <!-- Arriba al centro: aviso de skin nueva y, en PC, los mensajes de la partida -->
      <div class="arriba" :class="{ 'bajo-pildora': conRivales && compact && !landscapeTouch }">
        <AvisoSkin />
        <TransitionGroup v-if="!compact" tag="ul" name="feed" class="feed" aria-live="polite">
          <li v-for="f in feedItems" :key="f.id" :class="{ mio: f.mine }">{{ f.text }}</li>
        </TransitionGroup>
      </div>
      <TransitionGroup v-if="compact" tag="ul" name="feed" class="feed abajo" aria-live="polite">
        <li v-for="f in feedItems" :key="f.id" :class="{ mio: f.mine }">{{ f.text }}</li>
      </TransitionGroup>

      <aside v-if="conRivales && !compact" class="ranking" aria-label="Ranking de la arena">
        <h2>EN ESTA ARENA <span class="cuantos">· {{ playersText }}</span></h2>
        <ol>
          <li v-for="(r, i) in store.leaderboard.slice(0, 8)" :key="r.id" :class="{ yo: r.isPlayer }">
            <span class="pos">{{ i + 1 }}</span>
            <span class="punto" :style="{ background: r.color }"></span>
            <span class="nombre">{{ r.name }}</span>
            <span v-if="!r.isPlayer" class="pais">{{ r.country }}</span>
            <span class="pts">{{ r.score }}</span>
          </li>
        </ol>
      </aside>

      <MenuPausa v-if="paused && !store.gameOver" :en-linea="enLinea" @continuar="togglePause" />
      <PantallaGameOver
        :con-rivales="conRivales"
        :save-status="saveStatus"
        :save-message="saveMessage"
        @jugar-otra-vez="playAgain"
      />
    </div>

    <div v-if="mustRotate" class="girar" role="alert">
      <span class="movil" aria-hidden="true"></span>
      <p>Gira tu celular para jugar</p>
    </div>

    <div class="cruceta" aria-label="Controles táctiles">
      <button class="btn" type="button" aria-label="Arriba" @pointerdown.prevent="turn('up')">▲</button>
      <div>
        <button class="btn" type="button" aria-label="Izquierda" @pointerdown.prevent="turn('left')">◀</button>
        <button class="btn" type="button" aria-label="Derecha" @pointerdown.prevent="turn('right')">▶</button>
      </div>
      <button class="btn" type="button" aria-label="Abajo" @pointerdown.prevent="turn('down')">▼</button>
    </div>
  </div>
</template>

<style scoped>
.juego {
  height: 100vh;
  height: 100dvh;
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
  overscroll-behavior: none;
  /* En el celular: sin zoom con doble toque ni arrastrar la página */
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
}
.escenario {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
.arriba {
  position: absolute;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 4;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  pointer-events: none;
}
.arriba.bajo-pildora {
  top: 48px;
}
.feed {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  pointer-events: none;
}
.feed li {
  padding: 6px 16px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--color-superficie) 85%, transparent);
  border: 1px solid var(--color-borde);
  font-size: 14px;
  white-space: nowrap;
}
.feed li.mio {
  border-color: var(--color-peligro);
  font-weight: 700;
}
.feed.abajo {
  position: absolute;
  bottom: 8px;
  left: 50%;
  transform: translateX(-50%);
  gap: 4px;
}
.feed.abajo li {
  padding: 3px 10px;
  font-size: 11px;
}
.feed-enter-from,
.feed-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
.feed-enter-active,
.feed-leave-active {
  transition: all 0.25s ease;
}
.ranking {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 250px;
  padding: 14px;
  border-radius: 14px;
  background: color-mix(in srgb, var(--color-superficie) 85%, transparent);
  border: 1px solid var(--color-borde);
}
.ranking h2 {
  margin: 0 0 8px;
  font-size: 12px;
  letter-spacing: 1px;
  color: var(--color-texto-suave);
}
.cuantos {
  letter-spacing: 0;
  font-weight: 400;
}
.ranking ol {
  margin: 0;
  padding: 0;
  list-style: none;
}
.ranking li {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  border-radius: 8px;
  font-size: 14px;
}
.ranking li.yo {
  background: color-mix(in srgb, var(--color-primario) 14%, transparent);
  font-weight: 700;
}
.pos {
  width: 16px;
  color: var(--color-texto-suave);
}
.punto {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}
.nombre {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pais {
  font-size: 11px;
  color: var(--color-texto-suave);
}
.pts {
  font-variant-numeric: tabular-nums;
}
.cruceta {
  display: none;
}
@media (pointer: coarse) {
  .cruceta {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 8px 0 max(16px, env(safe-area-inset-bottom));
  }
  .cruceta div {
    display: flex;
    gap: 64px;
  }
  .cruceta .btn {
    width: 64px;
    height: 64px;
    touch-action: none;
    padding: 0;
    font-size: 20px;
  }
}
/* Celular en horizontal: el tablero ocupa toda la altura y los controles van en los márgenes */
.horizontal .escenario {
  position: absolute;
  inset: 0;
}
.horizontal .cruceta {
  position: absolute;
  left: max(10px, env(safe-area-inset-left));
  bottom: max(8px, env(safe-area-inset-bottom));
  z-index: 6;
  padding: 0;
  opacity: 0.55;
}
.horizontal .cruceta div {
  gap: 48px;
}
.horizontal .cruceta .btn {
  width: 48px;
  height: 48px;
  font-size: 16px;
}
/* En línea: código de la sala y ping, arriba a la izquierda */
.sala {
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 4;
  display: flex;
  align-items: center;
  gap: 8px;
}
.sala__codigo {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px 6px 12px;
  border-radius: 999px;
  border: 1px solid var(--color-borde);
  background: color-mix(in srgb, var(--color-superficie) 85%, transparent);
  color: var(--color-primario);
  font: 400 13px var(--fuente-titulo);
  cursor: pointer;
}
.sala__etiqueta {
  font: 600 11px var(--fuente-cuerpo);
  letter-spacing: 1px;
  color: var(--color-texto-suave);
}
.sala__copiar {
  padding: 3px 10px;
  border-radius: 999px;
  background: var(--color-primario);
  color: var(--color-fondo);
  font: 700 12px var(--fuente-cuerpo);
}
.ping {
  padding: 4px 10px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--color-superficie) 85%, transparent);
  border: 1px solid var(--color-borde);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  color: var(--color-primario);
}
.ping.alto {
  color: var(--color-oro);
}
.sala--compacta {
  top: auto;
  bottom: 8px;
  left: auto;
  right: 8px;
}
.sala--compacta .sala__codigo {
  font-size: 11px;
  padding: 4px 6px 4px 10px;
}
.conexion {
  position: absolute;
  inset: 0;
  z-index: 7;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 24px;
  background: var(--color-fondo);
  text-align: center;
}
.conexion p {
  margin: 0;
}
.conexion .suave {
  color: var(--color-texto-suave);
  font-size: 14px;
}
.fila-botones {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 12px;
}
/* Aviso para girar el celular: cubre todo y la partida queda en pausa */
.girar {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 24px;
  padding: 24px;
  background: var(--color-fondo);
  text-align: center;
}
.girar p {
  margin: 0;
  font-family: var(--fuente-titulo);
  font-size: 16px;
  line-height: 1.6;
  color: var(--color-primario);
}
.movil {
  width: 56px;
  height: 92px;
  border: 4px solid var(--color-primario);
  border-radius: 12px;
  box-shadow: 0 0 18px color-mix(in srgb, var(--color-primario) 50%, transparent);
  animation: girar 2s ease-in-out infinite;
}
@keyframes girar {
  0%,
  20% {
    transform: rotate(0deg);
  }
  60%,
  100% {
    transform: rotate(-90deg);
  }
}
@media (prefers-reduced-motion: reduce) {
  .movil {
    animation: none;
    transform: rotate(-90deg);
  }
}
</style>
