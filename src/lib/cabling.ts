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

/**
 * Cableado automático: distribuye el recorrido serpentina entre las salidas
 * físicas del sender, respetando el límite de módulos por salida.
 */
export function autoWire(
  screen: Screen,
  preset: ModulePreset,
  sender: Sender,
): number[][] {
  const order = serpentineOrder(screen.cols, screen.rows).map((c) => c.index)
  const limit = modulesPerOutput(preset, sender)
  const wire: number[][] = Array.from({ length: sender.outputs }, () => [])
  let oi = 0
  for (const idx of order) {
    while (oi < sender.outputs && wire[oi].length >= limit) oi++
    if (oi >= sender.outputs) break // sin capacidad: quedan sin asignar
    wire[oi].push(idx)
  }
  return wire
}

/**
 * Cableado actual de la pantalla: SOLO lo cableado (manual o auto ya aplicado).
 * Si nunca se cableó, devuelve salidas vacías (no muestra preview automático).
 */
export function resolveWire(screen: Screen, sender: Sender): number[][] {
  const base = screen.wire ?? []
  const total = screen.cols * screen.rows
  return Array.from({ length: sender.outputs }, (_, i) =>
    (base[i] ?? []).filter((idx) => idx < total),
  )
}
