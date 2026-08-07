// Íconos SVG inline (sin dependencias externas).
import type { ReactNode } from 'react'
type P = { className?: string }
const s = (children: ReactNode, extra?: object) => (p: P) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={p.className}
    {...extra}
  >
    {children}
  </svg>
)

export const IconExport = s(
  <>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </>,
)
export const IconMirror = s(
  <path d="M8 3H5a2 2 0 0 0-2 2v3m0 8v3a2 2 0 0 0 2 2h3m8-18h3a2 2 0 0 1 2 2v3m0 8v3a2 2 0 0 1-2 2h-3" />,
)
export const IconUpload = s(
  <>
    <path d="M12 16V4m-5 5 5-5 5 5" />
    <path d="M4 20h16" />
  </>,
)
export const IconFolder = s(
  <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />,
)
export const IconSave = s(
  <>
    <path d="M5 3h11l3 3v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
    <path d="M8 3v5h7M8 21v-6h8v6" />
  </>,
)
export const IconPlus = s(<path d="M5 12h14M12 5v14" />)
export const IconGear = s(
  <>
    <circle cx="12" cy="12" r="3" />
    <path d="M20 12a8 8 0 0 1-.2 1.8l2 1.6-2 3.4-2.4-1a8 8 0 0 1-1.6.9l-.4 2.6h-4l-.4-2.6a8 8 0 0 1-1.6-.9l-2.4 1-2-3.4 2-1.6A8 8 0 0 1 4 12a8 8 0 0 1 .2-1.8l-2-1.6 2-3.4 2.4 1a8 8 0 0 1 1.6-.9l.4-2.6h4l.4 2.6a8 8 0 0 1 1.6.9l2.4-1 2 3.4-2 1.6A8 8 0 0 1 20 12z" />
  </>,
)
export const IconTrash = s(<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />)
export const IconPalette = s(
  <>
    <circle cx="12" cy="12" r="9" />
    <circle cx="8.5" cy="9" r="1.2" fill="currentColor" stroke="none" />
    <circle cx="15.5" cy="9" r="1.2" fill="currentColor" stroke="none" />
    <circle cx="9" cy="15" r="1.2" fill="currentColor" stroke="none" />
    <circle cx="15" cy="15" r="1.2" fill="currentColor" stroke="none" />
  </>,
)
export const IconClose = s(<path d="M6 6l12 12M18 6 6 18" />)
export const IconUser = s(
  <>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
  </>,
)
export const IconHand = s(
  <>
    <path d="M18 11V6a2 2 0 0 0-4 0M14 10V4a2 2 0 0 0-4 0v2M10 10.5V6a2 2 0 0 0-4 0v8" />
    <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2a8 8 0 0 1-7-4l-2.5-4a2 2 0 0 1 3.5-2L8 14" />
  </>,
)
export const IconBrush = s(
  <>
    <path d="M18.4 2.6a2 2 0 0 1 3 3L12 15l-4 1 1-4z" />
    <path d="M2 22s3-1 5-3" />
  </>,
)
export const IconZoomOut = s(
  <>
    <circle cx="11" cy="11" r="7" />
    <path d="m21 21-4.3-4.3M8 11h6" />
  </>,
)
export const IconFit = s(
  <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3m8 0h3a2 2 0 0 0 2-2v-3" />,
)
export const IconCable = s(
  <>
    <path d="M9 7V4a2 2 0 0 1 4 0v3" />
    <rect x="7" y="7" width="8" height="4" rx="1" />
    <path d="M11 11v4a3 3 0 0 0 6 0v-1" />
    <circle cx="17" cy="19" r="2" />
  </>,
)
export const IconLayers = s(
  <>
    <path d="m12 2 9 5-9 5-9-5z" />
    <path d="m3 12 9 5 9-5M3 17l9 5 9-5" />
  </>,
  { strokeWidth: 1.6 },
)
export const IconPdf = s(
  <>
    <path d="M6 2h9l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" />
    <path d="M14 2v6h6" />
  </>,
  { strokeWidth: 1.6 },
)
