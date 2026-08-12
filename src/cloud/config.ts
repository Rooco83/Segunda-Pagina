// Configuración de la nube (Google Drive). Todo se activa por variable de entorno.
// Sin VITE_GOOGLE_CLIENT_ID la app funciona 100% local (como el artifact/preview).

// Client ID de Google (web). Es PÚBLICO por diseño (ya viaja en el bundle del cliente);
// lo que protege la app es la lista de orígenes autorizados en Google Cloud. La variable
// de entorno tiene prioridad; si no está, se usa este valor por defecto.
const FALLBACK_CLIENT_ID = '221214289296-de4c8cmpsjdi3gp43p1ot59eetuan1l7.apps.googleusercontent.com'

export const GOOGLE_CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID || FALLBACK_CLIENT_ID).trim()

/** Alcance mínimo: leer datos básicos del perfil + gestionar SÓLO los archivos que
 *  la propia app crea en el Drive del usuario (drive.file, no ve el resto del Drive). */
export const GOOGLE_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/drive.file',
].join(' ')

/** Carpeta raíz donde la app guarda todos los proyectos, dentro del Drive del usuario. */
export const ROOT_FOLDER = 'Pixel Map Studio'

/** ¿Está configurada la nube en este build? */
export function cloudEnabled(): boolean {
  return GOOGLE_CLIENT_ID.length > 0
}
