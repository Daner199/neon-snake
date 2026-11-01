// Canal de mensajes entre Phaser y Vue.
// Phaser emite: 'scene-ready', 'score-changed', 'food-eaten', 'bot-killed', 'player-died', 'game-over', 'leaderboard', 'feed'
// Vue emite:    'pause', 'resume', 'restart', 'turn'
// No depende de Phaser: así las pantallas de Vue cargan sin esperar al motor (~1 MB).
type Handler = (...args: never[]) => void

class Emitter {
  private handlers = new Map<string, Set<Handler>>()

  on(event: string, fn: Handler) {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set())
    this.handlers.get(event)!.add(fn)
    return this
  }

  off(event: string, fn: Handler) {
    this.handlers.get(event)?.delete(fn)
    return this
  }

  emit(event: string, ...args: unknown[]) {
    for (const fn of [...(this.handlers.get(event) ?? [])]) (fn as (...a: unknown[]) => void)(...args)
    return this
  }
}

export const EventBus = new Emitter()
