# 🌳 Arquitectura de la App de Rendiciones — paso a paso

Documento de referencia: qué herramientas usa la app y qué pasa desde que se
abre la URL hasta que se arma la planilla.

## 🧰 Herramientas en juego
- **Navegador** → la interfaz (HTML/JS) en el celular (`Index.html`)
- **Apps Script** → el "motor" que corre el código (`doGet`, `google.script.run`)
- **Google Sheets** (`SpreadsheetApp`) → lee la info y escribe las planillas
- **Google Drive** (`DriveApp`) → crea carpetas y guarda archivos
- **Gemini API** (`UrlFetchApp`) → lee el comprobante (modelo `gemini-2.5-flash`, con `gemini-2.0-flash` de respaldo)
- **PropertiesService** → guarda la clave de Gemini (`GEMINI_API_KEY`)
- **LockService** → evita choques si dos personas cargan a la vez

---

## Paso a paso

### 1) Se abre la URL `/exec`
- Apps Script corre **`doGet()`** → `HtmlService` sirve **`Index.html`**.
- *Herramienta: Apps Script*

### 2) Carga inicial (Splash → Home)
- El navegador llama **`getOpciones()`** (`google.script.run`).
- `getOpciones()` lee la planilla de info (`INFO_SHEET_ID`):
  - **`leerCCOs_()`** → pestaña **CCOs**
  - **`leerCuentas_()`** → pestaña **CUENTAS**
  - **`leerTitulares_()`** → pestaña **AMEX**
- **`iniciar()`** llena los desplegables → **`go('home')`**.
- *Herramientas: Apps Script + Google Sheets*

### 3) Se elige el flujo y se completa el formulario
- Botón **Tarjeta** o **Caja Chica** → `go('form-t' / 'form-c')`.
- Se completa titular, CCO (`renderCco`/`elegirCco`), cuenta, quién, etc.
- *Herramienta: solo navegador (aún no toca el servidor)*

### 4) Se sube el comprobante → lo lee la IA
- 📷/📎 → **`onFile()`** (si es imagen, la achica con canvas) → **`enviarAGemini()`**.
- **`leerComprobante(base64, mime)`**:
  - **`getGeminiApiKey_()`** saca la clave de **PropertiesService**
  - **`UrlFetchApp.fetch()`** → **Gemini API** con el archivo + la instrucción
  - Devuelve `{ tipo, fecha, proveedor, importe, moneda }`
- **`llegoGemini()`** rellena los campos (editables).
- *Herramientas: Navegador + Apps Script + Gemini API + PropertiesService*
- **Nota de privacidad:** a Gemini solo se le manda **el comprobante + la instrucción**.
  El resto (titular, CCO, cuenta, quién, comentario) NO va a Gemini.

### 5) Se toca "Guardar" → se arma la planilla
- **`guardar()`** valida y arma el paquete → **`procesarTicket(payload)`**.
- **`procesarTicket()`**, en orden:
  1. **`LockService`** → traba anti-choques
  2. **`DriveApp.getFolderById(ROOT_FOLDER_ID)`** → carpeta destino
  3. Carpeta + solapa:
     - Tarjeta → **`getOrCreateSubcarpeta_()`** (`Tarjeta/<iniciales>`) + **`solapaParaFecha_()`**
       (usa **`leerVtos_()`** → pestaña **VTOs**) para la solapa (o el mes del gasto)
     - Caja → `getOrCreateSubcarpeta_()` (`Caja Chica/<CCO>`) + solapa "Gastos"
  4. **`getSpreadsheetIn_()`** → busca o **crea la planilla** (`SpreadsheetApp.create` + `DriveApp.moveTo`)
  5. **`getOrCreateHoja_()`** → busca/crea la solapa; si es nueva, **`construirFormato_()`** arma el formato
  6. **`getOrCreateSubcarpeta_()`** → carpeta **`Imágenes`** (y en Tarjeta, subcarpeta del mes)
  7. **`siguienteNumeroDeOrden_()`** → próximo N° de orden
  8. **`guardarImagen_()`** → `DriveApp.createFile` guarda foto/PDF (o `guardarTextoManual_()`)
  9. **`agregarFila_()`** → escribe la fila y **recalcula los TOTALES por moneda**
  10. Si la fecha cae fuera del vencimiento → pinta ESTADO en rojo suave
- *Herramientas: Apps Script + Google Drive + Google Sheets*

### 6) Cierre
- El navegador recibe la respuesta → **`guardado()`** → toast "✅" o pantalla **Gracias**.
- *Herramienta: navegador*

---

## 🔁 Resumen visual

```
Celular (URL /exec)
   │
   ▼
doGet ─────────────► sirve Index.html            [Apps Script]
   │
   ▼
getOpciones ───────► lee CCOs/Cuentas/AMEX        [Sheets]
   │
   ▼ (completás el form)
   ▼
leerComprobante ───► Gemini lee la foto/PDF       [Gemini API]
   │
   ▼ (revisás los datos)
   ▼
procesarTicket ────► carpeta + planilla + fila    [Drive + Sheets]
   │                 (formato, totales, imagen)
   ▼
Gracias ✅
```

Todo vive en **Apps Script**, que orquesta **Sheets + Drive + Gemini**.
El código está en `ticket-app/Codigo.gs` (backend) e `ticket-app/Index.html` (interfaz).
