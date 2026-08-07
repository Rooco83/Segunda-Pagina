import { useStore } from '../store'
import { IconBrush, IconFit, IconHand, IconZoomOut } from './icons'

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
          title="Mover (pan)"
          onClick={() => setTool('hand')}
        >
          <IconHand />
        </button>
        <button
          className={`dockbtn ${tool === 'brush' ? 'active' : ''}`}
          title="Pincel: pintá módulos para apagarlos/encenderlos"
          onClick={() => setTool('brush')}
        >
          <IconBrush />
        </button>
      </div>
      <div className="group">
        <button className="dockbtn" title="Alejar" onClick={() => setZoom(zoom / 1.15)}><IconZoomOut /></button>
        <button className="dockbtn" title="Ajustar" onClick={() => window.dispatchEvent(new Event('pm-fit'))}><IconFit /></button>
      </div>
    </div>
  )
}
