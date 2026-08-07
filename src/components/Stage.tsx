import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { useStore } from '../store'
import { ScreenView } from './ScreenView'
import { CablePanel } from './CablePanel'

const IGNORE = '.mod,.drag,button,.cable-panel,.acc-switch,.ctx-tools,.dock,.zoombadge,.modal,.stbtn,.tool'

export function Stage() {
  const screens = useStore((s) => s.screens)
  const zoom = useStore((s) => s.zoom)
  const setZoom = useStore((s) => s.setZoom)
  const select = useStore((s) => s.select)

  const stageRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const [pan, setPan] = useState({ x: 80, y: 40 })
  const [panning, setPanning] = useState(false)
  const drag = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null)

  const fit = useCallback(() => {
    const stage = stageRef.current
    const content = contentRef.current
    if (!stage || !content) return
    const sw = stage.clientWidth
    const sh = stage.clientHeight
    const cw = content.offsetWidth
    const ch = content.offsetHeight
    if (!cw || !ch) return
    const z = Math.min((sw - 120) / cw, (sh - 120) / ch, 1)
    const nz = Math.max(0.15, z)
    setZoom(nz)
    setPan({ x: (sw - cw * nz) / 2, y: (sh - ch * nz) / 2 })
  }, [setZoom])

  useLayoutEffect(() => {
    fit()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screens.length])

  useLayoutEffect(() => {
    window.addEventListener('pm-fit', fit)
    return () => window.removeEventListener('pm-fit', fit)
  }, [fit])

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const stage = stageRef.current
    if (!stage) return
    const rect = stage.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1
    const nz = Math.min(2, Math.max(0.15, zoom * factor))
    const cx = (mx - pan.x) / zoom
    const cy = (my - pan.y) / zoom
    setPan({ x: mx - cx * nz, y: my - cy * nz })
    setZoom(nz)
  }

  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest(IGNORE)) return
    select(null)
    drag.current = { sx: e.clientX, sy: e.clientY, ox: pan.x, oy: pan.y }
    setPanning(true)
    stageRef.current?.setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return
    setPan({ x: drag.current.ox + (e.clientX - drag.current.sx), y: drag.current.oy + (e.clientY - drag.current.sy) })
  }
  const onPointerUp = () => {
    drag.current = null
    setPanning(false)
  }

  return (
    <main
      ref={stageRef}
      className={`stage ${panning ? 'panning' : ''}`}
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <div
        ref={contentRef}
        className="canvas-root"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 60,
        }}
      >
        {screens.map((s) => (
          <ScreenView key={s.id} screen={s} />
        ))}
      </div>

      <CablePanel />

      <div className="zoombadge">zoom {Math.round(zoom * 100)}%</div>
    </main>
  )
}
