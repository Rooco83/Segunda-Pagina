/**
 * ============================================================================
 *  COTAS VENUE · Backend (Google Apps Script)
 * ============================================================================
 *  Recibe los JPG finales de la app y los guarda en tu Drive:
 *
 *      <carpeta matriz "Cotas Venue">
 *          └── <Nombre del proyecto>
 *                └── Proyecto 001.jpg, Proyecto 002.jpg, ...
 *
 *  · La carpeta matriz y las de cada proyecto se crean solas cuando hacen
 *    falta. Si borrás una carpeta de proyecto a mano en Drive, se vuelve a
 *    crear la próxima vez que subas una foto de ese proyecto.
 *  · Solo se elimina en Drive si vos elegís borrar el proyecto DESDE LA APP
 *    tildando "borrar también de Drive".
 *
 *  Configuración: pegá el ID de la carpeta matriz en ROOT_FOLDER_ID (opcional;
 *  si lo dejás vacío, la app crea/usa una carpeta "Cotas Venue" en Mi unidad).
 *
 *  Deploy: Implementar → Nueva implementación → App web
 *          · Ejecutar como: yo
 *          · Acceso: cualquier persona con el vínculo
 *  Después pegá la URL /exec en Ajustes de la app.
 * ============================================================================
 */

const CONFIG = {
  // ID de la carpeta matriz en Drive (lo que va después de /folders/ en la URL).
  // Vacío = se crea/usa una carpeta "Cotas Venue" en Mi unidad.
  ROOT_FOLDER_ID: '',
  ROOT_FOLDER_NAME: 'Cotas Venue'
};

function doGet() {
  return respuesta_({ ok: true, app: 'Cotas Venue', version: 1 });
}

function doPost(e) {
  try {
    const datos = JSON.parse(e.postData.contents);

    if (datos.accion === 'ping') {
      // toca la carpeta raíz para validar permisos antes de decir "ok"
      const raiz = carpetaRaiz_();
      return respuesta_({ ok: true, carpeta: raiz.getName() });
    }

    if (datos.accion === 'subirFoto') {
      if (!datos.proyecto || !datos.jpegBase64) {
        return respuesta_({ ok: false, error: 'Faltan datos (proyecto o imagen).' });
      }
      const carpeta = carpetaProyecto_(String(datos.proyecto));
      const nombre = String(datos.nombreArchivo || 'foto.jpg');
      const blob = Utilities.newBlob(
        Utilities.base64Decode(datos.jpegBase64), 'image/jpeg', nombre);

      // si ya existe una foto con el mismo nombre, la pisamos (re-guardado desde la app)
      const existentes = carpeta.getFilesByName(nombre);
      while (existentes.hasNext()) existentes.next().setTrashed(true);

      const archivo = carpeta.createFile(blob);
      return respuesta_({
        ok: true,
        url: archivo.getUrl(),
        carpetaUrl: carpeta.getUrl()
      });
    }

    if (datos.accion === 'borrarProyecto') {
      if (!datos.proyecto) {
        return respuesta_({ ok: false, error: 'Falta el nombre del proyecto.' });
      }
      const raiz = carpetaRaiz_();
      const carpetas = raiz.getFoldersByName(String(datos.proyecto));
      let borradas = 0;
      while (carpetas.hasNext()) { carpetas.next().setTrashed(true); borradas++; }
      // borradas = 0 significa que no había carpeta (nunca se subió): igual es OK
      return respuesta_({ ok: true, borradas: borradas });
    }

    return respuesta_({ ok: false, error: 'Acción desconocida: ' + datos.accion });
  } catch (err) {
    return respuesta_({ ok: false, error: String(err && err.message || err) });
  }
}

/* ── helpers ── */

function carpetaRaiz_() {
  if (CONFIG.ROOT_FOLDER_ID) {
    return DriveApp.getFolderById(CONFIG.ROOT_FOLDER_ID);
  }
  const existentes = DriveApp.getRootFolder().getFoldersByName(CONFIG.ROOT_FOLDER_NAME);
  return existentes.hasNext() ? existentes.next()
                              : DriveApp.createFolder(CONFIG.ROOT_FOLDER_NAME);
}

function carpetaProyecto_(nombreProyecto) {
  const raiz = carpetaRaiz_();
  const existentes = raiz.getFoldersByName(nombreProyecto);
  return existentes.hasNext() ? existentes.next()
                              : raiz.createFolder(nombreProyecto);
}

function respuesta_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
