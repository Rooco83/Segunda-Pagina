import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { useStore } from '../store'
import { contentBounds } from '../lib/layout'
import { ScreenView } from './ScreenView'
import { CablePanel } from './CablePanel'

// Elementos de UI sobre los que NO se panea ni pinta.
const CHROME = '.cable-panel,.acc-switch,.ctx-tools,.dock,.zoombadge,.modal,.drag,button,.stbtn,.tool'

export function Stage() {
  const screens = useStore((s) => s.screens)
  const zoom = useStore((s) => s.zoom)
  const setZoom = useStore((s) => s.setZoom)
  const select = useStore((s) => s.select)
  const tool = useStore((s) => s.tool)
  const setModuleOff = useStore((s) => s.setModuleOff)
  const assignModule = useStore((s) => s.assignModule)
  const startCableStroke = useStore((s) => s.startCableStroke)
  const updateScreen = useStore((s) => s.updateScreen)
  const snapshot = useStore((s) => s.snapshot)

  const stageRef = useRef<HTMLDivElement>(null)
  const [pan, setPan] = useState({ x: 80, y: 40 })
  const [panning, setPanning] = useState(false)
  const drag = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null)
  const paint = useRef<{ mode: 'brush' | 'cable'; target: boolean; done: Set<string> } | null>(null)
  const moveRef = useRef<{ id: string; sx: number; sy: number; ox: number; oy: number } | null>(null)

  const fit = useCallback(() => {
    const stage = stageRef.current
    if (!stage) return
    const sw = stage.clientWidth
    const sh = stage.clientHeight
    const b = contentBounds(useStore.getState().screens)
    if (!b.w || !b.h) return
    const z = Math.max(0.15, Math.min((sw - 160) / b.w, (sh - 160) / b.h, 1))
    setZoom(z)
    setPan({ x: (sw - b.w * z) / 2 - b.minX * z, y: (sh - b.h * z) / 2 - b.minY * z })
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
    const el = e.target as HTMLElement
    const mod = el.closest('.mod') as HTMLElement | null

    // Pincel / Cable: actuar sobre módulos
    if ((tool === 'brush' || tool === 'cable') && mod) {
      const sid = mod.dataset.sid!
      const idx = Number(mod.dataset.idx)
      const target = !mod.classList.contains('off')
      snapshot()
      if (tool === 'brush') setModuleOff(sid, idx, target)
      else startCableStroke(sid, idx)
      paint.current = { mode: tool === 'brush' ? 'brush' : 'cable', target, done: new Set([`${sid}:${idx}`]) }
      stageRef.current?.setPointerCapture(e.pointerId)
      return
    }

    // Mover pantalla completa
    if (tool === 'move') {
      const screenEl = el.closest('.screen') as HTMLElement | null
      if (screenEl) {
        const id = screenEl.dataset.screen!
        const sc = useStore.getState().screens.find((s) => s.id === id)
        if (sc) {
          snapshot()
          select(id)
          moveRef.current = { id, sx: e.clientX, sy: e.clientY, ox: sc.x, oy: sc.y }
          stageRef.current?.setPointerCapture(e.pointerId)
          return
        }
      }
    }

    if (el.closest(CHROME)) return

    // Pan (mano, o área vacía en cualquier herramienta)
    if (!el.closest('.screen')) select(null)
    drag.current = { sx: e.clientX, sy: e.clientY, ox: pan.x, oy: pan.y }
    setPanning(true)
    stageRef.current?.setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (paint.current) {
      const target = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null
      const mod = target?.closest('.mod') as HTMLElement | null
      if (mod) {
        const key = `${mod.dataset.sid}:${mod.dataset.idx}`
        if (!paint.current.done.has(key)) {
          paint.current.done.add(key)
          if (paint.current.mode === 'brush') setModuleOff(mod.dataset.sid!, Number(mod.dataset.idx), paint.current.target)
          else assignModule(mod.dataset.sid!, Number(mod.dataset.idx))
        }
      }
      return
    }
    if (moveRef.current) {
      const m = moveRef.current
      updateScreen(m.id, { x: m.ox + (e.clientX - m.sx) / zoom, y: m.oy + (e.clientY - m.sy) / zoom })
      return
    }
    if (drag.current) {
      setPan({ x: drag.current.ox + (e.clientX - drag.current.sx), y: drag.current.oy + (e.clientY - drag.current.sy) })
    }
  }

  const onPointerUp = () => {
    drag.current = null
    paint.current = null
    moveRef.current = null
    setPanning(false)
  }

  return (
    <main
      ref={stageRef}
      className={`stage ${panning ? 'panning' : ''} ${tool === 'brush' || tool === 'cable' ? 'brush' : ''} ${tool === 'move' ? 'move' : ''}`}
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <div
        className="canvas-root"
        style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
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
