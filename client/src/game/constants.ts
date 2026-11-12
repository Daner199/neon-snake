// Medidas del tablero y reglas, compartidas por todas las escenas
export const CELL = 20 // tamaño de cada celda en píxeles
export const COLS = 64
export const ROWS = 40

// Lo que cambia por modo (comida, jugadores, velocidad) está en src/data/modos.json
export const SPEEDUP_MS = 8 // cuánto se acorta el paso cada "aceleraCadaFrutas" frutas
export const GOLDEN_CHANCE = 0.06 // probabilidad de que una comida sea dorada (solo con rivales)
export const BOT_RESPAWN_MS = 2500
export const BOT_FLOOD_LIMIT = 150 // celdas que mira un bot para no meterse en callejones

// Cámara en pantallas pequeñas: si cada celda se ve de menos de MIN_CELL_PX, se acerca y sigue al jugador
export const MIN_CELL_PX = 10
export const TARGET_CELL_PX = 15
export const MAX_ZOOM = 2
export const MINIMAP = { width: 256, height: 160, margin: 16 } as const

export const POINTS = {
  food: 10,
  goldenFood: 50,
  kill: 100,
} as const

// Los mismos colores que las variables de style.css, en el formato numérico de Phaser
export const COLORS = {
  background: 0x0b0f1a,
  surface: 0x121a2b,
  eye: 0xe6edf7,
  player: 0x39ff14,
  food: 0xff2e88,
  golden: 0xffc83d,
  grid: 0x39ff14,
  bots: [0x3db8ff, 0xb36bff, 0xff9f43, 0x00e5d4, 0xffe15a, 0xff6b6b, 0x7c9cff, 0xf78fff],
} as const

// Texturas que crea BootScene una sola vez y usan las demás escenas (blancas: se tiñen con setTint)
export const TEXTURES = { disc: 'disc', glow: 'glow', grid: 'grid', dot: 'dot' } as const
export const DISC_PX = 64 // tamaño en píxeles de la textura del círculo
export const GLOW_PX = 128 // tamaño en píxeles de la textura del brillo
