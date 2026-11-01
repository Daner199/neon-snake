<template>
  <main class="pagina">
    <form class="tarjeta" @submit.prevent>
      <h1>Bienvenido de nuevo</h1>
      <label for="usuario">Usuario</label>
      <input id="usuario" type="text" autocomplete="username" />
      <label for="clave">Contraseña</label>
      <input id="clave" type="password" autocomplete="current-password" />
      <button class="btn btn--primario" type="submit">Entrar</button>
      <RouterLink to="/">Seguir como invitado</RouterLink>
    </form>
  </main>
</template>

<style scoped>
.pagina {
  min-height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}
.tarjeta {
  width: min(440px, 100%);
  padding: 36px;
  border-radius: 22px;
  border: 1px solid var(--color-borde);
  background: var(--color-superficie);
  display: flex;
  flex-direction: column;
  gap: 10px;
}
h1 {
  margin: 0 0 12px;
  font-size: 26px;
}
label {
  font-size: 14px;
  font-weight: 600;
}
input {
  height: 48px;
  padding: 0 14px;
  border-radius: 10px;
  border: 1px solid var(--color-borde);
  background: var(--color-fondo);
  color: var(--color-texto);
  font: 16px var(--fuente-cuerpo);
}
.btn--primario {
  margin-top: 8px;
}
</style>
