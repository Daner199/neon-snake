import { defineStore } from 'pinia'
import { api } from '../api'

export interface AuthUser {
  id: string
  username: string
}

interface AuthResponse {
  token: string
  user: AuthUser
}

const STORAGE_KEY = 'neon-snake-auth'

function readSaved(): AuthResponse | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as AuthResponse) : null
  } catch {
    return null
  }
}

function save(value: AuthResponse | null) {
  try {
    if (value) localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    // sin almacenamiento local (modo privado): la sesión dura hasta cerrar la pestaña
  }
}

// Sesión del jugador: token JWT y nombre de usuario
export const useAuthStore = defineStore('auth', {
  state: () => {
    const saved = readSaved()
    return { token: saved?.token ?? null, user: saved?.user ?? null }
  },
  getters: {
    loggedIn: (state) => state.token !== null,
  },
  actions: {
    setSession(session: AuthResponse) {
      this.token = session.token
      this.user = session.user
      save(session)
    },
    async login(username: string, password: string) {
      this.setSession(await api<AuthResponse>('/auth/login', { method: 'POST', body: { username, password } }))
    },
    async register(username: string, email: string, password: string) {
      this.setSession(
        await api<AuthResponse>('/auth/register', { method: 'POST', body: { username, email, password } }),
      )
    },
    logout() {
      this.token = null
      this.user = null
      save(null)
    },
  },
})
