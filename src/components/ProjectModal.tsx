import { useRef } from 'react'
import { useStore } from '../store'
import { IconClose, IconFolder, IconSave, IconUpload } from './icons'

export function ProjectModal({ onClose }: { onClose: () => void }) {
  const projectName = useStore((s) => s.projectName)
  const setProjectName = useStore((s) => s.setProjectName)
  const serialize = useStore((s) => s.serialize)
  const loadProject = useStore((s) => s.loadProject)
  const fileRef = useRef<HTMLInputElement>(null)

  const download = () => {
    const data = serialize()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${data.projectName.trim().replace(/\s+/g, '_') || 'proyecto'}.pmap`
    a.click()
    URL.revokeObjectURL(url)
  }

  const load = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    file.text().then((txt) => {
      try {
        loadProject(JSON.parse(txt))
        onClose()
      } catch {
        alert('No se pudo leer el archivo de proyecto (.pmap).')
      }
    })
    e.target.value = ''
  }

  const soon = () =>
    alert(
      'El envío por mail y el guardado en Google Drive llegan con el inicio de sesión (próxima versión).',
    )

  return (
    <div className="backdrop" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal m-export">
        <div className="modal-head">
          <div>
            <h2 style={{ color: 'var(--acc)' }}><IconSave /> Proyecto</h2>
            <div className="sub">Guardá o cargá tu pixel map.</div>
          </div>
          <button className="xbtn" onClick={onClose}><IconClose /></button>
        </div>

        <div className="modal-body">
          <label className="field-lbl">Nombre del proyecto / evento</label>
          <input
            className="text-input"
            placeholder="Ej: Festival XYZ 2026"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
          />

          <div className="card" style={{ marginTop: 18 }}>
            <h3>Guardar</h3>
            <button className="exp-opt" onClick={download}>
              <div className="ico" style={{ color: 'var(--acc)' }}><IconSave /></div>
              <div>
                <h4>Descargar archivo (.pmap)</h4>
                <p>Guarda el proyecto en tu compu para volver a cargarlo o enviarlo.</p>
              </div>
            </button>
            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <input className="text-input" placeholder="Enviar a este mail…" type="email" />
              <button className="btn btn-ghost" onClick={soon}><IconUpload /> Enviar</button>
            </div>
          </div>

          <div className="card" style={{ marginTop: 14 }}>
            <h3>Cargar</h3>
            <button className="exp-opt" onClick={() => fileRef.current?.click()}>
              <div className="ico" style={{ color: 'var(--acc)' }}><IconFolder /></div>
              <div>
                <h4>Cargar archivo (.pmap)</h4>
                <p>Abrí un proyecto guardado antes.</p>
              </div>
            </button>
            <input ref={fileRef} type="file" accept=".pmap,application/json" hidden onChange={load} />
          </div>

          <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6, marginTop: 14 }}>
            <b style={{ color: 'var(--text)' }}>Próximamente:</b> al iniciar sesión con Google,
            tus proyectos se guardarán en tu <b style={{ color: 'var(--text)' }}>Drive</b> (carpeta
            «Pixel Map Studio / {projectName.trim() || 'evento'}»). Si no usás Gmail, se enviarán por
            mail y se irán actualizando en la misma cadena con cada guardado.
          </p>
        </div>

        <div className="modal-foot">
          <button className="btn btn-ghost" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  )
}
