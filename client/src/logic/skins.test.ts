import { describe, expect, it } from 'vitest'
import { SKINS } from '../data'
import { puntosQueFaltan, skinsPorDesbloquear } from './skins'

describe('skinsPorDesbloquear', () => {
  it('con 0 puntos solo está la skin neon', () => {
    expect(skinsPorDesbloquear(SKINS, [], 0)).toEqual(['neon'])
  })

  it('con 250 puntos se desbloquean hielo y magenta si no estaban', () => {
    expect(skinsPorDesbloquear(SKINS, ['neon'], 250)).toEqual(['hielo', 'magenta'])
  })

  it('una skin ya desbloqueada no se devuelve otra vez', () => {
    expect(skinsPorDesbloquear(SKINS, ['neon', 'hielo'], 250)).toEqual(['magenta'])
    expect(skinsPorDesbloquear(SKINS, ['neon', 'hielo', 'magenta'], 250)).toEqual([])
  })

  it('exactamente el puntajeRequerido desbloquea (el límite es inclusivo)', () => {
    for (const skin of SKINS) {
      const otras = SKINS.filter((s) => s.id !== skin.id).map((s) => s.id)
      expect(skinsPorDesbloquear(SKINS, otras, skin.puntajeRequerido)).toEqual([skin.id])
      if (skin.puntajeRequerido > 0) expect(skinsPorDesbloquear(SKINS, otras, skin.puntajeRequerido - 1)).toEqual([])
    }
  })
})

describe('puntosQueFaltan', () => {
  it('resta el récord al puntaje requerido y nunca baja de 0', () => {
    const fuego = SKINS.find((s) => s.id === 'fuego')!
    expect(puntosQueFaltan(fuego, 380)).toBe(120)
    expect(puntosQueFaltan(fuego, 900)).toBe(0)
  })
})
