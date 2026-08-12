import { useEffect } from 'react'
import { useStore } from '../store'
import { useAuth } from '../cloud/authStore'
import { useSync, AUTOSAVE_MS } from '../cloud/projectSync'
import { cloudEnabled } from '../cloud/config'
import { IconCloud, IconCloudUp, IconCheck } from './icons'

function hhmm(t: number): string {
  const d = new Date(t)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function AutoSaveBar() {
  const account = useAuth((s) => s.account)
  const signIn = useAuth((s) => s.signIn)
  const setProjectOpen = useStore((s) => s.setProjectOpen)
  const armed = useSync((s) => s.armed)
  const saving = useSync((s) => s.saving)
  const lastSaved = useSync((s) => s.lastSaved)
  const error = useSync((s) => s.error)

  // Timer de autoguardado (cada 1 minuto). Sólo sube si está armado y hay cambios.
  useEffect(() => {
    const id = setInterval(() => useSync.getState().tick(), AUTOSAVE_MS)
    return () => clearInterval(id)
  }, [])

  if (!cloudEnabled()) return null

  // Estado 1: sin sesión → hay que iniciar sesión primero
  if (!account) {
    return (
      <div className="asbar warn">
        <IconCloud />
        <span>Iniciá sesión y guardá el proyecto para activar el autoguardado.</span>
        <button className="asbar-btn" onClick={() => signIn()}>Iniciar sesión</button>
      </div>
    )
  }

  // Estado 2: con sesión pero todavía sin primer guardado
  if (!armed) {
    return (
      <div className="asbar warn">
        <IconCloudUp />
        <span>Guardá el proyecto en tu Drive para empezar el autoguardado (cada 1 min).</span>
        <button className="asbar-btn" onClick={() => setProjectOpen(true)}>Guardar ahora</button>
      </div>
    )
  }

  // Estado 3: autoguardado activo
  return (
    <div className={`asbar ${error ? 'bad' : 'ok'}`}>
      {saving ? (
        <>
          <IconCloudUp className="spin" />
          <span>Guardando…</span>
        </>
      ) : error ? (
        <>
          <IconCloud />
          <span>No se pudo autoguardar: {error}</span>
          <button className="asbar-btn" onClick={() => useSync.getState().tick()}>Reintentar</button>
        </>
      ) : (
        <>
          <IconCheck />
          <span>Autoguardado activo{lastSaved ? ` · guardado ${hhmm(lastSaved)}` : ''}</span>
        </>
      )}
    </div>
  )
}
