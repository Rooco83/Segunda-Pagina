import type { Sender } from '../types'

// Seed inicial de senders usados en LatAm.
// pxPerOutput es orientativo (px totales / nº de salidas) y se refinará por datasheet.
// El auto-lookup y el alta manual permitirán completar/editar estos valores por usuario.
export const SENDERS: Sender[] = [
  // NovaStar
  { id: 'ns-vx400', brand: 'NovaStar', model: 'VX4S / VX400', outputs: 4, pxPerOutput: 650_000 },
  { id: 'ns-vx600', brand: 'NovaStar', model: 'VX600', outputs: 6, pxPerOutput: 650_000 },
  { id: 'ns-vx1000', brand: 'NovaStar', model: 'VX1000', outputs: 10, pxPerOutput: 650_000 },
  { id: 'ns-vx16s', brand: 'NovaStar', model: 'VX16s', outputs: 16, pxPerOutput: 650_000 },
  { id: 'ns-mctrl300', brand: 'NovaStar', model: 'MCTRL300', outputs: 2, pxPerOutput: 650_000 },
  { id: 'ns-mctrl660', brand: 'NovaStar', model: 'MCTRL600 / 660', outputs: 4, pxPerOutput: 650_000 },
  { id: 'ns-mctrl4k', brand: 'NovaStar', model: 'MCTRL4K', outputs: 16, pxPerOutput: 650_000 },
  // Colorlight
  { id: 'cl-x4s', brand: 'Colorlight', model: 'X2s / X4s', outputs: 4, pxPerOutput: 650_000 },
  { id: 'cl-x16', brand: 'Colorlight', model: 'X8 / X16', outputs: 16, pxPerOutput: 650_000 },
  { id: 'cl-s4', brand: 'Colorlight', model: 'S2 / S4', outputs: 4, pxPerOutput: 650_000 },
  // Huidu
  { id: 'hd-vp620', brand: 'Huidu', model: 'HD-VP620', outputs: 4, pxPerOutput: 650_000 },
  // Linsn
  { id: 'ls-ts802d', brand: 'Linsn', model: 'TS802D', outputs: 2, pxPerOutput: 650_000 },
]

export const senderById = (id: string): Sender =>
  SENDERS.find((s) => s.id === id) ?? SENDERS[0]
