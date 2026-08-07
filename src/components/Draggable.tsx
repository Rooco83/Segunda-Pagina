import { useRef } from 'react'
import type { ReactNode } from 'react'
import { useStore } from '../store'

interface Props {
  pos: { x: number; y: number }
  onChange: (pos: { x: number; y: number }) => void
  className?: string
  children: ReactNode
}

/** Elemento posicionado en absoluto y arrastrable dentro de su contenedor. */
export function Draggable({ pos, onChange, className, children }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const start = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null)

  function down(e: React.PointerEvent) {
    e.stopPropagation()
    const el = ref.current
    if (!el) return
    el.setPointerCapture(e.pointerId)
    start.current = { sx: e.clientX, sy: e.clientY, ox: pos.x, oy: pos.y }
  }
  function move(e: React.PointerEvent) {
    if (!start.current || !ref.current) return
    const el = ref.current
    const parent = el.parentElement!
    const zoom = useStore.getState().zoom
    const dx = (e.clientX - start.current.sx) / zoom
    const dy = (e.clientY - start.current.sy) / zoom
    const nx = Math.max(0, Math.min(start.current.ox + dx, parent.offsetWidth - el.offsetWidth))
    const ny = Math.max(0, Math.min(start.current.oy + dy, parent.offsetHeight - el.offsetHeight))
    onChange({ x: nx, y: ny })
  }
  function up() {
    start.current = null
  }

  return (
    <div
      ref={ref}
      className={`drag ${className ?? ''}`}
      style={{ left: pos.x, top: pos.y }}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
    >
      {children}
    </div>
  )
}
