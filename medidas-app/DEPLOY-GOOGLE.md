# ☁️ Publicar Cotas Venue en Google (Firebase Hosting) — a nombre de la empresa

Objetivo: que la app viva **en el Google de la empresa** (cuenta
@venuebrandexperience.com), no en un GitHub personal. Gratis. El login de Google
ya está atado a este mismo proyecto, así que queda todo en un solo lado.

> Todo esto se hace **logueado con tu cuenta @venuebrandexperience.com**. No hace
> falta instalar nada: usamos **Google Cloud Shell** (una terminal en el navegador).

---

## Paso 1 · Activar Firebase en el proyecto que ya tenés

1. Entrá a **[console.firebase.google.com](https://console.firebase.google.com)** con tu
   cuenta @venuebrandexperience.com.
2. **Agregar proyecto** → en vez de crear uno nuevo, elegí de la lista el proyecto
   que ya existe: **Cotas Venue** (el mismo del login). Aceptá los pasos (podés
   desactivar Google Analytics, no hace falta).
3. Cuando termine, en el menú izquierdo entrá a **Compilación → Hosting** →
   **Comenzar** (con eso queda habilitado; no hace falta más).

## Paso 2 · Publicar con Cloud Shell (terminal en el navegador)

1. Entrá a **[console.cloud.google.com](https://console.cloud.google.com)** (misma cuenta),
   arriba a la derecha tocá el ícono **`>_`** (**Activar Cloud Shell**). Se abre una
   terminal negra abajo. **No instalás nada**, ya viene con todo y logueada como vos.
2. Pegá estos comandos (uno por vez, Enter después de cada uno):
   ```bash
   git clone https://github.com/Rooco83/Segunda-Pagina.git
   cd Segunda-Pagina
   git checkout claude/photo-measurement-app-design-va3e87
   firebase deploy --only hosting --project cotas-venue
   ```
   > Si `--project cotas-venue` da error de "proyecto no encontrado", corré
   > `firebase projects:list`, copiá el **Project ID** que te muestre y usalo en el
   > comando (ej. `--project cotas-venue-1a2b3`).
   >
   > Si te pide autorizar, corré `firebase login --no-localhost` y seguí el enlace.
3. Al terminar te muestra la **Hosting URL**, algo como:
   ```
   https://cotas-venue.web.app
   ```
   Esa es la **dirección nueva de la app, alojada en Google, a nombre de la empresa**. 🎉

## Paso 3 · Autorizar la dirección nueva en el login

1. **Google Cloud → Credenciales →** tu cliente **"Cotas Venue Web"**.
2. En **Orígenes autorizados de JavaScript** → **Agregar URI** → pegá la dirección
   nueva **sin barra final**, por ejemplo:
   ```
   https://cotas-venue.web.app
   ```
   (dejá también la de GitHub si querés, no molesta). **Guardar**.
3. Esperá unos minutos (a veces tarda en activarse) y probá **Entrar con Google**
   desde la dirección nueva.

## Paso 4 · Que sea permanente (aunque cambie la persona)

- En **Google Cloud → IAM**, agregá a **otro administrador de la empresa** como
  **Propietario (Owner)** del proyecto. Así el proyecto (login + hosting) **es de la
  empresa**, no depende de una sola persona.

---

## Actualizaciones futuras
Cada vez que haya cambios en la app, se vuelven a publicar corriendo de nuevo en
Cloud Shell:
```bash
cd Segunda-Pagina && git pull && firebase deploy --only hosting --project cotas-venue
```
No hay que hacer nada más: la app se **auto-actualiza en cada apertura**. Al abrirla
(desde el link o instalada) compara su versión con la publicada y, si hay una nueva,
limpia todo y recarga sola una vez. Así todos ven los cambios enseguida sin tener que
borrar caché ni reinstalar. La versión se marca en `medidas-app/version.json` (y se
sube junto con cada cambio de código).

## ¿Y el código?
El código puede seguir donde está; lo que importa es que la **app publicada** vive
en el Firebase de la empresa. Si más adelante querés que el **código** también esté
en un Google de la empresa (o en una organización propia), se puede mover sin tocar
nada de lo de arriba.
