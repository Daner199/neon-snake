import { defineStore } from 'pinia'
import { api } from '../api'
import { buscarSkin, MODOS, SKINS, type Skin } from '../data'
import { estadoSkin, puntosQueFaltan, skinsPorDesbloquear, type EstadoSkin } from '../logic/skins'
import { useAuthStore } from './auth'

const PRIMERA = SKINS[0].id // la primera skin del JSON siempre está desbloqueada (también para invitados)
const storageKey = (userId: string) => `neon-snake-skins-${userId}`

export type SkinEnCatalogo = Skin & { estado: EstadoSkin; faltan: number }

interface Guardado {
  elegida: string
  desbloqueadas: string[]
}

const INVITADO: Guardado = { elegida: PRIMERA, desbloqueadas: [PRIMERA] }

// Copia local de las skins de una cuenta (para no esperar al servidor al abrir el juego)
function leer(userId: string): Guardado {
  let saved: Partial<Guardado> = {}
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(storageKey(userId)) ?? 'null')
    if (parsed && typeof parsed === 'object') saved = parsed as Partial<Guardado>
  } catch {
    // sin almacenamiento local o datos rotos: se empieza con la primera skin
  }
  // Solo ids que existen en el JSON (si se borra una skin, desaparece sin romper nada)
  const guardadas = Array.isArray(saved.desbloqueadas) ? saved.desbloqueadas.filter((id) => buscarSkin(id)) : []
  const desbloqueadas = [PRIMERA, ...guardadas.filter((id) => id !== PRIMERA)]
  const elegida = typeof saved.elegida === 'string' && desbloqueadas.includes(saved.elegida) ? saved.elegida : PRIMERA
  return { elegida, desbloqueadas }
}

function guardar(userId: string, value: Guardado) {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(value))
  } catch {
    // sin almacenamiento local (modo privado): el servidor las vuelve a dar al iniciar sesión
  }
}

// La mejor partida de la cuenta en cualquier modo, según el servidor (la misma que usa el ranking)
async function mejorPartidaEnServidor(token: string): Promise<number> {
  const resultados = await Promise.all(
    MODOS.map((m) =>
      api<{ me: { score: number } | null }>(`/ranking/${m.id}`, { token })
        .then((r) => r.me?.score ?? 0)
        .catch(() => 0),
    ),
  )
  return Math.max(0, ...resultados)
}

// Skins del jugador. Se desbloquean solo con sesión iniciada y quedan en su cuenta:
// el servidor guarda su mejor partida y de ahí salen las skins en cualquier navegador.
// Los invitados solo tienen la primera skin.
// Solo datos que se ven: elegida y desbloqueadas (selector de skins y pausa), nuevas (aviso y Game Over)
// y el récord de la cuenta (cuánto falta para cada skin).
export const useSkinsStore = defineStore('skins', {
  state: () => ({
    ...INVITADO,
    nuevas: [] as string[],
    recordCuenta: 0,
  }),
  getters: {
    // Objeto completo del JSON de la skin elegida
    skinActual: (state): Skin => buscarSkin(state.elegida) ?? SKINS[0],
    // Cada skin del JSON con su estado y cuántos puntos le faltan al récord de la cuenta
    catalogo: (state): SkinEnCatalogo[] =>
      SKINS.map((s) => ({
        ...s,
        estado: estadoSkin(s, state.elegida, state.desbloqueadas),
        faltan: puntosQueFaltan(s, state.recordCuenta),
      })),
  },
  actions: {
    // Al abrir el juego y al iniciar o cerrar sesión: carga las skins de esa cuenta (o las de invitado)
    async cargar() {
      const auth = useAuthStore()
      const user = auth.user
      this.nuevas = []
      this.recordCuenta = 0
      if (!user || !auth.token) {
        Object.assign(this, INVITADO)
        return
      }
      Object.assign(this, leer(user.id))
      const record = await mejorPartidaEnServidor(auth.token)
      if (auth.user?.id !== user.id) return // cambió la sesión mientras se esperaba
      this.recordCuenta = Math.max(this.recordCuenta, record)
      const ids = skinsPorDesbloquear(SKINS, this.desbloqueadas, record)
      if (ids.length > 0) this.desbloqueadas = [...this.desbloqueadas, ...ids]
      guardar(user.id, { elegida: this.elegida, desbloqueadas: this.desbloqueadas })
    },
    elegir(id: string) {
      if (!this.desbloqueadas.includes(id)) return
      this.elegida = id
      const user = useAuthStore().user
      if (user) guardar(user.id, { elegida: this.elegida, desbloqueadas: this.desbloqueadas })
    },
    // Se llama con cada cambio de puntaje. Solo con sesión: desbloquea las skins que se alcanzan en esta partida
    comprobar(puntaje: number) {
      const user = useAuthStore().user
      if (!user) return
      this.recordCuenta = Math.max(this.recordCuenta, puntaje)
      const ids = skinsPorDesbloquear(SKINS, this.desbloqueadas, puntaje)
      if (ids.length === 0) return
      this.desbloqueadas = [...this.desbloqueadas, ...ids]
      this.nuevas = [...this.nuevas, ...ids]
      guardar(user.id, { elegida: this.elegida, desbloqueadas: this.desbloqueadas })
    },
    limpiarNuevas() {
      this.nuevas = []
    },
  },
})
