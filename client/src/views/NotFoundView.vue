<template>
  <main class="pagina">
    <h1 class="titulo">404</h1>
    <p class="texto">Esta página no existe. La serpiente se fue por otro camino.</p>
    <RouterLink class="btn btn--primario" to="/">Volver al menú</RouterLink>
  </main>
</template>

<style scoped>
.pagina {
  min-height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 20px;
  padding: 24px 16px;
  text-align: center;
}
.titulo {
  margin: 0;
  font-size: clamp(48px, 12vw, 96px);
  color: var(--color-peligro);
  text-shadow: 0 0 18px color-mix(in srgb, var(--color-peligro) 60%, transparent);
}
.texto {
  margin: 0;
  color: var(--color-texto-suave);
}
</style>
