// Nombres de todos los eventos entre Vue y Phaser, y los datos que lleva cada uno.
// Es el único lugar donde se escribe el texto de un evento: el resto del código usa EVENTS.X.

export const EVENTS = {
  // Phaser (GameScene) -> Vue (GameCanvas, GameView). Sin datos. La escena terminó create()
  SCENE_READY: 'scene-ready',
  // Phaser (GameScene) -> Vue (GameCanvas). Sin datos. El navegador perdió el contexto WebGL
  RENDER_LOST: 'render-lost',
  // Phaser (GameScene) -> Vue (GameView -> Pinia). ScorePayload. Cambió el puntaje, el tamaño o los eliminados
  SCORE_CHANGED: 'score-changed',
  // Phaser (GameScene) -> Vue (GameView: sonido). FoodEatenPayload. El jugador comió
  FOOD_EATEN: 'food-eaten',
  // Phaser (GameScene) -> Vue (GameView: sonido). Texto con el nombre del eliminado. El jugador eliminó a otro
  BOT_KILLED: 'bot-killed',
  // Phaser (GameScene) -> Vue (GameView: sonido). Sin datos. Murió el jugador
  PLAYER_DIED: 'player-died',
  // Phaser (GameScene) -> Vue (GameView -> Pinia). GameOverStats. Fin de la partida con sus estadísticas
  GAME_OVER: 'game-over',
  // Phaser (GameScene) -> Vue (GameView -> Pinia). LeaderboardRow[]. Ranking en vivo de la partida
  LEADERBOARD: 'leaderboard',
  // Phaser (GameScene) -> Vue (GameView -> Pinia). FeedPayload. Mensaje corto ("X te eliminó")
  FEED: 'feed',
  // Vue (GameView) -> Phaser (GameScene). Sin datos. Pausar la partida
  PAUSE: 'pause',
  // Vue (GameView) -> Phaser (GameScene). Sin datos. Seguir jugando
  RESUME: 'resume',
  // Vue (GameView: cruceta táctil) -> Phaser (GameScene). Direction. Girar la serpiente del jugador
  TURN: 'turn',
} as const

export type EventName = (typeof EVENTS)[keyof typeof EVENTS]

export type Direction = 'up' | 'down' | 'left' | 'right'

export interface ScorePayload {
  score: number
  length: number
  botsKilled: number
}

export interface FeedPayload {
  text: string
  mine: boolean
}

export interface LeaderboardRow {
  id: number
  name: string
  country: string
  level: number
  score: number
  color: string
  isPlayer: boolean
}

export interface GameOverStats {
  mode: string
  score: number
  length: number
  botsKilled: number
  foodsEaten: number
  durationMs: number
  killedBy: string | null
  rank: number
  players: number
}

// Datos de cada evento (void = el evento no lleva datos)
export interface EventPayloads {
  [EVENTS.SCENE_READY]: void
  [EVENTS.RENDER_LOST]: void
  [EVENTS.SCORE_CHANGED]: ScorePayload
  [EVENTS.FOOD_EATEN]: boolean
  [EVENTS.BOT_KILLED]: string
  [EVENTS.PLAYER_DIED]: void
  [EVENTS.GAME_OVER]: GameOverStats
  [EVENTS.LEADERBOARD]: LeaderboardRow[]
  [EVENTS.FEED]: FeedPayload
  [EVENTS.PAUSE]: void
  [EVENTS.RESUME]: void
  [EVENTS.TURN]: Direction
}
