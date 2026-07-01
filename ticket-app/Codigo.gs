/**
 * ============================================================================
 *  APP CARGA DE TICKETS / RENDICIÓN  ·  Backend (Google Apps Script)
 * ============================================================================
 *  Modo EQUIPO: cualquiera de @venue carga un gasto y lo asigna a un TITULAR
 *  de tarjeta. Todo se guarda ORDENADO en una Unidad compartida:
 *
 *    Unidad compartida / Rendiciones / (AAAA-MM Mes) /
 *        - Rendicion AAAA-MM Mes   (planilla: 1 SOLAPA por titular)
 *        - <Titular>               (carpeta con los comprobantes de ese titular)
 *
 *  El N° de orden es propio de cada titular (cada solapa arranca en 1) y la
 *  imagen se guarda con ese número. Cada mes se crea todo nuevo.
 *
 *  La app corre "a nombre del dueño" (execute as owner) → solo el dueño necesita
 *  acceso a la Unidad compartida y al archivo de Centros de Costos.
 * ============================================================================
 */

// ─────────────────────────────────────────────────────────────────────────
//  CONFIG
// ─────────────────────────────────────────────────────────────────────────
const CONFIG = {
  // ID de la carpeta "Rendiciones" DENTRO de la Unidad compartida (ahí se crea todo).
  // Se saca de la URL de la carpeta:  .../folders/ESTO_ES_EL_ID
  ROOT_FOLDER_ID: 'PEGA_AQUI_EL_ID_DE_LA_CARPETA_RENDICIONES',
  RENDICION_NOMBRE: 'Rendicion', // base del nombre de la planilla mensual

  // Titulares de tarjeta: una SOLAPA y una CARPETA de comprobantes por cada uno.
  // Poné los nombres tal cual querés que aparezcan.
  TITULARES: ['Titular 1', 'Titular 2', 'Titular 3'],

  // Archivo de Centros de Costos (lo lee el dueño; no hace falta compartirlo).
  CCO_SOURCE_SHEET_ID: 'PEGA_AQUI_EL_ID_DEL_ARCHIVO_DE_CENTROS_DE_COSTOS',
  CCO_SOURCE_TAB: 'CENTROS DE COSTOS',
  CCO_SOURCE_COL: 1,
  CCO_ANIO_MINIMO: 2025,

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

  MONEDA_ESPERADA: 'ARS',
  GEMINI_MODEL: 'gemini-2.5-flash',
  GEMINI_MODEL_FALLBACK: 'gemini-2.0-flash'
};

const ENCABEZADOS = [
  'ORDEN', 'FECHA', 'EVENTO (CCO)', 'CUENTA', 'DESCRIPCION DEL GASTO', 'PROVEED', 'IMPORTE EN $',
  'Moneda', 'Imagen', 'Cargado', 'Cargado por', 'Estado'
];
const COL_IMPORTE = 7;

function getGeminiApiKey_() {
  const key = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!key) {
    throw new Error('Falta la clave de Gemini. Cargala en Configuración del proyecto → Propiedades del script → GEMINI_API_KEY.');
  }
  return key;
}


// ─────────────────────────────────────────────────────────────────────────
//  1) Mostrar la app
// ─────────────────────────────────────────────────────────────────────────
function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Carga de Tickets')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1')
    .addMetaTag('mobile-web-app-capable', 'yes');
}


// ─────────────────────────────────────────────────────────────────────────
//  2) Datos para los desplegables
// ─────────────────────────────────────────────────────────────────────────
function getOpciones() {
  let ccos = [];
  let avisoCco = '';
  try {
    ccos = leerCCOs_();
  } catch (err) {
    avisoCco = 'No se pudo leer la lista de eventos (CCO). Revisá el ID y la pestaña del archivo de Centros de Costos.';
  }
  return { ccos: ccos, cuentas: CONFIG.CUENTAS, titulares: CONFIG.TITULARES, avisoCco: avisoCco };
}

function leerCCOs_() {
  const ss = SpreadsheetApp.openById(CONFIG.CCO_SOURCE_SHEET_ID);
  const hoja = ss.getSheetByName(CONFIG.CCO_SOURCE_TAB);
  if (!hoja || hoja.getLastRow() === 0) return [];

  const valores = hoja.getRange(1, CONFIG.CCO_SOURCE_COL, hoja.getLastRow(), 1).getValues();
  const vistos = {};
  const lista = [];

  valores.forEach(function (fila) {
    const v = String(fila[0]).trim();
    const m = v.match(/^(\d{4})\s+\S/);
    if (m && parseInt(m[1], 10) >= CONFIG.CCO_ANIO_MINIMO) {
      if (!vistos[v]) { vistos[v] = true; lista.push(v); }
    }
  });

  return lista;
}


// ─────────────────────────────────────────────────────────────────────────
//  3) Procesar un ticket
//     payload = { titular, cco, cuenta, descripcion, imagenBase64, mimeType }
// ─────────────────────────────────────────────────────────────────────────
function procesarTicket(payload) {
  const titular = String(payload.titular || '').trim();
  if (CONFIG.TITULARES.indexOf(titular) === -1) {
    return { ok: false, error: 'Elegí un titular válido.' };
  }

  const lock = LockService.getScriptLock(); // un solo Drive (el del dueño): candado global
  lock.waitLock(30000);

  try {
    const carpetaMes = getCarpetaMes_();                    // Rendiciones / Mes
    const ss = getMonthSpreadsheet_(carpetaMes);            // planilla del mes
    const hoja = getOrCreateHojaTitular_(ss, titular);      // solapa del titular
    const carpetaTitular = getOrCreateSubcarpeta_(carpetaMes, titular); // comprobantes del titular

    const orden = siguienteNumeroDeOrden_(hoja);
    const ordenTxt = String(orden).padStart(4, '0');

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

    let linkImagen = '';
    try {
      const nombreArchivo = ordenTxt + (datos.proveedor ? ' - ' + limpiarNombre_(datos.proveedor) : ' - ticket');
      linkImagen = guardarImagenEnDrive_(carpetaTitular, payload.imagenBase64, payload.mimeType, nombreArchivo);
    } catch (err) {
      estado = agregarAviso_(estado, 'no se guardó la imagen: ' + err.message);
    }

    const cargadoPor = Session.getActiveUser().getEmail() || '';
    hoja.appendRow([
      orden,
      datos.fecha || '',
      payload.cco || '',
      payload.cuenta || '',
      payload.descripcion || '',
      datos.proveedor || '',
      datos.importe_total || '',
      datos.moneda || '',
      linkImagen,
      new Date(),
      cargadoPor,
      estado
    ]);

    const fila = hoja.getLastRow();
    const codigoMoneda = (datos.moneda || CONFIG.MONEDA_ESPERADA).toUpperCase();
    hoja.getRange(fila, COL_IMPORTE).setNumberFormat('"' + codigoMoneda + ' "#,##0.00');

    return {
      ok: true,
      titular: titular,
      orden: ordenTxt,
      fecha: datos.fecha,
      proveedor: datos.proveedor,
      importe: datos.importe_total,
      moneda: datos.moneda,
      estado: estado,
      carpetaUrl: carpetaTitular.getUrl(),
      carpetaRuta: rutaCarpeta_(carpetaTitular),
      hojaUrl: ss.getUrl()
    };

  } catch (err) {
    return { ok: false, error: err.message };
  } finally {
    lock.releaseLock();
  }
}


// ─────────────────────────────────────────────────────────────────────────
//  Estructura por mes en la Unidad compartida
// ─────────────────────────────────────────────────────────────────────────

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
               'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

function etiquetaMes_() {
  const tz = Session.getScriptTimeZone() || 'America/Argentina/Buenos_Aires';
  const d = new Date();
  const anio = Utilities.formatDate(d, tz, 'yyyy');
  const mm = Utilities.formatDate(d, tz, 'MM');
  return anio + '-' + mm + ' ' + MESES[Number(mm) - 1];
}

function getOrCreateSubcarpeta_(padre, nombre) {
  const it = padre.getFoldersByName(nombre);
  return it.hasNext() ? it.next() : padre.createFolder(nombre);
}

function getCarpetaMes_() {
  const root = DriveApp.getFolderById(CONFIG.ROOT_FOLDER_ID);
  return getOrCreateSubcarpeta_(root, etiquetaMes_());
}

function getMonthSpreadsheet_(carpetaMes) {
  const nombre = CONFIG.RENDICION_NOMBRE + ' ' + etiquetaMes_();
  const it = carpetaMes.getFilesByName(nombre);
  if (it.hasNext()) return SpreadsheetApp.open(it.next());
  const ss = SpreadsheetApp.create(nombre);
  DriveApp.getFileById(ss.getId()).moveTo(carpetaMes); // llevarla a la Unidad compartida
  return ss;
}

// Solapa (pestaña) del titular, con encabezados. Borra la "Hoja 1" vacía que confunde.
function getOrCreateHojaTitular_(ss, titular) {
  let hoja = ss.getSheetByName(titular);
  if (!hoja) hoja = ss.insertSheet(titular);
  if (hoja.getLastRow() === 0) {
    hoja.appendRow(ENCABEZADOS);
    hoja.getRange(1, 1, 1, ENCABEZADOS.length).setFontWeight('bold');
    hoja.setFrozenRows(1);
    hoja.getRange('G2:G').setNumberFormat('"ARS"#,##0.00');
  }
  borrarHojaPorDefecto_(ss, titular);
  return hoja;
}

function borrarHojaPorDefecto_(ss, titular) {
  const defaults = ['Hoja 1', 'Hoja1', 'Sheet1', 'Sheet 1'];
  const hojas = ss.getSheets();
  if (hojas.length <= 1) return;
  hojas.forEach(function (s) {
    if (s.getName() !== titular && defaults.indexOf(s.getName()) > -1 && s.getLastRow() === 0) {
      if (ss.getSheets().length > 1) ss.deleteSheet(s);
    }
  });
}


// ─────────────────────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────────────────────

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

function guardarImagenEnDrive_(carpeta, base64, mimeType, nombre) {
  const ext = (mimeType && mimeType.indexOf('png') > -1) ? '.png' : '.jpg';
  const bytes = Utilities.base64Decode(base64);
  const blob = Utilities.newBlob(bytes, mimeType || 'image/jpeg', nombre + ext);
  return carpeta.createFile(blob).getUrl();
}

function leerTicketConGemini_(base64, mimeType) {
  const prompt =
    'Sos un asistente que extrae datos de comprobantes (tickets, facturas, recibos), ' +
    'incluso si es una captura de pantalla o una foto torcida. ' +
    'Interpretá el significado, no la palabra exacta (el total puede aparecer como ' +
    '"Total", "Importe", "Monto", "Total a pagar", "Neto", etc.). ' +
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

  const opciones = {
    method: 'post', contentType: 'application/json',
    payload: JSON.stringify(payload), muteHttpExceptions: true
  };

  const key = getGeminiApiKey_();
  const base = 'https://generativelanguage.googleapis.com/v1beta/models/';
  const modelos = [CONFIG.GEMINI_MODEL, CONFIG.GEMINI_MODEL_FALLBACK];
  let ultimoError = 'Gemini no respondió';

  for (var mi = 0; mi < modelos.length; mi++) {
    const url = base + modelos[mi] + ':generateContent?key=' + key;
    for (var intento = 0; intento < 3; intento++) {
      const respuesta = UrlFetchApp.fetch(url, opciones);
      const codigo = respuesta.getResponseCode();
      if (codigo === 200) {
        const json = JSON.parse(respuesta.getContentText());
        return JSON.parse(json.candidates[0].content.parts[0].text);
      }
      ultimoError = 'Gemini (' + modelos[mi] + ') respondió ' + codigo;
      if (codigo === 503 || codigo === 429 || codigo === 500) {
        Utilities.sleep(1200 * (intento + 1));
        continue;
      }
      break;
    }
  }
  throw new Error(ultimoError + '. Estaba saturado; probá de nuevo en unos segundos.');
}

function agregarAviso_(estado, aviso) {
  if (estado === 'OK') return 'Revisar: ' + aviso;
  return estado + '; ' + aviso;
}

function rutaCarpeta_(folder) {
  const partes = [folder.getName()];
  let padres = folder.getParents();
  while (padres.hasNext()) {
    const p = padres.next();
    partes.unshift(p.getName());
    padres = p.getParents();
  }
  return partes.join(' ▸ ');
}

function limpiarNombre_(texto) {
  return String(texto).replace(/[\\/:*?"<>|]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
}
