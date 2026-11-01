<script setup lang="ts">
import { enterGameScreen } from '../screen'
</script>

<template>
  <main class="pagina">
    <header class="cabecera">
      <RouterLink class="btn" to="/">‹ Volver</RouterLink>
      <h1 class="titulo">ELIGE UN MODO</h1>
    </header>
    <div class="modos">
      <RouterLink class="modo" to="/jugar/arena" @click="enterGameScreen">
        <h2>Arena</h2>
        <p>Muchos jugadores en un mapa grande. Haz que choquen contra tu cuerpo para eliminarlos y quedarte con su comida.</p>
      </RouterLink>
      <RouterLink class="modo" to="/jugar/classic" @click="enterGameScreen">
        <h2>Clásico</h2>
        <p>Tú solo en un tablero cerrado. Cada 5 frutas vas más rápido.</p>
      </RouterLink>
    </div>
  </main>
</template>

<style scoped>
.pagina {
  max-width: 1120px;
  margin: 0 auto;
  padding: 40px 24px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 24px;
}
.cabecera {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 24px;
}
.titulo {
  margin: 0;
  font-size: 28px;
}
.modos {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 24px;
  width: 100%;
}
.modo {
  padding: 28px;
  border-radius: 20px;
  border: 1px solid var(--color-borde);
  background: var(--color-superficie);
  color: var(--color-texto);
  text-decoration: none;
}
.modo h2 {
  margin: 0 0 8px;
}
.modo p {
  margin: 0;
  color: var(--color-texto-suave);
}
</style>
