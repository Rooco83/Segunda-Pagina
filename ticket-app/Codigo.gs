/**
 * ============================================================================
 *  APP CARGA DE TICKETS / RENDICIÓN  ·  Backend (Google Apps Script)
 * ============================================================================
 *  Modo MULTIUSUARIO: la app corre "a nombre de quien la usa". Cada persona
 *  guarda sus tickets en SU PROPIO Drive (nada queda centralizado).
 *
 *  La primera vez que alguien la usa, la app le crea en su Drive:
 *    - una planilla  "Rendicion Tickets"
 *    - una carpeta   "Tickets - fotos"
 *  y las reutiliza de ahí en más (recuerda sus IDs por usuario).
 *
 *  Lo ÚNICO compartido es el archivo de Centros de Costos (la lista de
 *  eventos/CCO), que debe estar compartido con permiso de LECTURA para todos.
 *
 *  👉 Config editable abajo.  👉 La clave de Gemini va en Propiedades del script.
 * ============================================================================
 */

// ─────────────────────────────────────────────────────────────────────────
//  CONFIG
// ─────────────────────────────────────────────────────────────────────────
const CONFIG = {
  // Estructura que la app crea en el Drive de CADA persona:
  //   Rendiciones / (AAAA-MM Mes) / Rendicion AAAA-MM Mes  + las fotos del mes
  // Cada mes se crea una carpeta y una planilla nuevas, y el N° de orden se reinicia.
  CARPETA_RAIZ:      'Rendiciones', // carpeta madre en el Drive del usuario
  RENDICION_NOMBRE:  'Rendicion',   // base del nombre de la planilla mensual
  TAB_RENDICION:     'Rendicion',

  // Archivo COMPARTIDO de Centros de Costos (uno solo). De ahí sale el desplegable
  // EVENTO (CCO). Debe estar compartido con LECTURA para todos los que usen la app.
  CCO_SOURCE_SHEET_ID: 'PEGA_AQUI_EL_ID_DEL_ARCHIVO_DE_CENTROS_DE_COSTOS',
  CCO_SOURCE_TAB: 'CENTROS DE COSTOS', // nombre EXACTO de la pestaña con la lista (columna A)
  CCO_SOURCE_COL: 1,
  CCO_ANIO_MINIMO: 2025, // se muestran los CCO de este año en adelante (2025, 2026, 2027, ...)

  // Lista fija del desplegable CUENTA (va exactamente como está escrito).
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
  GEMINI_MODEL: 'gemini-2.5-flash'
};

const ENCABEZADOS = [
  'ORDEN', 'FECHA', 'EVENTO (CCO)', 'CUENTA', 'DESCRIPCION DEL GASTO', 'PROVEED', 'IMPORTE EN $',
  'Moneda', 'Imagen', 'Cargado', 'Estado'
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
    // Suele pasar si la persona no tiene acceso de lectura al archivo de Centros de Costos.
    avisoCco = 'No se pudo leer la lista de eventos (CCO). Pedí que te compartan el archivo de Centros de Costos.';
  }
  return { ccos: ccos, cuentas: CONFIG.CUENTAS, avisoCco: avisoCco };
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
    // Debe empezar con un año de 4 dígitos + espacio + algo más (ej: "2027 06 FIFA...").
    // Así se incluyen 2025, 2026, 2027 y todos los años futuros, y se descartan los
    // títulos sueltos ("2025", "ENE", "FEB", ...).
    const m = v.match(/^(\d{4})\s+\S/);
    if (m && parseInt(m[1], 10) >= CONFIG.CCO_ANIO_MINIMO) {
      if (!vistos[v]) { vistos[v] = true; lista.push(v); }
    }
  });

  return lista;
}


// ─────────────────────────────────────────────────────────────────────────
//  3) Procesar un ticket (en el Drive de quien usa la app)
//     payload = { cco, cuenta, descripcion, imagenBase64, mimeType }
// ─────────────────────────────────────────────────────────────────────────
function procesarTicket(payload) {
  const lock = LockService.getUserLock(); // candado por usuario
  lock.waitLock(30000);

  try {
    const carpetaMes = getCarpetaMes_();       // carpeta del mes (se crea si no existe)
    const hoja = getRendicionSheet_(carpetaMes); // planilla del mes (se crea si no existe)

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

    // La imagen no debe frenar la carga: si falla, igual guardamos la fila y lo avisamos.
    let linkImagen = '';
    try {
      const nombreArchivo = ordenTxt + (datos.proveedor ? ' - ' + limpiarNombre_(datos.proveedor) : ' - ticket');
      linkImagen = guardarImagenEnDrive_(carpetaMes, payload.imagenBase64, payload.mimeType, nombreArchivo);
    } catch (err) {
      estado = agregarAviso_(estado, 'no se guardó la imagen: ' + err.message);
    }

    const usuario = Session.getActiveUser().getEmail() || '';
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
      estado
    ]);

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
      estado: estado,
      carpetaUrl: carpetaMes.getUrl(),
      carpetaRuta: rutaCarpeta_(carpetaMes),
      hojaUrl: hoja.getParent().getUrl()
    };

  } catch (err) {
    return { ok: false, error: err.message };
  } finally {
    lock.releaseLock();
  }
}


// ─────────────────────────────────────────────────────────────────────────
//  Estructura por mes en el Drive del usuario (se crea sola)
//     Rendiciones / AAAA-MM Mes / Rendicion AAAA-MM Mes
// ─────────────────────────────────────────────────────────────────────────

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
               'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

// Etiqueta del mes actual, ej: "2026-07 Julio" (ordenable y legible).
function etiquetaMes_() {
  const tz = Session.getScriptTimeZone() || 'America/Argentina/Buenos_Aires';
  const d = new Date();
  const anio = Utilities.formatDate(d, tz, 'yyyy');
  const mm = Utilities.formatDate(d, tz, 'MM');
  return anio + '-' + mm + ' ' + MESES[Number(mm) - 1];
}

// Busca una subcarpeta por nombre; si no existe, la crea.
function getOrCreateSubcarpeta_(padre, nombre) {
  const it = padre.getFoldersByName(nombre);
  return it.hasNext() ? it.next() : padre.createFolder(nombre);
}

// Carpeta del mes actual dentro de "Rendiciones".
function getCarpetaMes_() {
  const raiz = getOrCreateSubcarpeta_(DriveApp.getRootFolder(), CONFIG.CARPETA_RAIZ);
  return getOrCreateSubcarpeta_(raiz, etiquetaMes_());
}

// Planilla del mes actual, dentro de la carpeta del mes.
function getRendicionSheet_(carpetaMes) {
  const nombre = CONFIG.RENDICION_NOMBRE + ' ' + etiquetaMes_();
  const it = carpetaMes.getFilesByName(nombre);
  let ss;
  if (it.hasNext()) {
    ss = SpreadsheetApp.open(it.next());
  } else {
    ss = SpreadsheetApp.create(nombre);
    DriveApp.getFileById(ss.getId()).moveTo(carpetaMes); // sacarla de la raíz y meterla al mes
  }
  return getOrCreateHoja_(ss);
}

function getOrCreateHoja_(ss) {
  let hoja = ss.getSheetByName(CONFIG.TAB_RENDICION);
  if (!hoja) {
    // Reusar la hoja por defecto (evita dejar una "Hoja 1" vacía que confunde).
    const primera = ss.getSheets()[0];
    if (primera && primera.getLastRow() === 0) {
      primera.setName(CONFIG.TAB_RENDICION);
      hoja = primera;
    } else {
      hoja = ss.insertSheet(CONFIG.TAB_RENDICION);
    }
  }
  if (hoja.getLastRow() === 0) {
    hoja.appendRow(ENCABEZADOS);
    hoja.getRange(1, 1, 1, ENCABEZADOS.length).setFontWeight('bold');
    hoja.setFrozenRows(1);
    hoja.getRange('G2:G').setNumberFormat('"ARS"#,##0.00');
  }
  return hoja;
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

// Devuelve el "caminito" de la carpeta, ej: "Mi unidad ▸ Rendiciones ▸ 2026-07 Julio".
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
