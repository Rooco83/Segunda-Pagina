import { useRef } from 'react'
import type { Marker } from '../types'
import { useStore } from '../store'
import { IconTrash } from './icons'

export function MarkerView({ marker }: { marker: Marker }) {
  const updateMarker = useStore((s) => s.updateMarker)
  const deleteMarker = useStore((s) => s.deleteMarker)
  const setMarkerSel = useStore((s) => s.setMarkerSel)
  const selected = useStore((s) => s.markerSel === marker.id)
  const rez = useRef<{ sx: number; sy: number; ow: number; oh: number } | null>(null)

  const down = (e: React.PointerEvent) => {
    e.stopPropagation()
    setMarkerSel(marker.id)
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    rez.current = { sx: e.clientX, sy: e.clientY, ow: marker.w, oh: marker.h }
  }
  const move = (e: React.PointerEvent) => {
    if (!rez.current) return
    const z = useStore.getState().zoom
    const w = Math.max(20, Math.round(rez.current.ow + (e.clientX - rez.current.sx) / z))
    const h = Math.max(20, Math.round(rez.current.oh + (e.clientY - rez.current.sy) / z))
    updateMarker(marker.id, { w, h })
  }
  const up = () => {
    rez.current = null
  }

  // medida en px (según pitch) y en metros; contraescala para que el texto no se deforme
  const zoom = useStore((s) => s.zoom)
  const wPx = Math.round((marker.w * 10) / marker.pitch)
  const hPx = Math.round((marker.h * 10) / marker.pitch)
  const inv = { transform: `scale(${1 / zoom})` }
  const setPx = (axis: 'w' | 'h', px: number) =>
    updateMarker(marker.id, { [axis]: Math.max(20, (Math.max(1, px) * marker.pitch) / 10) } as Partial<Marker>)

  return (
    <div
      className={`marker ${selected ? 'sel' : ''}`}
      data-marker={marker.id}
      onPointerDown={() => setMarkerSel(marker.id)}
      style={{
        left: marker.x,
        top: marker.y,
        width: marker.w,
        height: marker.h,
        background: `${marker.color}30`,
        borderColor: marker.color,
      }}
    >
      <div className="marker-dim" style={{ ...inv, transformOrigin: 'top left' }}>
        {wPx} × {hPx} px · {(marker.w / 100).toFixed(2)} × {(marker.h / 100).toFixed(2)} m
      </div>
      <div
        className="marker-tools"
        style={{ ...inv, transformOrigin: 'top right' }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <input className="mk-in" type="number" value={wPx} onChange={(e) => setPx('w', Number(e.target.value))} />
        <span>×</span>
        <input className="mk-in" type="number" value={hPx} onChange={(e) => setPx('h', Number(e.target.value))} />
        <span>px</span>
        <button className="stbtn del" title="Eliminar marcador" onClick={() => deleteMarker(marker.id)}>
          <IconTrash />
        </button>
      </div>
      <div
        className="marker-resize"
        style={{ ...inv, transformOrigin: 'bottom right' }}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
      />
    </div>
  )
}
