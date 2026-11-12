import { describe, expect, it } from 'vitest'
import modos from './modos.json'
import nombres from './nombres.json'
import skins from './skins.json'

// Se revisan los JSON tal cual están en disco: así un error al agregar una skin o un modo salta aquí
const COLOR = /^#[0-9a-f]{6}$/i
const ID = /^[a-z0-9-]+$/ // va en la URL (/jugar/arena) y en localStorage

const SKIN_TEXTO = ['id', 'nombre', 'descripcion'] as const
const SKIN_COLORES = ['colorCabeza', 'colorCuerpo', 'colorFranja', 'colorBrillo'] as const
const MODO_NUMEROS = ['comida', 'jugadores', 'pasoInicialMs', 'pasoMinimoMs', 'aceleraCadaFrutas'] as const

const sinRepetir = (ids: string[]) => new Set(ids).size === ids.length

describe('skins.json', () => {
  it('cada skin tiene todos los campos', () => {
    for (const s of skins as Record<string, unknown>[]) {
      for (const k of SKIN_TEXTO) expect(typeof s[k], `${s.id}.${k}`).toBe('string')
      for (const k of SKIN_COLORES) expect(s[k], `${s.id}.${k}`).toMatch(COLOR)
      expect(Number.isInteger(s.puntajeRequerido), `${s.id}.puntajeRequerido`).toBe(true)
      expect(s.id).toMatch(ID)
    }
  })

  it('los ids no se repiten', () => {
    expect(sinRepetir(skins.map((s) => s.id))).toBe(true)
  })

  it('la primera skin tiene puntajeRequerido 0 y están ordenadas de menor a mayor', () => {
    expect(skins[0].puntajeRequerido).toBe(0)
    const puntajes = skins.map((s) => s.puntajeRequerido)
    expect(puntajes).toEqual([...puntajes].sort((a, b) => a - b))
  })
})

describe('modos.json', () => {
  it('cada modo tiene todos los campos', () => {
    for (const m of modos as Record<string, unknown>[]) {
      for (const k of ['id', 'nombre', 'descripcion']) expect(typeof m[k], `${m.id}.${k}`).toBe('string')
      for (const k of MODO_NUMEROS) {
        expect(Number.isInteger(m[k]), `${m.id}.${k}`).toBe(true)
        expect(m[k] as number, `${m.id}.${k}`).toBeGreaterThanOrEqual(0)
      }
      expect(m.id).toMatch(ID)
    }
  })

  it('los ids no se repiten', () => {
    expect(sinRepetir(modos.map((m) => m.id))).toBe(true)
  })

  it('hay comida y la velocidad tiene sentido', () => {
    for (const m of modos) {
      expect(m.comida).toBeGreaterThan(0)
      expect(m.pasoMinimoMs).toBeGreaterThan(0)
      expect(m.pasoMinimoMs).toBeLessThanOrEqual(m.pasoInicialMs)
    }
  })
})

describe('nombres.json', () => {
  it('tiene bases, sufijos y países', () => {
    expect(nombres.bases.length).toBeGreaterThan(0)
    expect(nombres.sufijos.length).toBeGreaterThan(0)
    expect(nombres.paises.length).toBeGreaterThan(0)
  })
})
