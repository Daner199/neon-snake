<script setup lang="ts">
import { watch } from 'vue'
import { RouterView } from 'vue-router'
import { useAuthStore } from './stores/auth'
import { useSkinsStore } from './stores/skins'

const auth = useAuthStore()
const skins = useSkinsStore()

// Las skins son de cada cuenta: se cargan al abrir el juego y cada vez que se inicia o cierra sesión
watch(() => auth.user?.id, () => skins.cargar(), { immediate: true })

// Antes las skins se guardaban sin cuenta y las compartían todos los invitados del navegador
try {
  localStorage.removeItem('neon-snake-skins')
} catch {
  // sin almacenamiento local: no hay nada que borrar
}
</script>

<template>
  <RouterView />
</template>
