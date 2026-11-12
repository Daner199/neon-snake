import { defineStore } from 'pinia'
import type { GameOverStats, LeaderboardRow, SnakeDiedPayload } from '../events/names'

export interface FeedItem {
  id: number
  text: string
  mine: boolean
}

const bestKey = (mode: string) => `neon-snake-record-${mode}`

function readBest(mode: string): number {
  try {
    return Number(localStorage.getItem(bestKey(mode)) ?? 0) || 0
  } catch {
    return 0
  }
}

let feedId = 0

// Estado compartido entre Vue (HUD, ranking en vivo, Game Over) y Phaser (el juego)
export const useGameStore = defineStore('game', {
  state: () => ({
    mode: 'arena',
    score: 0,
    length: 4,
    botsKilled: 0,
    bestScore: 0,
    leaderboard: [] as LeaderboardRow[],
    feed: [] as FeedItem[],
    gameOver: null as GameOverStats | null,
    muerte: null as SnakeDiedPayload | null, // por qué murió el jugador (texto del Game Over)
    newRecord: false,
  }),
  actions: {
    start(mode: string) {
      this.mode = mode
      this.score = 0
      this.length = 4
      this.botsKilled = 0
      this.leaderboard = []
      this.feed = []
      this.gameOver = null
      this.muerte = null
      this.newRecord = false
      this.bestScore = readBest(mode)
    },
    pushFeed(text: string, mine: boolean) {
      const item = { id: ++feedId, text, mine }
      this.feed = [item, ...this.feed].slice(0, 5)
      setTimeout(() => (this.feed = this.feed.filter((f) => f.id !== item.id)), 4000)
    },
    finish(stats: GameOverStats) {
      this.gameOver = stats
      if (stats.score > this.bestScore) {
        this.newRecord = true
        this.bestScore = stats.score
        try {
          localStorage.setItem(bestKey(this.mode), String(stats.score))
        } catch {
          // sin almacenamiento local (modo privado): solo no se guarda el récord
        }
      }
    },
  },
})
