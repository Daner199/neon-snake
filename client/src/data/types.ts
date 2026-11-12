// Forma de los datos del juego que viven en JSON (src/data/*.json)

// Una skin de la serpiente del jugador (skins.json)
export interface Skin {
  id: string
  nombre: string
  descripcion: string
  colorCabeza: string // #rrggbb
  colorCuerpo: string
  colorFranja: string // escamas: el cuerpo alterna con este color cada 2 segmentos
  colorBrillo: string // halo neón alrededor de la cabeza
  puntajeRequerido: number // puntaje en una sola partida para desbloquearla
}

// Un modo de juego (modos.json)
export interface Modo {
  id: string // va en la URL (/jugar/arena) y en el ranking
  nombre: string
  descripcion: string
  comida: number // comida normal que siempre hay en el tablero
  jugadores: number // rivales con IA (0 = el jugador solo)
  pasoInicialMs: number // tiempo entre movimientos al empezar (más bajo = más rápido)
  pasoMinimoMs: number // velocidad máxima
  aceleraCadaFrutas: number // cada cuántas frutas va más rápido (0 = nunca)
  atraviesaCuerpo: boolean // true = chocar con tu propio cuerpo no elimina (solo los bordes y las otras serpientes)
}

// Piezas para inventar los nombres de los jugadores con IA (nombres.json)
export interface Nombres {
  bases: string[]
  sufijos: string[]
  paises: string[]
}
