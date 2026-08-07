import { useStore } from '../store'
import { presetById } from '../data/modulePresets'
import { senderById } from '../data/senders'
import { cableRuns } from '../lib/cabling'

export function CablePanel() {
  const screen = useStore((s) => s.screens.find((sc) => sc.id === s.selectedId) ?? null)

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
  const runs = cableRuns(screen, preset, sender)

  return (
    <aside className="cable-panel">
      <div className="cp-head">
        Cableado <span>{screen.name}</span>
      </div>
      <div className="cp-sender">
        Sender: <b>{sender.brand} {sender.model}</b> · {sender.outputs} salidas
      </div>
      <div className="cp-list">
        {runs.map((run, i) => (
          <div key={run.output} className={`cp-out ${i === 0 ? 'sel' : ''}`}>
            <span className="cp-color" style={{ background: run.color }} />
            <div className="cp-mid">
              <div className="cp-name">Salida {run.output + 1}</div>
              <div className="cp-bar">
                <i style={{ width: `${(run.cells.length / run.limit) * 100}%`, background: run.color }} />
              </div>
            </div>
            <span className="cp-count">
              {run.cells.length}/{run.limit}
            </span>
          </div>
        ))}
      </div>
      <div className="cp-hint">
        Elegí una salida, tocá el módulo inicial y extendé la conexión módulo a módulo.
        Al llegar al límite de la salida, no deja conectar más.
      </div>
    </aside>
  )
}
