import Phaser from 'phaser'
import { BootScene } from '../scenes/BootScene'
import { GameOverScene } from '../scenes/GameOverScene'
import { GameScene } from '../scenes/GameScene'
import { CELL, COLORS, COLS, ROWS } from './constants'

// Crea el juego. Escenas: Boot (texturas) -> Game (la partida) -> GameOver (efecto final).
// El menú no es una escena: es una pantalla de Vue, así Phaser solo se descarga al jugar.
export function createGame(parent: string, mode: string): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: COLS * CELL,
    height: ROWS * CELL,
    backgroundColor: COLORS.background,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [BootScene, GameScene, GameOverScene],
    callbacks: {
      // id del modo de src/data/modos.json: la escena lee del JSON su comida, jugadores y velocidad
      preBoot: (game) => game.registry.set('mode', mode),
    },
  })
}
