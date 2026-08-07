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
}

export interface Project {
  name: string
  screens: Screen[]
  selectedId: string | null
}
