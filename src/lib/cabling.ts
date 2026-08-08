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

/**
 * Orden de numeración en serpentina por columnas (solo para mostrar el número
 * de módulo). El cableado real usa flowCable.
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

const rc = (index: number, cols: number) => ({ r: Math.floor(index / cols), c: index % cols })

interface Offset {
  dr: number
  dc: number
}
interface Dir {
  axis: 'v' | 'h'
  row: 1 | -1
  col: 1 | -1
}

/** Offsets (en orden) de una tirada respecto a su primer módulo: capta la FORMA. */
function templateOffsets(run: number[], cols: number): Offset[] {
  if (!run.length) return [{ dr: 0, dc: 0 }]
  const p0 = rc(run[0], cols)
  return run.map((idx) => {
    const p = rc(idx, cols)
    return { dr: p.r - p0.r, dc: p.c - p0.c }
  })
}

/** Dirección primaria (eje y sentido) de una plantilla de offsets. */
function primaryDir(offs: Offset[]): Dir {
  const last = offs[offs.length - 1]
  const axis: 'v' | 'h' = Math.abs(last.dr) >= Math.abs(last.dc) ? 'v' : 'h'
  return { axis, row: last.dr < 0 ? -1 : 1, col: last.dc < 0 ? -1 : 1 }
}

const range = (n: number, rev: boolean) =>
  rev ? Array.from({ length: n }, (_, i) => n - 1 - i) : Array.from({ length: n }, (_, i) => i)

/** Orden en que se buscan los módulos de entrada, según la dirección heredada. */
function scanOrder(cols: number, rows: number, dir: Dir): number[] {
  const order: number[] = []
  const cs = range(cols, dir.col < 0)
  const rs = range(rows, dir.row < 0)
  if (dir.axis === 'v') {
    for (const c of cs) for (const r of rs) order.push(r * cols + c)
  } else {
    for (const r of rs) for (const c of cs) order.push(r * cols + c)
  }
  return order
}

/**
 * Motor de cableado.
 *  - Respeta las salidas bloqueadas (manuales): las mantiene, solo saca módulos apagados.
 *  - Si fillUnlocked, regenera las salidas automáticas copiando el PATRÓN (forma +
 *    dirección + largo) de la primera salida manual (o una tirada vertical al máximo
 *    si no hay manual). Nunca cruza huecos (corta al toparse con apagado/ocupado).
 */
export function flowCable(
  screen: Screen,
  preset: ModulePreset,
  sender: Sender,
  fillUnlocked: boolean,
): number[][] {
  const cols = screen.cols
  const rows = screen.rows
  const total = cols * rows
  const off = new Set(screen.off)
  const isOn = (idx: number) => idx >= 0 && idx < total && !off.has(idx)
  const limit = modulesPerOutput(preset, sender)
  const locked = screen.wireLocked ?? []
  const wireIn = screen.wire ?? []

  const out: number[][] = Array.from({ length: sender.outputs }, () => [])
  const used = new Set<number>()

  const sanitize = (run: number[]) => {
    const res: number[] = []
    for (const idx of run) {
      if (isOn(idx) && !used.has(idx)) {
        used.add(idx)
        res.push(idx)
      }
    }
    return res
  }

  // 1) salidas bloqueadas (manuales): se mantienen, saneadas
  for (let o = 0; o < sender.outputs; o++) {
    if (locked[o]) out[o] = sanitize(wireIn[o] ?? [])
  }

  if (!fillUnlocked) {
    // solo sanear las automáticas existentes (sin regenerar)
    for (let o = 0; o < sender.outputs; o++) {
      if (!locked[o]) out[o] = sanitize(wireIn[o] ?? [])
    }
    return out
  }

  // 2) plantilla: patrón de la primera salida manual, o vertical al máximo por defecto
  let firstLocked: number[] | null = null
  for (let o = 0; o < sender.outputs; o++) {
    if (locked[o] && out[o].length) {
      firstLocked = out[o]
      break
    }
  }
  const offs: Offset[] = firstLocked
    ? templateOffsets(firstLocked, cols)
    : Array.from({ length: limit }, (_, i) => ({ dr: i, dc: 0 }))
  const dir = primaryDir(offs)
  const order = scanOrder(cols, rows, dir)

  let ptr = 0
  const nextEntry = (): number => {
    while (ptr < order.length) {
      const idx = order[ptr]
      if (isOn(idx) && !used.has(idx)) return idx
      ptr++
    }
    return -1
  }

  // 3) llenar salidas automáticas copiando la plantilla, cortando en huecos
  for (let o = 0; o < sender.outputs; o++) {
    if (locked[o]) continue
    const entry = nextEntry()
    if (entry < 0) {
      out[o] = []
      continue
    }
    const p0 = rc(entry, cols)
    const run: number[] = []
    for (const { dr, dc } of offs) {
      const r = p0.r + dr
      const c = p0.c + dc
      if (r < 0 || r >= rows || c < 0 || c >= cols) break
      const idx = r * cols + c
      if (!isOn(idx) || used.has(idx)) break // corta en hueco/ocupado
      run.push(idx)
      used.add(idx)
    }
    out[o] = run
  }
  return out
}

/** Cableado actual para mostrar: lo guardado, saneado (sin apagados ni fuera de rango). */
export function resolveWire(screen: Screen, sender: Sender): number[][] {
  const base = screen.wire ?? []
  const total = screen.cols * screen.rows
  const off = new Set(screen.off)
  return Array.from({ length: sender.outputs }, (_, i) =>
    (base[i] ?? []).filter((idx) => idx < total && !off.has(idx)),
  )
}
