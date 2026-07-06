/**
 * ============================================================================
 *  COTAS VENUE · Backend (Google Apps Script)
 * ============================================================================
 *  Recibe los JPG finales de la app y los guarda en tu Drive:
 *
 *      <carpeta raíz "Mediciones">
 *          └── <Nombre del proyecto>
 *                └── Proyecto 001.jpg, Proyecto 002.jpg, ...
 *
 *  Configuración: pegá el ID de la carpeta raíz en ROOT_FOLDER_ID (opcional;
 *  si lo dejás vacío, la app crea/usa una carpeta "Mediciones" en Mi unidad).
 *
 *  Deploy: Implementar → Nueva implementación → App web
 *          · Ejecutar como: yo
 *          · Acceso: cualquier persona con el vínculo
 *  Después pegá la URL /exec en Ajustes de la app.
 * ============================================================================
 */

const CONFIG = {
  // ID de la carpeta raíz en Drive (lo que va después de /folders/ en la URL).
  // Vacío = se crea/usa una carpeta "Mediciones" en Mi unidad.
  ROOT_FOLDER_ID: '',
  ROOT_FOLDER_NAME: 'Mediciones'
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
