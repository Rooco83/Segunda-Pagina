// Sincronización del proyecto con Google Drive: guardado manual + autoguardado.
// El autoguardado se "arma" recién cuando el usuario guarda el proyecto por primera vez
// (así se define el destino en su Drive). A partir de ahí, cada minuto sube los cambios.

import { create } from 'zustand'
import { useStore } from '../store'
import { useAuth } from './authStore'
import { saveProject } from './drive'

export const AUTOSAVE_MS = 60_000 // 1 minuto

interface SyncState {
  armed: boolean // ya hubo un primer guardado en Drive → autoguardado activo
  saving: boolean
  lastSaved: number | null
  error: string | null
  lastContent: string // última versión subida (para no re-subir sin cambios)

  /** Guardado manual (arma el autoguardado). Lanza si falla. */
  saveNow: () => Promise<{ path: string }>
  /** Llamado por el timer: sube si hay cambios y ya está armado. */
  tick: () => Promise<void>
  /** Arma el autoguardado tomando el estado actual como referencia (p. ej. al cargar). */
  armFromCurrent: () => void
  /** Al cerrar sesión o resetear. */
  disarm: () => void
}

function currentContent(): string {
  return JSON.stringify(useStore.getState().serialize(), null, 2)
}

export const useSync = create<SyncState>((set, get) => ({
  armed: false,
  saving: false,
  lastSaved: null,
  error: null,
  lastContent: '',

  saveNow: async () => {
    const st = useStore.getState()
    const content = currentContent()
    set({ saving: true, error: null })
    try {
      const res = await useAuth.getState().runDrive((t) => saveProject(t, st.projectName, content))
      set({ saving: false, armed: true, lastSaved: Date.now(), lastContent: content })
      return res
    } catch (e) {
      set({ saving: false, error: e instanceof Error ? e.message : 'No se pudo guardar.' })
      throw e
    }
  },

  tick: async () => {
    const s = get()
    if (!s.armed || s.saving) return
    if (!useAuth.getState().account) return
    const content = currentContent()
    if (content === s.lastContent) return // sin cambios: no subir
    const st = useStore.getState()
    set({ saving: true, error: null })
    try {
      await useAuth.getState().runDrive((t) => saveProject(t, st.projectName, content))
      set({ saving: false, lastSaved: Date.now(), lastContent: content })
    } catch (e) {
      set({ saving: false, error: e instanceof Error ? e.message : 'Falló el autoguardado.' })
    }
  },

  armFromCurrent: () =>
    set({ armed: true, lastContent: currentContent(), lastSaved: Date.now(), error: null }),

  disarm: () => set({ armed: false, lastSaved: null, lastContent: '', error: null }),
}))
