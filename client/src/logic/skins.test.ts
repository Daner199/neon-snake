import { describe, expect, it } from 'vitest'
import type { Skin } from '../data/types'
import { puntosQueFaltan, skinsPorDesbloquear } from './skins'

// Catálogo fijo solo para las pruebas: así agregar o quitar skins en skins.json no rompe estas reglas
// (que skins.json esté bien escrito lo revisa src/data/data.test.ts)
const skin = (id: string, puntajeRequerido: number): Skin => ({
  id,
  nombre: id,
  descripcion: '',
  colorCabeza: '#ffffff',
  colorCuerpo: '#ffffff',
  colorFranja: '#ffffff',
  colorBrillo: '#ffffff',
  puntajeRequerido,
})
const CATALOGO = [skin('neon', 0), skin('hielo', 100), skin('magenta', 250), skin('fuego', 500)]

describe('skinsPorDesbloquear', () => {
  it('con 0 puntos solo está la skin neon', () => {
    expect(skinsPorDesbloquear(CATALOGO, [], 0)).toEqual(['neon'])
  })

  it('con 250 puntos se desbloquean hielo y magenta si no estaban', () => {
    expect(skinsPorDesbloquear(CATALOGO, ['neon'], 250)).toEqual(['hielo', 'magenta'])
  })

  it('una skin ya desbloqueada no se devuelve otra vez', () => {
    expect(skinsPorDesbloquear(CATALOGO, ['neon', 'hielo'], 250)).toEqual(['magenta'])
    expect(skinsPorDesbloquear(CATALOGO, ['neon', 'hielo', 'magenta'], 250)).toEqual([])
  })

  it('exactamente el puntajeRequerido desbloquea (el límite es inclusivo)', () => {
    for (const s of CATALOGO) {
      const otras = CATALOGO.filter((o) => o.id !== s.id).map((o) => o.id)
      expect(skinsPorDesbloquear(CATALOGO, otras, s.puntajeRequerido)).toEqual([s.id])
      if (s.puntajeRequerido > 0) expect(skinsPorDesbloquear(CATALOGO, otras, s.puntajeRequerido - 1)).toEqual([])
    }
  })
})

describe('puntosQueFaltan', () => {
  it('resta el récord al puntaje requerido y nunca baja de 0', () => {
    const fuego = CATALOGO[3]
    expect(puntosQueFaltan(fuego, 380)).toBe(120)
    expect(puntosQueFaltan(fuego, 900)).toBe(0)
  })
})
