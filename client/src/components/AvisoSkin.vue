<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { buscarSkin, type Skin } from '../data'
import { useSkinsStore } from '../stores/skins'

// Aviso pequeño durante la partida cuando se desbloquea una skin (arriba al centro, 2,5 s)
const DURACION_MS = 2500

const skins = useSkinsStore()
const visibles = ref<Skin[]>([])
let timer: ReturnType<typeof setTimeout> | undefined

watch(
  () => skins.nuevas.length,
  (total, antes) => {
    if (total <= antes) return
    visibles.value = skins.nuevas.slice(antes).flatMap((id) => buscarSkin(id) ?? [])
    clearTimeout(timer)
    timer = setTimeout(() => (visibles.value = []), DURACION_MS)
  },
)

onBeforeUnmount(() => clearTimeout(timer))
</script>

<template>
  <Transition name="aviso">
    <p
      v-if="visibles.length"
      class="aviso-skin"
      role="status"
      :style="{ '--skin-cuerpo': visibles[0].colorCuerpo, '--skin-brillo': visibles[0].colorBrillo }"
    >
      <span class="punto" aria-hidden="true"></span>
      <span>
        {{ visibles.length === 1 ? '¡Nueva skin:' : '¡Nuevas skins:' }}
        <strong>{{ visibles.map((s) => s.nombre).join(' y ') }}</strong>!
      </span>
    </p>
  </Transition>
</template>

<style scoped>
.aviso-skin {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  padding: 6px 16px;
  border-radius: 999px;
  border: 1px solid var(--skin-cuerpo);
  background: color-mix(in srgb, var(--color-superficie) 90%, transparent);
  box-shadow: 0 0 14px color-mix(in srgb, var(--skin-brillo) 45%, transparent);
  font-size: 14px;
  white-space: nowrap;
  pointer-events: none;
}
.aviso-skin strong {
  color: var(--skin-cuerpo);
}
.punto {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--skin-cuerpo);
  box-shadow: 0 0 6px var(--skin-brillo);
}
/* Celular: más pequeño para no tapar el juego */
.compacto .aviso-skin {
  padding: 3px 10px;
  font-size: 11px;
}
.aviso-enter-from,
.aviso-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
.aviso-enter-active,
.aviso-leave-active {
  transition: all 0.25s ease;
}
</style>
