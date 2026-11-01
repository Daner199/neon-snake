<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import type Phaser from 'phaser'
import { EventBus } from '../game/EventBus'

const props = defineProps<{ mode: string }>()
let game: Phaser.Game | null = null
let unmounted = false
const loading = ref(true)
const failed = ref(false)

const onReady = () => (loading.value = false)
const reload = () => window.location.reload()

onMounted(async () => {
  EventBus.on('scene-ready', onReady)
  try {
    // Phaser se descarga aparte: mientras tanto se ve la pantalla de carga
    const { createGame } = await import('../game/config')
    if (!unmounted) game = createGame('game-container', props.mode)
  } catch {
    failed.value = true
  }
})

onBeforeUnmount(() => {
  unmounted = true
  EventBus.off('scene-ready', onReady)
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
        <p>No se pudo cargar el juego.</p>
        <button class="btn btn--primario" type="button" @click="reload">Recargar</button>
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
