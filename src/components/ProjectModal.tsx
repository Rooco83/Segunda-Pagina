import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store'
import { useAuth } from '../cloud/authStore'
import { useSync } from '../cloud/projectSync'
import { cloudEnabled } from '../cloud/config'
import { CloudFile, listProjects, readProject } from '../cloud/drive'
import { IconCheck, IconCloud, IconCloudUp, IconClose, IconFolder, IconGoogle, IconSave } from './icons'

export function ProjectModal({ onClose }: { onClose: () => void }) {
  const projectName = useStore((s) => s.projectName)
  const setProjectName = useStore((s) => s.setProjectName)
  const serialize = useStore((s) => s.serialize)
  const loadProject = useStore((s) => s.loadProject)
  const account = useAuth((s) => s.account)
  const signIn = useAuth((s) => s.signIn)
  const runDrive = useAuth((s) => s.runDrive)
  const fileRef = useRef<HTMLInputElement>(null)

  const [busy, setBusy] = useState<'save' | 'list' | 'open' | null>(null)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [cloudList, setCloudList] = useState<CloudFile[] | null>(null)

  const download = () => {
    const data = serialize()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${data.projectName.trim().replace(/\s+/g, '_') || 'proyecto'}.pmap`
    a.click()
    URL.revokeObjectURL(url)
  }

  const load = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    file.text().then((txt) => {
      try {
        loadProject(JSON.parse(txt))
        onClose()
      } catch {
        alert('No se pudo leer el archivo de proyecto (.pmap).')
      }
    })
    e.target.value = ''
  }

  const saveToDrive = async () => {
    setBusy('save')
    setMsg(null)
    try {
      const res = await useSync.getState().saveNow() // arma el autoguardado
      setMsg({ ok: true, text: `Guardado en Drive: ${res.path}. Autoguardado activado.` })
      setCloudList(null) // forzar refresco al reabrir la lista
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'No se pudo guardar en Drive.' })
    } finally {
      setBusy(null)
    }
  }

  const refreshList = async () => {
    setBusy('list')
    setMsg(null)
    try {
      const files = await runDrive((t) => listProjects(t))
      setCloudList(files)
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'No se pudo leer Drive.' })
    } finally {
      setBusy(null)
    }
  }

  const openFromDrive = async (f: CloudFile) => {
    setBusy('open')
    setMsg(null)
    try {
      const txt = await runDrive((t) => readProject(t, f.id))
      loadProject(JSON.parse(txt))
      useSync.getState().armFromCurrent() // seguir autoguardando este proyecto
      onClose()
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'No se pudo abrir el proyecto.' })
      setBusy(null)
    }
  }

  // cargar la lista automáticamente al abrir estando logueado
  useEffect(() => {
    if (account && cloudList === null && busy === null) refreshList()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account])

  return (
    <div className="backdrop" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal m-export">
        <div className="modal-head">
          <div>
            <h2 style={{ color: 'var(--acc)' }}><IconSave /> Proyecto</h2>
            <div className="sub">Guardá o cargá tu pixel map.</div>
          </div>
          <button className="xbtn" onClick={onClose}><IconClose /></button>
        </div>

        <div className="modal-body">
          <label className="field-lbl">Nombre del proyecto / evento</label>
          <input
            className="text-input"
            placeholder="Ej: Festival XYZ 2026"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
          />

          {/* --- Nube (Google Drive) --- */}
          {cloudEnabled() && (
            <div className="card cloud" style={{ marginTop: 18 }}>
              <h3><IconCloud /> Google Drive</h3>
              {!account ? (
                <>
                  <p className="cloud-p">
                    Iniciá sesión para guardar el proyecto en tu Drive, en la carpeta
                    «Pixel Map Studio / {projectName.trim() || 'evento'}», y abrirlo desde cualquier compu.
                  </p>
                  <button className="btn btn-primary" onClick={() => signIn()}>
                    <IconGoogle className="gg" /> Iniciar sesión con Google
                  </button>
                </>
              ) : (
                <>
                  <button className="exp-opt" onClick={saveToDrive} disabled={busy === 'save'}>
                    <div className="ico" style={{ color: 'var(--acc)' }}><IconCloudUp /></div>
                    <div>
                      <h4>{busy === 'save' ? 'Guardando…' : 'Guardar en mi Drive'}</h4>
                      <p>Carpeta «Pixel Map Studio / {projectName.trim() || 'evento'}». Si ya existe, se actualiza.</p>
                    </div>
                  </button>

                  <div className="cloud-list-head">
                    <span>Mis proyectos en Drive</span>
                    <button className="linkbtn" onClick={refreshList} disabled={busy === 'list'}>
                      {busy === 'list' ? 'Actualizando…' : 'Actualizar'}
                    </button>
                  </div>
                  <div className="cloud-list">
                    {cloudList === null ? (
                      <div className="cloud-empty">Cargando…</div>
                    ) : cloudList.length === 0 ? (
                      <div className="cloud-empty">Todavía no guardaste nada en Drive.</div>
                    ) : (
                      cloudList.map((f) => (
                        <button
                          key={f.id}
                          className="cloud-file"
                          onClick={() => openFromDrive(f)}
                          disabled={busy === 'open'}
                        >
                          <IconFolder />
                          <div>
                            <b>{f.event}</b>
                            <span>{f.name}</span>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </>
              )}
              {msg && (
                <div className={`cloud-msg ${msg.ok ? 'ok' : 'bad'}`}>
                  {msg.ok && <IconCheck />} {msg.text}
                </div>
              )}
            </div>
          )}

          {/* --- Archivo local --- */}
          <div className="card" style={{ marginTop: 14 }}>
            <h3>Archivo (.pmap)</h3>
            <button className="exp-opt" onClick={download}>
              <div className="ico" style={{ color: 'var(--acc)' }}><IconSave /></div>
              <div>
                <h4>Descargar a mi compu</h4>
                <p>Guardá el proyecto como archivo para volver a cargarlo o enviarlo.</p>
              </div>
            </button>
            <button className="exp-opt" onClick={() => fileRef.current?.click()}>
              <div className="ico" style={{ color: 'var(--acc)' }}><IconFolder /></div>
              <div>
                <h4>Cargar desde archivo</h4>
                <p>Abrí un .pmap guardado antes.</p>
              </div>
            </button>
            <input ref={fileRef} type="file" accept=".pmap,application/json" hidden onChange={load} />
          </div>

          {!cloudEnabled() && (
            <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6, marginTop: 14 }}>
              <b style={{ color: 'var(--text)' }}>Nube:</b> al desplegar la app con las credenciales de
              Google, vas a poder iniciar sesión y guardar tus proyectos en tu <b style={{ color: 'var(--text)' }}>Drive</b>
              {' '}(carpeta «Pixel Map Studio / evento»). Ver <code>docs/BACKEND_SETUP.md</code>.
            </p>
          )}
        </div>

        <div className="modal-foot">
          <button className="btn btn-ghost" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  )
}
