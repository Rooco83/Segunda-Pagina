# Backend — Login con Google + guardado en Drive

Pixel Map Studio guarda los proyectos **en el Google Drive del propio usuario**, sin
servidor propio: el navegador se autentica con **Google Identity Services** y sube el
`.pmap` con la **Drive REST API** (alcance `drive.file`, o sea la app sólo ve/gestiona los
archivos que ella misma crea, nunca el resto del Drive).

Mientras no configures Google, la app funciona **100% local** (descargar/cargar `.pmap`) —
igual que hasta ahora. La nube se enciende con una sola variable de entorno.

## 1. Crear las credenciales en Google Cloud

1. Entrá a <https://console.cloud.google.com/> y creá (o elegí) un proyecto.
2. **APIs y servicios → Biblioteca** → buscá **Google Drive API** → **Habilitar**.
3. **APIs y servicios → Pantalla de consentimiento de OAuth**:
   - Tipo de usuario: **Externo**.
   - Completá nombre de la app, correo de soporte y correo del desarrollador.
   - En **Scopes** agregá `.../auth/drive.file` (además de `openid`, `email`, `profile`).
   - En **Usuarios de prueba** agregá tu correo (y el de quien vaya a probar) mientras la
     app esté en modo *Testing*. Para uso abierto, publicá la app (Google puede pedir
     verificación si usás scopes sensibles; `drive.file` **no** es sensible, así que el
     trámite es liviano).
4. **APIs y servicios → Credenciales → Crear credenciales → ID de cliente de OAuth**:
   - Tipo: **Aplicación web**.
   - **Orígenes de JavaScript autorizados**: agregá las URLs desde donde se va a servir la
     app. Ejemplos:
     - `http://localhost:5173` (desarrollo con `npm run dev`)
     - `https://tu-dominio.com` (producción)
   - No hace falta "URI de redireccionamiento" (usamos el flujo de token, no redirect).
   - Guardá y copiá el **Client ID** (algo como `xxxxx.apps.googleusercontent.com`).

## 2. Configurar la app

Creá un archivo `.env` en la raíz (podés copiar `.env.example`) con:

```
VITE_GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com
```

En desarrollo:

```
npm install
npm run dev
```

Vas a ver el botón **“Iniciar sesión con Google”** activo (con el logo de Google). Al
iniciar sesión, en **Proyecto → Google Drive** podés **Guardar en mi Drive** y ver/abrir
tus proyectos. Se guardan en `Pixel Map Studio / <nombre del evento> / <evento>.pmap`; si
volvés a guardar el mismo evento, **se actualiza el archivo** (no se duplica).

## 3. Desplegar (salir a producción)

La app es un sitio estático (Vite). Cualquier hosting sirve:

- **Vercel / Netlify**: importá el repo, build command `npm run build`, output `dist`, y
  cargá la variable de entorno `VITE_GOOGLE_CLIENT_ID`. Acordate de agregar el dominio que
  te dé el hosting a los **Orígenes de JavaScript autorizados** del paso 1.
- **VPS / Nginx**: `npm run build` y serví la carpeta `dist`.

> El **artifact** de Claude no puede usar la nube: su sandbox bloquea la carga de scripts
> externos (los de Google). El login real funciona sólo en un deploy propio con el Client
> ID configurado. El artifact queda como demo del editor en modo local.

## 4. Próxima fase (opcional): mail para cuentas no-Gmail

El guardado en Drive cubre a los usuarios de Google. Para enviar el `.pmap` por **mail**
(cuentas no-Gmail) y **actualizarlo en el mismo hilo** en cada guardado hace falta un
pequeño servicio de envío (no se puede mandar mail seguro desde el navegador):

- Una **función serverless** (Vercel/Netlify Functions o Supabase Edge Function) con un
  proveedor tipo **Resend/SendGrid**.
- Guardar el `Message-ID` del primer envío por evento y responder ese hilo
  (`In-Reply-To` / `References`) en los guardados siguientes.

Queda como fase siguiente; el editor y el guardado en Drive ya son usables sin esto.
