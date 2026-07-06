# 📐 Cotas Venue — Instructivo paso a paso

Hola Rodrigo. Esta es tu app para **sacar fotos y marcarles cotas, medidas,
ángulos, flechas y notas**, organizadas **por proyecto**. Cada foto final
(con las cotas ya "quemadas") se guarda sola en tu **Drive de @venue**, en una
carpeta con el nombre del proyecto.

La app ya está lista para usar. Solo falta un paso de tu lado: crear el
"backend" en Apps Script para que las fotos lleguen a TU Drive. Es **copiar,
pegar y hacer clics** — calculá unos **15 minutos** la primera vez.

---

## Parte 1 · Abrir la app en el teléfono

1. Entrá desde el navegador del celu a:
   ```
   https://rooco83.github.io/Segunda-Pagina/medidas-app/
   ```
2. Para tenerla como una app de verdad (ícono + pantalla completa):
   - **Android / Chrome:** menú ⋮ → **"Agregar a pantalla principal"** → Instalar.
   - **iPhone / Safari:** botón compartir → **"Agregar a pantalla de inicio"**.

> 💡 Ya podés usarla así: crear proyectos, sacar fotos y ponerles cotas.
> Todo queda guardado en el teléfono. La Parte 2 agrega la subida a Drive.

---

## Parte 2 · El backend que guarda en tu Drive

### Paso 1 · (Opcional) Elegir la carpeta raíz en Drive

Si querés que las fotos vayan a una carpeta específica (por ejemplo dentro de
una Unidad compartida de Venue):

1. Entrá a esa carpeta en [drive.google.com](https://drive.google.com).
2. Copiá su **ID** desde la URL:
   ```
   https://drive.google.com/drive/folders/ESTO_DE_ACA_ES_EL_ID
   ```
3. Guardalo en un bloc de notas.

Si te salteás este paso, la app crea sola una carpeta matriz **"Cotas Venue"**
en *Mi unidad* y adentro va creando una subcarpeta por cada proyecto.

### Paso 2 · Crear el Apps Script

1. Con tu cuenta de **@venue**, entrá a **[script.google.com](https://script.google.com)**
   → **Nuevo proyecto**.
2. Arriba a la izquierda, donde dice *"Proyecto sin título"*, ponele nombre:
   **Cotas Venue**.
3. Borrá todo lo que hay en el editor y **pegá completo** el contenido del
   archivo **`Codigo.gs`** (está junto a este instructivo, en
   `medidas-app/Codigo.gs`).
4. Si hiciste el Paso 1: buscá arriba del todo la línea
   ```js
   ROOT_FOLDER_ID: '',
   ```
   y pegá tu ID entre las comillas.
5. **Guardá** (Ctrl+S o el disquito 💾).

### Paso 3 · Publicarlo como app web

1. Botón azul **Implementar** → **Nueva implementación**.
2. Engranaje ⚙️ → tipo **Aplicación web**.
3. Completá:
   - **Ejecutar como:** *Yo* (tu cuenta @venue).
   - **Quién tiene acceso:** *Cualquier persona con el vínculo*.
4. **Implementar** → Google te va a pedir **autorizar permisos**: aceptá
   (puede avisarte que "la app no está verificada": *Configuración avanzada →
   Ir a Cotas Venue*). Es tu propio script, no hay terceros.
5. Copiá la **URL de la aplicación web** (termina en **`/exec`**).

### Paso 4 · Conectar la app

1. En el teléfono, abrí **Cotas Venue** → engranaje ⚙️ (arriba a la derecha
   de la pantalla naranja).
2. Pegá la URL `/exec` en **"URL del backend"**.
3. Tocá **"Probar conexión"** → tiene que decir **"✓ Conectado con tu Drive"**.

¡Listo! A partir de acá, cada vez que guardes una foto anotada, sube sola a
`Cotas Venue / <nombre del proyecto> /` en tu Drive. Si estás sin señal queda
**pendiente** y se sube cuando vuelva la conexión (o desde el menú ⋮ del
proyecto → *"Subir pendientes a Drive"*).

---

## Cómo se usa (resumen)

| Qué querés hacer | Cómo |
|---|---|
| Crear proyecto | Pantalla naranja → **Nuevo proyecto** |
| Renombrar / eliminar proyecto | Mantené apretada su tarjeta (o menú ⋮ adentro) |
| Sacar foto | Dentro del proyecto → **Sacar foto** (zoom, linterna, exposición, grilla, nivel) |
| Importar de la galería | Dentro del proyecto → **Importar** |
| Agregar cota / flecha / ángulo / texto / marco | Tocá la herramienta abajo — aparece en el centro y la acomodás arrastrando los **puntitos naranjas** (con lupa de precisión) |
| Cambiar el valor de una cota | Tocá el numerito de la cota |
| Cambiar color / unidad / tamaño / grosor | Con la anotación seleccionada, usá la fila de arriba de las herramientas |
| Deshacer / rehacer / duplicar / borrar | Botones de arriba del editor |
| Guardar y subir a Drive | Botón naranja **Guardar** |
| Compartir por WhatsApp / mail | Botón compartir (arriba, en el editor) |

---

## Si algo no anda

- **"No se pudo conectar"** al probar: revisá que la URL termine en `/exec` y
  que en la implementación el acceso sea *"Cualquier persona con el vínculo"*.
- **Cambiaste el código del script:** hay que crear una **Nueva implementación**
  (o *Administrar implementaciones → editar → nueva versión*) para que se
  actualice la URL.
- **La cámara no abre controles pro:** depende del teléfono y navegador
  (en iPhone la cámara pro es más limitada). La app cae sola a la cámara
  nativa si hace falta; la foto sale igual.
- **Fotos "pendientes" que no suben:** entrá al proyecto → menú ⋮ →
  *"Subir pendientes a Drive"*.
