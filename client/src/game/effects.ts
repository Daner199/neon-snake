import type Phaser from 'phaser'
import { CELL, TEXTURES } from './constants'
import type { Cell } from './Snake'

// Partículas de las explosiones (las usan GameScene para los bots y GameOverScene para el jugador)
export function makeBurst(scene: Phaser.Scene): Phaser.GameObjects.Particles.ParticleEmitter {
  return scene.add
    .particles(0, 0, TEXTURES.dot, {
      speed: { min: 30, max: 150 },
      lifespan: 700,
      scale: { start: 0.9, end: 0 },
      alpha: { start: 1, end: 0 },
      emitting: false,
    })
    .setDepth(20)
}

// Al morir, el cuerpo se deshace en partículas a lo largo de su forma (la cabeza es la última celda)
export function explodeBody(burst: Phaser.GameObjects.Particles.ParticleEmitter, cells: Cell[], color: number) {
  burst.setParticleTint(color)
  const every = Math.max(1, Math.floor(cells.length / 24))
  for (let i = cells.length - 1; i >= 0; i -= every) {
    const c = cells[i]
    burst.explode(i === cells.length - 1 ? 12 : 4, c.x * CELL + CELL / 2, c.y * CELL + CELL / 2)
  }
}
