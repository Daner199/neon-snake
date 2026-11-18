<script setup lang="ts">
// Pantalla "En línea": partida rápida, crear una sala con código o unirse con el código de un amigo.
// Aquí solo se consigue el código de la sala; GameView es quien entra y juega.
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { crearSala, guardarNombre, nombreGuardado, partidaRapida, salasPublicas } from '../online/session'
import type { SalaPublica } from '../online/protocol'
import { enterGameScreen } from '../screen'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const auth = useAuthStore()

const nombre = ref(auth.user?.username ?? nombreGuardado())
const codigo = ref('')
const publica = ref(true)
const conIA = ref(true)
const ocupado = ref<'' | 'rapida' | 'crear' | 'unirse'>('')
const error = ref('')
const lento = ref(false) // el servidor gratis tarda en despertar: se avisa
const salas = ref<SalaPublica[]>([])

const nombreValido = computed(() => auth.loggedIn || nombre.value.trim().length >= 2)
const codigoValido = computed(() => /^[A-Za-z0-9]{4}$/.test(codigo.value.trim()))

function entrar(code: string) {
  if (!auth.loggedIn) guardarNombre(nombre.value.trim())
  enterGameScreen()
  router.push({ name: 'online-partida', params: { codigo: code.toUpperCase() } })
}

async function hacer(que: 'rapida' | 'crear', fn: () => Promise<string>) {
  if (!nombreValido.value) {
    error.value = 'Escribe un nombre de al menos 2 letras'
    return
  }
  error.value = ''
  ocupado.value = que
  const aviso = setTimeout(() => (lento.value = true), 3000)
  try {
    entrar(await fn())
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No se pudo conectar con el servidor'
  } finally {
    clearTimeout(aviso)
    lento.value = false
    ocupado.value = ''
  }
}

const rapida = () => hacer('rapida', partidaRapida)
const crear = () => hacer('crear', () => crearSala({ publica: publica.value, conIA: conIA.value }))
function unirse(code = codigo.value.trim()) {
  if (!nombreValido.value) {
    error.value = 'Escribe un nombre de al menos 2 letras'
    return
  }
  entrar(code)
}

// Lista de salas abiertas, actualizada cada pocos segundos
let timer: ReturnType<typeof setInterval> | undefined
async function cargarSalas() {
  try {
    salas.value = await salasPublicas()
  } catch {
    salas.value = []
  }
}
onMounted(() => {
  cargarSalas()
  timer = setInterval(cargarSalas, 5000)
})
onBeforeUnmount(() => clearInterval(timer))
</script>

<template>
  <main class="pagina">
    <header class="cabecera">
      <RouterLink class="btn" to="/">‹ Volver</RouterLink>
      <h1 class="titulo">EN LÍNEA</h1>
    </header>

    <section class="tarjeta">
      <label v-if="!auth.loggedIn" class="campo">
        <span>Tu nombre en la arena</span>
        <input v-model="nombre" maxlength="16" autocomplete="nickname" placeholder="Ej.: Daner" />
      </label>
      <p v-else class="suave">Jugarás como <strong>{{ auth.user?.username }}</strong>. Tus partidas entran al ranking En línea.</p>
      <p v-if="!auth.loggedIn" class="suave pequeno">
        <RouterLink to="/login">Inicia sesión</RouterLink> para que tus partidas en línea entren al ranking.
      </p>
      <button class="btn btn--primario grande" type="button" :disabled="!!ocupado" @click="rapida">
        {{ ocupado === 'rapida' ? 'Buscando sala…' : 'Partida rápida' }}
      </button>
    </section>

    <div class="columnas">
      <section class="tarjeta">
        <h2>Crear sala</h2>
        <p class="suave">Te damos un código para que tus amigos entren desde su celular o su PC.</p>
        <label class="opcion"><input v-model="publica" type="checkbox" /> Pública (aparece en la lista de salas)</label>
        <label class="opcion">
          <input v-model="conIA" type="checkbox" /> Completar con jugadores de la computadora
        </label>
        <button class="btn" type="button" :disabled="!!ocupado" @click="crear">
          {{ ocupado === 'crear' ? 'Creando…' : 'Crear sala' }}
        </button>
      </section>

      <section class="tarjeta">
        <h2>Unirse con código</h2>
        <form class="fila" @submit.prevent="unirse()">
          <input
            v-model="codigo"
            class="codigo"
            maxlength="4"
            autocapitalize="characters"
            autocomplete="off"
            spellcheck="false"
            placeholder="K7Q2"
            aria-label="Código de la sala"
          />
          <button class="btn" type="submit" :disabled="!codigoValido">Entrar</button>
        </form>

        <h2 class="subtitulo">Salas abiertas</h2>
        <p v-if="salas.length === 0" class="suave pequeno">No hay salas públicas ahora. ¡Crea una!</p>
        <ul v-else class="salas">
          <li v-for="s in salas" :key="s.code">
            <span class="sala-codigo">{{ s.code }}</span>
            <span class="suave">{{ s.humanos }} / {{ s.max }} personas</span>
            <button class="btn btn--chico" type="button" @click="unirse(s.code)">Unirse</button>
          </li>
        </ul>
      </section>
    </div>

    <p v-if="lento" class="aviso" role="status">Despertando el servidor… la primera vez puede tardar hasta un minuto.</p>
    <p v-if="error" class="aviso aviso--error" role="alert">{{ error }}</p>
  </main>
</template>

<style scoped>
.pagina {
  max-width: 960px;
  margin: 0 auto;
  padding: 40px 16px;
  display: flex;
  flex-direction: column;
  gap: 20px;
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
.columnas {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 20px;
}
.tarjeta {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 24px;
  border-radius: 20px;
  border: 1px solid var(--color-borde);
  background: var(--color-superficie);
}
.tarjeta h2 {
  margin: 0;
  font-size: 18px;
}
.subtitulo {
  margin-top: 8px !important;
  font-size: 14px !important;
  color: var(--color-texto-suave);
  letter-spacing: 1px;
  text-transform: uppercase;
}
.suave {
  margin: 0;
  color: var(--color-texto-suave);
}
.pequeno {
  font-size: 14px;
}
.campo {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 14px;
  color: var(--color-texto-suave);
}
input:not([type='checkbox']) {
  min-height: 48px;
  padding: 0 14px;
  border-radius: 12px;
  border: 1px solid var(--color-borde);
  background: var(--color-fondo);
  color: var(--color-texto);
  font: 500 16px var(--fuente-cuerpo);
}
input:focus-visible {
  outline: 2px solid var(--color-primario);
  outline-offset: 1px;
}
.opcion {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 15px;
}
.opcion input {
  width: 18px;
  height: 18px;
  accent-color: var(--color-primario);
}
.grande {
  min-height: 60px;
  font-size: 18px;
}
.fila {
  display: flex;
  gap: 10px;
}
.codigo {
  flex: 1;
  min-width: 0;
  font-family: var(--fuente-titulo) !important;
  font-size: 18px !important;
  letter-spacing: 4px;
  text-transform: uppercase;
}
.salas {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.salas li {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 8px 8px 14px;
  border-radius: 12px;
  border: 1px solid var(--color-borde);
}
.sala-codigo {
  font-family: var(--fuente-titulo);
  font-size: 13px;
  color: var(--color-primario);
}
.salas .suave {
  flex: 1;
  font-size: 14px;
}
.btn--chico {
  min-height: 40px;
  padding: 0 16px;
  font-size: 14px;
}
.btn:disabled {
  opacity: 0.5;
  cursor: default;
}
.aviso {
  margin: 0;
  padding: 12px 16px;
  border-radius: 12px;
  border: 1px solid var(--color-borde);
  background: var(--color-superficie);
}
.aviso--error {
  border-color: var(--color-peligro);
  color: var(--color-peligro);
}
</style>
