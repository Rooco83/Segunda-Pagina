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

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

/**
 * Imanta la posición (x,y) de una pantalla de tamaño w×h contra otras pantallas:
 * alinea bordes (izq/der/arriba/abajo), centros y adyacencia (pegado).
 */
export function snapPosition(
  x: number,
  y: number,
  w: number,
  h: number,
  others: Rect[],
  threshold: number,
): { x: number; y: number } {
  let bestX = { d: threshold, v: x }
  let bestY = { d: threshold, v: y }
  for (const o of others) {
    const xs = [o.x, o.x + o.w - w, o.x + o.w, o.x - w, o.x + (o.w - w) / 2]
    const ys = [o.y, o.y + o.h - h, o.y + o.h, o.y - h, o.y + (o.h - h) / 2]
    for (const cx of xs) {
      const d = Math.abs(x - cx)
      if (d < bestX.d) bestX = { d, v: cx }
    }
    for (const cy of ys) {
      const d = Math.abs(y - cy)
      if (d < bestY.d) bestY = { d, v: cy }
    }
  }
  return { x: bestX.v, y: bestY.v }
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
