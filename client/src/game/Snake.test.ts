import { describe, expect, it } from 'vitest'
import { DIRS, Snake } from './Snake'

const tag = { name: 'Prueba', country: 'PE', level: 1 }
const colors = { head: 0xffffff, body: 0x39ff14, stripe: 0x22b80c, glow: 0x39ff14 }

// Serpiente de 4 segmentos que va a la derecha con la cabeza en (5, 5)
const nueva = () => new Snake(tag, colors, { x: 5, y: 5 }, DIRS.right, 4, true)

describe('Snake', () => {
  it('se crea con sus segmentos de la cola a la cabeza', () => {
    expect(nueva().cells).toEqual([
      { x: 2, y: 5 },
      { x: 3, y: 5 },
      { x: 4, y: 5 },
      { x: 5, y: 5 },
    ])
  })

  it('no puede girar 180°: si va a la derecha, no gira a la izquierda', () => {
    const s = nueva()
    s.turn(DIRS.left)
    expect(s.nextDir).toEqual(DIRS.right)
    expect(s.nextHead()).toEqual({ x: 6, y: 5 })
  })

  it('nextHead() devuelve la celda siguiente en la dirección elegida', () => {
    const s = nueva()
    expect(s.nextHead()).toEqual({ x: 6, y: 5 })
    s.turn(DIRS.up)
    expect(s.nextHead()).toEqual({ x: 5, y: 4 })
    s.turn(DIRS.down)
    expect(s.nextHead()).toEqual({ x: 5, y: 6 })
  })
})
