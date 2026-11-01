<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { api } from '../api'
import { useAuthStore } from '../stores/auth'

type Mode = 'arena' | 'classic'

interface RankingRow {
  position: number
  username: string
  score: number
  botsKilled: number
}

const TABS: { mode: Mode; label: string }[] = [
  { mode: 'arena', label: 'Arena' },
  { mode: 'classic', label: 'Clásico' },
]

const auth = useAuthStore()
const mode = ref<Mode>('arena')
const top = ref<RankingRow[]>([])
const me = ref<RankingRow | null>(null)
const loading = ref(true)
const error = ref('')

// Si el jugador no está en el top 10, su fila va aparte al final
const meOutside = computed(() => (me.value && me.value.position > top.value.length ? me.value : null))

// "6820" -> "6 820", como en el mockup
const formatPoints = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')

async function load() {
  loading.value = true
  error.value = ''
  try {
    const data = await api<{ top: RankingRow[]; me: RankingRow | null }>(`/ranking/${mode.value}`, {
      token: auth.token,
    })
    top.value = data.top
    me.value = data.me
  } catch (e) {
    top.value = []
    me.value = null
    error.value = e instanceof Error ? e.message : 'No se pudo cargar el ranking'
  } finally {
    loading.value = false
  }
}

watch(mode, load, { immediate: true })
</script>

<template>
  <main class="pagina">
    <header class="cabecera">
      <RouterLink class="btn" to="/">‹ Volver</RouterLink>
      <h1 class="titulo">RANKING</h1>
    </header>

    <div class="pestanas" role="tablist">
      <button
        v-for="t in TABS"
        :key="t.mode"
        type="button"
        role="tab"
        class="btn"
        :class="{ 'btn--primario': mode === t.mode }"
        :aria-selected="mode === t.mode"
        @click="mode = t.mode"
      >
        {{ t.label }}
      </button>
    </div>

    <section class="tabla" :aria-busy="loading">
      <div class="fila cabeza">
        <span>PUESTO</span>
        <span>JUGADOR</span>
        <span v-if="mode === 'arena'" class="bots">ELIMINADOS</span>
        <span class="pts">PUNTOS</span>
      </div>

      <p v-if="loading" class="estado">Cargando…</p>
      <p v-else-if="error" class="estado estado--error">{{ error }}</p>
      <p v-else-if="top.length === 0" class="estado">Todavía no hay partidas. ¡Sé el primero!</p>

      <template v-else>
        <div
          v-for="r in top"
          :key="r.position"
          class="fila"
          :class="{ yo: me?.position === r.position, oro: r.position === 1 }"
        >
          <span class="puesto">{{ r.position }}</span>
          <span class="nombre">{{ me?.position === r.position ? `Tú · ${r.username}` : r.username }}</span>
          <span v-if="mode === 'arena'" class="bots">{{ r.botsKilled }}</span>
          <span class="pts">{{ formatPoints(r.score) }}</span>
        </div>
        <div v-if="meOutside" class="fila yo aparte">
          <span class="puesto">{{ meOutside.position }}</span>
          <span class="nombre">Tú · {{ meOutside.username }}</span>
          <span v-if="mode === 'arena'" class="bots">{{ meOutside.botsKilled }}</span>
          <span class="pts">{{ formatPoints(meOutside.score) }}</span>
        </div>
      </template>
    </section>

    <p class="nota">
      Solo cuenta la mejor partida de cada jugador.
      <template v-if="!auth.loggedIn"><RouterLink to="/login">Inicia sesión</RouterLink> para entrar al ranking.</template>
    </p>
  </main>
</template>

<style scoped>
.pagina {
  max-width: 1120px;
  margin: 0 auto;
  padding: 40px 24px;
  display: flex;
  flex-direction: column;
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
  color: var(--color-oro);
  text-shadow: 0 0 18px color-mix(in srgb, var(--color-oro) 60%, transparent);
}
.pestanas {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}
.pestanas .btn {
  border-radius: 999px;
  min-height: 48px;
}
.pestanas .btn--primario {
  box-shadow: none;
}
.tabla {
  border-radius: 20px;
  border: 1px solid var(--color-borde);
  background: var(--color-superficie);
  overflow: hidden;
}
.fila {
  display: grid;
  grid-template-columns: 90px 1fr 170px 110px;
  align-items: center;
  gap: 12px;
  padding: 16px 44px;
  border-top: 1px solid var(--color-borde);
  font-weight: 600;
}
.fila:not(:has(.bots)) {
  grid-template-columns: 90px 1fr 110px;
}
.cabeza {
  border-top: 0;
  font-size: 13px;
  letter-spacing: 1.5px;
  color: var(--color-texto-suave);
}
.puesto {
  color: var(--color-texto-suave);
}
.oro .puesto {
  color: var(--color-oro);
}
.nombre {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.bots {
  color: var(--color-texto-suave);
  font-weight: 400;
}
.pts {
  text-align: right;
  font-variant-numeric: tabular-nums;
  font-weight: 700;
}
.yo {
  background: color-mix(in srgb, var(--color-primario) 14%, var(--color-superficie));
}
.yo .puesto,
.yo .pts {
  color: var(--color-primario);
}
.aparte {
  border-top: 2px solid var(--color-primario);
}
.estado {
  margin: 0;
  padding: 32px 44px;
  color: var(--color-texto-suave);
}
.estado--error {
  color: var(--color-peligro);
}
.nota {
  margin: 0;
  font-size: 14px;
  color: var(--color-texto-suave);
}
@media (max-width: 640px) {
  .pagina {
    padding: 24px 16px;
  }
  .fila {
    grid-template-columns: 48px 1fr 56px 72px;
    padding: 14px 16px;
    font-size: 14px;
  }
  .fila:not(:has(.bots)) {
    grid-template-columns: 48px 1fr 72px;
  }
  .cabeza {
    font-size: 11px;
    letter-spacing: 0.5px;
  }
  .cabeza .bots {
    font-size: 0;
  }
  .cabeza .bots::after {
    content: 'ELIM.';
    font-size: 11px;
  }
}
</style>
