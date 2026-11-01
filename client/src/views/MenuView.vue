<script setup lang="ts">
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()
</script>

<template>
  <main class="menu">
    <header class="barra">
      <span class="jugador">{{ auth.user ? `Jugando como ${auth.user.username}` : 'Jugando como invitado' }}</span>
      <button v-if="auth.loggedIn" class="btn btn--sesion" type="button" @click="auth.logout()">Cerrar sesión</button>
      <RouterLink v-else class="btn btn--sesion" to="/login">Iniciar sesión</RouterLink>
    </header>
    <h1 class="titulo">NEON SNAKE</h1>
    <p class="lema">Come, crece y haz chocar a los demás jugadores contra tu cola.</p>
    <RouterLink class="btn btn--primario btn--grande" to="/jugar/arena">Jugar ahora</RouterLink>
    <nav class="opciones">
      <RouterLink class="btn" to="/modos">Elegir modo</RouterLink>
      <RouterLink class="btn" to="/ranking">Ranking</RouterLink>
    </nav>
  </main>
</template>

<style scoped>
.menu {
  position: relative;
  min-height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 20px;
  padding: 96px 16px 24px;
  text-align: center;
}
.barra {
  position: absolute;
  top: 24px;
  left: 24px;
  right: 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}
.jugador {
  color: var(--color-texto-suave);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.btn--sesion {
  flex-shrink: 0;
  border-color: var(--color-primario);
  background: transparent;
  color: var(--color-primario);
}
.titulo {
  margin: 0;
  font-size: clamp(28px, 6vw, 64px);
}
.lema {
  margin: 0 0 16px;
  color: var(--color-texto-suave);
}
.btn--grande {
  width: min(340px, 100%);
  min-height: 64px;
  font-size: 20px;
}
.opciones {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: min(340px, 100%);
}
@media (max-width: 480px) {
  .barra {
    top: 16px;
    left: 16px;
    right: 16px;
  }
}
</style>
