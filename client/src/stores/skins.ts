import { defineStore } from 'pinia'
import { buscarSkin, SKINS, type Skin } from '../data'
import { estadoSkin, puntosQueFaltan, skinsPorDesbloquear, type EstadoSkin } from '../logic/skins'
import { leerRecordGlobal, useGameStore } from './game'

const STORAGE_KEY = 'neon-snake-skins'
const PRIMERA = SKINS[0].id // la primera skin del JSON siempre está desbloqueada

export type SkinEnCatalogo = Skin & { estado: EstadoSkin; faltan: number }

interface Guardado {
  elegida: string
  desbloqueadas: string[]
}

function leer(): Guardado {
  let saved: Partial<Guardado> = {}
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')
    if (parsed && typeof parsed === 'object') saved = parsed as Partial<Guardado>
  } catch {
    // sin almacenamiento local o datos rotos: se empieza con la primera skin
  }
  // Solo ids que existen en el JSON (si se borra una skin, desaparece sin romper nada)
  const guardadas = Array.isArray(saved.desbloqueadas) ? saved.desbloqueadas.filter((id) => buscarSkin(id)) : []
  const base = [PRIMERA, ...guardadas.filter((id) => id !== PRIMERA)]
  // El récord es el puntaje de una sola partida: lo conseguido antes de que existieran las skins también cuenta
  const desbloqueadas = [...base, ...skinsPorDesbloquear(SKINS, base, leerRecordGlobal())]
  const elegida = typeof saved.elegida === 'string' && desbloqueadas.includes(saved.elegida) ? saved.elegida : PRIMERA
  return { elegida, desbloqueadas }
}

function guardar(value: Guardado) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
  } catch {
    // sin almacenamiento local (modo privado): las skins duran hasta cerrar la pestaña
  }
}

// Skins del jugador. Solo datos que se ven: la elegida y las desbloqueadas (selector de skins y pausa)
// y las nuevas de esta partida (aviso durante el juego y Game Over).
export const useSkinsStore = defineStore('skins', {
  state: () => ({
    ...leer(),
    nuevas: [] as string[],
  }),
  getters: {
    // Objeto completo del JSON de la skin elegida
    skinActual: (state): Skin => buscarSkin(state.elegida) ?? SKINS[0],
    // Cada skin del JSON con su estado y cuántos puntos le faltan al récord para llegar
    catalogo(state): SkinEnCatalogo[] {
      const record = useGameStore().recordGlobal
      return SKINS.map((s) => ({
        ...s,
        estado: estadoSkin(s, state.elegida, state.desbloqueadas),
        faltan: puntosQueFaltan(s, record),
      }))
    },
  },
  actions: {
    elegir(id: string) {
      if (!this.desbloqueadas.includes(id)) return
      this.elegida = id
      guardar({ elegida: this.elegida, desbloqueadas: this.desbloqueadas })
    },
    // Se llama con cada cambio de puntaje: desbloquea las skins que se alcanzan en esta partida
    comprobar(puntaje: number) {
      const ids = skinsPorDesbloquear(SKINS, this.desbloqueadas, puntaje)
      if (ids.length === 0) return
      this.desbloqueadas = [...this.desbloqueadas, ...ids]
      this.nuevas = [...this.nuevas, ...ids]
      guardar({ elegida: this.elegida, desbloqueadas: this.desbloqueadas })
    },
    limpiarNuevas() {
      this.nuevas = []
    },
  },
})
