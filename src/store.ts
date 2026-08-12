import { create } from 'zustand'
import type { AccentKey, Marker, Screen } from './types'
import { accentByKey } from './data/accents'
import { presetById } from './data/modulePresets'
import { senderById } from './data/senders'
import { flowCable, modulesPerOutput } from './lib/cabling'
import { contentBounds, screenSizePx, stackIfOverlapping } from './lib/layout'

let markerSeq = 1

export type Tool = 'hand' | 'brush' | 'cable'

let idSeq = 1
const newId = () => `s${idSeq++}`

const emptyWire = (n: number): number[][] => Array.from({ length: n }, () => [])

// Recalcula el cableado de una pantalla tras cambiar módulos: sanea las salidas
// manuales (quita apagados) y, si ya se auto-cableó, re-genera las automáticas.
function reflowScreen(sc: Screen): Screen {
  if (!sc.wire) return sc
  const wire = flowCable(sc, presetById(sc.presetId), senderById(sc.senderId), !!sc.autoCabled)
  return { ...sc, wire }
}

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
    resPos: { x: 120, y: 150 },
    nameSize: 30,
    logoSize: 1,
    ...partial,
  }
}

export const PALETTES: Array<[string, string]> = [
  ['#4A78B8', '#3B5F98'],
  ['#7CC72E', '#66A423'],
  ['#8B5CF6', '#6A3EC1'],
  ['#E8C24A', '#C7A233'],
  ['#39C6C6', '#2A9E9E'],
  ['#EC4899', '#B7336F'],
  ['#F97316', '#C25A10'],
]

interface PersistShape {
  projectName: string
  screens: Screen[]
  markers?: Marker[]
}

interface State {
  projectName: string
  screens: Screen[]
  markers: Marker[]
  selectedId: string | null
  accentKey: AccentKey
  editingId: string | null
  exportOpen: boolean
  projectOpen: boolean
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
  setPalette: (id: string, palette: [string, string]) => void
  mirrorScreen: (id: string) => void
  markerSel: string | null
  addMarker: (opts: { w: number; h: number; pitch: number; color?: string }) => void
  updateMarker: (id: string, patch: Partial<Marker>) => void
  deleteMarker: (id: string) => void
  setMarkerSel: (id: string | null) => void
  select: (id: string | null) => void
  openEdit: (id: string) => void
  closeEdit: () => void
  setExportOpen: (v: boolean) => void
  setProjectOpen: (v: boolean) => void
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

// La app arranca SIEMPRE reseteada (proyecto nuevo en blanco). El trabajo previo NO
// se restaura del navegador: se recupera iniciando sesión y cargando el proyecto desde
// tu Drive (o abriendo un archivo .pmap).
const boot = {
  projectName: '',
  screens: stackIfOverlapping(defaultScreens()),
  markers: [] as Marker[],
}

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
  markers: boot.markers,
  markerSel: null,
  selectedId: boot.screens[0]?.id ?? null,
  accentKey: loadAccent(),
  editingId: null,
  exportOpen: false,
  projectOpen: false,
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
        return reflowScreen({ ...sc, off })
      }),
    ),

  setModuleOff: (id, index, off) =>
    set((s) => ({
      screens: s.screens.map((sc) => {
        if (sc.id !== id) return sc
        const has = sc.off.includes(index)
        let noff = sc.off
        if (off && !has) noff = [...sc.off, index]
        else if (!off && has) noff = sc.off.filter((i) => i !== index)
        else return sc
        return reflowScreen({ ...sc, off: noff })
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

  setPalette: (id, palette) =>
    mutate(set, (screens) => screens.map((sc) => (sc.id === id ? { ...sc, palette } : sc))),

  addMarker: (opts) =>
    set((s) => {
      // ubicar a la derecha de todo lo existente (visible, sin solapar)
      const b = contentBounds(s.screens)
      let maxX = b.w ? b.minX + b.w : 0
      let minY = b.w ? b.minY : 0
      for (const mk of s.markers) {
        maxX = Math.max(maxX, mk.x + mk.w)
        minY = Math.min(minY, mk.y)
      }
      const marker: Marker = {
        id: `mk${markerSeq++}`,
        x: maxX + 160,
        y: minY,
        w: opts.w,
        h: opts.h,
        pitch: opts.pitch,
        color: opts.color ?? '#8B93A7',
      }
      return { markers: [...s.markers, marker], markerSel: marker.id }
    }),

  updateMarker: (id, patch) =>
    set((s) => ({ markers: s.markers.map((mk) => (mk.id === id ? { ...mk, ...patch } : mk)) })),

  deleteMarker: (id) =>
    set((s) => ({
      markers: s.markers.filter((mk) => mk.id !== id),
      markerSel: s.markerSel === id ? null : s.markerSel,
    })),

  setMarkerSel: (id) => set({ markerSel: id }),

  mirrorScreen: (id) =>
    mutate(set, (screens) =>
      screens.map((sc) => {
        if (sc.id !== id) return sc
        const off = sc.off.map((i) => {
          const r = Math.floor(i / sc.cols)
          const c = i % sc.cols
          return r * sc.cols + (sc.cols - 1 - c)
        })
        return reflowScreen({ ...sc, off })
      }),
    ),

  select: (id) => set((s) => (s.selectedId === id ? {} : { selectedId: id })),
  openEdit: (id) => set({ editingId: id, selectedId: id }),
  closeEdit: () => set({ editingId: null }),
  setExportOpen: (v) => set({ exportOpen: v }),
  setProjectOpen: (v) => set({ projectOpen: v }),
  setTool: (t) =>
    set((s) => ({ tool: t, activeOutput: t === 'cable' ? (s.activeOutput ?? 0) : s.activeOutput })),

  selectOutput: (i) => set({ activeOutput: i, tool: 'cable' }),

  // Inicia el recorrido de la salida activa (la marca como manual/bloqueada).
  // No roba módulos de otra salida: si ya está cableado en otra, no hace nada.
  startCableStroke: (id, index) =>
    set((s) => {
      const out = s.activeOutput
      if (out == null) return {}
      return {
        screens: s.screens.map((sc) => {
          if (sc.id !== id) return sc
          const sender = senderById(sc.senderId)
          const wire = (sc.wire ?? emptyWire(sender.outputs)).map((a) => [...a])
          const locked = (sc.wireLocked ?? []).slice()
          while (wire.length <= out) wire.push([])
          while (locked.length <= out) locked.push(false)
          // ¿ya cableado en OTRA salida? → no pisar
          const occupied = wire.some((a, o) => o !== out && a.includes(index))
          if (occupied) return sc
          wire[out] = [index]
          locked[out] = true
          return { ...sc, wire, wireLocked: locked }
        }),
      }
    }),

  // Extiende el recorrido de la salida activa hasta su límite (solo agrega módulos libres).
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
          const locked = (sc.wireLocked ?? []).slice()
          while (wire.length <= out) wire.push([])
          while (locked.length <= out) locked.push(false)
          const occupied = wire.some((a, o) => o !== out && a.includes(index))
          if (occupied || wire[out].includes(index) || wire[out].length >= limit) return sc
          wire[out].push(index)
          locked[out] = true
          return { ...sc, wire, wireLocked: locked }
        }),
      }
    }),

  // Auto-cablear: copia el patrón de la 1ª salida manual (forma+dirección+largo) a las
  // salidas automáticas, respetando huecos; sin manual, reparte al máximo por salida.
  autoCable: (id) =>
    mutate(set, (screens) =>
      screens.map((sc) => {
        if (sc.id !== id) return sc
        const withFlag = { ...sc, autoCabled: true }
        const wire = flowCable(withFlag, presetById(sc.presetId), senderById(sc.senderId), true)
        return { ...withFlag, wire }
      }),
    ),

  resetOutput: (id, output) =>
    mutate(set, (screens) =>
      screens.map((sc) => {
        if (sc.id !== id || !sc.wire) return sc
        const wire = sc.wire.map((a, i) => (i === output ? [] : [...a]))
        const locked = (sc.wireLocked ?? []).slice()
        if (locked[output] !== undefined) locked[output] = false
        return reflowScreen({ ...sc, wire, wireLocked: locked })
      }),
    ),

  resetWire: (id) =>
    mutate(set, (screens) =>
      screens.map((sc) =>
        sc.id === id ? { ...sc, wire: undefined, wireLocked: undefined, autoCabled: false } : sc,
      ),
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
      markers: data.markers ?? [],
      selectedId: data.screens[0]?.id ?? null,
      past: [],
      future: [],
    })
  },

  serialize: () => {
    const s = get()
    return { projectName: s.projectName, screens: s.screens, markers: s.markers }
  },
}))

// Sin autosave en localStorage: la app no persiste el trabajo entre sesiones a propósito.
// El guardado es explícito → Drive (con sesión) o archivo .pmap. Limpiamos cualquier
// borrador viejo que hubiera quedado de versiones anteriores.
try {
  localStorage.removeItem('pm_project')
} catch {
  /* ignore */
}
