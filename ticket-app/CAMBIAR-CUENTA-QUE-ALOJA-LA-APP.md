# 🔁 Cómo cambiar la cuenta (mail) que aloja la app

Guía para mover la app a otra cuenta de Google (la que la "corre" y es dueña de
los datos), manteniendo todo lo demás igual.

## Qué se mantiene y qué cambia

**Se mantiene:**
- El código, las funciones y la estética (es el mismo `Codigo.gs` + `Index.html`).
- Los datos y planillas ya cargados (quedan donde están).

**Cambia:**
- El **link `/exec`** de la app → hay que **reinstalar el ícono/link** en los celulares.

---

## Pasos para migrar a la cuenta nueva

1. **Con la cuenta nueva**, entrá a [script.google.com](https://script.google.com) → **Proyecto nuevo**.
2. Pegá los 3 archivos del repo:
   - `Codigo.gs` (borrá lo que traiga y pegá todo)
   - `Index.html` (nuevo archivo HTML llamado exactamente `Index`)
   - `appsscript.json` (en Configuración del proyecto → mostrar "appsscript.json en el editor")
3. **Cargar la clave de Gemini**: engranaje ⚙️ Configuración del proyecto → Propiedades del script →
   agregar `GEMINI_API_KEY` con la clave. (Puede ser la misma clave o una nueva de esa cuenta.)
4. **Dar acceso a la cuenta nueva** a:
   - La **planilla de info** (CCOs / CUENTAS / AMEX / VTOs) → acceso de **lectura**.
   - La **carpeta destino** (`ROOT_FOLDER_ID`) → **Editor** (o miembro, si es Unidad compartida).
5. **Publicar**: Implementar → Nueva implementación → Aplicación web:
   - **Ejecutar como:** Yo (la cuenta nueva)
   - **Quién tiene acceso:** Cualquier usuario con una cuenta de Google
   - Implementar.
6. **Autorizar** la primera vez (pantalla "Google no verificó…" → Configuración avanzada → Ir a la app → Permitir).
7. Copiar el **link `/exec` nuevo** y **reinstalar el ícono** en los celulares.

---

## 💡 Consejo para que el cambio sea indoloro

Poné (o mantené) la carpeta de Rendiciones dentro de una **Unidad compartida (Shared Drive)**:
- Los archivos pertenecen a la **unidad**, no a una persona.
- El día que cambie el mail que aloja la app, **no hay que migrar ni mover datos**:
  solo agregás la cuenta nueva como **miembro** de la unidad.

---

## Cómo confirmar que quedó bien

1. Abrí el link nuevo en la compu (incógnito) y en el celu → debe abrir.
2. Cargá un gasto de prueba y verificá que la carpeta/planilla se cree en la carpeta destino.
3. Borrá la prueba y listo.

> Recordá: cambiar la cuenta que aloja la app **no** cambia el código; solo el link
> y quién es el dueño. Si algo falla, casi siempre es un **permiso** (acceso a la
> planilla de info o a la carpeta) o que faltó cargar la **clave de Gemini**.
