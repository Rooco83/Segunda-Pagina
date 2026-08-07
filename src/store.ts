import { create } from 'zustand'
import type { AccentKey, Screen } from './types'
import { accentByKey } from './data/accents'

let idSeq = 1
const newId = () => `s${idSeq++}`

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
  ['#4A78B8', '#3B5F98'], // azul
  ['#7CC72E', '#66A423'], // lima
  ['#8B5CF6', '#6A3EC1'], // violeta
  ['#E8C24A', '#C7A233'], // ámbar
  ['#39C6C6', '#2A9E9E'], // cian
]

interface State {
  projectName: string
  screens: Screen[]
  selectedId: string | null
  accentKey: AccentKey
  editingId: string | null
  exportOpen: boolean
  zoom: number

  setProjectName: (name: string) => void
  addScreen: () => void
  updateScreen: (id: string, patch: Partial<Screen>) => void
  deleteScreen: (id: string) => void
  toggleModule: (id: string, index: number) => void
  cycleColor: (id: string) => void
  select: (id: string | null) => void
  openEdit: (id: string) => void
  closeEdit: () => void
  setExportOpen: (v: boolean) => void
  setAccent: (key: AccentKey) => void
  setZoom: (z: number) => void
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

const initial: Screen[] = [
  makeScreen({ name: 'Pantalla arriba', palette: PALETTES[0], off: [85, 86, 87, 102, 103] }),
  makeScreen({
    name: 'CENTRAL',
    presetId: 'P3.9-50x50',
    cols: 18,
    rows: 6,
    palette: PALETTES[1],
    senderId: 'ns-vx600',
  }),
]

export const useStore = create<State>((set) => ({
  projectName: '',
  screens: initial,
  selectedId: initial[0].id,
  accentKey: loadAccent(),
  editingId: null,
  exportOpen: false,
  zoom: 0.62,

  setProjectName: (name) => set({ projectName: name }),

  addScreen: () =>
    set((s) => {
      const palette = PALETTES[s.screens.length % PALETTES.length]
      const scr = makeScreen({
        name: `Pantalla ${s.screens.length + 1}`,
        palette,
      })
      return { screens: [...s.screens, scr], selectedId: scr.id, editingId: scr.id }
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
      return { screens, selectedId, editingId }
    }),

  toggleModule: (id, index) =>
    set((s) => ({
      screens: s.screens.map((sc) => {
        if (sc.id !== id) return sc
        const off = sc.off.includes(index)
          ? sc.off.filter((i) => i !== index)
          : [...sc.off, index]
        return { ...sc, off }
      }),
    })),

  cycleColor: (id) =>
    set((s) => ({
      screens: s.screens.map((sc) => {
        if (sc.id !== id) return sc
        const idx = PALETTES.findIndex((p) => p[0] === sc.palette[0])
        return { ...sc, palette: PALETTES[(idx + 1) % PALETTES.length] }
      }),
    })),

  select: (id) => set({ selectedId: id }),
  openEdit: (id) => set({ editingId: id, selectedId: id }),
  closeEdit: () => set({ editingId: null }),
  setExportOpen: (v) => set({ exportOpen: v }),

  setAccent: (key) => {
    try {
      localStorage.setItem('pm_accent', key)
    } catch {
      /* ignore */
    }
    set({ accentKey: key })
  },

  setZoom: (z) => set({ zoom: Math.min(2, Math.max(0.15, z)) }),
}))
