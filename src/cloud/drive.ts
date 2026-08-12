// Cliente de Google Drive del lado del navegador.
// - Autenticación: Google Identity Services (token client, sin backend propio).
// - Almacenamiento: Drive REST API por fetch, alcance drive.file (sólo archivos de la app).
// Los tokens viven en memoria (no se persisten). Ver docs/BACKEND_SETUP.md.

import { GOOGLE_CLIENT_ID, GOOGLE_SCOPES, ROOT_FOLDER } from './config'

export interface Account {
  email: string
  name: string
  picture: string
}

export interface CloudFile {
  id: string
  name: string
  event: string // carpeta de evento que lo contiene
  modifiedTime?: string
}

const GIS_SRC = 'https://accounts.google.com/gsi/client'
const FOLDER_MIME = 'application/vnd.google-apps.folder'

let gisPromise: Promise<void> | null = null
let tokenClient: ReturnType<NonNullable<Window['google']>['accounts']['oauth2']['initTokenClient']> | null = null

/** Carga el script de Google Identity Services una sola vez. */
function loadGis(): Promise<void> {
  if (gisPromise) return gisPromise
  gisPromise = new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) return resolve()
    const el = document.createElement('script')
    el.src = GIS_SRC
    el.async = true
    el.defer = true
    el.onload = () => resolve()
    el.onerror = () => reject(new Error('No se pudo cargar Google Identity Services.'))
    document.head.appendChild(el)
  })
  return gisPromise
}

/** Pide un access token. interactive=true muestra el popup de Google; false intenta silencioso. */
export async function requestAccessToken(interactive: boolean): Promise<string> {
  await loadGis()
  const oauth2 = window.google?.accounts?.oauth2
  if (!oauth2) throw new Error('Google Identity Services no disponible.')
  if (!tokenClient) {
    tokenClient = oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: GOOGLE_SCOPES,
      callback: () => {}, // se reemplaza por request
    })
  }
  return new Promise<string>((resolve, reject) => {
    const client = tokenClient!
    ;(client as unknown as { callback: (r: { access_token?: string; error?: string }) => void }).callback = (
      resp,
    ) => {
      if (resp.access_token) resolve(resp.access_token)
      else reject(new Error(resp.error || 'No se pudo iniciar sesión con Google.'))
    }
    ;(client as unknown as { error_callback?: (e: { message?: string }) => void }).error_callback = (e) =>
      reject(new Error(e.message || 'Inicio de sesión cancelado.'))
    client.requestAccessToken({ prompt: interactive ? 'consent' : '' })
  })
}

/** Datos básicos del usuario a partir del access token. */
export async function fetchUserInfo(token: string): Promise<Account> {
  const r = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!r.ok) throw new Error('No se pudieron leer los datos de la cuenta.')
  const d = await r.json()
  return { email: d.email ?? '', name: d.name ?? d.email ?? 'Cuenta', picture: d.picture ?? '' }
}

/** Revoca el token (cierre de sesión completo). */
export function revokeToken(token: string): void {
  window.google?.accounts?.oauth2?.revoke(token)
}

// ---- Drive REST helpers ----

async function driveGet(token: string, url: string): Promise<Response> {
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (r.status === 401) throw new AuthError()
  return r
}

/** Error específico para 401 → hay que re-autenticar. */
export class AuthError extends Error {
  constructor() {
    super('La sesión de Google expiró. Volvé a iniciar sesión.')
    this.name = 'AuthError'
  }
}

/** Lanza un error con el detalle real que devuelve Google (status + mensaje). */
async function driveError(r: Response, fallback: string): Promise<never> {
  let detail = ''
  try {
    const d = await r.json()
    detail = d?.error?.message || ''
  } catch {
    /* sin cuerpo JSON */
  }
  // El caso más común: la Drive API no está habilitada en el proyecto.
  if (r.status === 403 && /has not been used|disabled|SERVICE_DISABLED/i.test(detail)) {
    throw new Error(
      'La Google Drive API no está habilitada en tu proyecto de Google Cloud. ' +
        'Andá a Google Cloud → APIs y servicios → Biblioteca → «Google Drive API» → Habilitar, ' +
        'esperá 1-2 min y reintentá.',
    )
  }
  throw new Error(detail ? `${fallback} (${r.status}: ${detail})` : `${fallback} (HTTP ${r.status})`)
}

async function listFiles(token: string, q: string, fields = 'files(id,name,modifiedTime,parents)') {
  const url =
    'https://www.googleapis.com/drive/v3/files?spaces=drive' +
    `&q=${encodeURIComponent(q)}&fields=${encodeURIComponent(fields)}&pageSize=200`
  const r = await driveGet(token, url)
  if (!r.ok) await driveError(r, 'Error consultando Drive.')
  const d = await r.json()
  return (d.files ?? []) as { id: string; name: string; modifiedTime?: string; parents?: string[] }[]
}

async function createFolder(token: string, name: string, parentId?: string): Promise<string> {
  const body: Record<string, unknown> = { name, mimeType: FOLDER_MIME }
  if (parentId) body.parents = [parentId]
  const r = await fetch('https://www.googleapis.com/drive/v3/files?fields=id', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (r.status === 401) throw new AuthError()
  if (!r.ok) await driveError(r, 'No se pudo crear la carpeta en Drive.')
  return (await r.json()).id
}

async function ensureFolder(token: string, name: string, parentId?: string): Promise<string> {
  const safe = name.replace(/'/g, "\\'")
  const parentClause = parentId ? ` and '${parentId}' in parents` : " and 'root' in parents"
  const q = `mimeType='${FOLDER_MIME}' and name='${safe}' and trashed=false${parentClause}`
  const found = await listFiles(token, q, 'files(id,name)')
  if (found.length) return found[0].id
  return createFolder(token, name, parentId)
}

/** Sube (o actualiza si ya existe) un archivo de texto en la carpeta dada. */
async function uploadFile(
  token: string,
  opts: { name: string; parentId: string; content: string; existingId?: string },
): Promise<string> {
  const meta: Record<string, unknown> = { name: opts.name }
  if (!opts.existingId) meta.parents = [opts.parentId]
  const boundary = 'pmap' + Math.random().toString(36).slice(2)
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(meta)}\r\n` +
    `--${boundary}\r\nContent-Type: application/json\r\n\r\n` +
    `${opts.content}\r\n--${boundary}--`
  const base = 'https://www.googleapis.com/upload/drive/v3/files'
  const url = opts.existingId
    ? `${base}/${opts.existingId}?uploadType=multipart&fields=id`
    : `${base}?uploadType=multipart&fields=id`
  const r = await fetch(url, {
    method: opts.existingId ? 'PATCH' : 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  })
  if (r.status === 401) throw new AuthError()
  if (!r.ok) await driveError(r, 'No se pudo guardar el archivo en Drive.')
  return (await r.json()).id
}

const slug = (s: string) => (s.trim().replace(/\s+/g, '_') || 'proyecto').replace(/[^\w.-]/g, '')

/** Guarda el proyecto en Drive: «Pixel Map Studio / <evento> / <archivo>.pmap».
 *  Si ya existe un archivo con ese nombre en el evento, lo actualiza (mismo lugar). */
export async function saveProject(
  token: string,
  eventName: string,
  content: string,
): Promise<{ id: string; path: string }> {
  const root = await ensureFolder(token, ROOT_FOLDER)
  const eventFolder = (eventName || 'General').trim() || 'General'
  const sub = await ensureFolder(token, eventFolder, root)
  const filename = `${slug(eventFolder)}.pmap`
  const existing = await listFiles(
    token,
    `name='${filename.replace(/'/g, "\\'")}' and '${sub}' in parents and trashed=false`,
    'files(id,name)',
  )
  const id = await uploadFile(token, {
    name: filename,
    parentId: sub,
    content,
    existingId: existing[0]?.id,
  })
  return { id, path: `${ROOT_FOLDER} / ${eventFolder} / ${filename}` }
}

/** Lista todos los .pmap que la app creó, con el nombre del evento que los contiene. */
export async function listProjects(token: string): Promise<CloudFile[]> {
  const root = await listFiles(
    token,
    `mimeType='${FOLDER_MIME}' and name='${ROOT_FOLDER}' and 'root' in parents and trashed=false`,
    'files(id,name)',
  )
  if (!root.length) return []
  const events = await listFiles(
    token,
    `mimeType='${FOLDER_MIME}' and '${root[0].id}' in parents and trashed=false`,
    'files(id,name)',
  )
  const byFolder = new Map(events.map((e) => [e.id, e.name]))
  const out: CloudFile[] = []
  for (const ev of events) {
    const files = await listFiles(
      token,
      `'${ev.id}' in parents and mimeType!='${FOLDER_MIME}' and trashed=false`,
    )
    for (const f of files) {
      out.push({
        id: f.id,
        name: f.name,
        event: byFolder.get(ev.id) ?? '—',
        modifiedTime: f.modifiedTime,
      })
    }
  }
  out.sort((a, b) => (b.modifiedTime ?? '').localeCompare(a.modifiedTime ?? ''))
  return out
}

/** Descarga el contenido (texto JSON) de un archivo. */
export async function readProject(token: string, id: string): Promise<string> {
  const r = await driveGet(token, `https://www.googleapis.com/drive/v3/files/${id}?alt=media`)
  if (!r.ok) await driveError(r, 'No se pudo abrir el proyecto de Drive.')
  return r.text()
}
