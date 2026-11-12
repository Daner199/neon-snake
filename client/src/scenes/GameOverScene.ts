import Phaser from 'phaser'
import { EventBus } from '../events/EventBus'
import { EVENTS, type GameOverStats } from '../events/names'
import { CELL, COLORS, COLS, ROWS } from '../game/constants'
import { explodeBody, makeBurst } from '../game/effects'
import type { Cell } from '../game/Snake'

// Lo que GameScene le pasa al morir el jugador
export interface GameOverData {
  stats: GameOverStats
  body: Cell[] // celdas del jugador al morir, para la explosión
  color: number // color del cuerpo (el de su skin)
}

const DARKEN_MS = 600 // a los 600 ms se avisa a Vue para mostrar la pantalla de Game Over

// Se lanza encima de GameScene (que queda en pausa) cuando muere el jugador.
// Hace el efecto final: el cuerpo explota, la cámara tiembla y la imagen se oscurece poco a poco.
// Al terminar emite game-over con las estadísticas: el "game over" ya no vive dentro de GameScene.
export class GameOverScene extends Phaser.Scene {
  private shaking: Phaser.Cameras.Scene2D.Camera | null = null

  constructor() {
    super('GameOverScene')
  }

  create(data: GameOverData) {
    // Misma vista que la cámara del juego (en el celular puede estar acercada y siguiendo al jugador)
    const gameCam = this.scene.get('GameScene').cameras.main
    this.cameras.main.setZoom(gameCam.zoom).setScroll(gameCam.scrollX, gameCam.scrollY)

    // Velo oscuro que cubre todo el tablero y aparece poco a poco
    const width = COLS * CELL
    const height = ROWS * CELL
    const shade = this.add
      .rectangle(width / 2, height / 2, width * 3, height * 3, COLORS.background)
      .setScrollFactor(0)
      .setAlpha(0)
    this.tweens.add({ targets: shade, alpha: 0.55, duration: DARKEN_MS })

    explodeBody(makeBurst(this), data.body, data.color)

    // Sacudida: GameScene está en pausa y su cámara no se actualiza sola, así que se mueve desde aquí
    gameCam.shake(250, 0.01)
    this.cameras.main.shake(250, 0.01)
    this.shaking = gameCam

    this.time.delayedCall(DARKEN_MS, () => EventBus.emit(EVENTS.GAME_OVER, data.stats))
  }

  update(time: number, delta: number) {
    this.shaking?.shakeEffect.update(time, delta)
  }
}
