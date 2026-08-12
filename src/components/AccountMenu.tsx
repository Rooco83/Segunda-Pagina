import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../cloud/authStore'
import { useSync } from '../cloud/projectSync'
import { cloudEnabled } from '../cloud/config'
import { IconGoogle, IconLogout, IconUser } from './icons'

export function AccountMenu() {
  const account = useAuth((s) => s.account)
  const status = useAuth((s) => s.status)
  const error = useAuth((s) => s.error)
  const signIn = useAuth((s) => s.signIn)
  const signOut = useAuth((s) => s.signOut)
  const clearError = useAuth((s) => s.clearError)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const h = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('pointerdown', h)
    return () => window.removeEventListener('pointerdown', h)
  }, [])

  if (!account) {
    return (
      <div className="acct" ref={ref}>
        <button
          className="btn btn-ghost"
          style={{ padding: '8px 12px' }}
          disabled={status === 'connecting'}
          title={cloudEnabled() ? 'Guardá tus proyectos en tu Google Drive' : 'La nube se habilita al desplegar (ver docs/BACKEND_SETUP.md)'}
          onClick={() => signIn()}
        >
          {cloudEnabled() ? <IconGoogle className="gg" /> : <IconUser />}
          {status === 'connecting' ? 'Conectando…' : 'Iniciar sesión'}
        </button>
        {error && (
          <div className="acct-menu err">
            <p>{error}</p>
            <button className="btn btn-ghost" onClick={clearError}>Entendido</button>
          </div>
        )}
      </div>
    )
  }

  const initials = (account.name || account.email).slice(0, 1).toUpperCase()
  return (
    <div className="acct" ref={ref}>
      <button className="acct-chip" onClick={() => setOpen((v) => !v)} title={account.email}>
        {account.picture ? (
          <img src={account.picture} alt="" referrerPolicy="no-referrer" />
        ) : (
          <span className="avatar">{initials}</span>
        )}
        <span className="nm">{account.name || account.email}</span>
      </button>
      {open && (
        <div className="acct-menu">
          <div className="acct-id">
            <b>{account.name}</b>
            <span>{account.email}</span>
          </div>
          <button
            className="acct-item"
            onClick={() => {
              signOut()
              useSync.getState().disarm()
              setOpen(false)
            }}
          >
            <IconLogout /> Cerrar sesión
          </button>
        </div>
      )}
    </div>
  )
}
