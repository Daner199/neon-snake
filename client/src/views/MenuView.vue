<template>
  <main class="menu">
    <h1 class="titulo">NEON SNAKE</h1>
    <p class="lema">Come, crece y haz chocar a los bots contra tu cola.</p>
    <RouterLink class="btn btn--primario btn--grande" to="/jugar/arena">Jugar ahora</RouterLink>
    <nav class="opciones">
      <RouterLink class="btn" to="/modos">Elegir modo</RouterLink>
      <RouterLink class="btn" to="/ranking">Ranking</RouterLink>
      <RouterLink class="btn" to="/login">Iniciar sesión</RouterLink>
    </nav>
  </main>
</template>

<style scoped>
.menu {
  min-height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 20px;
  padding: 24px;
  text-align: center;
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
</style>
