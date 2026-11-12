<script setup lang="ts">
// Velo sobre el juego con una tarjeta centrada: la usan el menú de pausa y la pantalla de Game Over
defineOptions({ inheritAttrs: false })
defineProps<{ titulo: string; tituloId?: string; peligro?: boolean }>()
</script>

<template>
  <div class="capa">
    <div class="tarjeta" v-bind="$attrs">
      <h2 :id="tituloId" class="titulo-capa" :class="{ peligro }">{{ titulo }}</h2>
      <slot />
    </div>
  </div>
</template>

<style scoped>
.capa {
  position: absolute;
  inset: 0;
  z-index: 8;
  display: flex;
  background: color-mix(in srgb, var(--color-fondo) 70%, transparent);
  backdrop-filter: blur(3px);
  padding: 16px;
  overflow-y: auto;
  touch-action: pan-y;
}
.tarjeta {
  /* margin: auto centra la tarjeta y, si no cabe, deja desplazarse hasta arriba */
  margin: auto;
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
.titulo-capa.peligro {
  color: var(--color-peligro);
}
/* En horizontal la tarjeta es más compacta para caber en poca altura */
.horizontal .tarjeta {
  width: min(560px, 100%);
  padding: 16px 20px;
  gap: 8px;
}
.horizontal .titulo-capa {
  font-size: 20px;
}
</style>
