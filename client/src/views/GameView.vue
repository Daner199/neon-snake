<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { api, ApiError } from '../api'
import GameCanvas from '../components/GameCanvas.vue'
import { EventBus } from '../game/EventBus'
import type { GameOverStats, LeaderboardRow } from '../game/scenes/ArenaScene'
import { sounds, unlockAudio } from '../sound'
import { useAuthStore } from '../stores/auth'
import { useGameStore } from '../stores/game'
import { useSettingsStore } from '../stores/settings'

type SaveStatus = 'idle' | 'saving' | 'saved' | 'guest' | 'error'

const route = useRoute()
const mode = route.params.modo === 'classic' ? 'classic' : 'arena'
const store = useGameStore()
const auth = useAuthStore()
const settings = useSettingsStore()
const paused = ref(false)
const saveStatus = ref<SaveStatus>('idle')
const saveMessage = ref('')

store.start(mode)

// Celular o ventana estrecha: HUD en una fila, píldora de puesto en vez del panel y feed abajo
const compactQuery = window.matchMedia('(pointer: coarse), (max-width: 767px)')
const compact = ref(compactQuery.matches)
const updateCompact = () => (compact.value = compactQuery.matches)

const playerRank = computed(() => store.leaderboard.findIndex((r) => r.isPlayer) + 1)
const playersText = computed(() => {
  const n = store.leaderboard.length
  return `${n} ${n === 1 ? 'jugador' : 'jugadores'}`
})
const feedItems = computed(() => (compact.value ? store.feed.slice(0, 2) : store.feed))

// Top 5 desplegable desde la píldora: se cierra al tocar otra vez o a los 3 segundos
const showTop = ref(false)
let topTimer: ReturnType<typeof setTimeout> | undefined
function toggleTop() {
  showTop.value = !showTop.value
  clearTimeout(topTimer)
  if (showTop.value) topTimer = setTimeout(() => (showTop.value = false), 3000)
}

// Guarda la partida en el servidor si hay sesión; los invitados no entran al ranking
async function saveGame(stats: GameOverStats) {
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

function togglePause() {
  if (store.gameOver) return
  paused.value = !paused.value
  EventBus.emit(paused.value ? 'pause' : 'resume')
}

function playAgain() {
  store.start(mode)
  paused.value = false
  saveStatus.value = 'idle'
  EventBus.emit('restart')
}

function turn(d: 'up' | 'down' | 'left' | 'right') {
  EventBus.emit('turn', d)
}

const formatTime = (ms: number) => {
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

const onScore = (hud: { score: number; length: number; botsKilled: number }) => {
  store.score = hud.score
  store.length = hud.length
  store.botsKilled = hud.botsKilled
}
const onLeaderboard = (rows: LeaderboardRow[]) => (store.leaderboard = rows)
const onFeed = (f: { text: string; mine: boolean }) => store.pushFeed(f.text, f.mine)
const onGameOver = (stats: GameOverStats) => {
  store.finish(stats)
  saveGame(stats)
}
const onKey = (e: KeyboardEvent) => {
  if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') togglePause()
  if (e.key === 'Enter' && store.gameOver) playAgain()
}

// Sonidos: Phaser avisa por el EventBus y aquí se reproducen si no está silenciado
const ifSound = (fn: () => void) => () => {
  if (!settings.muted) fn()
}
const onFoodEaten = (golden: boolean) => ifSound(golden ? sounds.golden : sounds.eat)()
const onBotKilled = ifSound(sounds.kill)
const onPlayerDied = ifSound(sounds.die)

onMounted(() => {
  EventBus.on('score-changed', onScore)
  EventBus.on('leaderboard', onLeaderboard)
  EventBus.on('feed', onFeed)
  EventBus.on('game-over', onGameOver)
  EventBus.on('food-eaten', onFoodEaten)
  EventBus.on('bot-killed', onBotKilled)
  EventBus.on('player-died', onPlayerDied)
  window.addEventListener('keydown', onKey)
  compactQuery.addEventListener('change', updateCompact)
  window.addEventListener('keydown', unlockAudio, { once: true })
  window.addEventListener('pointerdown', unlockAudio, { once: true })
})

onBeforeUnmount(() => {
  EventBus.off('score-changed', onScore)
  EventBus.off('leaderboard', onLeaderboard)
  EventBus.off('feed', onFeed)
  EventBus.off('game-over', onGameOver)
  EventBus.off('food-eaten', onFoodEaten)
  EventBus.off('bot-killed', onBotKilled)
  EventBus.off('player-died', onPlayerDied)
  window.removeEventListener('keydown', onKey)
  compactQuery.removeEventListener('change', updateCompact)
  clearTimeout(topTimer)
  window.removeEventListener('keydown', unlockAudio)
  window.removeEventListener('pointerdown', unlockAudio)
})
</script>

<template>
  <div class="juego" :class="{ compacto: compact }">
    <header class="hud">
      <div class="marcador">
        <div><span>PUNTOS</span><strong>{{ store.score }}</strong></div>
        <template v-if="mode === 'arena'">
          <div><span>ELIMINADOS</span><strong class="rosa">{{ store.botsKilled }}</strong></div>
          <div><span>SERPIENTES</span><strong class="blanco">{{ store.leaderboard.length }}</strong></div>
          <div v-if="compact"><span>PUESTO</span><strong class="oro">{{ playerRank }}</strong></div>
        </template>
        <div v-else><span>TAMAÑO</span><strong class="blanco">{{ store.length }}</strong></div>
        <div v-if="!compact || mode === 'classic'"><span>RÉCORD</span><strong class="oro">{{ store.bestScore }}</strong></div>
      </div>
      <div class="acciones">
        <button
          class="btn sonido"
          type="button"
          :aria-label="settings.muted ? 'Activar sonido' : 'Silenciar'"
          :aria-pressed="settings.muted"
          :title="settings.muted ? 'Activar sonido' : 'Silenciar'"
          @click="settings.toggleMute()"
        >
          {{ settings.muted ? '🔇' : '🔊' }}
        </button>
        <button class="btn" type="button" :aria-label="paused ? 'Continuar' : 'Pausar'" @click="togglePause">
          {{ compact ? (paused ? '▶' : '⏸') : paused ? 'Continuar' : 'Pausa' }}
        </button>
        <RouterLink class="btn" to="/" aria-label="Salir">{{ compact ? '✕' : 'Salir' }}</RouterLink>
      </div>
    </header>

    <div class="escenario">
      <GameCanvas :mode="mode" />

      <TransitionGroup tag="ul" name="feed" class="feed" :class="{ abajo: compact }" aria-live="polite">
        <li v-for="f in feedItems" :key="f.id" :class="{ mio: f.mine }">{{ f.text }}</li>
      </TransitionGroup>

      <div v-if="mode === 'arena' && compact" class="puesto">
        <button class="pildora" type="button" :aria-expanded="showTop" @click="toggleTop">
          Puesto {{ playerRank }} de {{ store.leaderboard.length }}
        </button>
        <ol v-if="showTop" class="top5" aria-label="Top 5 de la arena">
          <li v-for="(r, i) in store.leaderboard.slice(0, 5)" :key="r.id" :class="{ yo: r.isPlayer }">
            <span class="pos">{{ i + 1 }}</span>
            <span class="punto" :style="{ background: r.color }"></span>
            <span class="nombre">{{ r.name }}</span>
            <span class="pts">{{ r.score }}</span>
          </li>
        </ol>
      </div>

      <aside v-if="mode === 'arena' && !compact" class="ranking" aria-label="Ranking de la arena">
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

      <div v-if="paused && !store.gameOver" class="capa">
        <div class="tarjeta">
          <h2 class="titulo-capa">PAUSA</h2>
          <button class="btn btn--primario" type="button" @click="togglePause">Continuar</button>
          <button class="btn" type="button" :aria-pressed="settings.muted" @click="settings.toggleMute()">
            {{ settings.muted ? '🔇 Sonido apagado' : '🔊 Sonido encendido' }}
          </button>
          <RouterLink class="btn" to="/">Salir al menú</RouterLink>
        </div>
      </div>

      <div v-if="store.gameOver" class="capa">
        <div class="tarjeta" role="dialog" aria-labelledby="go-titulo">
          <h2 id="go-titulo" class="titulo-capa rosa">GAME OVER</h2>
          <p class="motivo">
            {{ store.gameOver.killedBy ? `Te eliminó ${store.gameOver.killedBy}` : 'Chocaste' }}
          </p>
          <p class="puntos">{{ store.gameOver.score }}</p>
          <p v-if="store.newRecord" class="record">¡Nuevo récord!</p>
          <p v-else class="suave">Tu récord: {{ store.bestScore }}</p>
          <p v-if="saveStatus === 'guest'" class="aviso">
            <RouterLink to="/login">Inicia sesión</RouterLink> para entrar al ranking
          </p>
          <p v-else-if="saveStatus !== 'idle'" class="aviso" :class="{ 'aviso--error': saveStatus === 'error' }" role="status">
            {{ saveMessage }}
          </p>
          <div class="stats">
            <div><strong>{{ store.gameOver.length }}</strong><span>Tamaño final</span></div>
            <div v-if="mode === 'arena'"><strong class="rosa">{{ store.gameOver.botsKilled }}</strong><span>Jugadores eliminados</span></div>
            <div><strong>{{ formatTime(store.gameOver.durationMs) }}</strong><span>Tiempo</span></div>
            <div v-if="mode === 'arena'"><strong>{{ store.gameOver.rank }}.º / {{ store.gameOver.players }}</strong><span>En la arena</span></div>
          </div>
          <button class="btn btn--primario grande" type="button" @click="playAgain">Jugar otra vez</button>
          <div class="fila">
            <RouterLink class="btn" to="/ranking">Ver ranking</RouterLink>
            <RouterLink class="btn" to="/">Menú</RouterLink>
          </div>
        </div>
      </div>
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
.hud {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
}
.marcador,
.acciones {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  align-items: center;
}
.acciones {
  gap: 8px;
}
.marcador div {
  display: flex;
  flex-direction: column;
}
.marcador span {
  font-size: 12px;
  color: var(--color-texto-suave);
}
.marcador strong {
  font-family: var(--fuente-titulo);
  font-size: 18px;
  color: var(--color-primario);
}
.blanco {
  color: var(--color-texto) !important;
}
.rosa {
  color: var(--color-peligro) !important;
}
.oro {
  color: var(--color-oro) !important;
}
.hud .btn {
  min-height: 44px;
}
.hud .sonido {
  width: 44px;
  padding: 0;
  font-size: 18px;
}
/* HUD compacto: una sola fila */
.compacto .hud {
  flex-wrap: nowrap;
  gap: 8px;
  padding: 6px 10px;
}
.compacto .marcador {
  flex-wrap: nowrap;
  gap: 14px;
  min-width: 0;
}
.compacto .marcador span {
  font-size: 9px;
  letter-spacing: 0.5px;
}
.compacto .marcador strong {
  font-size: 13px;
}
.compacto .acciones {
  flex-wrap: nowrap;
  gap: 6px;
}
.compacto .hud .btn {
  min-height: 36px;
  height: 36px;
  min-width: 36px;
  padding: 0 10px;
  font-size: 14px;
}
.compacto .hud .sonido {
  width: 36px;
  padding: 0;
  font-size: 15px;
}
.escenario {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
.feed {
  position: absolute;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
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
  top: auto;
  bottom: 8px;
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
.puesto {
  position: absolute;
  top: 8px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 5;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.pildora {
  min-height: 32px;
  padding: 0 14px;
  border-radius: 999px;
  border: 1px solid var(--color-borde);
  background: color-mix(in srgb, var(--color-superficie) 88%, transparent);
  color: var(--color-texto);
  font: 600 13px var(--fuente-cuerpo);
  white-space: nowrap;
  cursor: pointer;
}
.top5 {
  margin: 6px 0 0;
  padding: 6px;
  min-width: 210px;
  list-style: none;
  border-radius: 12px;
  border: 1px solid var(--color-borde);
  background: color-mix(in srgb, var(--color-superficie) 94%, transparent);
}
.top5 li {
  font-size: 13px;
}
.ranking ol {
  margin: 0;
  padding: 0;
  list-style: none;
}
.ranking li,
.top5 li {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  border-radius: 8px;
  font-size: 14px;
}
.ranking li.yo,
.top5 li.yo {
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
.capa {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--color-fondo) 70%, transparent);
  backdrop-filter: blur(3px);
  padding: 16px;
  overflow-y: auto;
  touch-action: pan-y;
}
.tarjeta {
  width: min(520px, 100%);
  padding: 32px;
  border-radius: 22px;
  background: var(--color-superficie);
  border: 1px solid var(--color-borde);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  text-align: center;
}
.titulo-capa {
  margin: 0;
  font-family: var(--fuente-titulo);
  font-size: 28px;
  color: var(--color-primario);
}
.motivo,
.suave {
  margin: 0;
  color: var(--color-texto-suave);
}
.puntos {
  margin: 0;
  font-family: var(--fuente-titulo);
  font-size: 40px;
  color: var(--color-primario);
}
.record {
  margin: 0;
  font-weight: 700;
  color: var(--color-oro);
}
.aviso {
  margin: 0;
  padding: 8px 14px;
  border-radius: 10px;
  border: 1px solid var(--color-borde);
  background: var(--color-fondo);
  font-size: 14px;
  font-weight: 600;
}
.aviso--error {
  border-color: var(--color-peligro);
  color: var(--color-peligro);
}
.stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(90px, 1fr));
  gap: 10px;
  width: 100%;
}
.stats div {
  padding: 10px;
  border-radius: 12px;
  background: var(--color-fondo);
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.stats span {
  font-size: 12px;
  color: var(--color-texto-suave);
}
.grande {
  width: 100%;
  min-height: 56px;
  font-size: 18px;
}
.fila {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  width: 100%;
}
.tarjeta > .btn:not(.grande) {
  width: 100%;
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
/* Celular en horizontal: la cruceta flota en una esquina para no quitar altura al tablero */
@media (pointer: coarse) and (orientation: landscape) {
  .cruceta {
    position: absolute;
    right: max(12px, env(safe-area-inset-right));
    bottom: 8px;
    padding: 0;
    opacity: 0.85;
  }
  .cruceta div {
    gap: 52px;
  }
  .cruceta .btn {
    width: 52px;
    height: 52px;
  }
}
</style>
