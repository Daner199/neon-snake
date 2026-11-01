import { defineStore } from 'pinia'

const MUTED_KEY = 'neon-snake-muted'

function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTED_KEY) === '1'
  } catch {
    return false
  }
}

// Ajustes del jugador que se recuerdan entre visitas
export const useSettingsStore = defineStore('settings', {
  state: () => ({
    muted: readMuted(),
  }),
  actions: {
    toggleMute() {
      this.muted = !this.muted
      try {
        localStorage.setItem(MUTED_KEY, this.muted ? '1' : '0')
      } catch {
        // sin almacenamiento local: el ajuste dura hasta cerrar la pestaña
      }
    },
  },
})
