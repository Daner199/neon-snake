<template>
  <main class="pagina">
    <RouterLink class="btn" to="/">Volver</RouterLink>
    <h1 class="titulo">ELIGE UN MODO</h1>
    <div class="modos">
      <RouterLink class="modo" to="/jugar/arena">
        <h2>Arena con bots</h2>
        <p>Haz que los bots choquen contra tu cuerpo para eliminarlos.</p>
      </RouterLink>
      <RouterLink class="modo" to="/jugar/classic">
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
