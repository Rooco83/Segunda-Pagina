// Estado de sesión de Google (separado del store del proyecto).
// El token vive sólo en memoria; se persiste apenas un "hint" del email para UX.

import { create } from 'zustand'
import { cloudEnabled } from './config'
import {
  Account,
  AuthError,
  fetchUserInfo,
  requestAccessToken,
  revokeToken,
} from './drive'

interface AuthState {
  account: Account | null
  token: string | null
  status: 'idle' | 'connecting' | 'error'
  error: string | null
  emailHint: string | null

  signIn: () => Promise<void>
  signOut: () => void
  /** Ejecuta una operación de Drive garantizando token válido; reintenta 1 vez si expira. */
  runDrive: <T>(fn: (token: string) => Promise<T>) => Promise<T>
  clearError: () => void
}

function hint(): string | null {
  try {
    return localStorage.getItem('pm_email_hint')
  } catch {
    return null
  }
}

export const useAuth = create<AuthState>((set, get) => ({
  account: null,
  token: null,
  status: 'idle',
  error: null,
  emailHint: hint(),

  signIn: async () => {
    if (!cloudEnabled()) {
      set({ error: 'La nube no está configurada en esta versión. Ver docs/BACKEND_SETUP.md.' })
      return
    }
    set({ status: 'connecting', error: null })
    try {
      const token = await requestAccessToken(true)
      const account = await fetchUserInfo(token)
      try {
        localStorage.setItem('pm_email_hint', account.email)
      } catch {
        /* ignore */
      }
      set({ account, token, status: 'idle', error: null, emailHint: account.email })
    } catch (e) {
      set({ status: 'error', error: e instanceof Error ? e.message : 'No se pudo iniciar sesión.' })
    }
  },

  signOut: () => {
    const t = get().token
    if (t) revokeToken(t)
    set({ account: null, token: null, status: 'idle', error: null })
  },

  runDrive: async (fn) => {
    let token = get().token
    if (!token) {
      token = await requestAccessToken(true)
      const account = await fetchUserInfo(token)
      set({ account, token, emailHint: account.email })
    }
    try {
      return await fn(token)
    } catch (e) {
      if (e instanceof AuthError) {
        const fresh = await requestAccessToken(true)
        set({ token: fresh })
        return fn(fresh)
      }
      throw e
    }
  },

  clearError: () => set({ error: null }),
}))
