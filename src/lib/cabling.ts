import type { ModulePreset, Screen, Sender } from '../types'

/** Colores por salida de cableado (cada salida su color). */
export const OUTPUT_COLORS = [
  '#F0574B', '#F5A524', '#3EE88F', '#19D3E0',
  '#3B82F6', '#8B5CF6', '#EC4899', '#14B8A6',
]

export interface Cell {
  r: number
  c: number
  index: number
}

/** Numeración de módulos ENCENDIDOS: columnas arriba→abajo, izquierda→derecha. */
export function moduleNumbers(cols: number, rows: number, off: number[]): Map<number, number> {
  const offSet = new Set(off)
  const map = new Map<number, number>()
  let n = 0
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      const idx = r * cols + c
      if (!offSet.has(idx)) map.set(idx, ++n)
    }
  }
  return map
}

/** Módulos que soporta cada salida según el sender y el preset de módulo. */
export function modulesPerOutput(preset: ModulePreset, sender: Sender): number {
  const pxMod = preset.wPx * preset.hPx
  return Math.max(1, Math.floor(sender.pxPerOutput / pxMod))
}

const rc = (index: number, cols: number) => ({ r: Math.floor(index / cols), c: index % cols })
const adjacent = (a: number, b: number, cols: number) => {
  const pa = rc(a, cols)
  const pb = rc(b, cols)
  return Math.abs(pa.r - pb.r) + Math.abs(pa.c - pb.c) === 1
}

/** Componentes conexas (adyacencia ortogonal) de un conjunto de módulos. */
function regions(available: Set<number>, cols: number, rows: number): number[][] {
  const seen = new Set<number>()
  const out: number[][] = []
  for (let i = 0; i < cols * rows; i++) {
    if (!available.has(i) || seen.has(i)) continue
    const comp: number[] = []
    const stack = [i]
    seen.add(i)
    while (stack.length) {
      const cur = stack.pop()!
      comp.push(cur)
      const { r, c } = rc(cur, cols)
      const nbrs = [
        r > 0 ? cur - cols : -1,
        r < rows - 1 ? cur + cols : -1,
        c > 0 ? cur - 1 : -1,
        c < cols - 1 ? cur + 1 : -1,
      ]
      for (const nb of nbrs) {
        if (nb >= 0 && available.has(nb) && !seen.has(nb)) {
          seen.add(nb)
          stack.push(nb)
        }
      }
    }
    out.push(comp)
  }
  return out
}

/** Serpentina de una región según su forma: ancha→horizontal, alta→vertical. */
function regionSerpentine(region: number[], cols: number): number[] {
  const set = new Set(region)
  let minR = Infinity, maxR = -Infinity, minC = Infinity, maxC = -Infinity
  for (const idx of region) {
    const { r, c } = rc(idx, cols)
    minR = Math.min(minR, r); maxR = Math.max(maxR, r)
    minC = Math.min(minC, c); maxC = Math.max(maxC, c)
  }
  const w = maxC - minC + 1
  const h = maxR - minR + 1
  const order: number[] = []
  if (w >= h) {
    // horizontal: fila por fila (izq→der / der→izq alternando)
    for (let r = minR; r <= maxR; r++) {
      const cs = (r - minR) % 2 === 0
        ? range(minC, maxC, 1)
        : range(maxC, minC, -1)
      for (const c of cs) {
        const idx = r * cols + c
        if (set.has(idx)) order.push(idx)
      }
    }
  } else {
    // vertical: columna por columna (arriba→abajo / abajo→arriba alternando)
    for (let c = minC; c <= maxC; c++) {
      const rs = (c - minC) % 2 === 0
        ? range(minR, maxR, 1)
        : range(maxR, minR, -1)
      for (const r of rs) {
        const idx = r * cols + c
        if (set.has(idx)) order.push(idx)
      }
    }
  }
  return order
}

function range(from: number, to: number, step: number): number[] {
  const out: number[] = []
  if (step > 0) for (let i = from; i <= to; i += step) out.push(i)
  else for (let i = from; i >= to; i += step) out.push(i)
  return out
}

/**
 * Motor de cableado.
 *  - Respeta las salidas bloqueadas (manuales): las mantiene, solo saca apagados.
 *  - Si fillUnlocked, cablea las zonas automáticas: divide en regiones conexas de
 *    módulos encendidos, cada región con la dirección que le conviene por su forma
 *    (ancha→izq-der, alta→arriba-abajo), en tiradas del largo de la 1ª manual (o el
 *    máximo por salida). Nunca cruza huecos.
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

  // salidas manuales: se mantienen, saneadas
  for (let o = 0; o < sender.outputs; o++) {
    if (locked[o]) out[o] = sanitize(wireIn[o] ?? [])
  }

  if (!fillUnlocked) {
    for (let o = 0; o < sender.outputs; o++) {
      if (!locked[o]) out[o] = sanitize(wireIn[o] ?? [])
    }
    return out
  }

  // tamaño de tirada: largo de la 1ª salida manual, o el máximo por salida
  let firstLocked = 0
  for (let o = 0; o < sender.outputs; o++) {
    if (locked[o] && out[o].length) { firstLocked = out[o].length; break }
  }
  const chunk = Math.max(1, Math.min(limit, firstLocked || limit))

  // módulos encendidos aún sin cablear → regiones conexas
  const available = new Set<number>()
  for (let i = 0; i < total; i++) if (isOn(i) && !used.has(i)) available.add(i)

  const runs: number[][] = []
  for (const region of regions(available, cols, rows)) {
    const ordered = regionSerpentine(region, cols)
    let cur: number[] = []
    for (const idx of ordered) {
      if (cur.length > 0 && (cur.length >= chunk || !adjacent(cur[cur.length - 1], idx, cols))) {
        runs.push(cur)
        cur = []
      }
      cur.push(idx)
    }
    if (cur.length) runs.push(cur)
  }

  // asignar tiradas a las salidas automáticas (en orden)
  let ri = 0
  for (let o = 0; o < sender.outputs; o++) {
    if (locked[o]) continue
    out[o] = ri < runs.length ? runs[ri++] : []
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
