/**
 * ============================================================================
 *  APP CARGA DE TICKETS / RENDICIÓN  ·  Backend (Google Apps Script)
 * ============================================================================
 *  Genera 1 fila por ticket con el formato de tu Planilla de Rendición:
 *    ORDEN | FECHA | EVENTO (CCO) | CUENTA | DESCRIPCION DEL GASTO | PROVEED | IMPORTE EN $
 *
 *  - ORDEN ............. número correlativo automático.
 *  - FECHA ............. la lee Gemini de la foto (DD/MM/AAAA).
 *  - EVENTO (CCO) ...... lo elegís del desplegable (sale de tu archivo de Centros de Costos).
 *  - CUENTA ............ lo elegís del desplegable (lista fija de abajo).
 *  - DESCRIPCION ....... la escribís vos.
 *  - PROVEED ........... la lee Gemini de la foto.
 *  - IMPORTE EN $ ...... lo lee Gemini de la foto.
 *  Además guarda la foto en tu carpeta de Drive nombrada con el N° de orden.
 *
 *  👉 Lo ÚNICO que tocás está en el bloque CONFIG.
 *  👉 La clave de Gemini va en "Propiedades del script" (INSTRUCTIVO, paso 6).
 * ============================================================================
 */

// ─────────────────────────────────────────────────────────────────────────
//  CONFIG  ·  Cambiá estos valores por los tuyos (ver INSTRUCTIVO.md)
// ─────────────────────────────────────────────────────────────────────────
const CONFIG = {
  // (A) Planilla donde se ESCRIBEN los tickets (tu Planilla de Rendición).
  //     El ID sale de la URL: .../spreadsheets/d/ESTO_ES_EL_ID/edit
  SHEET_ID: 'PEGA_AQUI_EL_ID_DE_TU_PLANILLA_DE_RENDICION',
  TAB_RENDICION: 'Rendicion', // nombre de la pestaña destino (se crea sola si no existe)

  // (B) Archivo EXTERNO de Centros de Costos: de ahí sale el desplegable EVENTO (CCO).
  //     Puede ser otra planilla distinta. El ID sale igual, de su URL.
  CCO_SOURCE_SHEET_ID: 'PEGA_AQUI_EL_ID_DEL_ARCHIVO_DE_CENTROS_DE_COSTOS',
  CCO_SOURCE_TAB: 'CCOs', // nombre EXACTO de la pestaña donde está la lista (columna A)
  CCO_SOURCE_COL: 1,      // columna donde está la lista (1 = A)
  CCO_ANIOS: ['2025', '2026'], // solo se muestran los CCO que empiezan con estos años

  // (C) Carpeta de Drive donde se guardan las fotos.
  //     ID de la URL: .../drive/folders/ESTO_ES_EL_ID
  DRIVE_FOLDER_ID: 'PEGA_AQUI_EL_ID_DE_TU_CARPETA',

  // (D) Lista fija del desplegable CUENTA (va exactamente como está escrito).
  CUENTAS: [
    '512 - Ambientacion',
    '514 - Catering Eventos Venue',
    '534 - Almacen y Libreria',
    '537 - Hoteles',
    '547 - Movilidad (combustible)',
    '548 - Gastos varios',
    '551 - Fletes, moto y mensajeria',
    '553 - Catering Produccion',
    '554 - Pasajes',
    '557 - Catering Clientes',
    '558 - Gastos Socios',
    '590 - Merchandising',
    '606 - Ferreteria',
    '611 - Taxis',
    '622 - OSDE / Obra Social',
    '640 - Suscripciones/membresías/Licencias',
    '805 - Regalos fda, credenciales, ropa'
  ],

  MONEDA_ESPERADA: 'ARS', // si un ticket viene en otra moneda, se marca para revisar
  GEMINI_MODEL: 'gemini-2.5-flash'
};

// Encabezados de la planilla de rendición (columnas A..G) + columnas de apoyo (H..K).
const ENCABEZADOS = [
  'ORDEN', 'FECHA', 'EVENTO (CCO)', 'CUENTA', 'DESCRIPCION DEL GASTO', 'PROVEED', 'IMPORTE EN $',
  'Moneda', 'Imagen', 'Cargado', 'Estado'
];
const COL_IMPORTE = 7; // columna G

// La clave de Gemini se lee de "Propiedades del script" (nunca se escribe en el código).
function getGeminiApiKey_() {
  const key = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!key) {
    throw new Error('Falta la clave de Gemini. Cargala en Configuración del proyecto → Propiedades del script → GEMINI_API_KEY (INSTRUCTIVO paso 6).');
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
  return {
    ccos: leerCCOs_(),
    cuentas: CONFIG.CUENTAS
  };
}

// Lee la columna A del archivo de Centros de Costos y deja solo los CCO de los años
// pedidos (por defecto 2025 y 2026), ignorando títulos sueltos como "2025", "ENE", etc.
function leerCCOs_() {
  const ss = SpreadsheetApp.openById(CONFIG.CCO_SOURCE_SHEET_ID);
  const hoja = ss.getSheetByName(CONFIG.CCO_SOURCE_TAB);
  if (!hoja || hoja.getLastRow() === 0) return [];

  const valores = hoja.getRange(1, CONFIG.CCO_SOURCE_COL, hoja.getLastRow(), 1).getValues();
  const anios = CONFIG.CCO_ANIOS;
  const vistos = {};
  const lista = [];

  valores.forEach(function (fila) {
    const v = String(fila[0]).trim();
    for (var i = 0; i < anios.length; i++) {
      // Debe empezar con "2025 " o "2026 " (año + espacio + algo más).
      // Así se descartan los títulos sueltos ("2025", "ENE", "FEB", ...).
      if (v.indexOf(anios[i] + ' ') === 0 && v.length > anios[i].length + 1) {
        if (!vistos[v]) { vistos[v] = true; lista.push(v); }
        break;
      }
    }
  });

  return lista;
}


// ─────────────────────────────────────────────────────────────────────────
//  3) Procesar un ticket:  Gemini → guardar imagen → agregar fila
//     payload = { cco, cuenta, descripcion, imagenBase64, mimeType }
// ─────────────────────────────────────────────────────────────────────────
function procesarTicket(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000); // evita que dos cargas casi simultáneas repitan el N° de orden

  try {
    const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
    const hoja = getOrCreateHoja_(ss);

    const orden = siguienteNumeroDeOrden_(hoja);
    const ordenTxt = String(orden).padStart(4, '0'); // 1 -> "0001"

    // --- Leer el comprobante con Gemini ------------------------------------
    let datos = { fecha: '', proveedor: '', importe_total: 0, moneda: '' };
    let estado = 'OK';
    try {
      datos = leerTicketConGemini_(payload.imagenBase64, payload.mimeType);
    } catch (err) {
      estado = 'Revisar (Gemini): ' + err.message;
    }
    if (!datos.importe_total) estado = agregarAviso_(estado, 'sin importe');
    if (datos.moneda && datos.moneda.toUpperCase() !== CONFIG.MONEDA_ESPERADA) {
      estado = agregarAviso_(estado, 'moneda ' + datos.moneda);
    }

    // --- Guardar la imagen en Drive, nombrada con el N° de orden -----------
    const nombreArchivo = ordenTxt + (datos.proveedor ? ' - ' + limpiarNombre_(datos.proveedor) : ' - ticket');
    const linkImagen = guardarImagenEnDrive_(payload.imagenBase64, payload.mimeType, nombreArchivo);

    // --- Agregar la fila (formato de la Planilla de Rendición) -------------
    const usuario = Session.getActiveUser().getEmail() || '';
    hoja.appendRow([
      orden,                                 // A  ORDEN
      datos.fecha || '',                     // B  FECHA
      payload.cco || '',                     // C  EVENTO (CCO)
      payload.cuenta || '',                  // D  CUENTA
      payload.descripcion || '',             // E  DESCRIPCION DEL GASTO
      datos.proveedor || '',                 // F  PROVEED
      datos.importe_total || '',             // G  IMPORTE EN $ (número)
      datos.moneda || '',                    // H  Moneda
      linkImagen,                            // I  Imagen
      new Date(),                            // J  Cargado
      estado                                 // K  Estado
    ]);

    // Formato de moneda según lo que leyó Gemini (ARS, USD, EUR, etc.), para que
    // cada importe muestre su moneda y siga sumando en el TOTAL.
    const fila = hoja.getLastRow();
    const codigoMoneda = (datos.moneda || CONFIG.MONEDA_ESPERADA).toUpperCase();
    hoja.getRange(fila, COL_IMPORTE).setNumberFormat('"' + codigoMoneda + ' "#,##0.00');

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

function getOrCreateHoja_(ss) {
  let hoja = ss.getSheetByName(CONFIG.TAB_RENDICION);
  if (!hoja) hoja = ss.insertSheet(CONFIG.TAB_RENDICION);
  if (hoja.getLastRow() === 0) {
    hoja.appendRow(ENCABEZADOS);
    hoja.getRange(1, 1, 1, ENCABEZADOS.length).setFontWeight('bold');
    hoja.setFrozenRows(1);
    hoja.getRange('G2:G').setNumberFormat('"ARS"#,##0.00');
  }
  return hoja;
}

function siguienteNumeroDeOrden_(hoja) {
  const ultima = hoja.getLastRow();
  if (ultima < 2) return 1;
  const numeros = hoja.getRange(2, 1, ultima - 1, 1).getValues();
  let max = 0;
  numeros.forEach(function (f) {
    const n = parseInt(f[0], 10);
    if (!isNaN(n) && n > max) max = n;
  });
  return max + 1;
}

function guardarImagenEnDrive_(base64, mimeType, nombre) {
  const carpeta = DriveApp.getFolderById(CONFIG.DRIVE_FOLDER_ID);
  const ext = (mimeType && mimeType.indexOf('png') > -1) ? '.png' : '.jpg';
  const bytes = Utilities.base64Decode(base64);
  const blob = Utilities.newBlob(bytes, mimeType || 'image/jpeg', nombre + ext);
  return carpeta.createFile(blob).getUrl();
}

function leerTicketConGemini_(base64, mimeType) {
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/' +
    CONFIG.GEMINI_MODEL + ':generateContent?key=' + getGeminiApiKey_();

  const prompt =
    'Sos un asistente que extrae datos de comprobantes (tickets, facturas, recibos), ' +
    'incluso si es una captura de pantalla o una foto torcida. ' +
    'Devolvé SOLO los datos que puedas leer con seguridad:\n' +
    '- fecha: la fecha del comprobante en formato DD/MM/AAAA.\n' +
    '- proveedor: el nombre del comercio o empresa que emite el comprobante.\n' +
    '- importe_total: el monto TOTAL final a pagar, solo el número (sin símbolos ni separadores de miles; usá punto para los decimales).\n' +
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

function agregarAviso_(estado, aviso) {
  if (estado === 'OK') return 'Revisar: ' + aviso;
  return estado + '; ' + aviso;
}

function limpiarNombre_(texto) {
  return String(texto).replace(/[\\/:*?"<>|]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
}
