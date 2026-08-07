import { useStore } from '../store'
import { IconFolder, IconMirror, IconPlus, IconSave, IconUpload } from './icons'

export function ContextTools() {
  const addScreen = useStore((s) => s.addScreen)

  return (
    <div className="ctx-tools">
      <button className="tool" title="Próximamente"><IconMirror /> Espejo</button>
      <button className="tool" title="Próximamente"><IconUpload /> Subir Logo</button>
      <button className="tool" title="Próximamente"><IconFolder /> Cargar</button>
      <button className="tool" title="Próximamente"><IconSave /> Guardar</button>
      <button className="tool" onClick={addScreen}><IconPlus /> Nueva</button>
    </div>
  )
}
