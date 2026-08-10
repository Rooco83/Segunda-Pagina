import type { ModulePreset, Screen, Sender } from '../types'

/** Colores por salida de cableado (cada salida su color). */
export const OUTPUT_COLORS = [
  '#F0574B', '#F5A524', '#3EE88F', '#19D3E0',
  '#3B82F6', '#8B5CF6', '#EC4899', '#14B8A6',
]

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

function range(from: number, to: number, step: number): number[] {
  const out: number[] = []
  if (step > 0) for (let i = from; i <= to; i += step) out.push(i)
  else for (let i = from; i >= to; i += step) out.push(i)
  return out
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

interface Corner {
  top: boolean
  left: boolean
}

/** Primer recorrido cableado a mano (para imitar su dirección). */
function firstLockedRun(screen: Screen, sender: Sender): number[] | null {
  const locked = screen.wireLocked ?? []
  const wire = screen.wire ?? []
  for (let o = 0; o < sender.outputs; o++) {
    if (locked[o] && wire[o]?.length) return wire[o]
  }
  return null
}

/** Rincón de inicio (arriba/abajo · izq/der) según el primer cable manual. */
function startCorner(run: number[] | null, cols: number): Corner {
  if (!run || run.length < 2) return { top: true, left: true }
  const a = rc(run[0], cols)
  const b = rc(run[run.length - 1], cols)
  return { top: a.r <= b.r, left: a.c <= b.c }
}

/**
 * Ordena una región en LÍNEAS perpendiculares a su eje largo (serpentina),
 * arrancando en el rincón indicado. Región ancha → líneas = columnas (recorre
 * izq↔der); región alta → líneas = filas (recorre arriba↔abajo).
 */
function regionLines(region: number[], cols: number, corner: Corner): number[][] {
  const set = new Set(region)
  let minR = Infinity, maxR = -Infinity, minC = Infinity, maxC = -Infinity
  for (const idx of region) {
    const { r, c } = rc(idx, cols)
    minR = Math.min(minR, r); maxR = Math.max(maxR, r)
    minC = Math.min(minC, c); maxC = Math.max(maxC, c)
  }
  const w = maxC - minC + 1
  const h = maxR - minR + 1
  const lines: number[][] = []
  if (w >= h) {
    // líneas = columnas; progresión horizontal según corner.left
    const colSeq = corner.left ? range(minC, maxC, 1) : range(maxC, minC, -1)
    colSeq.forEach((c, li) => {
      const goingDown = li % 2 === 0 ? corner.top : !corner.top
      const rowSeq = goingDown ? range(minR, maxR, 1) : range(maxR, minR, -1)
      const line = rowSeq.map((r) => r * cols + c).filter((i) => set.has(i))
      if (line.length) lines.push(line)
    })
  } else {
    // líneas = filas; progresión vertical según corner.top
    const rowSeq = corner.top ? range(minR, maxR, 1) : range(maxR, minR, -1)
    rowSeq.forEach((r, li) => {
      const goingRight = li % 2 === 0 ? corner.left : !corner.left
      const colSeq = goingRight ? range(minC, maxC, 1) : range(maxC, minC, -1)
      const line = colSeq.map((c) => r * cols + c).filter((i) => set.has(i))
      if (line.length) lines.push(line)
    })
  }
  return lines
}

/**
 * Divide las líneas en tiradas de salida por LÍNEAS COMPLETAS: agrega líneas
 * enteras mientras entren en el límite; si la próxima línea no entra, abre una
 * salida nueva (no parte una línea para llenar al tope → inputs cómodos al borde).
 */
function splitLines(lines: number[][], limit: number): number[][] {
  const runs: number[][] = []
  let cur: number[] = []
  for (const line of lines) {
    if (line.length > limit) {
      if (cur.length) { runs.push(cur); cur = [] }
      for (let i = 0; i < line.length; i += limit) runs.push(line.slice(i, i + limit))
      continue
    }
    if (cur.length && cur.length + line.length > limit) { runs.push(cur); cur = [] }
    cur.push(...line)
  }
  if (cur.length) runs.push(cur)
  return runs
}

/**
 * Motor de cableado.
 *  - Respeta las salidas manuales (bloqueadas): las mantiene, solo saca apagados.
 *  - Si fillUnlocked, cablea las zonas automáticas: por regiones conexas de módulos
 *    encendidos, imitando el rincón/dirección del primer cable manual, en tiradas de
 *    LÍNEAS COMPLETAS (comodidad de cableado). Nunca cruza huecos.
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

  for (let o = 0; o < sender.outputs; o++) {
    if (locked[o]) out[o] = sanitize(wireIn[o] ?? [])
  }

  if (!fillUnlocked) {
    for (let o = 0; o < sender.outputs; o++) {
      if (!locked[o]) out[o] = sanitize(wireIn[o] ?? [])
    }
    return out
  }

  const corner = startCorner(firstLockedRun(screen, sender), cols)

  const available = new Set<number>()
  for (let i = 0; i < total; i++) if (isOn(i) && !used.has(i)) available.add(i)

  const runs: number[][] = []
  for (const region of regions(available, cols, rows)) {
    runs.push(...splitLines(regionLines(region, cols, corner), limit))
  }

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
