import { spawnSync } from 'node:child_process'
import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config.ts'

// En Windows, si la terminal abre la carpeta como "c:\..." (VS Code lo hace), Vitest carga dos copias
// de sí mismo (c:\ y C:\) y ninguna prueba arranca. En ese caso se vuelve a lanzar una vez con "C:\".
const lowerDrive = /^[a-z]:/
if (process.platform === 'win32' && lowerDrive.test(process.cwd()) && !process.env.NEON_SNAKE_TEST_RELAUNCH) {
  const upper = (p: string) => p.replace(lowerDrive, (d) => d.toUpperCase())
  const result = spawnSync(process.execPath, [upper(process.argv[1]), ...process.argv.slice(2)], {
    cwd: upper(process.cwd()),
    stdio: 'inherit',
    env: { ...process.env, NEON_SNAKE_TEST_RELAUNCH: '1' },
  })
  process.exit(result.status ?? 1)
}

// Pruebas de la lógica pura (sin Phaser ni navegador): npm test
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: { include: ['src/**/*.test.ts'], environment: 'node' },
  }),
)
