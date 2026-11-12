<script setup lang="ts">
import { computed } from 'vue'
import { useSettingsStore } from '../stores/settings'
import { useSkinsStore } from '../stores/skins'
import CapaJuego from './CapaJuego.vue'

// Menú de pausa: continuar, sonido, skin y salir.
// Elegir una skin solo cambia Pinia; GameView lo ve y se lo dice a Phaser con skin-changed.
const emit = defineEmits<{ continuar: [] }>()
const settings = useSettingsStore()
const skins = useSkinsStore()

// Solo las skins desbloqueadas
const disponibles = computed(() => skins.catalogo.filter((s) => s.estado !== 'bloqueada'))
</script>

<template>
  <CapaJuego titulo="PAUSA">
    <button class="btn btn--primario" type="button" @click="emit('continuar')">Continuar</button>
    <button class="btn" type="button" :aria-pressed="settings.muted" @click="settings.toggleMute()">
      {{ settings.muted ? '🔇 Sonido apagado' : '🔊 Sonido encendido' }}
    </button>
    <div class="fila-skin" role="group" aria-label="Skin">
      <span>Skin</span>
      <div class="circulos">
        <button
          v-for="s in disponibles"
          :key="s.id"
          class="circulo"
          :class="{ activo: s.estado === 'activa' }"
          type="button"
          :style="{ '--skin-cuerpo': s.colorCuerpo, '--skin-brillo': s.colorBrillo }"
          :title="s.nombre"
          :aria-label="s.nombre"
          :aria-pressed="s.estado === 'activa'"
          @click="skins.elegir(s.id)"
        ></button>
      </div>
    </div>
    <RouterLink class="btn" to="/">Salir al menú</RouterLink>
  </CapaJuego>
</template>

<style scoped>
.btn {
  width: 100%;
}
.horizontal .btn {
  min-height: 40px;
}
.fila-skin {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  padding: 8px 14px;
  border-radius: 12px;
  border: 1px solid var(--color-borde);
  font-weight: 600;
}
.circulos {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 4px;
}
.circulo {
  width: 36px;
  height: 36px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  cursor: pointer;
}
.circulo::before {
  content: '';
  display: block;
  width: 22px;
  height: 22px;
  margin: auto;
  border-radius: 50%;
  background: var(--skin-cuerpo);
  box-shadow: 0 0 8px color-mix(in srgb, var(--skin-brillo) 60%, transparent);
}
.circulo.activo::before {
  outline: 2px solid var(--color-texto);
  outline-offset: 3px;
}
</style>
