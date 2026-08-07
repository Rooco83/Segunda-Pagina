# Pixel Map Studio

Editor web para diseñar **pixel maps de pantallas LED** y entregar a proveedores de
contenido y equipos de armado las medidas, el layout de módulos y el cableado exactos.

> Inspirado en herramientas del rubro AV/eventos, con identidad y hosting propios.
> Nombre "Pixel Map Studio" provisorio.

## Stack

- **React + Vite + TypeScript** (SPA, se compila a sitio estático).
- **Zustand** para el estado del proyecto.
- Render del lienzo con DOM + SVG (grilla de módulos, cableado por salida).
- Sin dependencias de UI externas; estilos propios en `src/index.css`.

## Scripts

```bash
npm install       # instalar dependencias
npm run dev       # servidor de desarrollo (http://localhost:5173)
npm run build     # typecheck + build de producción a dist/
npm run preview   # previsualizar el build
```

## Qué hace hoy (fundación)

- Crear/editar/eliminar **Pantallas** (grilla de módulos por **pitch × tamaño**).
- **Damero** de colores por pantalla y **numeración en orden de cableado** (serpentina).
- **Apagar/encender módulos** con clic: el **área (m²)** y el **consumo (A)** bajan en vivo,
  pero la **resolución/pixelaje no cambia** (como los senders reales).
- **Consumo eléctrico**: estimación 2,4 A/m² a blanco 100%.
- **Cableado por salida**: cada salida con su color; panel contextual con el sender y los
  límites de módulos por salida.
- **Editar Pantalla**: nombre, preset de módulo, dimensiones en px/metros/módulos, y sender.
- **Nombre y logo arrastrables** dentro de cada pantalla.
- **Acento configurable** (7 colores, se guarda en el navegador).
- **Pan** (arrastre) y **zoom** (rueda del mouse / botones).
- **Export PNG** (con o sin alpha) eligiendo qué info incluir (nombre, logo, resolución,
  cableado).

## Roadmap (próximas fases)

- Asignación **interactiva** del cableado (elegir salida, extender módulo a módulo hasta el
  límite de la salida).
- Mapear runs a las **salidas físicas** del sender y avisar cuando se excede su capacidad.
- **Espejo**, **clonación de grupos** con snap magnético, **pintado** con pincel.
- **Undo/Redo**, **guardar/cargar** proyecto en archivo.
- Export **Resolume Arena 6/7 (XML)** y **Reporte PDF** apaisado.
- **Arco de 3 puntas** (marcos curvos).
- **Login con correo** + datos por usuario (senders, acento, proyectos) — vía backend
  (p. ej. Supabase) + **auto-lookup** de datasheets de senders.

## Estructura

```
src/
  data/       presets de módulo, senders, acentos
  lib/        cableado (serpentina + salidas), métricas, export PNG
  components/  TopBar, Stage, ScreenView, CablePanel, modales, etc.
  store.ts    estado global (Zustand)
  types.ts    modelo de dominio
```
