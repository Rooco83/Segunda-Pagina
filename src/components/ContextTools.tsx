import { useState } from 'react'
import { useStore } from '../store'
import { ProjectModal } from './ProjectModal'
import { MarkerModal } from './MarkerModal'
import { IconFolder, IconFrame, IconMirror, IconPlus, IconSave, IconUpload } from './icons'

export function ContextTools() {
  const addScreen = useStore((s) => s.addScreen)
  const mirrorScreen = useStore((s) => s.mirrorScreen)
  const selectedId = useStore((s) => s.selectedId)
  const projectOpen = useStore((s) => s.projectOpen)
  const setProjectOpen = useStore((s) => s.setProjectOpen)
  const [markerOpen, setMarkerOpen] = useState(false)

  return (
    <>
      <div className="ctx-tools">
        <button className="tool" title="Reflejar módulos apagados" onClick={() => selectedId && mirrorScreen(selectedId)}>
          <IconMirror /> Espejo
        </button>
        <button className="tool" title="Próximamente"><IconUpload /> Subir Logo</button>
        <button className="tool" title="Agregar forma de referencia (no se exporta)" onClick={() => setMarkerOpen(true)}>
          <IconFrame /> Marco
        </button>
        <button className="tool" onClick={() => setProjectOpen(true)}><IconFolder /> Cargar</button>
        <button className="tool" onClick={() => setProjectOpen(true)}><IconSave /> Guardar</button>
        <button className="tool" onClick={addScreen}><IconPlus /> Nueva</button>
      </div>
      {projectOpen && <ProjectModal onClose={() => setProjectOpen(false)} />}
      {markerOpen && <MarkerModal onClose={() => setMarkerOpen(false)} />}
    </>
  )
}
