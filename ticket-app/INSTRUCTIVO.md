# 📸 App Carga de Tickets / Rendición — Instructivo paso a paso

Hola Rodrigo. Esta es tu app para cargar tickets/comprobantes desde el celular.
Vos elegís el **Evento (CCO)** y la **Cuenta**, escribís una **descripción**, sacás
una **foto**, y **Gemini lee** la fecha, el proveedor y el importe. Todo se guarda
solo en tu **Planilla de Rendición** y la foto en tu **carpeta de Drive**.

No necesitás saber programar. Es **copiar, pegar y hacer clics**. Calculá unos
**20–30 minutos** la primera vez.

### Cada fila queda con el formato de tu rendición:

| ORDEN | FECHA | EVENTO (CCO) | CUENTA | DESCRIPCION DEL GASTO | PROVEED | IMPORTE EN $ |
|---|---|---|---|---|---|---|
| _auto_ | 📷 Gemini | 🔽 vos elegís | 🔽 vos elegís | ✍️ vos escribís | 📷 Gemini | 📷 Gemini |

> La app agrega columnas de apoyo a la derecha (**Moneda, Imagen, Cargado, Estado**)
> para que puedas encontrar la foto y detectar tickets que convenga revisar. Las
> podés ocultar; no molestan al TOTAL.

---

## Antes de empezar
Solo necesitás tu cuenta de Google. Todo lo demás es gratis para empezar.

---

## Paso 1 · Tener a mano tus 2 archivos

Esta app usa **dos** planillas (pueden ser las que ya tenés):

- **(A) La Planilla de Rendición** → donde se escriben los tickets.
- **(B) El archivo de Centros de Costos** → de donde sale el desplegable de **Evento (CCO)**.

Para cada una, copiá su **ID** desde la URL del navegador:
```
https://docs.google.com/spreadsheets/d/ESTO_DE_ACA_ES_EL_ID/edit
```
Guardá los dos ID en un bloc de notas (los vas a pegar en el Paso 5).

> 💡 No hace falta preparar columnas en la Rendición: la app crea una pestaña
> **`Rendicion`** con los títulos la primera vez que cargás un ticket.

**Del archivo de Centros de Costos, fijate el nombre EXACTO de la pestaña** donde
está la lista (la columna con los nombres tipo `2026 01 FIJOS OFICINA`). Anotalo
(por ejemplo `CCOs` o `CENTROS DE COSTOS`). Lo vas a necesitar.

---

## Paso 2 · Crear la carpeta en Drive (para las fotos)

1. Entrá a **[drive.google.com](https://drive.google.com)** → **Nuevo → Carpeta nueva**.
   Llamala, por ejemplo, **"Tickets - imágenes"**.
2. Entrá a la carpeta y copiá su **ID** desde la URL:
   ```
   https://drive.google.com/drive/folders/ESTO_DE_ACA_ES_EL_ID
   ```

---

## Paso 3 · Conseguir la clave de Gemini (gratis)

1. Entrá a **[aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)**.
2. **"Create API key"** (Crear clave de API).
3. Copiá el texto largo que empieza con `AIza...`.
   - ⚠️ **Es como una contraseña. No la compartas ni la subas a internet.**

---

## Paso 4 · Crear el proyecto de Apps Script

1. Entrá a **[script.google.com](https://script.google.com)** → **Proyecto nuevo**.
2. Ponele nombre: **"App Tickets"**.
3. En el archivo `Código.gs`, **borrá todo** lo que tenga.
4. Abrí **`ticket-app/Codigo.gs`** de este repo, **copiá TODO** y **pegalo**.
5. Al lado de "Archivos", **+ → HTML**. Nombralo exactamente **`Index`** (sin `.html`).
   Borrá lo que traiga, copiá TODO de **`ticket-app/Index.html`** y pegalo ahí.
6. Guardá con el disquete 💾 (o `Ctrl+S`).

---

## Paso 5 · Poner tus datos en el código

En `Codigo.gs`, arriba está el bloque **`CONFIG`**. Completá:

```js
// (A) Planilla de Rendición (donde se escriben los tickets)
SHEET_ID: 'aquí_el_ID_de_la_rendición',
TAB_RENDICION: 'Rendicion',            // dejá así (o poné el nombre de pestaña que prefieras)

// (B) Archivo de Centros de Costos (de donde sale el desplegable Evento CCO)
CCO_SOURCE_SHEET_ID: 'aquí_el_ID_del_archivo_de_CCO',
CCO_SOURCE_TAB: 'CCOs',                // ⚠️ el nombre EXACTO de la pestaña (Paso 1)
CCO_ANIOS: ['2025', '2026'],           // qué años mostrar en el desplegable

// (C) Carpeta de Drive para las fotos
DRIVE_FOLDER_ID: 'aquí_el_ID_de_la_carpeta',
```

La lista **`CUENTAS`** ya viene cargada con tus 17 opciones (512, 514, … 805).
Si alguna cambia, la editás ahí. Guardá 💾.

---

## Paso 6 · Cargar la clave de Gemini (de forma segura)

1. En Apps Script, engranaje **⚙️ Configuración del proyecto**.
2. Bajá a **"Propiedades de la secuencia de comandos"** → **Agregar propiedad**.
   - **Propiedad:** `GEMINI_API_KEY`
   - **Valor:** pegá la clave del Paso 3 (`AIza...`)
3. **Guardar propiedades de la secuencia de comandos**.

---

## Paso 7 · Publicar la app (Deploy)

1. Arriba a la derecha: **Implementar → Nueva implementación**.
2. Engranaje ⚙️ → **"Aplicación web"**.
3. Configurá:
   - **Ejecutar como:** **Yo (tu mail)**
   - **Quién tiene acceso:** **Solo yo**
4. **Implementar**.
5. La primera vez pide **autorizar permisos**:
   - "Revisar permisos" → tu cuenta.
   - Si dice "Google no verificó esta app": **Configuración avanzada → Ir a App
     Tickets (no seguro)** → **Permitir**. (Es tu propia app, es normal.)
6. Copiá el **link** ("URL de la aplicación web"). 👉 **Ese link ES tu app.**

---

## Paso 8 · Instalar la app en el celular

1. Abrí el link en el navegador del celular (**Chrome** o **Safari**).
2. Para dejarlo como ícono:
   - **Android/Chrome:** menú ⋮ → **"Agregar a la pantalla principal"**.
   - **iPhone/Safari:** compartir → **"Agregar a inicio"**.
3. Listo. Funciona por **WiFi, 4G o 5G** igual.

---

## ✅ Probala

1. Abrí la app, elegí **Evento (CCO)** y **Cuenta**.
2. Escribí la descripción, sacá la **foto** y tocá **Guardar ticket**.
3. En unos segundos ves la tarjeta verde con lo que leyó Gemini.
4. En tu Rendición aparece la **fila nueva**; en Drive, la **foto** con su N° de orden.

---

## Cómo funciona el desplegable de Evento (CCO)

- La app lee **en vivo** la columna A de tu archivo de Centros de Costos.
- Muestra **solo** los que empiezan con **`2025` o `2026`** (los que pusiste en
  `CCO_ANIOS`). Ignora los títulos sueltos como `2025`, `ENE`, `FEB`, etc.
- Cuando actualices ese archivo, **cerrá y reabrí la app** y el desplegable ya
  aparece actualizado. (No hay que volver a publicar nada.)

> ¿Querés sumar otro año, por ejemplo 2027? Cambiá `CCO_ANIOS: ['2025','2026','2027']`
> y volvé a publicar (ver abajo).

---

## Cuando cambies el código (importante)

Si editás `Codigo.gs` o `Index.html`, para verlo en el celular hay que **volver a publicar**:

> **Implementar → Administrar implementaciones → ✏️ editar →
> Versión: "Nueva versión" → Implementar.**

El **link no cambia**, así que el ícono del celular sigue sirviendo.

> ⚠️ Solo cambiar el **contenido** de tu archivo de Centros de Costos (agregar/quitar
> CCOs) **no** requiere volver a publicar: la app lo lee en vivo.

---

## Si algo falla

- **"Falta la clave de Gemini"** → revisá el Paso 6 (nombre exacto: `GEMINI_API_KEY`).
- **El desplegable de Evento (CCO) sale vacío** → revisá que `CCO_SOURCE_TAB` tenga
  el **nombre exacto** de la pestaña, y que los nombres empiecen con `2025`/`2026`.
- **La CUENTA no es la que quiero** → editá la lista `CUENTAS` en el `CONFIG`.
- **"Gemini respondió 4xx"** → clave mal pegada o el modelo cambió de nombre; avisame.
- **Cualquier otra cosa:** copiame el mensaje de error y lo resolvemos juntos.

---

### ¿Qué sigue? (para más adelante)
- Que la Rendición se arme por mes automáticamente.
- Un botón para ver / corregir los últimos tickets cargados.
- Que varias personas puedan usarla.
- Mejorar la parte estética.

Cuando quieras, seguimos. 🚀
