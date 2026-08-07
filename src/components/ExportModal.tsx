import { useState } from 'react'
import { useStore } from '../store'
import { exportScreenPng } from '../lib/exportImage'
import type { ExportOptions } from '../lib/exportImage'
import { IconClose, IconExport, IconLayers, IconPdf } from './icons'

export function ExportModal() {
  const open = useStore((s) => s.exportOpen)
  const setOpen = useStore((s) => s.setExportOpen)
  const screen = useStore((s) => s.screens.find((sc) => sc.id === s.selectedId) ?? s.screens[0] ?? null)

  const [inc, setInc] = useState({ name: true, logo: true, resolution: true, cabling: false })

  if (!open) return null

  const png = (alpha: boolean) => {
    if (!screen) return
    const opts: ExportOptions = { alpha, ...inc }
    exportScreenPng(screen, opts)
    setOpen(false)
  }

  const todo = (what: string) => {
    alert(`${what}: en construcción (próxima fase). El plan ya lo contempla.`)
  }

  const toggle = (k: keyof typeof inc) => setInc((v) => ({ ...v, [k]: !v[k] }))

  return (
    <div className="backdrop" onPointerDown={(e) => e.target === e.currentTarget && setOpen(false)}>
      <div className="modal m-export">
        <div className="modal-head">
          <div>
            <h2 style={{ color: 'var(--acc)' }}>
              <IconExport /> Opciones de Exportación
            </h2>
            <div className="sub">Elegí qué incluir y el formato de salida:</div>
          </div>
          <button className="xbtn" onClick={() => setOpen(false)}><IconClose /></button>
        </div>

        <div className="modal-body">
          <div className="exp-include">
            <div className="ei-title">¿Qué información incluir en el export?</div>
            <div className="ei-opts">
              <label className="chk"><input type="checkbox" checked={inc.name} onChange={() => toggle('name')} /> Nombre de pantalla</label>
              <label className="chk"><input type="checkbox" checked={inc.logo} onChange={() => toggle('logo')} /> Logo</label>
              <label className="chk"><input type="checkbox" checked={inc.resolution} onChange={() => toggle('resolution')} /> Resolución (W × H)</label>
              <label className="chk"><input type="checkbox" checked={inc.cabling} onChange={() => toggle('cabling')} /> Cableado (salidas y colores)</label>
            </div>
          </div>

          <button className="exp-opt" onClick={() => png(true)}>
            <div className="ico" style={{ color: 'var(--muted)' }}><IconExport /></div>
            <div>
              <h4>Fondo PNG Transparente (Alpha)</h4>
              <p>Sin fondo. Ideal para superponer sobre otros diseños o software VJ.</p>
            </div>
          </button>
          <button className="exp-opt" onClick={() => png(false)}>
            <div className="ico" style={{ color: 'var(--muted)' }}><IconExport /></div>
            <div>
              <h4>PNG con fondo</h4>
              <p>Render de la grilla con fondo oscuro, para vista previa y armado.</p>
            </div>
          </button>
          <button className="exp-opt" onClick={() => todo('Preset Resolume Arena 7.0')}>
            <div className="ico"><IconLayers /></div>
            <div>
              <h4>Preset Arena 7.0</h4>
              <p>Exporta la grilla como un XML (Advanced Output) para Resolume 7.</p>
            </div>
          </button>
          <button className="exp-opt" onClick={() => todo('Preset Resolume Arena 6.0')}>
            <div className="ico" style={{ color: 'var(--power)' }}><IconLayers /></div>
            <div>
              <h4>Preset Arena 6.0</h4>
              <p>Exporta la grilla como un XML (Advanced Output) para Resolume 6.</p>
            </div>
          </button>
          <button className="exp-opt" onClick={() => todo('Reporte PDF Profesional')}>
            <div className="ico"><IconPdf /></div>
            <div>
              <h4>Reporte PDF Profesional</h4>
              <p>Dossier técnico completo. 1 hoja por módulo + Layout Global.</p>
            </div>
          </button>
        </div>

        <div className="modal-foot">
          <button className="btn btn-ghost" onClick={() => setOpen(false)}>Cancelar</button>
        </div>
      </div>
    </div>
  )
}
