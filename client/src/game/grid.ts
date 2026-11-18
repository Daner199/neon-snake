import { COLS, ROWS } from './constants'
import type { Cell } from './Snake'

// Mapa de ocupación: 0 = libre, otro número = id de la serpiente que ocupa la celda
export type Grid = Int32Array

export const cellIndex = (c: Cell) => c.y * COLS + c.x
export const inside = (c: Cell) => c.x >= 0 && c.y >= 0 && c.x < COLS && c.y < ROWS
