import Phaser from 'phaser'
import { ArenaScene } from './scenes/ArenaScene'

export const CELL = 20 // tamaño de cada celda en píxeles
export const COLS = 64
export const ROWS = 40

export function createGame(parent: string, mode: string): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: COLS * CELL,
    height: ROWS * CELL,
    backgroundColor: '#0b0f1a',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [ArenaScene],
    callbacks: {
      preBoot: (game) => game.registry.set('mode', mode),
    },
  })
}
