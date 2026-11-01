import Phaser from 'phaser'

// Canal de mensajes entre Phaser y Vue.
// Phaser emite: 'score-changed', 'bot-killed', 'game-over'
// Vue emite:    'pause', 'resume', 'restart'
export const EventBus = new Phaser.Events.EventEmitter()
