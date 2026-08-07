import type { Screen } from '../types'
import { presetById } from '../data/modulePresets'

/** Amperaje estimado a blanco 100%, por m². */
export const AMPS_PER_M2 = 2.4

export interface ScreenMetrics {
  totalModules: number
  activeModules: number
  wPx: number
  hPx: number
  moduleAreaM2: number
  areaM2: number
  amps: number
}

export function screenMetrics(screen: Screen): ScreenMetrics {
  const preset = presetById(screen.presetId)
  const totalModules = screen.cols * screen.rows
  const activeModules = totalModules - screen.off.length
  const moduleAreaM2 = (preset.wCm / 100) * (preset.hCm / 100)
  const areaM2 = activeModules * moduleAreaM2
  return {
    totalModules,
    activeModules,
    // La resolución NO cambia al apagar módulos: es el bounding completo.
    wPx: screen.cols * preset.wPx,
    hPx: screen.rows * preset.hPx,
    moduleAreaM2,
    areaM2,
    amps: areaM2 * AMPS_PER_M2,
  }
}

export interface ProjectMetrics {
  totalPx: number
  areaM2: number
  amps: number
}

export function projectMetrics(screens: Screen[]): ProjectMetrics {
  let totalPx = 0
  let areaM2 = 0
  for (const s of screens) {
    const m = screenMetrics(s)
    totalPx += m.wPx * m.hPx
    areaM2 += m.areaM2
  }
  return { totalPx, areaM2, amps: areaM2 * AMPS_PER_M2 }
}
