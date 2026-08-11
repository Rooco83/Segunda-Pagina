/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** OAuth Client ID de Google (Web). Si está vacío, la nube queda deshabilitada
   *  y la app funciona 100% local. Se setea al desplegar (ver docs/BACKEND_SETUP.md). */
  readonly VITE_GOOGLE_CLIENT_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

/** API mínima de Google Identity Services (se carga en runtime sólo si hay client id). */
interface Window {
  google?: {
    accounts: {
      oauth2: {
        initTokenClient(cfg: {
          client_id: string
          scope: string
          prompt?: string
          callback: (resp: { access_token?: string; error?: string; error_description?: string }) => void
          error_callback?: (err: { type?: string; message?: string }) => void
        }): { requestAccessToken(overrides?: { prompt?: string }): void }
        revoke(token: string, done?: () => void): void
      }
    }
  }
}
