import Phaser from 'phaser'
import { CELL, COLORS, COLS, ROWS } from './constants'
import { ArenaScene } from '../scenes/ArenaScene'

export function createGame(parent: string, mode: string): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: COLS * CELL,
    height: ROWS * CELL,
    backgroundColor: COLORS.background,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [ArenaScene],
    callbacks: {
      preBoot: (game) => game.registry.set('mode', mode),
    },
  })
}
