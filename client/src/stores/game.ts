import { defineStore } from 'pinia'

// Estado compartido entre Vue (HUD, Game Over) y Phaser (el juego)
export const useGameStore = defineStore('game', {
  state: () => ({
    score: 0,
    length: 3,
    botsKilled: 0,
    bestScore: 0,
  }),
  actions: {
    reset() {
      this.score = 0
      this.length = 3
      this.botsKilled = 0
    },
  },
})
