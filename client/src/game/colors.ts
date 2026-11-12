// Colores de las serpientes en el formato numérico de Phaser (0xrrggbb)
import type { Skin } from '../data/types'
import { COLORS } from './constants'

export interface SnakeColors {
  head: number
  body: number
  stripe: number // escamas: el cuerpo alterna con este color cada 2 segmentos
  glow: number // brillo neón alrededor de la cabeza
}

// Colores de una skin: lo que llega con el evento skin-changed
export type SkinColors = Pick<Skin, 'colorCabeza' | 'colorCuerpo' | 'colorFranja' | 'colorBrillo'>

const WHITE = 0xffffff

export const hex = (n: number) => '#' + n.toString(16).padStart(6, '0')
export const fromHex = (s: string) => parseInt(s.slice(1), 16)

const rgb = (c: number) => [(c >> 16) & 255, (c >> 8) & 255, c & 255]

// Mezcla un color con otro (t = 0: el primero, t = 1: el segundo)
export function mix(a: number, b: number, t: number): number {
  const [ar, ag, ab] = rgb(a)
  const [br, bg, bb] = rgb(b)
  return (Math.round(ar + (br - ar) * t) << 16) | (Math.round(ag + (bg - ag) * t) << 8) | Math.round(ab + (bb - ab) * t)
}

// Bots: a partir de un solo color se sacan la cabeza (más clara), la franja (más oscura) y el brillo
export function colorsFromBase(c: number): SnakeColors {
  return { head: mix(c, WHITE, 0.35), body: c, stripe: mix(c, COLORS.background, 0.28), glow: c }
}

// Jugador: los cuatro colores vienen de la skin elegida (src/data/skins.json)
export function colorsFromSkin(skin: SkinColors): SnakeColors {
  return {
    head: fromHex(skin.colorCabeza),
    body: fromHex(skin.colorCuerpo),
    stripe: fromHex(skin.colorFranja),
    glow: fromHex(skin.colorBrillo),
  }
}

// El color de la lista que más se parece a "target" (distancia entre sus componentes rojo, verde y azul)
export function closestColor(list: readonly number[], target: number): number {
  const [tr, tg, tb] = rgb(target)
  let best = list[0]
  let bestDist = Infinity
  for (const c of list) {
    const [r, g, b] = rgb(c)
    const d = (r - tr) ** 2 + (g - tg) ** 2 + (b - tb) ** 2
    if (d < bestDist) {
      bestDist = d
      best = c
    }
  }
  return best
}
