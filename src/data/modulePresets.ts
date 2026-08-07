import type { ModulePreset } from '../types'

/** Calcula px a partir del tamaño físico (cm) y el pitch (mm). */
function px(cm: number, pitchMm: number): number {
  return Math.round((cm * 10) / pitchMm)
}

function preset(pitch: number, wCm: number, hCm: number): ModulePreset {
  return {
    id: `P${pitch}-${wCm}x${hCm}`,
    label: `P${pitch} | ${wCm} × ${hCm} cm`,
    pitch,
    wCm,
    hCm,
    wPx: px(wCm, pitch),
    hPx: px(hCm, pitch),
  }
}

/** Presets combinando pitch × tamaño físico (los más usados). */
export const MODULE_PRESETS: ModulePreset[] = [
  preset(2.6, 50, 50),
  preset(2.6, 50, 100),
  preset(2.6, 100, 50),
  preset(2.9, 50, 50),
  preset(2.9, 50, 100),
  preset(3.9, 50, 50),
  preset(3.9, 50, 100),
  preset(3.9, 100, 50),
  preset(4.8, 50, 50),
  preset(4.8, 100, 50),
]

export const presetById = (id: string): ModulePreset =>
  MODULE_PRESETS.find((p) => p.id === id) ?? MODULE_PRESETS[1]
