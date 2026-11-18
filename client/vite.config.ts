import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [vue()],
  // Phaser pesa ~1 MB; es normal
  build: { chunkSizeWarningLimit: 1500 },
  server: {
    port: 5173,
    // Las llamadas a /api van al servidor Express (carpeta server); ws: true deja pasar
    // el WebSocket del multijugador en línea (/api/socket.io)
    proxy: {
      '/api': { target: 'http://localhost:3000', ws: true },
    },
  },
})
