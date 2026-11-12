// Reglas de las skins. Funciones puras: sin Phaser ni Pinia, así se pueden probar solas (skins.test.ts).
import type { Skin } from '../data/types'

export type EstadoSkin = 'activa' | 'disponible' | 'bloqueada'

// Devuelve los ids de las skins que se desbloquean con este puntaje y que aún no estaban desbloqueadas.
// Regla: una skin se desbloquea al conseguir en una sola partida un puntaje >= su puntajeRequerido.
export function skinsPorDesbloquear(catalogo: Skin[], desbloqueadas: string[], puntaje: number): string[] {
  return catalogo.filter((s) => puntaje >= s.puntajeRequerido && !desbloqueadas.includes(s.id)).map((s) => s.id)
}

// Puntos que le faltan al récord del jugador para llegar a la skin (0 si ya llega)
export function puntosQueFaltan(skin: Skin, record: number): number {
  return Math.max(0, skin.puntajeRequerido - record)
}

export function estadoSkin(skin: Skin, elegida: string, desbloqueadas: string[]): EstadoSkin {
  if (skin.id === elegida) return 'activa'
  return desbloqueadas.includes(skin.id) ? 'disponible' : 'bloqueada'
}
