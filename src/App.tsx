import { useEffect } from 'react'
import { useStore } from './store'
import { accentByKey } from './data/accents'
import { TopBar } from './components/TopBar'
import { AccentSwitcher } from './components/AccentSwitcher'
import { ContextTools } from './components/ContextTools'
import { Stage } from './components/Stage'
import { ToolDock } from './components/ToolDock'
import { EditScreenModal } from './components/EditScreenModal'
import { ExportModal } from './components/ExportModal'

function hexSoft(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`
}

export default function App() {
  const accentKey = useStore((s) => s.accentKey)
  const closeEdit = useStore((s) => s.closeEdit)
  const setExportOpen = useStore((s) => s.setExportOpen)

  useEffect(() => {
    const a = accentByKey(accentKey)
    const r = document.documentElement.style
    r.setProperty('--acc', a.c)
    r.setProperty('--acc-ink', a.ink)
    r.setProperty('--acc-soft', hexSoft(a.c, 0.12))
  }, [accentKey])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeEdit()
        setExportOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [closeEdit, setExportOpen])

  return (
    <div className="app">
      <TopBar />
      <Stage />
      <AccentSwitcher />
      <ContextTools />
      <ToolDock />
      <EditScreenModal />
      <ExportModal />
    </div>
  )
}
