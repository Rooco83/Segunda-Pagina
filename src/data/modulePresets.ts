import type { ModulePreset } from '../types'

// Resolución NATIVA real de cada módulo (no se calcula por pitch: los paneles
// tienen conteos de píxeles fijos). Valores a ampliar/confirmar por datasheet.
function preset(
  pitch: number,
  wCm: number,
  hCm: number,
  wPx: number,
  hPx: number,
): ModulePreset {
  return { id: `P${pitch}-${wCm}x${hCm}`, label: `P${pitch} | ${wCm} × ${hCm} cm`, pitch, wCm, hCm, wPx, hPx }
}

export const MODULE_PRESETS: ModulePreset[] = [
  preset(2.5, 50, 50, 200, 200),
  preset(2.6, 50, 50, 192, 192),
  preset(2.6, 50, 100, 192, 384),
  preset(2.6, 100, 50, 384, 192),
  preset(2.9, 50, 50, 168, 168),
  preset(2.9, 50, 100, 168, 336),
  preset(3.9, 50, 50, 128, 128),
  preset(3.9, 50, 100, 128, 256),
  preset(3.9, 100, 50, 256, 128),
  preset(3.9, 100, 100, 256, 256),
  preset(4.8, 50, 50, 104, 104),
  preset(4.8, 100, 50, 208, 104),
]

export const presetById = (id: string): ModulePreset =>
  MODULE_PRESETS.find((p) => p.id === id) ?? MODULE_PRESETS[2]
