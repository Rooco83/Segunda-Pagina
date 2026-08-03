# 📐 Cotas Venue — Instructivo

App para **sacar fotos y marcarles cotas, medidas, ángulos y notas**, organizadas
**por proyecto**. Cada persona entra con **su** Google y las fotos finales se
guardan en **su propio Drive**, en la carpeta **`Cotas Venue/<Proyecto>/`**.
Privado por usuario: nadie ve las carpetas de los demás.

---

## Parte A · Configuración de Google (una sola vez, la hace el dueño)

Esto ya lo hicimos, pero queda documentado por si hay que rehacerlo. Es **gratis**
y **no pide tarjeta** (ignorá el cartel del crédito de $300).

1. **[console.cloud.google.com](https://console.cloud.google.com)** con la cuenta @venue →
   **Selecciona un proyecto → Proyecto nuevo** → nombre **`Cotas Venue`** → Crear.
2. **Habilitar la Drive API**: buscá *"Google Drive API"* → **Habilitar**.
3. **Pantalla de consentimiento OAuth** → tipo **Interno** (solo @venue, sin
   advertencias). Nombre `Cotas Venue`, mail de soporte.
4. **Credenciales → Crear → ID de cliente de OAuth → Aplicación web**:
   - *Orígenes de JavaScript autorizados*: **`https://cotas-venue.web.app`** y
     **`https://cotas-venue.firebaseapp.com`**
   - (no hace falta URI de redireccionamiento).
5. Copiás el **Client ID** (`…apps.googleusercontent.com`) y lo pegás en
   **`medidas-app/config.js`** (`googleClientId`). El **secreto del cliente NO se usa**.

> El Client ID no es secreto (identifica a la app). El "secreto del cliente" no
> se usa en esta app y no debe ponerse nunca en el código.

---

## Parte B · Publicar la app (Firebase Hosting, gratis, a nombre de la empresa)

La app vive en **`https://cotas-venue.web.app`**, alojada en el proyecto de Google
de la empresa (Firebase Hosting del proyecto `cotas-venue`). El paso a paso completo
para publicar/actualizar está en **`DEPLOY-GOOGLE.md`**. Resumen:

```bash
# en Google Cloud Shell (terminal del navegador, logueado con @venue)
git clone https://github.com/Rooco83/Segunda-Pagina.git
cd Segunda-Pagina
firebase deploy --only hosting --project cotas-venue
```

Para **actualizar** la app cuando haya cambios:
```bash
cd ~/Segunda-Pagina && git pull && firebase deploy --only hosting --project cotas-venue
```

---

## Parte C · Usarla en el teléfono

1. Abrí esa URL en el navegador del celu.
2. Instalala como app:
   - **Android / Chrome**: menú ⋮ → **Agregar a pantalla principal**.
   - **iPhone / Safari**: compartir → **Agregar a pantalla de inicio**.
3. Tocá **Entrar con Google** (banner del inicio o en ⚙️ Ajustes) → elegí tu
   cuenta @venue → **Permitir** una vez. Queda recordado.
4. Listo: creá proyectos, sacá/importá fotos, marcá cotas y **Guardar**. Cada foto
   sube sola a `Cotas Venue/<Proyecto>/` en **tu** Drive.

> **Cada usuario** repite solo el punto 3 (Entrar con Google) en su teléfono. La
> configuración de Google (Parte A) y la publicación (Parte B) se hacen **una vez**.

---

## Cómo se usa (resumen)

| Qué querés | Cómo |
|---|---|
| Entrar / cambiar de cuenta | Banner del inicio o ⚙️ Ajustes → *Entrar con Google* / *Cerrar sesión* |
| Crear proyecto | Inicio → **Nuevo proyecto** |
| Renombrar / eliminar proyecto | Mantené apretada la tarjeta (o ⋮ adentro) |
| Sacar / importar foto | Dentro del proyecto → **Sacar foto** / **Importar** |
| Cotas, ángulos, texto… | Herramientas de abajo; acomodás con los puntitos naranjas |
| Color / unidad / tamaño / grosor | Fila de arriba de las herramientas |
| Guardar y subir a tu Drive | Botón **Guardar** |
| Compartir por WhatsApp / mail | Botón compartir del editor |
| Borrar un proyecto de Drive también | Al eliminar, tildás *"Borrar también de Drive"* |

**Espacio en el teléfono:** después de subir, la app **borra la copia pesada** y
deja una miniatura + una copia liviana para editar. Se puede desactivar en Ajustes
(*"Liberar espacio"*). El original a máxima resolución queda en tu Drive.

---

## Si algo no anda

- **El botón "Entrar con Google" no hace nada / da error de origen**: revisá que la
  app se abra desde `https://cotas-venue.web.app` y que ese origen esté en
  *Orígenes de JavaScript autorizados* del ID de OAuth (Parte A, paso 4).
- **"Google no ha podido verificar que esta cuenta sea tuya"**: es un candado de la
  cuenta de Google (no de la app). Quitá y volvé a agregar la cuenta en el teléfono,
  o revisá myaccount.google.com/security-checkup. Probá también en Chrome (no dentro
  de otra app).
- **"Falta el Client ID"** en Ajustes: no se pegó el Client ID en `config.js`.
- **Una foto quedó "pendiente"**: entrá al proyecto → ⋮ → *Subir pendientes a Drive*
  (necesitás señal y estar logueado).
- **Cambié de teléfono**: entrás con Google; las fotos están en tu Drive. La app baja
  lo que necesites cuando abrís una foto.
