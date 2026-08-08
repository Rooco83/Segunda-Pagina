import { create } from 'zustand'
import type { AccentKey, Screen } from './types'
import { accentByKey } from './data/accents'
import { presetById } from './data/modulePresets'
import { senderById } from './data/senders'
import { autoWire, modulesPerOutput, serpentineOrder } from './lib/cabling'
import { screenSizePx, stackIfOverlapping } from './lib/layout'

export type Tool = 'hand' | 'brush' | 'cable'

let idSeq = 1
const newId = () => `s${idSeq++}`

const emptyWire = (n: number): number[][] => Array.from({ length: n }, () => [])

function makeScreen(partial: Partial<Screen> = {}): Screen {
  return {
    id: newId(),
    name: 'Pantalla',
    x: 0,
    y: 0,
    presetId: 'P2.6-50x100',
    cols: 15,
    rows: 8,
    palette: ['#4A78B8', '#3B5F98'],
    off: [],
    senderId: 'ns-vx400',
    namePos: { x: 120, y: 60 },
    logoPos: { x: 24, y: 220 },
    ...partial,
  }
}

const PALETTES: Array<[string, string]> = [
  ['#4A78B8', '#3B5F98'],
  ['#7CC72E', '#66A423'],
  ['#8B5CF6', '#6A3EC1'],
  ['#E8C24A', '#C7A233'],
  ['#39C6C6', '#2A9E9E'],
]

interface PersistShape {
  projectName: string
  screens: Screen[]
}

interface State {
  projectName: string
  screens: Screen[]
  selectedId: string | null
  accentKey: AccentKey
  editingId: string | null
  exportOpen: boolean
  zoom: number
  tool: Tool
  activeOutput: number | null
  past: Screen[][]
  future: Screen[][]

  setProjectName: (name: string) => void
  addScreen: () => void
  updateScreen: (id: string, patch: Partial<Screen>) => void
  deleteScreen: (id: string) => void
  toggleModule: (id: string, index: number) => void
  setModuleOff: (id: string, index: number, off: boolean) => void
  cycleColor: (id: string) => void
  mirrorScreen: (id: string) => void
  select: (id: string | null) => void
  openEdit: (id: string) => void
  closeEdit: () => void
  setExportOpen: (v: boolean) => void
  setAccent: (key: AccentKey) => void
  setZoom: (z: number) => void
  setTool: (t: Tool) => void
  selectOutput: (i: number) => void
  startCableStroke: (id: string, index: number) => void
  assignModule: (id: string, index: number) => void
  autoCable: (id: string) => void
  resetOutput: (id: string, output: number) => void
  resetWire: (id: string) => void

  snapshot: () => void
  undo: () => void
  redo: () => void
  loadProject: (data: PersistShape) => void
  serialize: () => PersistShape
}

function loadAccent(): AccentKey {
  try {
    const k = localStorage.getItem('pm_accent') as AccentKey | null
    if (k && accentByKey(k).key === k) return k
  } catch {
    /* ignore */
  }
  return 'magenta'
}

function defaultScreens(): Screen[] {
  return [
    makeScreen({ name: 'Pantalla arriba', palette: PALETTES[0], off: [85, 86, 87, 102, 103], x: 0, y: 0 }),
    makeScreen({
      name: 'CENTRAL',
      presetId: 'P3.9-50x50',
      cols: 18,
      rows: 6,
      palette: PALETTES[1],
      senderId: 'ns-vx600',
      x: 0,
      y: 920,
    }),
  ]
}

function loadProject(): { projectName: string; screens: Screen[] } {
  try {
    const raw = localStorage.getItem('pm_project')
    if (raw) {
      const data = JSON.parse(raw) as PersistShape
      if (Array.isArray(data.screens) && data.screens.length) {
        // avanzar idSeq más allá de los ids cargados
        let max = 0
        for (const s of data.screens) {
          const n = Number(String(s.id).replace(/\D/g, ''))
          if (n > max) max = n
        }
        idSeq = max + 1
        return { projectName: data.projectName ?? '', screens: data.screens }
      }
    }
  } catch {
    /* ignore */
  }
  return { projectName: '', screens: defaultScreens() }
}

const bootRaw = loadProject()
const boot = { projectName: bootRaw.projectName, screens: stackIfOverlapping(bootRaw.screens) }

// helper: aplica una mutación sobre screens registrando historial
type SetFn = (partial: Partial<State> | ((s: State) => Partial<State>)) => void

function mutate(set: SetFn, fn: (screens: Screen[]) => Screen[]) {
  set((s) => {
    const screens = fn(s.screens)
    if (screens === s.screens) return {}
    return { screens, past: [...s.past.slice(-49), s.screens], future: [] }
  })
}

export const useStore = create<State>((set, get) => ({
  projectName: boot.projectName,
  screens: boot.screens,
  selectedId: boot.screens[0]?.id ?? null,
  accentKey: loadAccent(),
  editingId: null,
  exportOpen: false,
  zoom: 0.62,
  tool: 'hand',
  activeOutput: null,
  past: [],
  future: [],

  setProjectName: (name) => set({ projectName: name }),

  addScreen: () =>
    set((s) => {
      const palette = PALETTES[s.screens.length % PALETTES.length]
      const bottom = s.screens.reduce((m, sc) => Math.max(m, sc.y + screenSizePx(sc).h), 0)
      const scr = makeScreen({
        name: `Pantalla ${s.screens.length + 1}`,
        palette,
        x: 0,
        y: s.screens.length ? bottom + 120 : 0,
      })
      return {
        screens: [...s.screens, scr],
        selectedId: scr.id,
        editingId: scr.id,
        past: [...s.past.slice(-49), s.screens],
        future: [],
      }
    }),

  updateScreen: (id, patch) =>
    set((s) => ({
      screens: s.screens.map((sc) => (sc.id === id ? { ...sc, ...patch } : sc)),
    })),

  deleteScreen: (id) =>
    set((s) => {
      const screens = s.screens.filter((sc) => sc.id !== id)
      const selectedId = s.selectedId === id ? (screens[0]?.id ?? null) : s.selectedId
      const editingId = s.editingId === id ? null : s.editingId
      return { screens, selectedId, editingId, past: [...s.past.slice(-49), s.screens], future: [] }
    }),

  toggleModule: (id, index) =>
    mutate(set, (screens) =>
      screens.map((sc) => {
        if (sc.id !== id) return sc
        const off = sc.off.includes(index)
          ? sc.off.filter((i) => i !== index)
          : [...sc.off, index]
        return { ...sc, off }
      }),
    ),

  setModuleOff: (id, index, off) =>
    set((s) => ({
      screens: s.screens.map((sc) => {
        if (sc.id !== id) return sc
        const has = sc.off.includes(index)
        if (off && !has) return { ...sc, off: [...sc.off, index] }
        if (!off && has) return { ...sc, off: sc.off.filter((i) => i !== index) }
        return sc
      }),
    })),

  cycleColor: (id) =>
    mutate(set, (screens) =>
      screens.map((sc) => {
        if (sc.id !== id) return sc
        const idx = PALETTES.findIndex((p) => p[0] === sc.palette[0])
        return { ...sc, palette: PALETTES[(idx + 1) % PALETTES.length] }
      }),
    ),

  mirrorScreen: (id) =>
    mutate(set, (screens) =>
      screens.map((sc) => {
        if (sc.id !== id) return sc
        const off = sc.off.map((i) => {
          const r = Math.floor(i / sc.cols)
          const c = i % sc.cols
          return r * sc.cols + (sc.cols - 1 - c)
        })
        return { ...sc, off }
      }),
    ),

  select: (id) => set((s) => (s.selectedId === id ? {} : { selectedId: id })),
  openEdit: (id) => set({ editingId: id, selectedId: id }),
  closeEdit: () => set({ editingId: null }),
  setExportOpen: (v) => set({ exportOpen: v }),
  setTool: (t) =>
    set((s) => ({ tool: t, activeOutput: t === 'cable' ? (s.activeOutput ?? 0) : s.activeOutput })),

  selectOutput: (i) => set({ activeOutput: i, tool: 'cable' }),

  // Inicia el recorrido de la salida activa: arranca de cero (el auto es solo vista previa).
  startCableStroke: (id, index) =>
    set((s) => {
      const out = s.activeOutput
      if (out == null) return {}
      return {
        screens: s.screens.map((sc) => {
          if (sc.id !== id) return sc
          const sender = senderById(sc.senderId)
          const wire = (sc.wire ?? emptyWire(sender.outputs)).map((a) => [...a])
          while (wire.length <= out) wire.push([])
          for (const a of wire) {
            const k = a.indexOf(index)
            if (k >= 0) a.splice(k, 1)
          }
          wire[out] = [index]
          return { ...sc, wire }
        }),
      }
    }),

  // Extiende el recorrido de la salida activa hasta su límite (solo agrega, nunca al tope forzado).
  assignModule: (id, index) =>
    set((s) => {
      const out = s.activeOutput
      if (out == null) return {}
      return {
        screens: s.screens.map((sc) => {
          if (sc.id !== id) return sc
          const sender = senderById(sc.senderId)
          const limit = modulesPerOutput(presetById(sc.presetId), sender)
          const wire = (sc.wire ?? emptyWire(sender.outputs)).map((a) => [...a])
          while (wire.length <= out) wire.push([])
          if (wire[out].includes(index) || wire[out].length >= limit) return sc
          for (const a of wire) {
            const k = a.indexOf(index)
            if (k >= 0) a.splice(k, 1)
          }
          wire[out].push(index)
          return { ...sc, wire }
        }),
      }
    }),

  // Auto-cablear: si no se cableó nada, cablea todo; si hay manual, completa solo las salidas vacías.
  autoCable: (id) =>
    mutate(set, (screens) =>
      screens.map((sc) => {
        if (sc.id !== id) return sc
        const preset = presetById(sc.presetId)
        const sender = senderById(sc.senderId)
        const limit = modulesPerOutput(preset, sender)
        const manual = sc.wire
        if (!manual || manual.every((a) => a.length === 0)) {
          return { ...sc, wire: autoWire(sc, preset, sender) }
        }
        const wire = manual.map((a) => [...a])
        while (wire.length < sender.outputs) wire.push([])
        const assigned = new Set(wire.flat())
        const order = serpentineOrder(sc.cols, sc.rows).map((c) => c.index)
        const remaining = order.filter((idx) => !assigned.has(idx))
        let oi = 0
        for (const idx of remaining) {
          // saltear salidas que el usuario ya tocó (no vacías en el manual) o ya llenas
          while (oi < sender.outputs && ((manual[oi]?.length ?? 0) > 0 || wire[oi].length >= limit)) oi++
          if (oi >= sender.outputs) break
          wire[oi].push(idx)
        }
        return { ...sc, wire }
      }),
    ),

  resetOutput: (id, output) =>
    mutate(set, (screens) =>
      screens.map((sc) => {
        if (sc.id !== id || !sc.wire) return sc
        const wire = sc.wire.map((a, i) => (i === output ? [] : [...a]))
        return { ...sc, wire }
      }),
    ),

  resetWire: (id) =>
    mutate(set, (screens) =>
      screens.map((sc) => (sc.id === id ? { ...sc, wire: undefined } : sc)),
    ),

  setAccent: (key) => {
    try {
      localStorage.setItem('pm_accent', key)
    } catch {
      /* ignore */
    }
    set({ accentKey: key })
  },

  setZoom: (z) => set({ zoom: Math.min(2, Math.max(0.15, z)) }),

  snapshot: () => set((s) => ({ past: [...s.past.slice(-49), s.screens], future: [] })),

  undo: () =>
    set((s) => {
      if (!s.past.length) return {}
      const prev = s.past[s.past.length - 1]
      return { screens: prev, past: s.past.slice(0, -1), future: [s.screens, ...s.future] }
    }),

  redo: () =>
    set((s) => {
      if (!s.future.length) return {}
      const next = s.future[0]
      return { screens: next, future: s.future.slice(1), past: [...s.past, s.screens] }
    }),

  loadProject: (data) => {
    let max = 0
    for (const s of data.screens) {
      const n = Number(String(s.id).replace(/\D/g, ''))
      if (n > max) max = n
    }
    idSeq = max + 1
    set({
      projectName: data.projectName ?? '',
      screens: data.screens,
      selectedId: data.screens[0]?.id ?? null,
      past: [],
      future: [],
    })
  },

  serialize: () => {
    const s = get()
    return { projectName: s.projectName, screens: s.screens }
  },
}))

// Autosave en localStorage (proyecto actual)
useStore.subscribe((s) => {
  try {
    const data: PersistShape = { projectName: s.projectName, screens: s.screens }
    localStorage.setItem('pm_project', JSON.stringify(data))
  } catch {
    /* ignore */
  }
})
