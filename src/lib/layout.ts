import type { Screen } from '../types'
import { presetById } from '../data/modulePresets'

/** px por cm a zoom 1 (tamaño de render del módulo en el lienzo). */
export const CM_PX = 1

export function screenSizePx(screen: Screen): { w: number; h: number } {
  const p = presetById(screen.presetId)
  return { w: screen.cols * p.wCm * CM_PX, h: screen.rows * p.hCm * CM_PX }
}

export interface Bounds {
  minX: number
  minY: number
  w: number
  h: number
}

export function contentBounds(screens: Screen[]): Bounds {
  if (!screens.length) return { minX: 0, minY: 0, w: 0, h: 0 }
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const s of screens) {
    const { w, h } = screenSizePx(s)
    minX = Math.min(minX, s.x)
    minY = Math.min(minY, s.y)
    maxX = Math.max(maxX, s.x + w)
    maxY = Math.max(maxY, s.y + h)
  }
  return { minX, minY, w: maxX - minX, h: maxY - minY }
}

/** Apila verticalmente pantallas que están todas en el mismo punto (evita solapamiento). */
export function stackIfOverlapping(screens: Screen[]): Screen[] {
  const allZero = screens.every((s) => s.x === 0 && s.y === 0)
  if (!allZero || screens.length < 2) return screens
  let y = 0
  return screens.map((s) => {
    const placed = { ...s, x: 0, y }
    y += screenSizePx(s).h + 120
    return placed
  })
}
