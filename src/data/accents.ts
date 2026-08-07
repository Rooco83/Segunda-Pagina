import type { Accent, AccentKey } from '../types'

export const ACCENTS: Accent[] = [
  { key: 'magenta', c: '#FF4D8D', ink: '#2a0412' },
  { key: 'cyan', c: '#19D3E0', ink: '#04262a' },
  { key: 'amber', c: '#F5A524', ink: '#2a1c04' },
  { key: 'violet', c: '#8B5CF6', ink: '#150a2a' },
  { key: 'green', c: '#3EE88F', ink: '#052a17' },
  { key: 'orange', c: '#FF7A1A', ink: '#2a1204' },
  { key: 'blue', c: '#3B82F6', ink: '#06122a' },
]

export const accentByKey = (key: AccentKey): Accent =>
  ACCENTS.find((a) => a.key === key) ?? ACCENTS[0]
