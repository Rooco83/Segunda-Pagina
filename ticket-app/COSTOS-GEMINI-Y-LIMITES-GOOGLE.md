# 💵 Costos de Gemini y límites de Google — App de Rendiciones

Referencia rápida para responder "¿de dónde salió esta info de costos?".
Cubre los costos y límites de los servicios que usa la app.

## Resumen (lo que hay que saber)
- **Apps Script + Google Drive + Google Sheets → GRATIS**, sin tarjeta. Tienen
  cuotas diarias (límites), pero si se tocan **pausan, no cobran**.
- **Gemini API → es el ÚNICO componente que puede costar**, y solo si VOS activás
  la facturación. En plan gratis **no cobra** (solo se pausa al llegar al límite).
- **Costo por lectura de comprobante ≈ US$0,001** (una décima de centavo).
  → ~US$1 cada 1.000 lecturas. Para 20 personas: unos **pocos dólares al mes**.
- Costo indirecto a muy largo plazo: **espacio de Drive** si se llena (las imágenes
  se guardan comprimidas, ~200–500 KB, así que tarda muchísimo).

---

## 💵 Precios (la tarifa oficial)
**Precios de Gemini API**
- https://ai.google.dev/gemini-api/docs/pricing
- Dónde: fila **"Gemini 2.5 Flash"** → precio de **input** y **output** por 1.000.000 de tokens.

## 📊 Uso y gasto REAL (lo más fehaciente)
**Google AI Studio — Uso y Gasto**
- https://aistudio.google.com
- Dónde: menú izquierdo → **"Uso"** (solicitudes/tokens) y **"Gasto"** (dólares reales).

**Google Cloud — Informes de facturación**
- https://console.cloud.google.com/billing
- Dónde: elegí el proyecto → **Informes (Reports)** → filtrá por **"Generative Language API"**.

## 🚦 Límites gratis (cuándo se corta / cuándo conviene pagar)
**AI Studio — Límite de frecuencia**
- https://aistudio.google.com
- Dónde: menú izquierdo → **"Límite de frecuencia"** → RPM / TPM / **RPD** por modelo.

**Documentación de límites de Gemini**
- https://ai.google.dev/gemini-api/docs/rate-limits
- Dónde: tabla por **modelo** y **nivel** (Free / Tier 1…).

**Cuotas de Apps Script** (gratis; son límites, no costos)
- https://developers.google.com/apps-script/guides/services/quotas
- Dónde: fila **"URL Fetch calls"** → columnas **Consumer** vs **Google Workspace** (~100.000/día en Workspace).

## 🛑 Controlar / topar el gasto
**Google Cloud — Presupuestos y alertas**
- https://console.cloud.google.com/billing
- Dónde: proyecto → **Presupuestos y alertas → Crear presupuesto** (ej: US$5, avisos 50/90/100%).

**Google Cloud — Cuotas de la API** (tope duro de solicitudes)
- https://console.cloud.google.com/apis
- Dónde: **Generative Language API → Cuotas** → editar "solicitudes por día".

## 🔑 Contexto
**Con qué cuenta está la clave de Gemini** (a esa cuenta se le acumula todo el uso)
- https://aistudio.google.com/app/apikey
- Dónde: las claves que aparecen pertenecen a la **cuenta logueada**.

**Términos de datos de Gemini** (privacidad: gratis vs pago)
- https://ai.google.dev/gemini-api/terms
- Dónde: sección de **uso de datos** (Unpaid vs Paid Services).

---

> Nota: los precios y límites los define Google y pueden cambiar; estos links son
> las fuentes oficiales para verificar el valor vigente en cualquier momento.
