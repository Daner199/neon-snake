// Pantalla completa y orientación horizontal para jugar en el celular.
// Los navegadores solo lo permiten justo después de un toque del jugador (por eso se llama al pulsar Jugar).

type LockableOrientation = ScreenOrientation & {
  lock?: (orientation: 'landscape') => Promise<void>
  unlock?: () => void
}

export const isTouchScreen = () => window.matchMedia('(pointer: coarse)').matches

export async function enterGameScreen() {
  if (!isTouchScreen()) return
  try {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen?.({ navigationUI: 'hide' })
  } catch {
    // iPhone no permite pantalla completa en páginas: se juega igual
  }
  try {
    await (screen.orientation as LockableOrientation).lock?.('landscape')
  } catch {
    // iPhone y algunos navegadores no dejan bloquear la orientación: se muestra el aviso de girar
  }
}

export function leaveGameScreen() {
  try {
    ;(screen.orientation as LockableOrientation).unlock?.()
  } catch {
    // nada que desbloquear
  }
  if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined)
}
