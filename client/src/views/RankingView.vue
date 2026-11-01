<template>
  <main class="pagina">
    <RouterLink class="btn" to="/">Volver</RouterLink>
    <h1 class="titulo">RANKING</h1>
    <p>Aquí se mostrará el top 10 por modo (día 5, conectado al servidor).</p>
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
  color: var(--color-oro);
}
</style>
