import { useStore } from '../store'
import { IconBrush, IconFit, IconHand, IconZoomOut } from './icons'

export function ToolDock() {
  const zoom = useStore((s) => s.zoom)
  const setZoom = useStore((s) => s.setZoom)

  return (
    <div className="dock">
      <div className="group">
        <button className="dockbtn active" title="Mover (pan)"><IconHand /></button>
        <button className="dockbtn" title="Pintar módulos (próximamente)"><IconBrush /></button>
      </div>
      <div className="group">
        <button className="dockbtn" title="Alejar" onClick={() => setZoom(zoom / 1.15)}><IconZoomOut /></button>
        <button className="dockbtn" title="Ajustar" onClick={() => window.dispatchEvent(new Event('pm-fit'))}><IconFit /></button>
      </div>
    </div>
  )
}
