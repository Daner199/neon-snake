// Nombres de jugador para los bots, al estilo de un juego en línea
const BASES = [
  'VíboraX', 'Serpentina', 'Cobra', 'Pitón', 'Anaconda', 'NeonKing', 'luzverde', 'm4ria', 'ZigZag',
  'TheBoa', 'sofi', 'juanito', 'Mamba', 'krt', 'pixelpro', 'Culebra', 'Kaiser', 'nova', 'Tito',
  'Rayo', 'Sombra', 'Glitch', 'Lobo', 'Xime', 'Diego', 'Vale', 'Toxic', 'Byte', 'Coral', 'Escamas',
]
const SUFFIXES = ['', '', '_77', '99', 'XD', '_pe', '_mx', '2010', '_ar', '_pro', '7', '_snk', '23']
const COUNTRIES = ['PE', 'MX', 'AR', 'CO', 'CL', 'ES', 'EC', 'BO', 'VE', 'UY']

export interface PlayerTag {
  name: string
  country: string
  level: number
}

export function randomTag(taken: Set<string>): PlayerTag {
  for (let i = 0; i < 50; i++) {
    const base = BASES[Math.floor(Math.random() * BASES.length)]
    const suffix = SUFFIXES[Math.floor(Math.random() * SUFFIXES.length)]
    const name = base + suffix
    if (!taken.has(name)) {
      return {
        name,
        country: COUNTRIES[Math.floor(Math.random() * COUNTRIES.length)],
        level: 1 + Math.floor(Math.random() * 40),
      }
    }
  }
  return { name: 'Jugador' + Math.floor(Math.random() * 1000), country: 'PE', level: 1 }
}
