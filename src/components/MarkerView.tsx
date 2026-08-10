import { useRef } from 'react'
import type { Marker } from '../types'
import { useStore } from '../store'
import { IconTrash } from './icons'

export function MarkerView({ marker }: { marker: Marker }) {
  const updateMarker = useStore((s) => s.updateMarker)
  const deleteMarker = useStore((s) => s.deleteMarker)
  const rez = useRef<{ sx: number; sy: number; ow: number; oh: number } | null>(null)

  const down = (e: React.PointerEvent) => {
    e.stopPropagation()
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    rez.current = { sx: e.clientX, sy: e.clientY, ow: marker.w, oh: marker.h }
  }
  const move = (e: React.PointerEvent) => {
    if (!rez.current) return
    const z = useStore.getState().zoom
    const w = Math.max(40, Math.round(rez.current.ow + (e.clientX - rez.current.sx) / z))
    const h = Math.max(40, Math.round(rez.current.oh + (e.clientY - rez.current.sy) / z))
    updateMarker(marker.id, { w, h })
  }
  const up = () => {
    rez.current = null
  }

  return (
    <div
      className="marker"
      data-marker={marker.id}
      style={{
        left: marker.x,
        top: marker.y,
        width: marker.w,
        height: marker.h,
        background: `${marker.color}33`,
        borderColor: marker.color,
      }}
    >
      <div className="marker-dim">{Math.round(marker.w)} × {Math.round(marker.h)} px</div>
      <div className="marker-tools" onPointerDown={(e) => e.stopPropagation()}>
        <input
          className="mk-in" type="number" value={Math.round(marker.w)}
          onChange={(e) => updateMarker(marker.id, { w: Math.max(40, Number(e.target.value)) })}
        />
        <span>×</span>
        <input
          className="mk-in" type="number" value={Math.round(marker.h)}
          onChange={(e) => updateMarker(marker.id, { h: Math.max(40, Number(e.target.value)) })}
        />
        <button className="stbtn del" title="Eliminar marcador" onClick={() => deleteMarker(marker.id)}>
          <IconTrash />
        </button>
      </div>
      <div className="marker-resize" onPointerDown={down} onPointerMove={move} onPointerUp={up} />
    </div>
  )
}
