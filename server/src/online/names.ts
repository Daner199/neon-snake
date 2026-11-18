// Nombres y colores de los jugadores con IA en las salas en línea
// (las mismas piezas que client/src/data/nombres.json y los colores de COLORS.bots del juego)
import type { NetColors } from './shared/protocol.js'

const BASES = ["VíboraX", "Serpentina", "Cobra", "Pitón", "Anaconda", "NeonKing", "luzverde", "m4ria", "ZigZag", "TheBoa", "sofi", "juanito", "Mamba", "krt", "pixelpro", "Culebra", "Kaiser", "nova", "Tito", "Rayo", "Sombra", "Glitch", "Lobo", "Xime", "Diego", "Vale", "Toxic", "Byte", "Coral", "Escamas"]
const SUFIJOS = ["", "", "_77", "99", "XD", "_pe", "_mx", "2010", "_ar", "_pro", "7", "_snk", "23"]
const PAISES = ["PE", "MX", "AR", "CO", "CL", "ES", "EC", "BO", "VE", "UY"]

const pick = <T>(list: T[]): T => list[Math.floor(Math.random() * list.length)]

export function botName(taken: Set<string>): { name: string; country: string; level: number } {
  for (let i = 0; i < 50; i++) {
    const name = pick(BASES) + pick(SUFIJOS)
    if (!taken.has(name)) return { name, country: pick(PAISES), level: 1 + Math.floor(Math.random() * 40) }
  }
  return { name: 'Jugador' + Math.floor(Math.random() * 1000), country: pick(PAISES), level: 1 }
}

const WHITE = 0xffffff
const BACKGROUND = 0x0b0f1a
const rgb = (c: number) => [(c >> 16) & 255, (c >> 8) & 255, c & 255]
function mix(a: number, b: number, t: number): number {
  const [ar, ag, ab] = rgb(a)
  const [br, bg, bb] = rgb(b)
  return (Math.round(ar + (br - ar) * t) << 16) | (Math.round(ag + (bg - ag) * t) << 8) | Math.round(ab + (bb - ab) * t)
}

const BASE_COLORS = [0x3db8ff, 0xb36bff, 0xff9f43, 0x00e5d4, 0xffe15a, 0xff6b6b, 0x7c9cff, 0xf78fff]
export const BOT_COLORS: NetColors[] = BASE_COLORS.map((c) => ({
  head: mix(c, WHITE, 0.35),
  body: c,
  stripe: mix(c, BACKGROUND, 0.28),
  glow: c,
}))

// Colores para personas cuya skin choca con la de otra en la sala (distintos de los bots)
const HUMAN_BASES = [0xf2f5ff, 0x00ff9c, 0xff5ef0, 0x5ef1ff, 0xffb3d9]
export const HUMAN_COLORS: NetColors[] = HUMAN_BASES.map((c) => ({
  head: mix(c, WHITE, 0.35),
  body: c,
  stripe: mix(c, BACKGROUND, 0.28),
  glow: c,
}))
