import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [vue()],
  // Phaser pesa ~1 MB; es normal
  build: { chunkSizeWarningLimit: 1500 },
  server: {
    port: 5173,
    // Las llamadas a /api van al servidor Express (carpeta server); ws: true deja pasar
    // el WebSocket del multijugador en línea (/api/socket.io).
    // Con API_URL se usa otro servidor, p. ej. el publicado en Render:
    //   PowerShell: $env:API_URL='https://neon-snake-api.onrender.com'; npm run dev
    proxy: {
      '/api': { target: process.env.API_URL || 'http://localhost:3000', ws: true, changeOrigin: true },
    },
  },
})
