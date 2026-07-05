# 🎨 ADN visual "Venue" — para mantener consistencia entre apps

> Esto define **cómo se ven** las apps de Venue. Lo específico de cada app (qué
> botones, qué pantallas, qué hace) cambia; esto **no**. Pegá este archivo al
> inicio de una sesión nueva y decí: *"usá esta identidad visual para la app
> nueva"*. Con eso la estética queda resuelta y hablamos solo de la función.

## Mood / sensación
Limpio, moderno y **profesional pero cercano**. Superficies amplias, mucho aire,
esquinas redondeadas y suaves. Nada duro ni corporativo-frío: transmite orden y a
la vez calidez.

## Marca
- El símbolo es la **"V"** de Venue, **blanca sobre navy**.
- Pensado como **suite**: todas las apps comparten navy + tipografía + formas, y
  cada app tiene **un color de acento propio** (esta usó naranja; la próxima puede
  ser otro).

## Paleta base (fija) + acento (variable)

| Rol | Color |
|---|---|
| **Navy** (base de marca, superficies inmersivas) | `#00263E` |
| **Acento** (acción/energía) — *cambia por app* | `#F15A24` (naranja, en esta) |
| Tinta / texto | `#212721` |
| Fondo general (gris muy claro) | `#eef0f2` |
| Superficie de datos (gris claro) | `#F1F3F5` |
| Bordes / líneas | `#d7dbe0` |
| Alerta suave | `#F8D7DA` |

**Regla de uso del color:** navy para lo estructural e inmersivo (pantallas plenas,
encabezados), el **acento solo para la acción principal**, neutros para el
contenido. El acento se usa poco y con intención.

## Tipografía
- **Montserrat** en todo (Google Fonts).
- Títulos **800**, subtítulos / labels **700**, cuerpo **400 / 500**.
- Da un aire geométrico, ordenado y actual.

## Lenguaje de formas
- **Redondeo generoso:** 12–16px en botones, inputs y tarjetas.
- **Sombras suaves** (nunca duras) en elementos que "flotan" (botón principal, menús).
- **Foco** de campos: borde del color de acento + un *glow* tenue del mismo acento.
- Espaciado cómodo, elementos grandes y fáciles de tocar (mobile-first).

## Cómo "se sienten" los elementos (adaptable)
- **Acción principal:** sólida, del color de acento, redondeada, con sombra → invita a tocar.
- **Acción secundaria:** blanca o navy, sin peso visual, para no competir.
- **Pantallas de estado** (bienvenida, éxito, carga): **navy pleno**, logo centrado,
  texto blanco → momentos "de marca".
- **Contenido / formularios:** fondo claro, tarjetas blancas, todo aireado y legible.
- **Tono en textos:** español informal y cálido.

---

### Cómo usar esto en una app nueva
1. Mantené **navy + Montserrat + redondeado + sombras suaves** como base.
2. Elegí **un color de acento** para esa app (reemplaza al naranja).
3. Usá la **"V"** blanca sobre navy como logo/ícono.
4. El resto (pantallas, botones, funciones) se diseña libre, pero respetando estas reglas.
