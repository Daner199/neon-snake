import Phaser from 'phaser'

// Canal de mensajes entre Phaser y Vue.
// Phaser emite: 'score-changed', 'food-eaten', 'bot-killed', 'player-died', 'game-over', 'leaderboard', 'feed'
// Vue emite:    'pause', 'resume', 'restart', 'turn'
export const EventBus = new Phaser.Events.EventEmitter()
