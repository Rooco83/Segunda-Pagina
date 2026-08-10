import { useRef, useState } from 'react'
import { PALETTES, useStore } from '../store'
import { MODULE_PRESETS, presetById } from '../data/modulePresets'
import { SENDERS, senderById } from '../data/senders'
import { modulesPerOutput } from '../lib/cabling'
import { screenMetrics } from '../lib/metrics'
import { Dropdown } from './Dropdown'
import { IconClose, IconTrash } from './icons'

type Unit = 'px' | 'm' | 'mod'

export function EditScreenModal() {
  const screen = useStore((s) => s.screens.find((sc) => sc.id === s.editingId) ?? null)
  const updateScreen = useStore((s) => s.updateScreen)
  const setPalette = useStore((s) => s.setPalette)
  const deleteScreen = useStore((s) => s.deleteScreen)
  const closeEdit = useStore((s) => s.closeEdit)
  const [unit, setUnit] = useState<Unit>('mod')
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const drag = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null)

  const headDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('.xbtn, input, button, .dd')) return
    drag.current = { sx: e.clientX, sy: e.clientY, ox: pos.x, oy: pos.y }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }
  const headMove = (e: React.PointerEvent) => {
    if (!drag.current) return
    setPos({ x: drag.current.ox + (e.clientX - drag.current.sx), y: drag.current.oy + (e.clientY - drag.current.sy) })
  }
  const headUp = () => {
    drag.current = null
  }

  if (!screen) return null
  const preset = presetById(screen.presetId)
  const sender = senderById(screen.senderId)
  const m = screenMetrics(screen)

  // valores en la unidad elegida
  const toUnit = (count: number, per: number, cm: number) =>
    unit === 'mod' ? count : unit === 'px' ? count * per : (count * cm) / 100
  const fromUnit = (val: number, per: number, cm: number) =>
    unit === 'mod'
      ? Math.round(val)
      : unit === 'px'
        ? Math.max(1, Math.round(val / per))
        : Math.max(1, Math.round((val * 100) / cm))

  const wVal = toUnit(screen.cols, preset.wPx, preset.wCm)
  const hVal = toUnit(screen.rows, preset.hPx, preset.hCm)
  const fmt = (v: number) => (unit === 'm' ? v.toFixed(2) : String(Math.round(v)))


  return (
    <div className="backdrop edit-float">
      <div className="modal m-edit" style={{ transform: `translate(${pos.x}px, ${pos.y}px)` }}>
        <div className="modal-head draggable" onPointerDown={headDown} onPointerMove={headMove} onPointerUp={headUp}>
          <h2>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 6h10M4 12h16M4 18h7" />
              <circle cx="18" cy="6" r="2" />
              <circle cx="9" cy="18" r="2" />
            </svg>
            Editar Pantalla
          </h2>
          <button className="xbtn" onClick={closeEdit}><IconClose /></button>
        </div>

        <div className="modal-body">
          <div className="edit-top">
            <div className="name">
              <label className="field-lbl">Nombre de la Pantalla</label>
              <input
                className="text-input"
                value={screen.name}
                onChange={(e) => updateScreen(screen.id, { name: e.target.value })}
              />
            </div>
            <div className="colorbase">
              <label className="field-lbl">Color de la pantalla</label>
              <div className="palette-row">
                {PALETTES.map((p) => (
                  <button
                    key={p[0]}
                    className={`pal-swatch ${p[0] === screen.palette[0] ? 'active' : ''}`}
                    style={{ background: `linear-gradient(135deg, ${p[0]} 50%, ${p[1]} 50%)` }}
                    title="Elegir color"
                    onClick={() => setPalette(screen.id, p)}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="labels-row">
            <div>
              <label className="field-lbl">Tamaño del nombre <b>{Math.round(screen.nameSize ?? 30)}px</b></label>
              <input
                type="range" min={12} max={90} value={screen.nameSize ?? 30}
                onChange={(e) => updateScreen(screen.id, { nameSize: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="field-lbl">Tamaño del logo <b>{(screen.logoSize ?? 1).toFixed(1)}×</b></label>
              <input
                type="range" min={0.5} max={4} step={0.1} value={screen.logoSize ?? 1}
                onChange={(e) => updateScreen(screen.id, { logoSize: Number(e.target.value) })}
              />
            </div>
          </div>

          <div className="cols2">
            <div className="card">
              <h3>Tamaño Módulo</h3>
              <Dropdown
                value={screen.presetId}
                options={MODULE_PRESETS.map((p) => ({ value: p.id, label: p.label }))}
                onChange={(v) => updateScreen(screen.id, { presetId: v })}
              />
              <div style={{ textAlign: 'center', marginTop: 18, fontFamily: 'var(--mono)', color: 'var(--muted)' }}>
                {preset.wPx} × {preset.hPx} px por módulo
              </div>
            </div>

            <div className="card">
              <h3>Dimensiones Totales</h3>
              <div className="seg">
                <button className={unit === 'px' ? 'active' : ''} onClick={() => setUnit('px')}>Píxeles</button>
                <button className={unit === 'm' ? 'active' : ''} onClick={() => setUnit('m')}>Metros</button>
                <button className={unit === 'mod' ? 'active' : ''} onClick={() => setUnit('mod')}>Módulos</button>
              </div>
              <div className="dims">
                <div>
                  <label className="field-lbl">Ancho <b>({unit})</b></label>
                  <div className="stepper">
                    <input
                      type="number"
                      value={fmt(wVal)}
                      onChange={(e) => updateScreen(screen.id, { cols: fromUnit(Number(e.target.value), preset.wPx, preset.wCm) })}
                    />
                    <div className="arrows">
                      <button onClick={() => updateScreen(screen.id, { cols: screen.cols + 1 })}>▲</button>
                      <button onClick={() => updateScreen(screen.id, { cols: Math.max(1, screen.cols - 1) })}>▼</button>
                    </div>
                  </div>
                </div>
                <div>
                  <label className="field-lbl">Alto <b>({unit})</b></label>
                  <div className="stepper">
                    <input
                      type="number"
                      value={fmt(hVal)}
                      onChange={(e) => updateScreen(screen.id, { rows: fromUnit(Number(e.target.value), preset.hPx, preset.hCm) })}
                    />
                    <div className="arrows">
                      <button onClick={() => updateScreen(screen.id, { rows: screen.rows + 1 })}>▲</button>
                      <button onClick={() => updateScreen(screen.id, { rows: Math.max(1, screen.rows - 1) })}>▼</button>
                    </div>
                  </div>
                </div>
              </div>
              <div className="calc">
                <div className="k">
                  Área calculada
                  <b>{((screen.cols * preset.wCm) / 100).toFixed(2)} × {((screen.rows * preset.hCm) / 100).toFixed(2)} m</b>
                </div>
                <div className="v">{(m.totalModules * m.moduleAreaM2).toFixed(0)} m²</div>
              </div>
            </div>
          </div>

          <div className="card" style={{ marginTop: 16 }}>
            <h3>Cableado / Sender</h3>
            <div className="sender-row">
              <div>
                <label className="field-lbl">Modelo de Sender</label>
                <Dropdown
                  value={screen.senderId}
                  options={SENDERS.map((s) => ({ value: s.id, label: `${s.brand} ${s.model}` }))}
                  onChange={(v) => updateScreen(screen.id, { senderId: v })}
                />
              </div>
              <div>
                <label className="field-lbl">Salidas</label>
                <div className="readout">{sender.outputs}</div>
              </div>
              <div>
                <label className="field-lbl">Módulos / salida</label>
                <div className="readout">{modulesPerOutput(preset, sender)}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="modal-foot">
          <button
            className="btn btn-danger"
            style={{ marginRight: 'auto' }}
            onClick={() => {
              deleteScreen(screen.id)
              closeEdit()
            }}
          >
            <IconTrash /> Eliminar Pantalla
          </button>
          <button className="btn btn-ghost" onClick={closeEdit}>Cancelar</button>
          <button className="btn btn-primary" onClick={closeEdit}>Guardar</button>
        </div>
      </div>
    </div>
  )
}
