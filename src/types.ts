// Modelo de dominio de Pixel Map Studio

/** Preset de módulo LED: combina pitch (mm) y tamaño físico (cm). */
export interface ModulePreset {
  id: string
  label: string
  pitch: number // mm (ej. 2.6)
  wCm: number
  hCm: number
  wPx: number
  hPx: number
}

/** Modelo de sender / procesador con sus salidas. */
export interface Sender {
  id: string
  brand: string
  model: string
  outputs: number // nº de salidas (RJ45)
  pxPerOutput: number // píxeles máximos por salida
}

export type AccentKey =
  | 'magenta' | 'cyan' | 'amber' | 'violet' | 'green' | 'orange' | 'blue'

export interface Accent {
  key: AccentKey
  c: string
  ink: string
}

/** Pantalla LED: grilla de módulos de un preset dado. */
export interface Screen {
  id: string
  name: string
  x: number
  y: number
  presetId: string
  cols: number
  rows: number
  /** dos tonos del damero */
  palette: [string, string]
  /** índices row-major (0-based) de módulos apagados */
  off: number[]
  senderId: string
  /** posición del nombre dentro de la pantalla (px relativos) */
  namePos: { x: number; y: number }
  /** posición del logo dentro de la pantalla (px relativos) */
  logoPos: { x: number; y: number }
  /** posición del cartel de resolución dentro de la pantalla */
  resPos?: { x: number; y: number }
  /** tamaño de la fuente del nombre (px) */
  nameSize?: number
  /** escala del logo (1 = base) */
  logoSize?: number
  /** cableado: por cada salida, lista ordenada de índices de módulo */
  wire?: number[][]
  /** qué salidas fueron cableadas a mano (no las toca el auto) */
  wireLocked?: boolean[]
  /** si ya se usó Auto-cablear (habilita el re-ajuste adaptativo al prender/apagar) */
  autoCabled?: boolean
}

/** Marcador de referencia en el lienzo (rectángulo sólido). NO se exporta.
 *  w/h están en unidades de lienzo (cm, escala física, para verse junto a las pantallas).
 *  pitch permite mostrar/editar la medida en px (px = w*10/pitch) o en metros (w/100). */
export interface Marker {
  id: string
  x: number
  y: number
  w: number
  h: number
  pitch: number
  color: string
}

export interface Project {
  name: string
  screens: Screen[]
  markers: Marker[]
  selectedId: string | null
}
