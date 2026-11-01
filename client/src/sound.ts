// Efectos de sonido cortos generados con Web Audio (sin archivos ni dependencias)
type Wave = OscillatorType

interface Tone {
  wave: Wave
  from: number // frecuencia inicial en Hz
  to: number // frecuencia final en Hz
  duration: number // segundos
  delay?: number
  volume?: number
}

let ctx: AudioContext | null = null

function context(): AudioContext | null {
  if (!ctx) {
    try {
      ctx = new AudioContext()
    } catch {
      return null
    }
  }
  // El navegador lo deja suspendido hasta que el jugador interactúa
  if (ctx.state === 'suspended') ctx.resume().catch(() => undefined)
  return ctx
}

function play(tones: Tone[]) {
  const ac = context()
  if (!ac) return
  for (const t of tones) {
    const start = ac.currentTime + (t.delay ?? 0)
    const osc = ac.createOscillator()
    const gain = ac.createGain()
    osc.type = t.wave
    osc.frequency.setValueAtTime(t.from, start)
    osc.frequency.exponentialRampToValueAtTime(t.to, start + t.duration)
    gain.gain.setValueAtTime(t.volume ?? 0.12, start)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + t.duration)
    osc.connect(gain).connect(ac.destination)
    osc.start(start)
    osc.stop(start + t.duration + 0.02)
  }
}

export const sounds = {
  eat: () => play([{ wave: 'square', from: 520, to: 880, duration: 0.07, volume: 0.06 }]),
  golden: () =>
    play([
      { wave: 'triangle', from: 660, to: 660, duration: 0.08 },
      { wave: 'triangle', from: 880, to: 880, duration: 0.08, delay: 0.07 },
      { wave: 'triangle', from: 1320, to: 1320, duration: 0.14, delay: 0.14 },
    ]),
  kill: () =>
    play([
      { wave: 'sawtooth', from: 900, to: 120, duration: 0.22, volume: 0.08 },
      { wave: 'square', from: 1200, to: 1600, duration: 0.1, delay: 0.18, volume: 0.06 },
    ]),
  die: () =>
    play([
      { wave: 'sawtooth', from: 360, to: 50, duration: 0.6, volume: 0.12 },
      { wave: 'square', from: 180, to: 40, duration: 0.5, delay: 0.1, volume: 0.06 },
    ]),
}

// Prepara el audio en el primer toque o tecla (requisito de los navegadores)
export function unlockAudio() {
  context()
}
