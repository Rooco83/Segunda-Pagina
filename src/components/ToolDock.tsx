import { useStore } from '../store'
import { IconBrush, IconCable, IconFit, IconHand, IconZoomOut } from './icons'

export function ToolDock() {
  const zoom = useStore((s) => s.zoom)
  const setZoom = useStore((s) => s.setZoom)
  const tool = useStore((s) => s.tool)
  const setTool = useStore((s) => s.setTool)

  return (
    <div className="dock">
      <div className="group">
        <button
          className={`dockbtn ${tool === 'hand' ? 'active' : ''}`}
          data-tip="Mano — mové el lienzo, o agarrá una pantalla para reubicarla (se imanta a las otras)."
          onClick={() => setTool('hand')}
        >
          <IconHand />
        </button>
        <button
          className={`dockbtn ${tool === 'brush' ? 'active' : ''}`}
          data-tip="Pincel — prendé o apagá módulos (clic, o arrastrando para pintar varios)."
          onClick={() => setTool('brush')}
        >
          <IconBrush />
        </button>
        <button
          className={`dockbtn ${tool === 'cable' ? 'active' : ''}`}
          data-tip="Cable — elegí una salida en el panel y tocá/arrastrá los módulos para cablearla."
          onClick={() => setTool('cable')}
        >
          <IconCable />
        </button>
      </div>
      <div className="group">
        <button className="dockbtn" data-tip="Alejar el zoom." onClick={() => setZoom(zoom / 1.15)}><IconZoomOut /></button>
        <button
          className="dockbtn"
          data-tip="Ajustar — centra la pantalla seleccionada, o toda la composición si no hay ninguna."
          onClick={() => window.dispatchEvent(new Event('pm-fit'))}
        >
          <IconFit />
        </button>
      </div>
    </div>
  )
}
