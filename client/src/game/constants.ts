// Medidas del tablero y reglas, compartidas por todas las escenas
export const CELL = 20 // tamaño de cada celda en píxeles
export const COLS = 64
export const ROWS = 40

export const START_STEP_MS = 110 // tiempo entre movimientos (más bajo = más rápido)
export const MIN_STEP_MS = 60
export const FOOD_COUNT = { arena: 45, classic: 1 } as const
export const BOT_COUNT = 7
export const BOT_RESPAWN_MS = 2500

export const POINTS = {
  food: 10,
  goldenFood: 50,
  kill: 100,
} as const

// Los mismos colores que las variables de style.css, en el formato numérico de Phaser
export const COLORS = {
  background: 0x0b0f1a,
  player: 0x39ff14,
  food: 0xff2e88,
  golden: 0xffc83d,
  grid: 0x39ff14,
  bots: [0x3db8ff, 0xb36bff, 0xff9f43, 0x00e5d4, 0xffe15a, 0xff6b6b, 0x7c9cff, 0xf78fff],
} as const

export type GameMode = 'arena' | 'classic'
