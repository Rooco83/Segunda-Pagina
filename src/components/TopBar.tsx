import { useStore } from '../store'
import { projectMetrics } from '../lib/metrics'
import { IconExport, IconUser } from './icons'

function mpx(px: number): string {
  return (px / 1_000_000).toFixed(2)
}

export function TopBar() {
  const projectName = useStore((s) => s.projectName)
  const setProjectName = useStore((s) => s.setProjectName)
  const screens = useStore((s) => s.screens)
  const setExportOpen = useStore((s) => s.setExportOpen)

  const m = projectMetrics(screens)

  return (
    <header className="topbar">
      <div className="brand">
        <svg className="mark" viewBox="0 0 34 34" fill="none" aria-hidden="true">
          <rect x="1" y="1" width="32" height="32" rx="7" stroke="var(--acc)" strokeWidth="1.5" />
          <rect x="7" y="7" width="8" height="8" rx="1.5" fill="var(--acc)" />
          <rect x="19" y="7" width="8" height="8" rx="1.5" fill="var(--acc)" opacity=".45" />
          <rect x="7" y="19" width="8" height="8" rx="1.5" fill="var(--acc)" opacity=".45" />
          <rect x="19" y="19" width="8" height="8" rx="1.5" fill="var(--acc)" />
        </svg>
        <div className="word">
          <b>PIXELMAP</b>
          <span>studio</span>
        </div>
      </div>

      <div className="stats">
        <div className="stat">
          <span className="lbl">Píxeles totales</span>
          <span className="val">{mpx(m.totalPx)} Mpx</span>
          <span className="hint">no cambia al apagar módulos</span>
        </div>
        <div className="vdiv" />
        <div className="stat area">
          <span className="lbl">Área activa</span>
          <span className="val">{m.areaM2.toFixed(1)} m²</span>
          <span className="hint">suma de módulos encendidos</span>
        </div>
        <div className="vdiv" />
        <div className="stat power">
          <span className="lbl">Consumo · blanco 100%</span>
          <span className="val">{Math.round(m.amps)} A</span>
          <span className="hint">2,4 A/m²</span>
        </div>
      </div>

      <div className="spacer" />

      <input
        className="proj-input"
        placeholder="Nombre del Proyecto"
        value={projectName}
        onChange={(e) => setProjectName(e.target.value)}
        aria-label="Nombre del proyecto"
      />
      <button className="btn btn-primary" onClick={() => setExportOpen(true)}>
        <IconExport /> Exportar
      </button>
      <button className="btn btn-ghost" style={{ padding: '8px 12px' }} title="Iniciar sesión con tu correo">
        <IconUser /> Iniciar sesión
      </button>
    </header>
  )
}
