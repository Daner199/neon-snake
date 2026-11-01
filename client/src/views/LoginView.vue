<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

type Tab = 'login' | 'register'

const router = useRouter()
const auth = useAuthStore()

const tab = ref<Tab>('login')
const username = ref('')
const email = ref('')
const password = ref('')
const error = ref('')
const sending = ref(false)

const title = computed(() => (tab.value === 'login' ? 'Bienvenido de nuevo' : 'Crea tu cuenta'))

function selectTab(next: Tab) {
  tab.value = next
  error.value = ''
}

async function submit() {
  error.value = ''
  sending.value = true
  try {
    if (tab.value === 'login') await auth.login(username.value, password.value)
    else await auth.register(username.value, email.value, password.value)
    router.push('/')
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Algo salió mal, inténtalo de nuevo'
  } finally {
    sending.value = false
  }
}
</script>

<template>
  <main class="pagina">
    <p class="fondo" aria-hidden="true">NEON SNAKE</p>
    <form class="tarjeta" @submit.prevent="submit">
      <RouterLink class="cerrar" to="/" aria-label="Cerrar">✕</RouterLink>
      <h1>{{ title }}</h1>

      <div class="pestanas" role="tablist">
        <button
          type="button"
          role="tab"
          :aria-selected="tab === 'login'"
          :class="{ activa: tab === 'login' }"
          @click="selectTab('login')"
        >
          Iniciar sesión
        </button>
        <button
          type="button"
          role="tab"
          :aria-selected="tab === 'register'"
          :class="{ activa: tab === 'register' }"
          @click="selectTab('register')"
        >
          Crear cuenta
        </button>
      </div>

      <label for="usuario">Usuario</label>
      <input
        id="usuario"
        v-model="username"
        type="text"
        autocomplete="username"
        placeholder="daner"
        required
        minlength="3"
        maxlength="16"
      />

      <template v-if="tab === 'register'">
        <label for="correo">Correo</label>
        <input id="correo" v-model="email" type="email" autocomplete="email" placeholder="tu@correo.com" required />
      </template>

      <label for="clave">Contraseña</label>
      <input
        id="clave"
        v-model="password"
        type="password"
        :autocomplete="tab === 'login' ? 'current-password' : 'new-password'"
        placeholder="Mínimo 8 caracteres"
        required
        minlength="8"
      />

      <p v-if="error" class="error" role="alert">{{ error }}</p>

      <button class="btn btn--primario" type="submit" :disabled="sending">
        {{ tab === 'login' ? 'Entrar' : 'Crear cuenta' }}
      </button>
      <RouterLink class="invitado" to="/">Seguir como invitado</RouterLink>
    </form>
  </main>
</template>

<style scoped>
.pagina {
  position: relative;
  min-height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px 16px;
  overflow: hidden;
}
.fondo {
  position: absolute;
  top: 18%;
  left: 50%;
  transform: translateX(-50%);
  margin: 0;
  font-family: var(--fuente-titulo);
  font-size: clamp(32px, 8vw, 96px);
  white-space: nowrap;
  color: var(--color-primario);
  opacity: 0.12;
  pointer-events: none;
}
.tarjeta {
  position: relative;
  width: min(440px, 100%);
  padding: 32px;
  border-radius: 22px;
  border: 1px solid var(--color-borde);
  background: var(--color-superficie);
  box-shadow: 0 30px 80px var(--color-fondo);
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.cerrar {
  position: absolute;
  top: 20px;
  right: 22px;
  color: var(--color-texto-suave);
  text-decoration: none;
  font-size: 18px;
}
h1 {
  margin: 0 0 8px;
  padding-right: 24px;
  font-size: 26px;
}
.pestanas {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px;
  padding: 4px;
  margin-bottom: 10px;
  border-radius: 12px;
  background: var(--color-fondo);
}
.pestanas button {
  min-height: 44px;
  border: 0;
  border-radius: 9px;
  background: transparent;
  color: var(--color-texto-suave);
  font: 600 15px var(--fuente-cuerpo);
  cursor: pointer;
}
.pestanas button.activa {
  background: var(--color-borde);
  color: var(--color-texto);
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
input:focus {
  outline: 2px solid var(--color-primario);
  outline-offset: 1px;
}
.error {
  margin: 4px 0 0;
  color: var(--color-peligro);
  font-size: 14px;
}
.btn--primario {
  margin-top: 8px;
}
.btn--primario:disabled {
  opacity: 0.6;
  cursor: wait;
}
.invitado {
  align-self: center;
  margin-top: 6px;
  font-weight: 600;
}
@media (max-width: 480px) {
  .tarjeta {
    padding: 24px 20px;
  }
}
</style>
