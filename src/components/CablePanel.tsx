import { useStore } from '../store'
import { presetById } from '../data/modulePresets'
import { senderById } from '../data/senders'
import { OUTPUT_COLORS, modulesPerOutput, resolveWire } from '../lib/cabling'

export function CablePanel() {
  const screen = useStore((s) => s.screens.find((sc) => sc.id === s.selectedId) ?? null)
  const tool = useStore((s) => s.tool)
  const activeOutput = useStore((s) => s.activeOutput)
  const selectOutput = useStore((s) => s.selectOutput)
  const autoCable = useStore((s) => s.autoCable)

  if (!screen) {
    return (
      <aside className="cable-panel">
        <div className="cp-head">Cableado</div>
        <div className="cp-hint" style={{ borderTop: 'none', marginTop: 10, paddingTop: 0 }}>
          Seleccioná una pantalla para ver y asignar sus salidas.
        </div>
      </aside>
    )
  }

  const preset = presetById(screen.presetId)
  const sender = senderById(screen.senderId)
  const wire = resolveWire(screen, preset, sender)
  const limit = modulesPerOutput(preset, sender)
  const assigned = wire.reduce((n, a) => n + a.length, 0)
  const total = screen.cols * screen.rows

  return (
    <aside className="cable-panel">
      <div className="cp-head">
        Cableado <span>{screen.name}</span>
      </div>
      <div className="cp-sender">
        Sender: <b>{sender.brand} {sender.model}</b> · {sender.outputs} salidas
      </div>
      <div className="cp-list">
        {wire.map((arr, o) => {
          const color = OUTPUT_COLORS[o % OUTPUT_COLORS.length]
          const active = tool === 'cable' && activeOutput === o
          return (
            <div key={o} className={`cp-out ${active ? 'sel' : ''}`} onClick={() => selectOutput(o)}>
              <span className="cp-color" style={{ background: color }} />
              <div className="cp-mid">
                <div className="cp-name">Salida {o + 1}</div>
                <div className="cp-bar">
                  <i style={{ width: `${Math.min(100, (arr.length / limit) * 100)}%`, background: color }} />
                </div>
              </div>
              <span className="cp-count">{arr.length}/{limit}</span>
            </div>
          )
        })}
      </div>
      <div className="cp-cap">
        Asignados <b>{assigned}</b> / {total} módulos{assigned < total ? ' · faltan cablear' : ''}
      </div>
      <button className="cp-btn" onClick={() => autoCable(screen.id)}>Auto-cablear</button>
      <div className="cp-hint">
        {tool === 'cable'
          ? 'Modo cable: tocá el módulo de entrada y arrastrá hasta donde quieras soltar (o hasta el límite de la salida). Podés cablear menos que el tope.'
          : 'Tocá una salida para cablearla a mano, o usá Auto-cablear (respeta lo que ya cableaste).'}
      </div>
    </aside>
  )
}
