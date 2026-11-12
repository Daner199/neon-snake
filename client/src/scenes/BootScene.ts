import Phaser from 'phaser'
import { CELL, COLORS, COLS, DISC_PX, GLOW_PX, ROWS, TEXTURES } from '../game/constants'

// Primera escena: pinta una sola vez las texturas que usan las demás y arranca la partida.
// No carga archivos: todo se dibuja con canvas (círculo, brillo, cuadrícula y partícula).
export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene')
  }

  create() {
    this.makeTextures()
    this.scene.start('GameScene')
  }

  private makeTextures() {
    // Círculo blanco: cuerpo, cabeza, ojos y comida (se tiñe con el color de cada cosa)
    if (!this.textures.exists(TEXTURES.disc)) {
      const t = this.textures.createCanvas(TEXTURES.disc, DISC_PX, DISC_PX)!
      t.context.fillStyle = 'white'
      t.context.beginPath()
      t.context.arc(DISC_PX / 2, DISC_PX / 2, DISC_PX / 2 - 1, 0, Math.PI * 2)
      t.context.fill()
      t.refresh()
    }
    // Brillo neón: degradado radial que se suma a lo de abajo
    if (!this.textures.exists(TEXTURES.glow)) {
      const t = this.textures.createCanvas(TEXTURES.glow, GLOW_PX, GLOW_PX)!
      const half = GLOW_PX / 2
      const gradient = t.context.createRadialGradient(half, half, 0, half, half, half)
      gradient.addColorStop(0, 'rgba(255, 255, 255, 0.9)')
      gradient.addColorStop(0.35, 'rgba(255, 255, 255, 0.35)')
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0)')
      t.context.fillStyle = gradient
      t.context.fillRect(0, 0, GLOW_PX, GLOW_PX)
      t.refresh()
    }
    // Tablero: cuadrícula tenue y borde
    if (!this.textures.exists(TEXTURES.grid)) {
      const g = this.make.graphics({ x: 0, y: 0 }, false)
      g.lineStyle(1, COLORS.grid, 0.06)
      for (let x = 0; x <= COLS; x++) g.lineBetween(x * CELL, 0, x * CELL, ROWS * CELL)
      for (let y = 0; y <= ROWS; y++) g.lineBetween(0, y * CELL, COLS * CELL, y * CELL)
      g.lineStyle(2, COLORS.grid, 0.35)
      g.strokeRect(1, 1, COLS * CELL - 2, ROWS * CELL - 2)
      g.generateTexture(TEXTURES.grid, COLS * CELL, ROWS * CELL)
      g.destroy()
    }
    // Partícula de las explosiones
    if (!this.textures.exists(TEXTURES.dot)) {
      const g = this.make.graphics({ x: 0, y: 0 }, false)
      g.fillStyle(0xffffff, 1)
      g.fillCircle(4, 4, 4)
      g.generateTexture(TEXTURES.dot, 8, 8)
      g.destroy()
    }
  }
}
