<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { useGameStore } from '../stores/game'
import { useSettingsStore } from '../stores/settings'

// HUD de la partida: puntaje, eliminados, serpientes o tamaño, puesto, récord, botones
// y, en el celular, la píldora "Puesto X de Y" con el top 5 desplegable.
const props = defineProps<{ conRivales: boolean; compact: boolean; paused: boolean }>()
const emit = defineEmits<{ pausa: [] }>()
const store = useGameStore()
const settings = useSettingsStore()

const playerRank = computed(() => store.leaderboard.findIndex((r) => r.isPlayer) + 1)

// Top 5 desplegable desde la píldora: se cierra al tocar otra vez o a los 3 segundos
const showTop = ref(false)
let topTimer: ReturnType<typeof setTimeout> | undefined
function toggleTop() {
  showTop.value = !showTop.value
  clearTimeout(topTimer)
  if (showTop.value) topTimer = setTimeout(() => (showTop.value = false), 3000)
}
onBeforeUnmount(() => clearTimeout(topTimer))

const pauseText = computed(() => {
  if (props.compact) return props.paused ? '▶' : '⏸'
  return props.paused ? 'Continuar' : 'Pausa'
})
</script>

<template>
  <header class="hud">
    <div class="marcador">
      <div><span>PUNTOS</span><strong>{{ store.score }}</strong></div>
      <template v-if="conRivales">
        <div><span>ELIMINADOS</span><strong class="rosa">{{ store.botsKilled }}</strong></div>
        <div><span>SERPIENTES</span><strong class="blanco">{{ store.leaderboard.length }}</strong></div>
        <div v-if="compact"><span>PUESTO</span><strong class="oro">{{ playerRank }}</strong></div>
      </template>
      <div v-else><span>TAMAÑO</span><strong class="blanco">{{ store.length }}</strong></div>
      <div v-if="!compact || !conRivales"><span>RÉCORD</span><strong class="oro">{{ store.bestScore }}</strong></div>
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
      <button class="btn" type="button" :aria-label="paused ? 'Continuar' : 'Pausar'" @click="emit('pausa')">
        {{ pauseText }}
      </button>
      <RouterLink class="btn" to="/" aria-label="Salir">{{ compact ? '✕' : 'Salir' }}</RouterLink>
    </div>

    <div v-if="conRivales && compact" class="puesto">
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
  </header>
</template>

<style scoped>
.hud {
  /* La píldora del puesto se coloca respecto al HUD, justo debajo de él */
  position: relative;
  z-index: 5;
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
.puesto {
  position: absolute;
  top: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
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
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  border-radius: 8px;
  font-size: 13px;
}
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
.pts {
  font-variant-numeric: tabular-nums;
}
/* Celular en horizontal: el HUD flota sobre el tablero, que ocupa toda la altura */
.horizontal .hud {
  position: absolute;
  inset: 0 0 auto 0;
  z-index: 6;
  align-items: flex-start;
  padding: max(8px, env(safe-area-inset-top)) max(10px, env(safe-area-inset-right)) 0
    max(10px, env(safe-area-inset-left));
  pointer-events: none;
}
.horizontal .hud > * {
  pointer-events: auto;
}
.horizontal .marcador {
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
}
.horizontal .hud .btn {
  height: 32px;
  min-height: 32px;
  min-width: 32px;
  padding: 0 8px;
  font-size: 13px;
}
.horizontal .hud .sonido {
  width: 32px;
  padding: 0;
}
.horizontal .puesto {
  top: calc(max(8px, env(safe-area-inset-top)) + 40px);
  left: auto;
  right: max(10px, env(safe-area-inset-right));
  transform: none;
  align-items: flex-end;
}
.horizontal .pildora {
  min-height: 28px;
  padding: 0 10px;
  font-size: 12px;
}
</style>
