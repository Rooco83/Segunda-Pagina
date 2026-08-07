import { useRef } from 'react'
import { useStore } from '../store'
import { IconFolder, IconMirror, IconPlus, IconSave, IconUpload } from './icons'

export function ContextTools() {
  const addScreen = useStore((s) => s.addScreen)
  const mirrorScreen = useStore((s) => s.mirrorScreen)
  const selectedId = useStore((s) => s.selectedId)
  const serialize = useStore((s) => s.serialize)
  const loadProject = useStore((s) => s.loadProject)
  const fileRef = useRef<HTMLInputElement>(null)

  const save = () => {
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
      } catch {
        alert('No se pudo leer el archivo de proyecto (.pmap).')
      }
    })
    e.target.value = ''
  }

  return (
    <div className="ctx-tools">
      <button className="tool" title="Reflejar módulos apagados" onClick={() => selectedId && mirrorScreen(selectedId)}>
        <IconMirror /> Espejo
      </button>
      <button className="tool" title="Próximamente"><IconUpload /> Subir Logo</button>
      <button className="tool" onClick={() => fileRef.current?.click()}><IconFolder /> Cargar</button>
      <button className="tool" onClick={save}><IconSave /> Guardar</button>
      <button className="tool" onClick={addScreen}><IconPlus /> Nueva</button>
      <input ref={fileRef} type="file" accept=".pmap,application/json" hidden onChange={load} />
    </div>
  )
}
