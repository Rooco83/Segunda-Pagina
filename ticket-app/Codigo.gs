/**
 * ============================================================================
 *  APP RENDICIONES VENUE  ·  Backend (Google Apps Script)
 * ============================================================================
 *  Dos flujos:
 *   - TARJETA:   carpeta por INICIALES del titular; solapas por VENCIMIENTO (VTOs)
 *   - CAJA CHICA: carpeta por CCO; una sola solapa que acumula gastos
 *
 *  Todo dentro de:  <Unidad compartida> / Rendiciones / Tarjeta|Caja Chica / ...
 *  Info fija (desplegables + vencimientos) leída de la planilla INFO_SHEET_ID.
 *
 *  La app corre "a nombre del dueño" (executeAs USER_DEPLOYING), acceso DOMAIN.
 * ============================================================================
 */

const CONFIG = {
  // Planilla de info fija (CCOs, CUENTAS, AMEX, VTOs)
  INFO_SHEET_ID: '1e5E3DNWjHWiAHswNIIXAmj1nXODJVyQaJuh8KiFxcCY',
  TAB_CCOS:    'CCOs',
  TAB_CUENTAS: 'CUENTAS',
  TAB_AMEX:    'AMEX',
  TAB_VTOS:    'VTOs',
  CCO_ANIO_MINIMO: 2025, // en CCOs se muestran los de este año en adelante

  // Carpeta "Rendiciones" DENTRO de la Unidad compartida (pegá su ID).
  ROOT_FOLDER_ID: '0AMxcaTKofh7hUk9PVA',
  SUB_TARJETA: 'Tarjeta',
  SUB_CAJA:    'Caja Chica',
  SOLAPA_CAJA: 'Gastos',
  CARPETA_IMAGENES: 'Imágenes',

  MONEDA_ESPERADA: 'ARS',
  GEMINI_MODEL: 'gemini-2.5-flash',
  GEMINI_MODEL_FALLBACK: 'gemini-2.0-flash'
};

// TARJETA: incluye TITULAR. CAJA CHICA: sin TITULAR. Ninguna lleva "CARGADO POR".
const ENC_TARJETA = [
  'ORDEN', 'FECHA', 'TIPO COMPROBANTE', 'PROVEEDOR', 'IMPORTE', 'MONEDA', 'TITULAR',
  'EVENTO (CCO)', 'CUENTA', 'QUIEN HIZO EL GASTO', 'COMENTARIO',
  'IMAGEN', 'CARGADO', 'ESTADO'
];
const ENC_CAJA = [
  'ORDEN', 'FECHA', 'TIPO COMPROBANTE', 'PROVEEDOR', 'IMPORTE', 'MONEDA',
  'EVENTO (CCO)', 'CUENTA', 'DESCRIPCION', 'QUIEN HIZO EL GASTO', 'COMENTARIO',
  'IMAGEN', 'CARGADO', 'ESTADO'
];
const COL_IMPORTE = 5;      // columna E (IMPORTE) en ambos formatos
const COL_MONEDA = 6;       // columna F (MONEDA) en ambos formatos
const HEADER_ROW = 6;       // fila de encabezados
const FIRST_DATA_ROW = 7;   // primera fila de datos / TOTAL inicial
const CLR_NAVY = '#00263E';
const CLR_ORANGE = '#F15A24';
const CLR_GRIS = '#F1F3F5';   // fondo gris clarito de las filas de datos
const CLR_TEXTO = '#212721';  // texto oscuro de los datos
// Ancho (px) por nombre de columna
const ANCHO_COL = {
  'ORDEN': 58, 'FECHA': 95, 'TIPO COMPROBANTE': 120, 'PROVEEDOR': 150, 'IMPORTE': 115,
  'MONEDA': 70, 'TITULAR': 140, 'EVENTO (CCO)': 175, 'CUENTA': 150, 'DESCRIPCION': 170,
  'QUIEN HIZO EL GASTO': 140, 'COMENTARIO': 160, 'IMAGEN': 120, 'CARGADO': 120, 'ESTADO': 120
};

function getGeminiApiKey_() {
  const key = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!key) throw new Error('Falta la clave de Gemini (Propiedades del script → GEMINI_API_KEY).');
  return key;
}


// ─────────────────────────────────────────────────────────────────────────
//  1) Mostrar la app
// ─────────────────────────────────────────────────────────────────────────
function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Rendiciones Venue')
    .setFaviconUrl('https://raw.githubusercontent.com/Rooco83/Segunda-Pagina/claude/mobile-google-sheets-automation-64txcn/ticket-app/icon_tickets_512.png')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1')
    .addMetaTag('mobile-web-app-capable', 'yes');
}


// ─────────────────────────────────────────────────────────────────────────
//  2) Datos para los desplegables (se llama al abrir la app)
// ─────────────────────────────────────────────────────────────────────────
function getOpciones() {
  const res = { ccos: [], cuentas: [], titulares: [], aviso: '' };
  try { res.ccos = leerCCOs_(); } catch (e) { res.aviso += 'CCOs. '; }
  try { res.cuentas = leerCuentas_(); } catch (e) { res.aviso += 'Cuentas. '; }
  try { res.titulares = leerTitulares_(); } catch (e) { res.aviso += 'Titulares. '; }
  if (res.aviso) res.aviso = 'No se pudieron leer: ' + res.aviso + 'Revisá el ID/solapas de la planilla.';
  return res;
}

function abrirInfo_() { return SpreadsheetApp.openById(CONFIG.INFO_SHEET_ID); }

function columnaA_(tabName) {
  const hoja = abrirInfo_().getSheetByName(tabName);
  if (!hoja || hoja.getLastRow() === 0) return [];
  return hoja.getRange(1, 1, hoja.getLastRow(), 1).getValues().map(function (f) { return String(f[0]).trim(); });
}

function leerCCOs_() {
  const vistos = {}, lista = [];
  columnaA_(CONFIG.TAB_CCOS).forEach(function (v) {
    const m = v.match(/^(\d{4})\s+\S/);
    if (m && parseInt(m[1], 10) >= CONFIG.CCO_ANIO_MINIMO && !vistos[v]) { vistos[v] = true; lista.push(v); }
  });
  return lista;
}

function leerCuentas_() {
  return columnaA_(CONFIG.TAB_CUENTAS).filter(function (v) {
    return v !== '' && v.toLowerCase() !== 'cuentas' && v.toLowerCase() !== 'cuenta';
  });
}

// AMEX: A = iniciales, B = nombre completo. Devuelve [{nombre, iniciales}].
function leerTitulares_() {
  const hoja = abrirInfo_().getSheetByName(CONFIG.TAB_AMEX);
  if (!hoja || hoja.getLastRow() === 0) return [];
  const vals = hoja.getRange(1, 1, hoja.getLastRow(), 2).getValues();
  const lista = [];
  vals.forEach(function (f) {
    const ini = String(f[0]).trim(), nom = String(f[1]).trim();
    if (ini && nom && nom.toLowerCase() !== 'nombre') lista.push({ nombre: nom, iniciales: ini });
  });
  return lista;
}

// VTOs: A = etiqueta ("agosto 2026"), B = "dd/mm/aaaa - dd/mm/aaaa"
function leerVtos_() {
  const hoja = abrirInfo_().getSheetByName(CONFIG.TAB_VTOS);
  if (!hoja || hoja.getLastRow() === 0) return [];
  const vals = hoja.getRange(1, 1, hoja.getLastRow(), 2).getValues();
  const lista = [];
  vals.forEach(function (f) {
    const etiqueta = String(f[0]).trim();
    const rango = String(f[1]).trim();
    const fechas = rango.match(/(\d{1,2}\/\d{1,2}\/\d{4}).*?(\d{1,2}\/\d{1,2}\/\d{4})/);
    if (etiqueta && fechas) {
      const desde = parseFecha_(fechas[1]), hasta = parseFecha_(fechas[2]);
      if (desde && hasta) lista.push({ etiqueta: etiqueta, desde: desde, hasta: hasta });
    }
  });
  return lista;
}

// Devuelve la solapa (etiqueta del VTO) donde cae una fecha DD/MM/AAAA.
function solapaParaFecha_(fechaStr) {
  const f = parseFecha_(fechaStr) || new Date();
  const vtos = leerVtos_();
  for (var i = 0; i < vtos.length; i++) {
    if (f >= vtos[i].desde && f <= diaFin_(vtos[i].hasta)) return vtos[i].etiqueta;
  }
  return 'Sin vencimiento';
}


// ─────────────────────────────────────────────────────────────────────────
//  3) Leer el comprobante con Gemini (se llama al subir la foto)
//     Devuelve datos EDITABLES para que la persona confirme o corrija.
// ─────────────────────────────────────────────────────────────────────────
function leerComprobante(base64, mimeType) {
  const prompt =
    'Sos un asistente que extrae datos de comprobantes (facturas, tickets, recibos), ' +
    'incluso capturas o fotos torcidas. Interpretá el significado, no la palabra exacta.\n' +
    'Devolvé SOLO lo que puedas leer con seguridad:\n' +
    '- tipo_comprobante: tipo del comprobante (ej: "Factura A", "Factura B", "Factura C", "Ticket", "Recibo", "Nota de crédito"). Si no se distingue, "Ticket".\n' +
    '- fecha: fecha del comprobante en formato DD/MM/AAAA.\n' +
    '- proveedor: nombre del comercio o empresa que emite.\n' +
    '- importe_total: el monto TOTAL final a pagar, como número. IMPORTANTE: los comprobantes usan formato ARGENTINO, donde el punto (.) separa MILES y la coma (,) separa decimales. Ejemplos: "$128.400" = 128400 ; "$1.234,56" = 1234.56 ; "$500" = 500. Devolvé el número COMPLETO, sin separador de miles, usando punto solo si hay decimales.\n' +
    '- moneda: código (ARS, USD, EUR, etc.).\n' +
    'Si algún dato no aparece, devolvé cadena vacía (0 para el importe).';

  const payload = {
    contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: mimeType || 'image/jpeg', data: base64 } }] }],
    generationConfig: {
      temperature: 0, responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: {
          tipo_comprobante: { type: 'STRING' },
          fecha:            { type: 'STRING' },
          proveedor:        { type: 'STRING' },
          importe_total:    { type: 'NUMBER' },
          moneda:           { type: 'STRING' }
        }
      }
    }
  };
  const opciones = { method: 'post', contentType: 'application/json', payload: JSON.stringify(payload), muteHttpExceptions: true };
  const key = getGeminiApiKey_();
  const base = 'https://generativelanguage.googleapis.com/v1beta/models/';
  const modelos = [CONFIG.GEMINI_MODEL, CONFIG.GEMINI_MODEL_FALLBACK];
  let ultimo = 'Gemini no respondió';

  for (var mi = 0; mi < modelos.length; mi++) {
    const url = base + modelos[mi] + ':generateContent?key=' + key;
    for (var intento = 0; intento < 3; intento++) {
      const r = UrlFetchApp.fetch(url, opciones);
      const c = r.getResponseCode();
      if (c === 200) {
        const j = JSON.parse(r.getContentText());
        const d = JSON.parse(j.candidates[0].content.parts[0].text);
        return { ok: true, tipoComprobante: d.tipo_comprobante || '', fecha: d.fecha || '',
                 proveedor: d.proveedor || '', importe: d.importe_total || '', moneda: (d.moneda || '').toUpperCase() };
      }
      ultimo = 'Gemini (' + modelos[mi] + ') respondió ' + c;
      if (c === 503 || c === 429 || c === 500) { Utilities.sleep(1200 * (intento + 1)); continue; }
      break;
    }
  }
  return { ok: false, error: ultimo + '. Probá de nuevo o cargá los datos a mano.' };
}


// ─────────────────────────────────────────────────────────────────────────
//  4) Guardar el gasto
//     payload = { tipo, titular, iniciales, cco, cuenta, descripcion, quienGasto,
//                 comentario, tipoComprobante, fecha, proveedor, importe, moneda,
//                 imagenBase64, mimeType }
// ─────────────────────────────────────────────────────────────────────────
function procesarTicket(p) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const esTarjeta = (p.tipo === 'tarjeta');
    const root = DriveApp.getFolderById(CONFIG.ROOT_FOLDER_ID);
    let carpetaDestino, ssName, solapa;

    if (esTarjeta) {
      const ini = limpiarNombre_(p.iniciales || '');
      if (!ini) return { ok: false, error: 'Elegí un titular de tarjeta.' };
      carpetaDestino = getOrCreateSubcarpeta_(getOrCreateSubcarpeta_(root, CONFIG.SUB_TARJETA), ini);
      ssName = 'Rendicion ' + ini;
      solapa = solapaParaFecha_(p.fecha);
    } else {
      const cco = String(p.cco || '').trim();
      if (!cco) return { ok: false, error: 'Elegí el evento (CCO).' };
      carpetaDestino = getOrCreateSubcarpeta_(getOrCreateSubcarpeta_(root, CONFIG.SUB_CAJA), limpiarNombre_(cco));
      ssName = 'Rendicion ' + limpiarNombre_(cco);
      solapa = CONFIG.SOLAPA_CAJA;
    }

    const headers = esTarjeta ? ENC_TARJETA : ENC_CAJA;
    const ss = getSpreadsheetIn_(carpetaDestino, ssName);
    const hoja = getOrCreateHoja_(ss, solapa, esTarjeta ? (p.titular || '') : (p.cco || ''), esTarjeta ? solapa : '', headers);
    const carpetaImg = getOrCreateSubcarpeta_(carpetaDestino, CONFIG.CARPETA_IMAGENES);

    const orden = siguienteNumeroDeOrden_(hoja);
    const ordenTxt = String(orden).padStart(4, '0');

    let estado = 'OK';
    if (solapa === 'Sin vencimiento') estado = agregarAviso_(estado, 'fecha fuera de los vencimientos');
    if (!p.importe) estado = agregarAviso_(estado, 'sin importe');

    // Guardar imagen o, si es carga manual, un texto con los datos.
    let link = '';
    const nombreBase = ordenTxt + (p.proveedor ? ' - ' + limpiarNombre_(p.proveedor) : ' - gasto');
    try {
      if (p.imagenBase64) {
        link = guardarImagen_(carpetaImg, p.imagenBase64, p.mimeType, nombreBase);
      } else {
        link = guardarTextoManual_(carpetaImg, nombreBase, p);
        estado = agregarAviso_(estado, 'sin comprobante (carga manual)');
      }
    } catch (e) {
      estado = agregarAviso_(estado, 'no se guardó el archivo: ' + e.message);
    }

    const monedaTxt = (p.moneda || CONFIG.MONEDA_ESPERADA).toUpperCase();
    const comun = [orden, p.fecha || '', p.tipoComprobante || '', p.proveedor || '', parseImporte_(p.importe), monedaTxt];
    const valores = esTarjeta
      ? comun.concat([p.titular || '', p.cco || '', p.cuenta || '', p.quienGasto || '', p.comentario || '', link, new Date(), estado])
      : comun.concat([p.cco || '', p.cuenta || '', p.descripcion || '', p.quienGasto || '', p.comentario || '', link, new Date(), estado]);
    agregarFila_(hoja, valores, monedaTxt);

    return {
      ok: true, orden: ordenTxt, tipo: p.tipo, titular: p.titular || '', cco: p.cco || '',
      solapa: solapa, proveedor: p.proveedor || '', importe: p.importe || '', moneda: monedaTxt,
      estado: estado, carpetaUrl: carpetaDestino.getUrl(), hojaUrl: ss.getUrl(),
      carpetaRuta: rutaCarpeta_(carpetaDestino)
    };
  } catch (e) {
    return { ok: false, error: e.message };
  } finally {
    lock.releaseLock();
  }
}


// ─────────────────────────────────────────────────────────────────────────
//  Helpers de Drive / Sheets
// ─────────────────────────────────────────────────────────────────────────
function getOrCreateSubcarpeta_(padre, nombre) {
  const it = padre.getFoldersByName(nombre);
  return it.hasNext() ? it.next() : padre.createFolder(nombre);
}

function getSpreadsheetIn_(folder, nombre) {
  const it = folder.getFilesByName(nombre);
  if (it.hasNext()) return SpreadsheetApp.open(it.next());
  const ss = SpreadsheetApp.create(nombre);
  DriveApp.getFileById(ss.getId()).moveTo(folder);
  return ss;
}

function getOrCreateHoja_(ss, solapa, nombreCtx, fechaCtx, headers) {
  let hoja = ss.getSheetByName(solapa);
  if (hoja) return hoja; // ya existe y está formateada
  const primera = ss.getSheets()[0];
  if (primera && primera.getLastRow() === 0 && ['Hoja 1', 'Hoja1', 'Sheet1'].indexOf(primera.getName()) > -1) {
    primera.setName(solapa); hoja = primera;
  } else {
    hoja = ss.insertSheet(solapa);
  }
  construirFormato_(hoja, nombreCtx, fechaCtx, headers);
  return hoja;
}

// Arma el formato estilo "Planilla de Rendición" (bloque de marca, título, encabezados, TOTAL).
function construirFormato_(hoja, nombreCtx, fechaCtx, headers) {
  const n = headers.length;
  hoja.getRange('A1:C1').merge().setValue('VENUE BRAND EXPERIENCE').setFontWeight('bold');
  hoja.getRange('A2:C2').merge().setValue('Nombre: ' + (nombreCtx || ''));
  hoja.getRange('A3:C3').merge().setValue('Fecha: ' + (fechaCtx || ''));
  hoja.getRange('A1:C3').setBackground(CLR_NAVY).setFontColor('#FFFFFF');

  hoja.getRange(5, 1, 1, n).merge().setValue('PLANILLA DE RENDICION')
    .setBackground(CLR_ORANGE).setFontColor('#FFFFFF').setFontWeight('bold').setHorizontalAlignment('center');

  hoja.getRange(HEADER_ROW, 1, 1, n).setValues([headers])
    .setBackground(CLR_NAVY).setFontColor('#FFFFFF').setFontWeight('bold').setHorizontalAlignment('center');

  hoja.setFrozenRows(HEADER_ROW);
  // Anchos fijos + texto que se ajusta dentro de la celda (wrap)
  for (var i = 0; i < n; i++) hoja.setColumnWidth(i + 1, ANCHO_COL[headers[i]] || 120);
  hoja.getRange(HEADER_ROW, 1, hoja.getMaxRows() - HEADER_ROW + 1, n).setWrap(true);
}

// Inserta una fila de datos y arma UN TOTAL por cada moneda presente (desglose por moneda).
function agregarFila_(hoja, valores, monedaTxt) {
  const n = valores.length;
  const last = hoja.getLastRow();

  // 1) Borrar el bloque de TOTALES actual (filas con "TOTAL" en la col A, siempre al final).
  let dataLast = FIRST_DATA_ROW - 1; // por defecto: todavía no hay datos
  if (last >= FIRST_DATA_ROW) {
    const colA = hoja.getRange(FIRST_DATA_ROW, 1, last - FIRST_DATA_ROW + 1, 1).getValues();
    let firstTotal = 0;
    for (var i = 0; i < colA.length; i++) {
      if (String(colA[i][0]).indexOf('TOTAL') === 0) { firstTotal = FIRST_DATA_ROW + i; break; }
    }
    if (firstTotal) { hoja.deleteRows(firstTotal, last - firstTotal + 1); dataLast = firstTotal - 1; }
    else { dataLast = last; }
  }

  // 2) Escribir la nueva fila de datos justo debajo de los datos existentes.
  const fila = dataLast + 1;
  hoja.getRange(fila, 1, 1, n).setValues([valores]);
  hoja.getRange(fila, 1, 1, n)
    .setBackground(CLR_GRIS).setFontColor(CLR_TEXTO)
    .setHorizontalAlignment('center').setVerticalAlignment('middle').setWrap(true)
    .setBorder(true, true, true, true, true, true, '#CBD2D9', SpreadsheetApp.BorderStyle.SOLID);
  hoja.getRange(fila, COL_IMPORTE).setNumberFormat('"' + monedaTxt + ' "#,##0.00');

  // 3) Monedas presentes en los datos (ARS primero, después alfabético).
  const dataFirst = FIRST_DATA_ROW, dataUlt = fila;
  const monVals = hoja.getRange(dataFirst, COL_MONEDA, dataUlt - dataFirst + 1, 1).getValues();
  const monedas = [];
  monVals.forEach(function (r) { const m = String(r[0]).trim(); if (m && monedas.indexOf(m) === -1) monedas.push(m); });
  monedas.sort(function (a, b) {
    if (a === CONFIG.MONEDA_ESPERADA) return -1;
    if (b === CONFIG.MONEDA_ESPERADA) return 1;
    return a < b ? -1 : (a > b ? 1 : 0);
  });

  // 4) Un TOTAL por moneda (SUMIF sobre la columna de moneda).
  const impCol = columnaLetra_(COL_IMPORTE), monCol = columnaLetra_(COL_MONEDA);
  const rangoMon = monCol + dataFirst + ':' + monCol + dataUlt;
  const rangoImp = impCol + dataFirst + ':' + impCol + dataUlt;
  monedas.forEach(function (m, idx) {
    const r = dataUlt + 1 + idx;
    hoja.getRange(r, 1, 1, n).setBackground(CLR_NAVY).setFontColor('#FFFFFF').setFontWeight('bold').setVerticalAlignment('middle');
    hoja.getRange(r, 1).setValue('TOTAL ' + m);
    hoja.getRange(r, COL_IMPORTE)
      .setFormula('=SUMIF(' + rangoMon + ',"' + m + '",' + rangoImp + ')')
      .setNumberFormat('"' + m + ' "#,##0.00');
  });
  return fila;
}

function columnaLetra_(num) {
  let s = '';
  while (num > 0) { const m = (num - 1) % 26; s = String.fromCharCode(65 + m) + s; num = Math.floor((num - 1) / 26); }
  return s;
}

function siguienteNumeroDeOrden_(hoja) {
  const last = hoja.getLastRow();
  if (last < FIRST_DATA_ROW) return 1; // aún no hay datos
  const vals = hoja.getRange(FIRST_DATA_ROW, 1, last - FIRST_DATA_ROW + 1, 1).getValues();
  let max = 0;
  vals.forEach(function (f) {
    if (String(f[0]).indexOf('TOTAL') === 0) return; // saltear filas de TOTAL por moneda
    const nn = parseInt(f[0], 10);
    if (!isNaN(nn) && nn > max) max = nn;
  });
  return max + 1;
}

function guardarImagen_(carpeta, base64, mimeType, nombre) {
  const ext = (mimeType && mimeType.indexOf('png') > -1) ? '.png' : '.jpg';
  const blob = Utilities.newBlob(Utilities.base64Decode(base64), mimeType || 'image/jpeg', nombre + ext);
  return carpeta.createFile(blob).getUrl();
}

function guardarTextoManual_(carpeta, nombre, p) {
  const txt =
    'CARGA MANUAL (sin comprobante)\n' +
    'Tipo: ' + (p.tipoComprobante || '-') + '\n' +
    'Fecha: ' + (p.fecha || '-') + '\n' +
    'Proveedor: ' + (p.proveedor || '-') + '\n' +
    'Importe: ' + (p.importe || '-') + ' ' + (p.moneda || '') + '\n' +
    'Quién hizo el gasto: ' + (p.quienGasto || '-') + '\n' +
    'Comentario: ' + (p.comentario || '-') + '\n';
  return carpeta.createFile(nombre + ' (manual).txt', txt, 'text/plain').getUrl();
}


// ─────────────────────────────────────────────────────────────────────────
//  Helpers varios
// ─────────────────────────────────────────────────────────────────────────
function parseFecha_(s) {
  const m = String(s).match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) return null;
  return new Date(parseInt(m[3], 10), parseInt(m[2], 10) - 1, parseInt(m[1], 10));
}
function diaFin_(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59); }

// Convierte "10.000,00" / "10000.00" / 10000 a número.
// Formato ARGENTINO: el punto (.) es separador de miles y la coma (,) el decimal.
// Ej: "128.400" -> 128400 ; "1.234,56" -> 1234.56 ; "128400" -> 128400.
function parseImporte_(v) {
  if (typeof v === 'number') return v;
  let s = String(v == null ? '' : v).replace(/[^\d.,-]/g, '');
  if (s === '') return '';
  s = s.replace(/\./g, '').replace(',', '.');
  const n = parseFloat(s);
  return isNaN(n) ? '' : n;
}

function agregarAviso_(estado, aviso) { return estado === 'OK' ? ('Revisar: ' + aviso) : (estado + '; ' + aviso); }

function rutaCarpeta_(folder) {
  const partes = [folder.getName()];
  let padres = folder.getParents();
  while (padres.hasNext()) { const p = padres.next(); partes.unshift(p.getName()); padres = p.getParents(); }
  return partes.join(' ▸ ');
}

function limpiarNombre_(t) {
  return String(t).replace(/[\\/:*?"<>|]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
}
