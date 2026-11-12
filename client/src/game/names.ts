// Nombres de jugador para los bots, al estilo de un juego en línea.
// Las piezas (bases, sufijos y países) están en src/data/nombres.json
import { NOMBRES } from '../data'

const pick = <T>(list: T[]): T => list[Math.floor(Math.random() * list.length)]

export interface PlayerTag {
  name: string
  country: string
  level: number
}

export function randomTag(taken: Set<string>): PlayerTag {
  for (let i = 0; i < 50; i++) {
    const name = pick(NOMBRES.bases) + pick(NOMBRES.sufijos)
    if (!taken.has(name)) {
      return {
        name,
        country: pick(NOMBRES.paises),
        level: 1 + Math.floor(Math.random() * 40),
      }
    }
  }
  return { name: 'Jugador' + Math.floor(Math.random() * 1000), country: pick(NOMBRES.paises), level: 1 }
}
