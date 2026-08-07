import type { ModulePreset, Screen, Sender } from '../types'

/** Colores por salida de cableado (cada salida su color). */
export const OUTPUT_COLORS = [
  '#F0574B', '#F5A524', '#3EE88F', '#19D3E0',
  '#3B82F6', '#8B5CF6', '#EC4899', '#14B8A6',
]

export interface Cell {
  r: number
  c: number
  /** índice row-major 0-based */
  index: number
}

export interface CableRun {
  output: number
  color: string
  limit: number
  cells: Cell[]
}

/**
 * Orden de cableado en serpentina por columnas: la columna 0 va de arriba
 * hacia abajo, la 1 de abajo hacia arriba, etc. (izq → der siempre).
 */
export function serpentineOrder(cols: number, rows: number): Cell[] {
  const out: Cell[] = []
  for (let c = 0; c < cols; c++) {
    const rowsSeq =
      c % 2 === 0
        ? Array.from({ length: rows }, (_, i) => i)
        : Array.from({ length: rows }, (_, i) => rows - 1 - i)
    for (const r of rowsSeq) out.push({ r, c, index: r * cols + c })
  }
  return out
}

/** Módulos que soporta cada salida según el sender y el preset de módulo. */
export function modulesPerOutput(preset: ModulePreset, sender: Sender): number {
  const pxMod = preset.wPx * preset.hPx
  return Math.max(1, Math.floor(sender.pxPerOutput / pxMod))
}

/** Divide el recorrido serpentina en salidas según el límite del sender. */
export function cableRuns(
  screen: Screen,
  preset: ModulePreset,
  sender: Sender,
): CableRun[] {
  const order = serpentineOrder(screen.cols, screen.rows)
  const limit = modulesPerOutput(preset, sender)
  const runs: CableRun[] = []
  for (let i = 0; i < order.length; i += limit) {
    const output = runs.length
    runs.push({
      output,
      color: OUTPUT_COLORS[output % OUTPUT_COLORS.length],
      limit,
      cells: order.slice(i, i + limit),
    })
  }
  return runs
}
