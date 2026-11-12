<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { EventBus, EVENTS } from '../events/EventBus'

// Lo único que Vue necesita del juego: poder destruirlo. Phaser se carga aparte con import() al jugar.
type GameHandle = { destroy(removeCanvas: boolean): void }

// Si el juego no arranca en este tiempo (WebGL bloqueado, poca memoria...), se avisa y se ofrece reintentar
const START_TIMEOUT_MS = 8000

const props = defineProps<{ mode: string }>()
let game: GameHandle | null = null
let unmounted = false
let timer: ReturnType<typeof setTimeout> | undefined
const loading = ref(true)
const failed = ref(false)

const onReady = () => {
  loading.value = false
  failed.value = false
  clearTimeout(timer)
}

// El contexto gráfico se perdió a mitad de partida: mismo aviso, con Reintentar
const onRenderLost = () => {
  clearTimeout(timer)
  loading.value = true
  failed.value = true
}

async function start() {
  loading.value = true
  failed.value = false
  clearTimeout(timer)
  timer = setTimeout(() => (failed.value = loading.value), START_TIMEOUT_MS)
  try {
    // Phaser se descarga aparte: mientras tanto se ve la pantalla de carga
    const { createGame } = await import('../game/config')
    if (unmounted) return
    // Al reintentar, el juego anterior puede no terminar de destruirse (su bucle se paró): se quita su lienzo
    game?.destroy(true)
    document.getElementById('game-container')?.replaceChildren()
    game = createGame('game-container', props.mode)
  } catch {
    failed.value = true
  }
}

onMounted(() => {
  EventBus.on(EVENTS.SCENE_READY, onReady)
  EventBus.on(EVENTS.RENDER_LOST, onRenderLost)
  start()
})

onBeforeUnmount(() => {
  unmounted = true
  clearTimeout(timer)
  EventBus.off(EVENTS.SCENE_READY, onReady)
  EventBus.off(EVENTS.RENDER_LOST, onRenderLost)
  game?.destroy(true)
  game = null
})
</script>

<template>
  <div class="lienzo">
    <div id="game-container" class="game-container"></div>
    <div v-if="loading" class="carga" role="status">
      <img class="logo" src="/logo.svg" alt="" width="72" height="72" />
      <template v-if="failed">
        <p>Tu navegador no pudo iniciar el juego</p>
        <button class="btn btn--primario" type="button" @click="start">Reintentar</button>
      </template>
      <template v-else>
        <p>Cargando la arena…</p>
        <span class="barra" aria-hidden="true"></span>
      </template>
    </div>
  </div>
</template>

<style scoped>
.lienzo {
  position: relative;
  width: 100%;
  height: 100%;
}
.game-container {
  width: 100%;
  height: 100%;
}
.carga {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  background: var(--color-fondo);
  color: var(--color-texto-suave);
}
.carga p {
  margin: 0;
}
.logo {
  animation: latido 1.2s ease-in-out infinite;
}
.barra {
  width: 160px;
  height: 4px;
  border-radius: 2px;
  background: linear-gradient(90deg, transparent, var(--color-primario), transparent) var(--color-borde);
  background-size: 60px 100%;
  background-repeat: no-repeat;
  animation: avance 1s linear infinite;
}
@keyframes latido {
  50% {
    transform: scale(1.08);
  }
}
@keyframes avance {
  from {
    background-position: -60px 0;
  }
  to {
    background-position: 160px 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .logo,
  .barra {
    animation: none;
  }
}
</style>
