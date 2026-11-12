<script setup lang="ts">
import { computed } from 'vue'
import type { Skin } from '../data'

// Vista previa de una skin hecha solo con HTML y CSS (sin Phaser): círculos solapados de la cola a la cabeza,
// franja cada 2 segmentos, cabeza con ojos y brillo neón. Los colores vienen del JSON como variables CSS.
const props = withDefaults(
  defineProps<{
    skin: Skin
    segmentos?: number
    tamano?: number // diámetro de un segmento en píxeles
    bloqueada?: boolean
  }>(),
  { segmentos: 6, tamano: 22, bloqueada: false },
)

const colores = computed(() => ({
  '--skin-cabeza': props.skin.colorCabeza,
  '--skin-cuerpo': props.skin.colorCuerpo,
  '--skin-franja': props.skin.colorFranja,
  '--skin-brillo': props.skin.colorBrillo,
  '--t': `${props.tamano}px`,
}))

// i = 1 es la punta de la cola; el último segmento queda junto a la cabeza
const desdeCabeza = (i: number) => props.segmentos - i
const esFranja = (i: number) => Math.floor(desdeCabeza(i) / 2) % 2 === 1
const escala = (i: number) => 0.6 + (0.4 * i) / props.segmentos
</script>

<template>
  <span class="serpiente" :class="{ bloqueada }" :style="colores" role="img" :aria-label="`Serpiente ${skin.nombre}`">
    <span v-for="i in segmentos" :key="i" class="seg" :class="{ franja: esFranja(i) }" :style="{ '--escala': escala(i) }"></span>
    <span class="cabeza"><span class="ojo"></span><span class="ojo"></span></span>
  </span>
</template>

<style scoped>
.serpiente {
  display: inline-flex;
  align-items: center;
  padding: calc(var(--t) * 0.4);
}
.seg {
  flex-shrink: 0;
  width: calc(var(--t) * var(--escala));
  height: calc(var(--t) * var(--escala));
  margin-left: calc(var(--t) * -0.35);
  border-radius: 50%;
  background: var(--skin-cuerpo);
  box-shadow: 0 0 calc(var(--t) * 0.4) color-mix(in srgb, var(--skin-brillo) 45%, transparent);
}
.seg:first-child {
  margin-left: 0;
}
.seg.franja {
  background: var(--skin-franja);
}
.cabeza {
  position: relative;
  flex-shrink: 0;
  width: calc(var(--t) * 1.25);
  height: calc(var(--t) * 1.1);
  margin-left: calc(var(--t) * -0.4);
  border-radius: 50%;
  background: var(--skin-cabeza);
  box-shadow: 0 0 calc(var(--t) * 0.8) var(--skin-brillo);
}
.ojo {
  position: absolute;
  left: 50%;
  width: calc(var(--t) * 0.32);
  height: calc(var(--t) * 0.32);
  border-radius: 50%;
  background: var(--color-texto);
}
.ojo:first-child {
  top: 12%;
}
.ojo:last-child {
  bottom: 12%;
}
.ojo::after {
  content: '';
  position: absolute;
  top: 25%;
  left: 40%;
  width: 55%;
  height: 55%;
  border-radius: 50%;
  background: var(--color-fondo);
}
.bloqueada {
  filter: grayscale(1) brightness(0.55);
}
</style>
