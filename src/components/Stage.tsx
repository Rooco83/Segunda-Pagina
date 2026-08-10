import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useStore } from '../store'
import { contentBounds, screenSizePx, snapPosition } from '../lib/layout'
import { ScreenView } from './ScreenView'
import { MarkerView } from './MarkerView'
import { CablePanel } from './CablePanel'

// Elementos de UI sobre los que NO se panea ni pinta.
const CHROME = '.cable-panel,.acc-switch,.ctx-tools,.dock,.zoombadge,.modal,.drag,button,.stbtn,.tool'

export function Stage() {
  const screens = useStore((s) => s.screens)
  const markers = useStore((s) => s.markers)
  const zoom = useStore((s) => s.zoom)
  const setZoom = useStore((s) => s.setZoom)
  const select = useStore((s) => s.select)
  const tool = useStore((s) => s.tool)
  const setModuleOff = useStore((s) => s.setModuleOff)
  const assignModule = useStore((s) => s.assignModule)
  const startCableStroke = useStore((s) => s.startCableStroke)
  const updateScreen = useStore((s) => s.updateScreen)
  const updateMarker = useStore((s) => s.updateMarker)
  const snapshot = useStore((s) => s.snapshot)

  const stageRef = useRef<HTMLDivElement>(null)
  const [pan, setPan] = useState({ x: 80, y: 40 })
  const [panning, setPanning] = useState(false)
  const drag = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null)
  const paint = useRef<{ mode: 'brush' | 'cable'; target: boolean; done: Set<string> } | null>(null)
  const moveRef = useRef<{ id: string; kind: 'screen' | 'marker'; sx: number; sy: number; ox: number; oy: number } | null>(null)

  const doFit = useCallback(
    (useSelection: boolean) => {
      const stage = stageRef.current
      if (!stage) return
      const sw = stage.clientWidth
      const sh = stage.clientHeight
      const st = useStore.getState()
      let b = contentBounds(st.screens)
      if (useSelection && st.selectedId) {
        const sc = st.screens.find((s) => s.id === st.selectedId)
        if (sc) {
          const sz = screenSizePx(sc)
          b = { minX: sc.x, minY: sc.y, w: sz.w, h: sz.h }
        }
      }
      if (!b.w || !b.h) return
      const z = Math.max(0.15, Math.min((sw - 160) / b.w, (sh - 160) / b.h, 1))
      setZoom(z)
      setPan({ x: (sw - b.w * z) / 2 - b.minX * z, y: (sh - b.h * z) / 2 - b.minY * z })
    },
    [setZoom],
  )

  useLayoutEffect(() => {
    doFit(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screens.length])

  useLayoutEffect(() => {
    const h = () => doFit(true)
    window.addEventListener('pm-fit', h)
    return () => window.removeEventListener('pm-fit', h)
  }, [doFit])

  const panRef = useRef(pan)
  useEffect(() => {
    panRef.current = pan
  }, [pan])

  // Zoom con rueda: listener nativo no-pasivo (para poder preventDefault sin warnings).
  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    const handler = (e: WheelEvent) => {
      const t = e.target as HTMLElement
      if (t.closest('.cable-panel,.acc-switch,.ctx-tools,.dock,.zoombadge')) return
      e.preventDefault()
      const rect = stage.getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top
      const cur = useStore.getState().zoom
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1
      const nz = Math.min(2, Math.max(0.15, cur * factor))
      const cx = (mx - panRef.current.x) / cur
      const cy = (my - panRef.current.y) / cur
      setPan({ x: mx - cx * nz, y: my - cy * nz })
      setZoom(nz)
    }
    stage.addEventListener('wheel', handler, { passive: false })
    return () => stage.removeEventListener('wheel', handler)
  }, [setZoom])

  const onPointerDown = (e: React.PointerEvent) => {
    const el = e.target as HTMLElement
    // Controles interactivos (engranaje, tools, inputs): dejarlos actuar, no panear/mover.
    if (el.closest('.stbtn, .screen-tools, .marker-tools, .marker-resize, button, input, select, .dd')) return
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

    // Mano sobre una pantalla o marcador: moverlo (pantalla con imantado)
    if (tool === 'hand') {
      const screenEl = el.closest('.screen') as HTMLElement | null
      if (screenEl) {
        const id = screenEl.dataset.screen!
        const sc = useStore.getState().screens.find((s) => s.id === id)
        if (sc) {
          snapshot()
          select(id)
          moveRef.current = { id, kind: 'screen', sx: e.clientX, sy: e.clientY, ox: sc.x, oy: sc.y }
          stageRef.current?.setPointerCapture(e.pointerId)
          return
        }
      }
      const markerEl = el.closest('.marker') as HTMLElement | null
      if (markerEl) {
        const id = markerEl.dataset.marker!
        const mk = useStore.getState().markers.find((m) => m.id === id)
        if (mk) {
          moveRef.current = { id, kind: 'marker', sx: e.clientX, sy: e.clientY, ox: mk.x, oy: mk.y }
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
      const rawX = m.ox + (e.clientX - m.sx) / zoom
      const rawY = m.oy + (e.clientY - m.sy) / zoom
      if (m.kind === 'marker') {
        updateMarker(m.id, { x: rawX, y: rawY })
        return
      }
      const all = useStore.getState().screens
      const me = all.find((s) => s.id === m.id)
      if (me) {
        const { w, h } = screenSizePx(me)
        const others = all
          .filter((s) => s.id !== m.id)
          .map((s) => ({ x: s.x, y: s.y, ...screenSizePx(s) }))
        const snapped = snapPosition(rawX, rawY, w, h, others, 12 / zoom)
        updateScreen(m.id, snapped)
      }
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
      className={`stage ${panning ? 'panning' : ''} ${tool === 'brush' || tool === 'cable' ? 'brush' : ''}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <div
        className="canvas-root"
        style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
      >
        {markers.map((mk) => (
          <MarkerView key={mk.id} marker={mk} />
        ))}
        {screens.map((s) => (
          <ScreenView key={s.id} screen={s} />
        ))}
      </div>

      <CablePanel />

      <div className="zoombadge">zoom {Math.round(zoom * 100)}%</div>
    </main>
  )
}
