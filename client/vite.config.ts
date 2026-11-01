import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [vue()],
  // Phaser pesa ~1 MB; es normal
  build: { chunkSizeWarningLimit: 1500 },
  server: {
    port: 5173,
    // Las llamadas a /api van al servidor Express (carpeta server)
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
})
