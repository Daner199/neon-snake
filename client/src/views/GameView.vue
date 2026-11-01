<script setup lang="ts">
import { ref } from 'vue'
import { useRoute } from 'vue-router'
import GameCanvas from '../components/GameCanvas.vue'
import { EventBus } from '../game/EventBus'
import { useGameStore } from '../stores/game'

const route = useRoute()
const mode = String(route.params.modo ?? 'arena')
const store = useGameStore()
const paused = ref(false)

function togglePause() {
  paused.value = !paused.value
  EventBus.emit(paused.value ? 'pause' : 'resume')
}
</script>

<template>
  <div class="juego">
    <header class="hud">
      <div><span>PUNTOS</span><strong>{{ store.score }}</strong></div>
      <div><span>LONGITUD</span><strong>{{ store.length }}</strong></div>
      <div v-if="mode === 'arena'"><span>BOTS ELIMINADOS</span><strong>{{ store.botsKilled }}</strong></div>
      <button class="btn" type="button" @click="togglePause">{{ paused ? 'Continuar' : 'Pausa' }}</button>
      <RouterLink class="btn" to="/">Salir</RouterLink>
    </header>
    <GameCanvas :mode="mode" />
  </div>
</template>

<style scoped>
.juego {
  height: 100vh;
  display: flex;
  flex-direction: column;
}
.hud {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 24px;
  padding: 12px 20px;
}
.hud div {
  display: flex;
  flex-direction: column;
}
.hud span {
  font-size: 12px;
  color: var(--color-texto-suave);
}
.hud strong {
  font-family: var(--fuente-titulo);
  font-size: 18px;
  color: var(--color-primario);
}
.hud .btn {
  min-height: 44px;
}
</style>
