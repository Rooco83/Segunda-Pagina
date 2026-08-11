import { useState } from 'react'
import { useStore } from '../store'
import { Dropdown } from './Dropdown'
import { IconClose, IconFrame } from './icons'

const PITCHES = [2.5, 2.6, 2.9, 3.9, 4.8]

export function MarkerModal({ onClose }: { onClose: () => void }) {
  const addMarker = useStore((s) => s.addMarker)
  const select = useStore((s) => s.select)
  const [mode, setMode] = useState<'px' | 'm'>('px')
  const [w, setW] = useState(mode === 'px' ? 1920 : 4)
  const [h, setH] = useState(mode === 'px' ? 1080 : 3)
  const [pitch, setPitch] = useState(2.6)

  const switchMode = (m: 'px' | 'm') => {
    if (m === mode) return
    // convertir el valor mostrado al cambiar de unidad
    if (m === 'm') {
      setW(+((w * pitch) / 1000).toFixed(2))
      setH(+((h * pitch) / 1000).toFixed(2))
    } else {
      setW(Math.round((w * 1000) / pitch))
      setH(Math.round((h * 1000) / pitch))
    }
    setMode(m)
  }

  const create = () => {
    // w/h del marcador se guardan en cm (escala física del lienzo)
    const wCm = mode === 'px' ? (w * pitch) / 10 : w * 100
    const hCm = mode === 'px' ? (h * pitch) / 10 : h * 100
    if (wCm < 1 || hCm < 1) return
    select(null) // para que el encuadre incluya todo (incluido el nuevo marco)
    addMarker({ w: wCm, h: hCm, pitch })
    onClose()
    setTimeout(() => window.dispatchEvent(new Event('pm-fit')), 0)
  }

  const previewPx =
    mode === 'px'
      ? `${Math.round(w)} × ${Math.round(h)} px`
      : `${Math.round((w * 1000) / pitch)} × ${Math.round((h * 1000) / pitch)} px`
  const previewM =
    mode === 'm'
      ? `${w} × ${h} m`
      : `${((w * pitch) / 1000).toFixed(2)} × ${((h * pitch) / 1000).toFixed(2)} m`

  return (
    <div className="backdrop" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal m-export">
        <div className="modal-head">
          <div>
            <h2 style={{ color: 'var(--acc)' }}><IconFrame /> Nuevo marco de referencia</h2>
            <div className="sub">No se exporta — solo queda en el lienzo.</div>
          </div>
          <button className="xbtn" onClick={onClose}><IconClose /></button>
        </div>

        <div className="modal-body">
          <div className="seg" style={{ marginBottom: 16 }}>
            <button className={mode === 'px' ? 'active' : ''} onClick={() => switchMode('px')}>Píxeles (px)</button>
            <button className={mode === 'm' ? 'active' : ''} onClick={() => switchMode('m')}>Metros (m)</button>
          </div>

          <div className="dims">
            <div>
              <label className="field-lbl">Ancho <b>({mode})</b></label>
              <input className="text-input" type="number" value={w} onChange={(e) => setW(Number(e.target.value))} />
            </div>
            <div>
              <label className="field-lbl">Alto <b>({mode})</b></label>
              <input className="text-input" type="number" value={h} onChange={(e) => setH(Number(e.target.value))} />
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <label className="field-lbl">Pitch (para convertir px ↔ metros)</label>
            <Dropdown
              value={String(pitch)}
              options={PITCHES.map((p) => ({ value: String(p), label: `P${p}` }))}
              onChange={(v) => setPitch(Number(v))}
            />
          </div>

          <div className="calc" style={{ marginTop: 16 }}>
            <div className="k">Equivale a<b>{previewM}</b></div>
            <div className="v" style={{ fontSize: 18 }}>{previewPx}</div>
          </div>
        </div>

        <div className="modal-foot">
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={create}>Crear marco</button>
        </div>
      </div>
    </div>
  )
}
