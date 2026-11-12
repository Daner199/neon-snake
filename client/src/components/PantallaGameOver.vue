<script setup lang="ts">
import { computed } from 'vue'
import { buscarSkin } from '../data'
import { useGameStore } from '../stores/game'
import { useSkinsStore } from '../stores/skins'
import CapaJuego from './CapaJuego.vue'

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'guest' | 'error'

// Game Over: motivo, puntos, récord, skins nuevas con "Usarla", estado del guardado y estadísticas
defineProps<{ conRivales: boolean; saveStatus: SaveStatus; saveMessage: string }>()
const emit = defineEmits<{ jugarOtraVez: [] }>()
const store = useGameStore()
const skins = useSkinsStore()

const motivo = computed(() => {
  const m = store.muerte
  if (m?.causa === 'jugador') return `Te eliminó ${m.eliminadoPor}`
  return m?.causa === 'cuerpo' ? 'Chocaste contra tu cuerpo' : 'Chocaste contra el borde'
})
// Skins desbloqueadas en esta partida
const nuevasSkins = computed(() => skins.nuevas.flatMap((id) => buscarSkin(id) ?? []))

const formatTime = (ms: number) => {
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
</script>

<template>
  <CapaJuego v-if="store.gameOver" titulo="GAME OVER" titulo-id="go-titulo" peligro role="dialog" aria-labelledby="go-titulo">
    <p class="motivo">{{ motivo }}</p>
    <p class="puntos">{{ store.gameOver.score }}</p>
    <p v-if="store.newRecord" class="record">¡Nuevo récord!</p>
    <p v-else class="suave">Tu récord: {{ store.bestScore }}</p>
    <div v-if="nuevasSkins.length" class="skins-nuevas">
      <div
        v-for="s in nuevasSkins"
        :key="s.id"
        class="skin-nueva"
        :style="{ '--skin-cuerpo': s.colorCuerpo, '--skin-brillo': s.colorBrillo }"
      >
        <span class="punto-skin" aria-hidden="true"></span>
        <span class="skin-nueva__texto">¡Nueva skin: <strong>{{ s.nombre }}</strong>!</span>
        <span v-if="skins.elegida === s.id" class="en-uso">En uso</span>
        <button v-else class="btn usar" type="button" @click="skins.elegir(s.id)">Usarla</button>
      </div>
    </div>
    <p v-if="saveStatus === 'guest'" class="aviso">
      <RouterLink to="/login">Inicia sesión</RouterLink> para entrar al ranking
    </p>
    <p v-else-if="saveStatus !== 'idle'" class="aviso" :class="{ 'aviso--error': saveStatus === 'error' }" role="status">
      {{ saveMessage }}
    </p>
    <div class="stats">
      <div><strong>{{ store.gameOver.length }}</strong><span>Tamaño final</span></div>
      <div v-if="conRivales"><strong class="rosa">{{ store.gameOver.botsKilled }}</strong><span>Jugadores eliminados</span></div>
      <div><strong>{{ formatTime(store.gameOver.durationMs) }}</strong><span>Tiempo</span></div>
      <div v-if="conRivales"><strong>{{ store.gameOver.rank }}.º / {{ store.gameOver.players }}</strong><span>En la arena</span></div>
    </div>
    <button class="btn btn--primario grande" type="button" @click="emit('jugarOtraVez')">Jugar otra vez</button>
    <div class="fila">
      <RouterLink class="btn" to="/ranking">Ver ranking</RouterLink>
      <RouterLink class="btn" to="/">Menú</RouterLink>
    </div>
  </CapaJuego>
</template>

<style scoped>
.rosa {
  color: var(--color-peligro);
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
.skins-nuevas {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}
.skin-nueva {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 8px 8px 14px;
  border-radius: 12px;
  border: 1px solid var(--skin-cuerpo);
  background: var(--color-fondo);
  box-shadow: 0 0 14px color-mix(in srgb, var(--skin-brillo) 30%, transparent);
  text-align: left;
}
.skin-nueva__texto {
  flex: 1;
  font-weight: 600;
}
.skin-nueva strong {
  color: var(--skin-cuerpo);
}
.punto-skin {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--skin-cuerpo);
  box-shadow: 0 0 8px var(--skin-brillo);
}
.usar {
  min-height: 40px;
  padding: 0 16px;
  font-size: 14px;
}
.en-uso {
  padding: 0 12px;
  font-size: 13px;
  font-weight: 700;
  color: var(--color-primario);
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
/* Celular en horizontal: todo más compacto para caber en poca altura */
.horizontal .puntos {
  font-size: 28px;
}
.horizontal .stats div {
  padding: 6px;
}
.horizontal .grande {
  font-size: 16px;
}
.horizontal .btn {
  min-height: 40px;
}
.horizontal .skin-nueva {
  padding: 4px 4px 4px 12px;
}
.horizontal .usar {
  min-height: 34px;
}
</style>
