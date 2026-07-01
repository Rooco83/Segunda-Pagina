/**
 * ============================================================================
 *  APP CARGADOR DE TICKETS  ·  Backend (Google Apps Script)
 * ============================================================================
 *  Este archivo corre DENTRO de Google. Se encarga de:
 *    1) Mostrar la app en el celular  (doGet)
 *    2) Darle al desplegable la lista de CCO y Tipos de cuenta  (getOpciones)
 *    3) Recibir la foto + datos, leer el ticket con Gemini, guardar la
 *       imagen en Drive y agregar 1 fila al Sheet.  (procesarTicket)
 *
 *  👉 Lo ÚNICO que tenés que tocar está en el bloque CONFIG de abajo.
 *  👉 La clave de Gemini NO va acá (por seguridad). Va en "Propiedades del
 *     script" (te lo explica el INSTRUCTIVO.md, paso 6).
 * ============================================================================
 */

// ─────────────────────────────────────────────────────────────────────────
//  CONFIG  ·  Cambiá estos valores por los tuyos (ver INSTRUCTIVO.md)
// ─────────────────────────────────────────────────────────────────────────
const CONFIG = {
  // ID de tu Google Sheet (lo sacás de la URL de la planilla).
  // Ej: en https://docs.google.com/spreadsheets/d/XXXXXXXX/edit  el ID es XXXXXXXX
  SHEET_ID: 'PEGA_AQUI_EL_ID_DE_TU_PLANILLA',

  // Nombre de las pestañas (las hojas de abajo) dentro de esa planilla.
  TAB_TICKETS: 'Tickets', // acá se escribe 1 fila por ticket
  TAB_CCO:     'CCO',     // acá pegás tu lista de CCO (en la columna A)

  // ID de la carpeta de Drive donde se guardan las fotos de los tickets.
  // Lo sacás de la URL de la carpeta:  https://drive.google.com/drive/folders/YYYY  ->  ID = YYYY
  DRIVE_FOLDER_ID: 'PEGA_AQUI_EL_ID_DE_TU_CARPETA',

  // Lista fija de "Tipo de cuenta". Como casi siempre es uno, dejá el que uses.
  // Podés poner más separados por coma:  ['Caja Chica', 'Gastos', 'Viáticos']
  TIPOS_CUENTA: ['Caja Chica'],

  // Modelo de Gemini que lee las imágenes. 'gemini-2.5-flash' es rápido y barato.
  GEMINI_MODEL: 'gemini-2.5-flash'
};

// La clave de Gemini se lee de "Propiedades del script" (NUNCA se escribe acá,
// así no se filtra si el código se sube a GitHub).
function getGeminiApiKey_() {
  const key = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!key) {
    throw new Error('Falta la clave de Gemini. Cargala en Configuración del proyecto → Propiedades del script → GEMINI_API_KEY (ver INSTRUCTIVO paso 6).');
  }
  return key;
}


// ─────────────────────────────────────────────────────────────────────────
//  1) Mostrar la app en el celular
// ─────────────────────────────────────────────────────────────────────────
function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Carga de Tickets')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1')
    .addMetaTag('mobile-web-app-capable', 'yes');
}


// ─────────────────────────────────────────────────────────────────────────
//  2) Datos para los desplegables (se llama al abrir la app)
// ─────────────────────────────────────────────────────────────────────────
function getOpciones() {
  const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  const hojaCco = ss.getSheetByName(CONFIG.TAB_CCO);

  let ccos = [];
  if (hojaCco && hojaCco.getLastRow() > 0) {
    // Lee la columna A de la hoja CCO, ignora vacíos y el encabezado si lo hubiera.
    ccos = hojaCco.getRange(1, 1, hojaCco.getLastRow(), 1)
      .getValues()
      .map(function (fila) { return String(fila[0]).trim(); })
      .filter(function (v) { return v !== '' && v.toLowerCase() !== 'cco'; });
  }

  return {
    ccos: ccos,
    tiposCuenta: CONFIG.TIPOS_CUENTA
  };
}


// ─────────────────────────────────────────────────────────────────────────
//  3) Procesar un ticket:  Gemini → guardar imagen → agregar fila
//     payload = { cco, tipoCuenta, descripcion, imagenBase64, mimeType }
// ─────────────────────────────────────────────────────────────────────────
function procesarTicket(payload) {
  // Un "candado" para que, si cargás dos tickets casi al mismo tiempo, no
  // se repita el número de orden.
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
    const hoja = getOrCreateTicketsSheet_(ss);

    // --- Número de orden correlativo ---------------------------------------
    const orden = siguienteNumeroDeOrden_(hoja);
    const ordenTxt = String(orden).padStart(4, '0'); // 1 -> "0001"

    // --- Leer el comprobante con Gemini ------------------------------------
    let datos = { fecha: '', proveedor: '', importe_total: 0, moneda: '' };
    let estado = 'OK';
    try {
      datos = leerTicketConGemini_(payload.imagenBase64, payload.mimeType);
    } catch (err) {
      estado = 'Revisar: ' + err.message;
    }

    // --- Guardar la imagen en Drive, nombrada con el N° de orden -----------
    const nombreArchivo = ordenTxt + (datos.proveedor ? ' - ' + limpiarNombre_(datos.proveedor) : ' - ticket');
    const linkImagen = guardarImagenEnDrive_(payload.imagenBase64, payload.mimeType, nombreArchivo);

    // --- Agregar la fila al Sheet ------------------------------------------
    const usuario = Session.getActiveUser().getEmail() || '';
    hoja.appendRow([
      orden,                          // A  N° Orden
      new Date(),                     // B  Fecha de carga
      usuario,                        // C  Usuario
      payload.cco || '',              // D  CCO
      payload.tipoCuenta || '',       // E  Tipo de cuenta
      payload.descripcion || '',      // F  Descripción
      datos.fecha || '',              // G  Fecha del comprobante (Gemini)
      datos.proveedor || '',          // H  Proveedor / Empresa (Gemini)
      datos.importe_total || '',      // I  Importe total (Gemini)
      datos.moneda || '',             // J  Moneda (Gemini)
      linkImagen,                     // K  Link a la imagen
      estado                          // L  Estado
    ]);

    // --- Lo que ve el usuario en pantalla ----------------------------------
    return {
      ok: true,
      orden: ordenTxt,
      fecha: datos.fecha,
      proveedor: datos.proveedor,
      importe: datos.importe_total,
      moneda: datos.moneda,
      estado: estado
    };

  } catch (err) {
    return { ok: false, error: err.message };
  } finally {
    lock.releaseLock();
  }
}


// ─────────────────────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────────────────────

// Devuelve la hoja de Tickets; si no existe la crea con encabezados.
function getOrCreateTicketsSheet_(ss) {
  let hoja = ss.getSheetByName(CONFIG.TAB_TICKETS);
  if (!hoja) {
    hoja = ss.insertSheet(CONFIG.TAB_TICKETS);
  }
  if (hoja.getLastRow() === 0) {
    hoja.appendRow([
      'N° Orden', 'Fecha de carga', 'Usuario', 'CCO', 'Tipo de cuenta',
      'Descripción', 'Fecha comprobante', 'Proveedor / Empresa',
      'Importe total', 'Moneda', 'Imagen', 'Estado'
    ]);
    hoja.getRange(1, 1, 1, 12).setFontWeight('bold');
    hoja.setFrozenRows(1);
  }
  return hoja;
}

// Calcula el próximo N° de orden mirando el máximo de la columna A.
function siguienteNumeroDeOrden_(hoja) {
  const ultimaFila = hoja.getLastRow();
  if (ultimaFila < 2) return 1; // solo el encabezado
  const numeros = hoja.getRange(2, 1, ultimaFila - 1, 1).getValues();
  let max = 0;
  numeros.forEach(function (f) {
    const n = parseInt(f[0], 10);
    if (!isNaN(n) && n > max) max = n;
  });
  return max + 1;
}

// Guarda la imagen (base64) en la carpeta de Drive y devuelve su link.
function guardarImagenEnDrive_(base64, mimeType, nombre) {
  const carpeta = DriveApp.getFolderById(CONFIG.DRIVE_FOLDER_ID);
  const ext = (mimeType && mimeType.indexOf('png') > -1) ? '.png' : '.jpg';
  const bytes = Utilities.base64Decode(base64);
  const blob = Utilities.newBlob(bytes, mimeType || 'image/jpeg', nombre + ext);
  const archivo = carpeta.createFile(blob);
  return archivo.getUrl();
}

// Le manda la imagen a Gemini y le pide los datos del comprobante en JSON.
function leerTicketConGemini_(base64, mimeType) {
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/' +
    CONFIG.GEMINI_MODEL + ':generateContent?key=' + getGeminiApiKey_();

  const prompt =
    'Sos un asistente que extrae datos de comprobantes (tickets, facturas, ' +
    'recibos), incluso si es una captura de pantalla o una foto torcida. ' +
    'Devolvé SOLO los datos que puedas leer con seguridad:\n' +
    '- fecha: la fecha del comprobante en formato AAAA-MM-DD.\n' +
    '- proveedor: el nombre del comercio o empresa que emite el comprobante.\n' +
    '- importe_total: el monto TOTAL final a pagar, solo el número (sin símbolos ni separadores de miles).\n' +
    '- moneda: código como ARS, USD, EUR, etc.\n' +
    'Si algún dato no aparece, devolvé cadena vacía (o 0 para el importe).';

  const payload = {
    contents: [{
      parts: [
        { text: prompt },
        { inline_data: { mime_type: mimeType || 'image/jpeg', data: base64 } }
      ]
    }],
    generationConfig: {
      temperature: 0,
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: {
          fecha:         { type: 'STRING' },
          proveedor:     { type: 'STRING' },
          importe_total: { type: 'NUMBER' },
          moneda:        { type: 'STRING' }
        }
      }
    }
  };

  const respuesta = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  const codigo = respuesta.getResponseCode();
  if (codigo !== 200) {
    throw new Error('Gemini respondió ' + codigo + ': ' + respuesta.getContentText().slice(0, 200));
  }

  const json = JSON.parse(respuesta.getContentText());
  const texto = json.candidates[0].content.parts[0].text;
  return JSON.parse(texto);
}

// Saca caracteres raros para poder usar el texto como nombre de archivo.
function limpiarNombre_(texto) {
  return String(texto).replace(/[\\/:*?"<>|]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
}
