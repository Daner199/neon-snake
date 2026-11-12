<script setup lang="ts">
import SkinPreview from '../components/SkinPreview.vue'
import { useAuthStore } from '../stores/auth'
import { useSkinsStore } from '../stores/skins'

// Selector de skins: una tarjeta por skin de src/data/skins.json con su estado (en uso, disponible o bloqueada).
// Las skins se desbloquean solo con sesión iniciada; los invitados ven qué hace falta para cada una.
const skins = useSkinsStore()
const auth = useAuthStore()

const puntos = (n: number) => `${n} ${n === 1 ? 'punto' : 'puntos'}`
</script>

<template>
  <main class="pagina">
    <header class="cabecera">
      <RouterLink class="btn" to="/">‹ Volver</RouterLink>
      <div>
        <h1 class="titulo">SKINS</h1>
        <p v-if="auth.loggedIn" class="record">Tu récord: <strong>{{ puntos(skins.recordCuenta) }}</strong></p>
      </div>
    </header>

    <p v-if="!auth.loggedIn" class="invitado">
      Juegas como invitado. <RouterLink to="/login">Inicia sesión</RouterLink> para desbloquear skins: quedan
      guardadas en tu cuenta.
    </p>

    <div class="skins">
      <article
        v-for="s in skins.catalogo"
        :key="s.id"
        class="skin"
        :class="`skin--${s.estado}`"
        :aria-label="`${s.nombre}: ${s.estado === 'activa' ? 'en uso' : s.estado}`"
      >
        <div class="vista">
          <SkinPreview :skin="s" :tamano="26" :bloqueada="s.estado === 'bloqueada'" />
        </div>
        <h2>{{ s.nombre }}</h2>
        <p class="descripcion">{{ s.descripcion }}</p>
        <div class="pie">
          <span v-if="s.estado === 'activa'" class="etiqueta">En uso</span>
          <button v-else-if="s.estado === 'disponible'" class="btn usar" type="button" @click="skins.elegir(s.id)">
            Usar
          </button>
          <span v-else class="candado">
            <span aria-hidden="true">🔒</span>
            {{
              auth.loggedIn && s.faltan > 0
                ? `Te faltan ${puntos(s.faltan)}`
                : `Consigue ${puntos(s.puntajeRequerido)} en una partida`
            }}
          </span>
        </div>
      </article>
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
.record {
  margin: 10px 0 0;
  color: var(--color-texto-suave);
}
.record strong {
  color: var(--color-oro);
}
.invitado {
  margin: 0;
  padding: 12px 16px;
  border-radius: 12px;
  border: 1px solid var(--color-borde);
  background: var(--color-superficie);
  color: var(--color-texto-suave);
}
.skins {
  display: grid;
  grid-template-columns: 1fr;
  gap: 24px;
  width: 100%;
}
@media (min-width: 600px) {
  .skins {
    grid-template-columns: repeat(2, 1fr);
  }
}
@media (min-width: 900px) {
  .skins {
    grid-template-columns: repeat(3, 1fr);
  }
}
.skin {
  display: flex;
  flex-direction: column;
  padding: 24px;
  border-radius: 20px;
  border: 1px solid var(--color-borde);
  background: var(--color-superficie);
}
.skin--activa {
  border: 2px solid var(--color-primario);
  box-shadow: 0 0 18px color-mix(in srgb, var(--color-primario) 25%, transparent);
}
.vista {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 96px;
  margin-bottom: 16px;
  border-radius: 14px;
  background: var(--color-fondo);
}
.skin h2 {
  margin: 0 0 6px;
}
.descripcion {
  flex: 1;
  margin: 0 0 16px;
  color: var(--color-texto-suave);
}
.skin--bloqueada h2,
.skin--bloqueada .descripcion {
  color: var(--color-texto-suave);
  opacity: 0.7;
}
.pie {
  display: flex;
  align-items: center;
  min-height: 44px;
}
.etiqueta {
  padding: 6px 14px;
  border-radius: 999px;
  background: var(--color-primario);
  color: var(--color-fondo);
  font-weight: 700;
}
.usar {
  min-height: 44px;
  border-color: var(--color-primario);
  color: var(--color-primario);
}
.candado {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--color-texto-suave);
  font-weight: 600;
}
@media (max-width: 640px) {
  .pagina {
    padding: 24px 16px;
  }
}
</style>
