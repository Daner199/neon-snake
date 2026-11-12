// Datos del juego ya tipados. Para agregar una skin o un modo solo se edita el JSON.
import modosJson from './modos.json'
import nombresJson from './nombres.json'
import skinsJson from './skins.json'
import type { Modo, Nombres, Skin } from './types'

export const SKINS: Skin[] = skinsJson
export const MODOS: Modo[] = modosJson
export const NOMBRES: Nombres = nombresJson

export const buscarModo = (id: unknown): Modo | undefined => MODOS.find((m) => m.id === id)
export const buscarSkin = (id: unknown): Skin | undefined => SKINS.find((s) => s.id === id)

export type { Modo, Nombres, Skin } from './types'
