// Canal de mensajes entre Phaser y Vue: el único puente entre los dos.
// Los nombres de los eventos y sus datos están en ./names.ts (quién emite, quién escucha y qué lleva).
// Está tipado: emitir un evento con datos equivocados es un error de TypeScript.
// No depende de Phaser: así las pantallas de Vue cargan sin esperar al motor (~1 MB).
import type { EventName, EventPayloads } from './names'

type Args<K extends EventName> = [EventPayloads[K]] extends [void] ? [] : [EventPayloads[K]]
type Handler<K extends EventName> = (...args: Args<K>) => void

class Emitter {
  private handlers = new Map<EventName, Set<(...args: unknown[]) => void>>()

  on<K extends EventName>(event: K, fn: Handler<K>) {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set())
    this.handlers.get(event)!.add(fn as (...args: unknown[]) => void)
    return this
  }

  off<K extends EventName>(event: K, fn: Handler<K>) {
    this.handlers.get(event)?.delete(fn as (...args: unknown[]) => void)
    return this
  }

  emit<K extends EventName>(event: K, ...args: Args<K>) {
    for (const fn of [...(this.handlers.get(event) ?? [])]) fn(...args)
    return this
  }
}

export const EventBus = new Emitter()
export { EVENTS } from './names'
