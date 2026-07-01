# 📸 App Cargador de Tickets — Instructivo paso a paso

Hola Rodrigo. Esta es tu app para cargar tickets/comprobantes desde el celular.
Vos sacás una foto, **Gemini lee los datos** (fecha, proveedor, importe) y todo
se guarda solo en **tu Google Sheet** y **tu carpeta de Drive**.

No necesitás saber programar. Es **copiar, pegar y hacer clics**. Seguí los pasos
en orden. Calculá unos **20–30 minutos** la primera vez.

> **¿Qué hace la app?**
> 1. Elegís un **CCO** (lista que sale de tu planilla).
> 2. Elegís un **Tipo de cuenta**.
> 3. Escribís una **descripción** corta.
> 4. Sacás la **foto** del comprobante.
> 5. Se agrega **1 fila** al Sheet con N° de orden, y la **foto se guarda** en Drive.

---

## Antes de empezar

Necesitás tu cuenta de Google (la de `@gmail.com` o la de tu trabajo). Nada más.
Todo lo demás es gratis para empezar.

---

## Paso 1 · Crear la planilla (Google Sheet)

1. Entrá a **[sheets.google.com](https://sheets.google.com)** y creá una planilla en blanco.
2. Ponele un nombre, por ejemplo **"Tickets"**.
3. Abajo a la izquierda vas a ver la pestaña "Hoja 1". Vamos a crear **2 pestañas**:
   - Renombrá "Hoja 1" a **`Tickets`** (doble clic sobre el nombre).
   - Hacé clic en el **+** (abajo a la izquierda) para crear otra pestaña y llamala **`CCO`**.
4. En la pestaña **`CCO`**, pegá tu lista de CCO en la **columna A** (uno por fila).
   - *La pestaña `Tickets` la dejás vacía: la app le pone los títulos sola la primera vez.*

> 💡 **¿Tu lista de CCO ya está en OTRA planilla?** En la celda `A1` de la pestaña
> `CCO` podés poner esta fórmula para traerla automáticamente (cambiá el link y el rango):
> ```
> =IMPORTRANGE("PEGA_AQUI_EL_LINK_DE_TU_OTRA_PLANILLA"; "Hoja1!A2:A")
> ```
> La primera vez te va a pedir "Permitir acceso": hacé clic ahí.

5. **Copiá el ID de la planilla.** Mirá la dirección (URL) arriba en el navegador:
   ```
   https://docs.google.com/spreadsheets/d/ESTO_DE_ACA_ES_EL_ID/edit
   ```
   Guardá ese código (el `ESTO_DE_ACA_ES_EL_ID`) en un bloc de notas. Lo vas a usar.

---

## Paso 2 · Crear la carpeta en Drive

1. Entrá a **[drive.google.com](https://drive.google.com)**.
2. Botón **Nuevo → Carpeta nueva**. Llamala, por ejemplo, **"Tickets - imágenes"**.
3. Entrá a esa carpeta y **copiá su ID** desde la URL:
   ```
   https://drive.google.com/drive/folders/ESTO_DE_ACA_ES_EL_ID
   ```
   Guardalo también en tu bloc de notas.

---

## Paso 3 · Conseguir la clave de Gemini (gratis)

1. Entrá a **[aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)**.
2. Hacé clic en **"Create API key"** (Crear clave de API).
3. Se genera un texto largo (empieza con `AIza...`). **Copialo** y guardalo en tu bloc.
   - ⚠️ **Es como una contraseña. No la compartas ni la subas a internet.**

---

## Paso 4 · Crear el proyecto de Apps Script

1. Entrá a **[script.google.com](https://script.google.com)** → **Proyecto nuevo**.
2. Arriba, donde dice "Proyecto sin título", ponele un nombre: **"App Tickets"**.
3. Vas a ver un archivo llamado `Código.gs` con algo escrito. **Borrá todo** lo que
   tenga adentro.
4. Abrí el archivo **`Codigo.gs`** de esta carpeta (`ticket-app/Codigo.gs`),
   **copiá TODO** y **pegalo** en el editor.
5. Ahora creamos la pantalla: al lado de "Archivos" hacé clic en el **+ → HTML**.
   - Ponele de nombre exactamente **`Index`** (sin `.html`).
   - Borrá lo que traiga, abrí **`Index.html`** de esta carpeta, copiá TODO y pegalo ahí.
6. Guardá con el ícono del **disquete** 💾 (o `Ctrl+S`).

---

## Paso 5 · Poner tus datos en el código

En el archivo `Codigo.gs` (dentro del editor), arriba de todo está el bloque
**`CONFIG`**. Reemplazá los textos entre comillas por lo tuyo:

```js
SHEET_ID:        'aquí_el_ID_de_la_planilla_del_Paso_1',
DRIVE_FOLDER_ID: 'aquí_el_ID_de_la_carpeta_del_Paso_2',
TIPOS_CUENTA:    ['Caja Chica'],   // poné el/los que uses
```

Los nombres `TAB_TICKETS: 'Tickets'` y `TAB_CCO: 'CCO'` dejalos igual (coinciden
con las pestañas del Paso 1). Guardá 💾.

---

## Paso 6 · Cargar la clave de Gemini (de forma segura)

La clave **no va en el código** (para que no se filtre). Se guarda aparte:

1. En el editor de Apps Script, a la izquierda, clic en el engranaje
   **⚙️ Configuración del proyecto**.
2. Bajá hasta **"Propiedades de la secuencia de comandos"** (Script properties).
3. Clic en **"Agregar propiedad de secuencia de comandos"**.
   - **Propiedad:** `GEMINI_API_KEY`
   - **Valor:** pegá la clave del Paso 3 (la que empieza con `AIza...`)
4. **Guardar propiedades de la secuencia de comandos**.

---

## Paso 7 · Publicar la app (Deploy)

1. Arriba a la derecha: **Implementar → Nueva implementación**.
2. En el engranaje ⚙️ (al lado de "Tipo") elegí **"Aplicación web"**.
3. Configurá:
   - **Descripción:** `Tickets v1`
   - **Ejecutar como:** **Yo (tu mail)**
   - **Quién tiene acceso:** **Solo yo**
4. Clic en **Implementar**.
5. La primera vez te va a pedir **autorizar permisos**:
   - "Revisar permisos" → elegí tu cuenta.
   - Si aparece "Google no verificó esta app": **Configuración avanzada →
     Ir a App Tickets (no seguro)**. Es tu propia app, es normal.
   - **Permitir**.
6. Al final te da un **link** ("URL de la aplicación web"). **Copialo.**
   👉 **Ese link ES tu app.**

---

## Paso 8 · Instalar la app en el celular

1. Abrí ese link en el navegador del celular (**Chrome** en Android, **Safari** en iPhone).
2. Para que quede como un **ícono** (como una app):
   - **Android/Chrome:** menú ⋮ → **"Agregar a la pantalla principal"**.
   - **iPhone/Safari:** botón compartir → **"Agregar a inicio"**.
3. ¡Listo! Ya la tenés en la pantalla del celu. Funciona por **WiFi, 4G o 5G** igual.

---

## ✅ Probala

1. Abrí la app, elegí un **CCO** y un **Tipo de cuenta**.
2. Escribí una descripción, sacá una **foto** de un ticket y tocá **Guardar ticket**.
3. En unos segundos aparece la tarjeta verde con los datos que leyó Gemini.
4. Andá a tu planilla: vas a ver la **fila nueva**. Y en la carpeta de Drive, la **foto**.

---

## Cuando quieras cambiar algo (importante)

Si editás el `Codigo.gs` o el `Index.html`, para que el cambio se vea en el celular
tenés que **volver a publicar**:

> **Implementar → Administrar implementaciones → ✏️ (editar) →
> Versión: "Nueva versión" → Implementar.**

El **link no cambia**, así que el ícono del celular sigue funcionando.

---

## Columnas que genera la app (pestaña `Tickets`)

| N° Orden | Fecha de carga | Usuario | CCO | Tipo de cuenta | Descripción | Fecha comprobante | Proveedor / Empresa | Importe total | Moneda | Imagen | Estado |
|---|---|---|---|---|---|---|---|---|---|---|---|

Las columnas **Fecha comprobante, Proveedor, Importe y Moneda** las completa Gemini
mirando la foto. Si algún ticket sale con datos raros, la columna **Estado** te avisa
para revisarlo a mano.

---

## Si algo falla

- **"Falta la clave de Gemini"** → revisá el Paso 6 (el nombre debe ser exacto: `GEMINI_API_KEY`).
- **El desplegable de CCO sale vacío** → revisá que la pestaña se llame `CCO` y que tu
  lista esté en la **columna A**.
- **"Gemini respondió 4xx"** → puede ser la clave mal pegada, o que el modelo cambió de
  nombre; avisame y lo ajustamos.
- **Cualquier otra cosa:** copiame el mensaje de error y lo resolvemos juntos.

---

### ¿Qué sigue? (para más adelante)
- Mejorar la parte estética.
- Que varias personas puedan usarla.
- Un botón para ver los últimos tickets cargados.
- Exportar un resumen mensual por CCO.

Cuando quieras, seguimos por ahí. 🚀
