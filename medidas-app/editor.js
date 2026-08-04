/* Cotas Venue · editor.js — anotaciones vectoriales sobre la foto.
   Coordenadas de las anotaciones SIEMPRE en píxeles de la imagen original,
   así el JPG final se renderiza a resolución completa sin conversiones. */
'use strict';

/* roundRect llegó a canvas en 2022; en navegadores viejos usamos rect común */
if (typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h) {
    this.rect(x, y, w, h);
    return this;
  };
}

const Editor = (() => {

  /* ── estado ── */
  let foto = null, proyecto = null;
  let img = null, imgURL = '', W = 0, H = 0, base = 0;
  let origSesion = null;   // original a máxima resolución para exportar (no se persiste)
  let annos = [], sel = -1;
  let vista = { x: 0, y: 0, w: 100, h: 100 };
  let historia = [], futuro = [];
  let ultimaTool = 'cota';

  const $ = id => document.getElementById(id);
  const svg = () => $('ed-svg');
  const stage = () => $('ed-stage');

  const medidor = document.createElement('canvas').getContext('2d');

  function defaults() {
    try { return Object.assign({ color: '#FFD400', fs: 1, grosor: 1 }, JSON.parse(localStorage.getItem('cv-defaults'))); }
    catch { return { color: '#FFD400', fs: 1, grosor: 1 }; }
  }
  function guardarDefaults(d) {
    localStorage.setItem('cv-defaults', JSON.stringify(Object.assign(defaults(), d)));
  }

  /* ── tamaños (en px de imagen) ── */
  const fontPx = a => base * 0.028 * (a.fs || 1);
  const strokePx = a => base * 0.005 * (a.grosor || 1);
  const tickPx = a => strokePx(a) * 3.2;

  function anchoTexto(txt, fpx) {
    medidor.font = `700 ${fpx}px Montserrat, sans-serif`;
    return medidor.measureText(txt).width;
  }

  /* ── conversión pantalla ↔ svg ── */
  function px2sv() {
    const m = svg().getScreenCTM();
    return m ? 1 / m.a : 1;
  }
  function punto(ev) {
    const p = svg().createSVGPoint();
    p.x = ev.clientX; p.y = ev.clientY;
    const m = svg().getScreenCTM();
    return m ? p.matrixTransform(m.inverse()) : { x: 0, y: 0 };
  }

  /* ══════════════ geometría ══════════════ */
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  function distSeg(p, a, b) {
    const l2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
    if (!l2) return dist(p, a);
    let t = ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    return dist(p, { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) });
  }

  function puntosCurva(a, n = 24) {
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n, s = 1 - t;
      pts.push({
        x: s * s * a.x1 + 2 * s * t * a.cx + t * t * a.x2,
        y: s * s * a.y1 + 2 * s * t * a.cy + t * t * a.y2
      });
    }
    return pts;
  }

  function anguloInfo(a) {
    const a1 = Math.atan2(a.y1 - a.yv, a.x1 - a.xv);
    const a2 = Math.atan2(a.y2 - a.yv, a.x2 - a.xv);
    let d = a2 - a1;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    const deg = Math.abs(d) * 180 / Math.PI;
    return { a1, a2, d, deg };
  }

  function etiquetaAngulo(a) {
    if (a.manual) return a.manual;
    return anguloInfo(a).deg.toFixed(0) + '°';
  }

  function etiquetaCota(a) {
    return (a.val || '?') + (a.u ? ' ' + a.u : '');
  }

  /* posición y caja de la etiqueta de una anotación (para hit-test y dibujo).
     ax,ay = ancla natural; cx,cy = posición final (ancla + corrimiento manual lox/loy) */
  const etiquetaMovida = a =>
    (a.t === 'cota' && (a.lt != null || a.ln != null)) ||
    (a.t === 'angulo' && (a.lox || a.loy));

  function cajaEtiqueta(a) {
    let txt = null, cx, cy, ax, ay;
    const fpx = fontPx(a);
    if (a.t === 'cota') {
      txt = etiquetaCota(a);
      // posición GUARDADA relativa a la cota (a lo largo lt, perpendicular ln),
      // así mantiene la distancia aunque muevas o gires la cota.
      const mx = (a.x1 + a.x2) / 2, my = (a.y1 + a.y2) / 2;
      const len = Math.hypot(a.x2 - a.x1, a.y2 - a.y1) || 1;
      const dx = (a.x2 - a.x1) / len, dy = (a.y2 - a.y1) / len;
      const nx = -dy, ny = dx;
      const lt = a.lt || 0;
      const ln = (a.ln != null) ? a.ln : fpx * 1.1;
      ax = mx + dx * lt; ay = my + dy * lt;      // pie sobre la cota
      cx = ax + nx * ln; cy = ay + ny * ln;      // etiqueta a distancia ln
    } else if (a.t === 'angulo') {
      txt = etiquetaAngulo(a);
      const i = anguloInfo(a);
      const bis = i.a1 + i.d / 2;
      const r = Math.min(dist({ x: a.x1, y: a.y1 }, { x: a.xv, y: a.yv }),
                         dist({ x: a.x2, y: a.y2 }, { x: a.xv, y: a.yv })) * 0.55 + fpx;
      ax = a.xv + Math.cos(bis) * r; ay = a.yv + Math.sin(bis) * r;
      cx = ax + (a.lox || 0); cy = ay + (a.loy || 0);
    } else if (a.t === 'texto') {
      txt = a.txt || ' ';
      ax = a.x; ay = a.y; cx = a.x; cy = a.y;
    } else return null;
    const w = anchoTexto(txt, fpx) + fpx * 0.9;
    const h = fpx * 1.6;
    return { txt, cx, cy, ax, ay, w, h, fpx };
  }

  /* guía desde la anotación hasta la etiqueta cuando se la corrió de lugar:
     línea sólida + puntito en la cota, para que se vea bien a cuál pertenece */
  function guiaEtiquetaSVG(a) {
    if (!etiquetaMovida(a)) return '';
    const c = cajaEtiqueta(a);
    return `<line x1="${c.ax}" y1="${c.ay}" x2="${c.cx}" y2="${c.cy}" stroke="${a.color}"
      stroke-width="${strokePx(a) * 0.6}" opacity=".9"/>
      <circle cx="${c.ax}" cy="${c.ay}" r="${strokePx(a) * 1.4}" fill="${a.color}"/>`;
  }

  /* ══════════════ dibujo SVG ══════════════ */
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

  function chipSVG(caja, colorTexto, conFondo = true) {
    const f = conFondo ? `<rect x="${caja.cx - caja.w / 2}" y="${caja.cy - caja.h / 2}" width="${caja.w}" height="${caja.h}"
      rx="${caja.h * 0.24}" fill="rgba(7,24,36,.82)"/>` : '';
    return `${f}<text x="${caja.cx}" y="${caja.cy}" fill="${colorTexto}" font-size="${caja.fpx}"
      font-weight="700" font-family="Montserrat, sans-serif" text-anchor="middle"
      dominant-baseline="central">${esc(caja.txt)}</text>`;
  }

  function flechaPuntaSVG(x, y, dx, dy, a) {
    const L = Math.hypot(dx, dy) || 1;
    const ux = dx / L, uy = dy / L;
    const s = strokePx(a) * 3.6;
    const p1 = { x: x - ux * s - uy * s * 0.6, y: y - uy * s + ux * s * 0.6 };
    const p2 = { x: x - ux * s + uy * s * 0.6, y: y - uy * s - ux * s * 0.6 };
    return `<path d="M${p1.x} ${p1.y} L${x} ${y} L${p2.x} ${p2.y}" stroke="${a.color}" stroke-width="${strokePx(a)}" fill="none"/>`;
  }

  function annoSVG(a) {
    const sw = strokePx(a), c = a.color;
    let s = '';
    if (a.t === 'cota') {
      const len = Math.hypot(a.x2 - a.x1, a.y2 - a.y1) || 1;
      const nx = -(a.y2 - a.y1) / len * tickPx(a), ny = (a.x2 - a.x1) / len * tickPx(a);
      s += `<line x1="${a.x1}" y1="${a.y1}" x2="${a.x2}" y2="${a.y2}" stroke="${c}" stroke-width="${sw}"/>
        <line x1="${a.x1 - nx}" y1="${a.y1 - ny}" x2="${a.x1 + nx}" y2="${a.y1 + ny}" stroke="${c}" stroke-width="${sw}"/>
        <line x1="${a.x2 - nx}" y1="${a.y2 - ny}" x2="${a.x2 + nx}" y2="${a.y2 + ny}" stroke="${c}" stroke-width="${sw}"/>`;
      s += guiaEtiquetaSVG(a);
      s += chipSVG(cajaEtiqueta(a), c);
    } else if (a.t === 'flecha') {
      s += `<line x1="${a.x1}" y1="${a.y1}" x2="${a.x2}" y2="${a.y2}" stroke="${c}" stroke-width="${sw}"/>`;
      s += flechaPuntaSVG(a.x2, a.y2, a.x2 - a.x1, a.y2 - a.y1, a);
    } else if (a.t === 'curva') {
      s += `<path d="M${a.x1} ${a.y1} Q${a.cx} ${a.cy} ${a.x2} ${a.y2}" stroke="${c}" stroke-width="${sw}" fill="none"/>`;
      s += flechaPuntaSVG(a.x2, a.y2, a.x2 - a.cx, a.y2 - a.cy, a);
    } else if (a.t === 'angulo') {
      const i = anguloInfo(a);
      const r = Math.min(dist({ x: a.x1, y: a.y1 }, { x: a.xv, y: a.yv }),
                         dist({ x: a.x2, y: a.y2 }, { x: a.xv, y: a.yv })) * 0.42;
      const sx = a.xv + Math.cos(i.a1) * r, sy = a.yv + Math.sin(i.a1) * r;
      const ex = a.xv + Math.cos(i.a2) * r, ey = a.yv + Math.sin(i.a2) * r;
      s += `<path d="M${a.x1} ${a.y1} L${a.xv} ${a.yv} L${a.x2} ${a.y2}" stroke="${c}" stroke-width="${sw}" fill="none"/>
        <path d="M${sx} ${sy} A${r} ${r} 0 0 ${i.d > 0 ? 1 : 0} ${ex} ${ey}" stroke="${c}" stroke-width="${sw * 0.8}" fill="none"/>`;
      s += guiaEtiquetaSVG(a);
      s += chipSVG(cajaEtiqueta(a), c);
    } else if (a.t === 'texto') {
      const caja = cajaEtiqueta(a);
      s = `<rect x="${caja.cx - caja.w / 2}" y="${caja.cy - caja.h / 2}" width="${caja.w}" height="${caja.h}"
        rx="${caja.h * 0.24}" fill="${a.color}"/>` +
        `<text x="${caja.cx}" y="${caja.cy}" fill="${colorContraste(a.color)}" font-size="${caja.fpx}"
        font-weight="700" font-family="Montserrat, sans-serif" text-anchor="middle"
        dominant-baseline="central">${esc(caja.txt)}</text>`;
    } else if (a.t === 'rect') {
      s += `<rect x="${Math.min(a.x1, a.x2)}" y="${Math.min(a.y1, a.y2)}" width="${Math.abs(a.x2 - a.x1)}"
        height="${Math.abs(a.y2 - a.y1)}" rx="${sw * 2}" stroke="${c}" stroke-width="${sw}" fill="none"/>`;
    } else if (a.t === 'elipse') {
      s += `<ellipse cx="${(a.x1 + a.x2) / 2}" cy="${(a.y1 + a.y2) / 2}" rx="${Math.abs(a.x2 - a.x1) / 2}"
        ry="${Math.abs(a.y2 - a.y1) / 2}" stroke="${c}" stroke-width="${sw}" fill="none"/>`;
    }
    return s;
  }

  function colorContraste(hex) {
    return (hex === '#FFD400' || hex === '#FFFFFF' || hex === '#37C8F0' || hex === '#3DDC84') ? '#071824' : '#fff';
  }

  function handlesDe(a) {
    if (a.t === 'cota' || a.t === 'flecha' || a.t === 'rect' || a.t === 'elipse')
      return [{ x: a.x1, y: a.y1 }, { x: a.x2, y: a.y2 }];
    if (a.t === 'curva')
      return [{ x: a.x1, y: a.y1 }, { x: a.cx, y: a.cy }, { x: a.x2, y: a.y2 }];
    if (a.t === 'angulo')
      return [{ x: a.x1, y: a.y1 }, { x: a.xv, y: a.yv }, { x: a.x2, y: a.y2 }];
    return [];
  }

  function setHandle(a, idx, p) {
    if (a.t === 'curva') {
      if (idx === 0) { a.x1 = p.x; a.y1 = p.y; }
      else if (idx === 1) { a.cx = p.x; a.cy = p.y; }
      else { a.x2 = p.x; a.y2 = p.y; }
    } else if (a.t === 'angulo') {
      if (idx === 0) { a.x1 = p.x; a.y1 = p.y; }
      else if (idx === 1) {
        const dx = p.x - a.xv, dy = p.y - a.yv;
        a.xv = p.x; a.yv = p.y; a.x1 += dx; a.y1 += dy; a.x2 += dx; a.y2 += dy;
      }
      else { a.x2 = p.x; a.y2 = p.y; }
    } else {
      if (idx === 0) { a.x1 = p.x; a.y1 = p.y; }
      else { a.x2 = p.x; a.y2 = p.y; }
    }
  }

  function mover(a, dx, dy) {
    ['x1', 'cx', 'xv', 'x2', 'x'].forEach(k => { if (k in a) a[k] += dx; });
    ['y1', 'cy', 'yv', 'y2', 'y'].forEach(k => { if (k in a) a[k] += dy; });
  }

  /* ══════════════ hit-test ══════════════ */
  function hitEtiqueta(a, p) {
    const caja = cajaEtiqueta(a);
    if (!caja) return false;
    return Math.abs(p.x - caja.cx) < caja.w / 2 + 4 && Math.abs(p.y - caja.cy) < caja.h / 2 + 4;
  }

  function hitAnno(a, p, tol) {
    if (hitEtiqueta(a, p)) return true;
    if (a.t === 'cota' || a.t === 'flecha')
      return distSeg(p, { x: a.x1, y: a.y1 }, { x: a.x2, y: a.y2 }) < tol;
    if (a.t === 'curva') {
      const pts = puntosCurva(a);
      for (let i = 0; i < pts.length - 1; i++) if (distSeg(p, pts[i], pts[i + 1]) < tol) return true;
      return false;
    }
    if (a.t === 'angulo')
      return distSeg(p, { x: a.x1, y: a.y1 }, { x: a.xv, y: a.yv }) < tol ||
             distSeg(p, { x: a.x2, y: a.y2 }, { x: a.xv, y: a.yv }) < tol;
    if (a.t === 'rect') {
      const x1 = Math.min(a.x1, a.x2), x2 = Math.max(a.x1, a.x2);
      const y1 = Math.min(a.y1, a.y2), y2 = Math.max(a.y1, a.y2);
      return distSeg(p, { x: x1, y: y1 }, { x: x2, y: y1 }) < tol ||
             distSeg(p, { x: x2, y: y1 }, { x: x2, y: y2 }) < tol ||
             distSeg(p, { x: x2, y: y2 }, { x: x1, y: y2 }) < tol ||
             distSeg(p, { x: x1, y: y2 }, { x: x1, y: y1 }) < tol;
    }
    if (a.t === 'elipse') {
      const cx = (a.x1 + a.x2) / 2, cy = (a.y1 + a.y2) / 2;
      const rx = Math.abs(a.x2 - a.x1) / 2 || 1, ry = Math.abs(a.y2 - a.y1) / 2 || 1;
      for (let i = 0; i < 28; i++) {
        const t = i / 28 * 2 * Math.PI;
        if (dist(p, { x: cx + rx * Math.cos(t), y: cy + ry * Math.sin(t) }) < tol) return true;
      }
      return false;
    }
    return false;
  }

  function hitTest(p) {
    const tol = px2sv() * 16;
    for (let i = annos.length - 1; i >= 0; i--) {
      if (hitAnno(annos[i], p, tol)) return i;
    }
    return -1;
  }

  /* ══════════════ render ══════════════ */
  function render() {
    const s = svg();
    s.setAttribute('viewBox', `${vista.x} ${vista.y} ${vista.w} ${vista.h}`);
    let html = `<image href="${imgURL}" x="0" y="0" width="${W}" height="${H}"/>`;
    annos.forEach(a => { html += annoSVG(a); });
    if (sel >= 0 && annos[sel]) {
      const r = px2sv() * 11, swH = px2sv() * 2.5;
      const a = annos[sel];
      if (a.t === 'curva') {
        html += `<path d="M${a.x1} ${a.y1} L${a.cx} ${a.cy} L${a.x2} ${a.y2}" stroke="rgba(255,255,255,.5)"
          stroke-width="${px2sv()}" stroke-dasharray="${px2sv() * 5} ${px2sv() * 5}" fill="none"/>`;
      }
      handlesDe(a).forEach(h => {
        html += `<circle cx="${h.x}" cy="${h.y}" r="${r}" fill="rgba(255,255,255,.92)"
          stroke="#F15A24" stroke-width="${swH}"/>`;
      });
      if (a.t === 'texto') {
        const caja = cajaEtiqueta(a);
        html += `<rect x="${caja.cx - caja.w / 2 - r / 2}" y="${caja.cy - caja.h / 2 - r / 2}" width="${caja.w + r}"
          height="${caja.h + r}" rx="${caja.h * 0.3}" stroke="#F15A24" stroke-width="${swH}"
          stroke-dasharray="${px2sv() * 6} ${px2sv() * 4}" fill="none"/>`;
      }
    }
    // cajita "lista para mover" (se mantuvo presionada): aro naranja alrededor
    if (etiquetaArmada && annos.indexOf(etiquetaArmada) >= 0) {
      const caja = cajaEtiqueta(etiquetaArmada);
      if (caja) {
        const m = px2sv() * 5, sw = px2sv() * 3;
        html += `<rect x="${caja.cx - caja.w / 2 - m}" y="${caja.cy - caja.h / 2 - m}"
          width="${caja.w + m * 2}" height="${caja.h + m * 2}" rx="${caja.h * 0.4}"
          fill="none" stroke="#F15A24" stroke-width="${sw}"/>`;
      }
    }
    s.innerHTML = html;
    actualizarBotones();
    marcarProps();
  }

  function actualizarBotones() {
    $('ed-undo').disabled = !historia.length;
    $('ed-redo').disabled = !futuro.length;
    $('ed-borrar').disabled = sel < 0;
    $('ed-dup').disabled = sel < 0;
  }

  function marcarProps() {
    const a = sel >= 0 ? annos[sel] : defaults();
    document.querySelectorAll('#ed-props .cdot').forEach(b =>
      b.classList.toggle('sel', b.dataset.color.toUpperCase() === (a.color || '').toUpperCase()));
    const u = sel >= 0 ? (annos[sel].u || '') : (Ajustes.unidad || 'm');
    document.querySelectorAll('#ed-props .unidad').forEach(b =>
      b.classList.toggle('sel', b.dataset.u === u));

    // barra contextual (girar / fijar eje): solo para cota o flecha seleccionada
    const seleccion = sel >= 0 ? annos[sel] : null;
    const esLinea = seleccion && (seleccion.t === 'cota' || seleccion.t === 'flecha');
    $('ed-contexto').classList.toggle('oculto', !esLinea);
    $('ctx-eje').classList.toggle('activo', !!(esLinea && seleccion.lock));
  }

  /* gira la cota/flecha seleccionada 90° alrededor de su centro */
  function rotarSel() {
    if (sel < 0) return;
    const a = annos[sel];
    if (a.t !== 'cota' && a.t !== 'flecha') return;
    pushHist(snap());
    const mx = (a.x1 + a.x2) / 2, my = (a.y1 + a.y2) / 2;
    const rot = (x, y) => ({ x: mx - (y - my), y: my + (x - mx) });
    const p1 = rot(a.x1, a.y1), p2 = rot(a.x2, a.y2);
    a.x1 = p1.x; a.y1 = p1.y; a.x2 = p2.x; a.y2 = p2.y;
    guardarBorrador();
    render();
  }

  function toggleEje() {
    if (sel < 0) return;
    const a = annos[sel];
    if (a.t !== 'cota' && a.t !== 'flecha') return;
    a.lock = !a.lock;
    guardarBorrador();
    render();
  }

  /* ══════════════ historial ══════════════ */
  const snap = () => JSON.parse(JSON.stringify(annos));
  function pushHist(estadoPrevio) {
    historia.push(estadoPrevio);
    if (historia.length > 60) historia.shift();
    futuro = [];
  }
  function undo() {
    if (!historia.length) return;
    futuro.push(snap());
    annos = historia.pop();
    sel = -1;
    render();
  }
  function redo() {
    if (!futuro.length) return;
    historia.push(snap());
    annos = futuro.pop();
    sel = -1;
    render();
  }

  /* ══════════════ agregar anotaciones ══════════════ */
  async function agregar(tool) {
    const cx = vista.x + vista.w / 2, cy = vista.y + vista.h / 2;
    const d = vista.w * 0.24;
    const def = defaults();
    const a = { t: tool, color: def.color, fs: def.fs, grosor: def.grosor };

    if (tool === 'cota') {
      // se crea sin valor; el "?" se toca después para cargar la medida
      Object.assign(a, { x1: cx - d, y1: cy, x2: cx + d, y2: cy, val: '', u: Ajustes.unidad });
    } else if (tool === 'flecha') {
      Object.assign(a, { x1: cx - d, y1: cy + d * 0.5, x2: cx + d * 0.7, y2: cy - d * 0.5 });
    } else if (tool === 'curva') {
      Object.assign(a, { x1: cx - d, y1: cy + d * 0.4, cx: cx, cy: cy - d * 0.8, x2: cx + d, y2: cy + d * 0.2 });
    } else if (tool === 'angulo') {
      Object.assign(a, {
        xv: cx - d * 0.4, yv: cy + d * 0.5,
        x1: cx - d * 0.4 + d * 1.3, y1: cy + d * 0.5,
        x2: cx - d * 0.4 + d * 1.3 * Math.cos(-0.9), y2: cy + d * 0.5 + d * 1.3 * Math.sin(-0.9),
        manual: null
      });
    } else if (tool === 'texto') {
      const txt = await App.dialogo('Texto de la nota', '', 'ej: revisar zócalo');
      if (txt === null || !txt.trim()) return;
      Object.assign(a, { x: cx, y: cy, txt: txt.trim(), color: def.color === '#FFD400' ? '#00263E' : def.color });
    } else if (tool === 'rect' || tool === 'elipse') {
      Object.assign(a, { x1: cx - d * 0.8, y1: cy - d * 0.55, x2: cx + d * 0.8, y2: cy + d * 0.55 });
    }

    pushHist(snap());
    annos.push(a);
    sel = annos.length - 1;
    render();
  }

  /* editar el contenido según qué etiqueta se tocó */
  async function editarContenido(a) {
    if (a.t === 'cota') {
      const val = await App.dialogo('Valor de la cota', a.val === '?' ? '' : a.val, 'ej: 2,45');
      if (val === null) return;
      pushHist(snap());
      a.val = val || '?';
      render();
    } else if (a.t === 'texto') {
      const txt = await App.dialogo('Texto de la nota', a.txt, '');
      if (txt === null || !txt.trim()) return;
      pushHist(snap());
      a.txt = txt.trim();
      render();
    } else if (a.t === 'angulo') {
      const v = await App.dialogo('Ángulo (vacío = automático)', a.manual || '', anguloInfo(a).deg.toFixed(0) + '°');
      if (v === null) return;
      pushHist(snap());
      a.manual = v.trim() || null;
      render();
    }
  }

  /* ══════════════ lupa ══════════════ */
  function lupaMostrar(p, ev) {
    const l = $('lupa'), cv = $('lupa-canvas'), ctx = cv.getContext('2d');
    l.classList.remove('oculto');
    const zoomLupa = 2.2;
    const wImg = 132 * px2sv() / zoomLupa;
    ctx.fillStyle = '#03101a';
    ctx.fillRect(0, 0, 132, 132);
    ctx.drawImage(img, p.x - wImg / 2, p.y - wImg / 2, wImg, wImg, 0, 0, 132, 132);
    ctx.strokeStyle = '#F15A24'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(66, 46); ctx.lineTo(66, 86);
    ctx.moveTo(46, 66); ctx.lineTo(86, 66);
    ctx.stroke();
    const r = stage().getBoundingClientRect();
    let lx = ev.clientX - r.left - 66, ly = ev.clientY - r.top - 132 - 44;
    if (ly < 4) ly = ev.clientY - r.top + 44;
    lx = Math.max(4, Math.min(r.width - 136, lx));
    l.style.left = lx + 'px';
    l.style.top = ly + 'px';
  }
  function lupaOcultar() { $('lupa').classList.add('oculto'); }

  /* ══════════════ punteros: pan, pinch, drag ══════════════ */
  const punteros = new Map();
  let modo = null;           // 'handle' | 'cuerpo' | 'pan' | 'pinch'
  let arrastre = null;       // datos del gesto en curso
  let lpTimer = null;        // temporizador de "mantener presionado" (mover cajita)
  let etiquetaArmada = null; // cajita lista para moverse (tras mantener presionado)

  /* la cajita del valor se movió con mantener-presionado: acá se "arma" */
  function armarEtiqueta(a) {
    if (!arrastre || modo !== 'etiqueta' || arrastre.movio) return;
    arrastre.armado = true;
    etiquetaArmada = a;
    if (navigator.vibrate) { try { navigator.vibrate(18); } catch {} }
    render();
  }

  function clampVista() {
    const aspecto = H / W;
    vista.w = Math.max(base * 0.10, Math.min(base * 1.8, vista.w));
    vista.h = vista.w * aspecto;
    vista.x = Math.max(-vista.w * 0.85, Math.min(W - vista.w * 0.15, vista.x));
    vista.y = Math.max(-vista.h * 0.85, Math.min(H - vista.h * 0.15, vista.y));
  }

  function onDown(ev) {
    ev.preventDefault();
    stage().setPointerCapture(ev.pointerId);
    punteros.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });

    if (punteros.size === 2) {
      const [p1, p2] = [...punteros.values()];
      clearTimeout(lpTimer);
      modo = 'pinch';
      arrastre = {
        d0: Math.hypot(p1.x - p2.x, p1.y - p2.y),
        vista0: { ...vista },
        centro: punto({ clientX: (p1.x + p2.x) / 2, clientY: (p1.y + p2.y) / 2 })
      };
      lupaOcultar();
      return;
    }

    const p = punto(ev);
    const inicio = { sx: ev.clientX, sy: ev.clientY, p, movio: false, pre: snap() };

    if (sel >= 0 && annos[sel]) {
      const tol = px2sv() * 20;
      const hs = handlesDe(annos[sel]);
      for (let i = 0; i < hs.length; i++) {
        if (dist(p, hs[i]) < tol) {
          modo = 'handle';
          arrastre = { ...inicio, idx: i };
          lupaMostrar(hs[i], ev);
          return;
        }
      }
    }

    const hit = hitTest(p);
    if (hit >= 0) {
      if (hit !== sel) { sel = hit; render(); }
      const a = annos[hit];
      arrastre = { ...inicio, hit, ult: p, armado: false };
      // La cajita del valor: TOCAR = poner/editar el valor. Para MOVERLA hay que
      // MANTENERLA PRESIONADA (~0,4s): recién ahí se "arma" (vibra + se resalta) y
      // se puede arrastrar. Así no se corre de lugar sin querer al querer tocarla.
      if ((a.t === 'cota' || a.t === 'angulo') && hitEtiqueta(a, p)) {
        modo = 'etiqueta';
        clearTimeout(lpTimer);
        lpTimer = setTimeout(() => armarEtiqueta(a), 400);
      } else {
        modo = 'cuerpo';
      }
      return;
    }

    modo = 'pan';
    arrastre = { ...inicio, vista0: { ...vista } };
  }

  function onMove(ev) {
    if (!punteros.has(ev.pointerId)) return;
    punteros.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });

    if (modo === 'pinch' && punteros.size >= 2) {
      const [p1, p2] = [...punteros.values()];
      const d = Math.hypot(p1.x - p2.x, p1.y - p2.y) || 1;
      const k = d / arrastre.d0;
      const c = arrastre.centro, v0 = arrastre.vista0;
      vista.w = v0.w / k; vista.h = v0.h / k;
      vista.x = c.x - (c.x - v0.x) / k;
      vista.y = c.y - (c.y - v0.y) / k;
      clampVista();
      render();
      return;
    }
    if (!arrastre) return;

    const dxs = ev.clientX - arrastre.sx, dys = ev.clientY - arrastre.sy;
    if (Math.hypot(dxs, dys) > 6) arrastre.movio = true;

    if (modo === 'handle') {
      const p = punto(ev);
      setHandle(annos[sel], arrastre.idx, p);
      lupaMostrar(p, ev);
      render();
    } else if (modo === 'cuerpo') {
      const p = punto(ev);
      const a = annos[arrastre.hit];
      let dx = p.x - arrastre.ult.x, dy = p.y - arrastre.ult.y;
      // "fijar eje": cota/flecha vertical → solo a los costados; horizontal → solo arriba/abajo
      if (a.lock && (a.t === 'cota' || a.t === 'flecha')) {
        const vertical = Math.abs(a.y2 - a.y1) >= Math.abs(a.x2 - a.x1);
        if (vertical) dy = 0; else dx = 0;
      }
      mover(a, dx, dy);
      arrastre.ult = p;
      render();
    } else if (modo === 'etiqueta') {
      // sin mantener presionado, NO se mueve (se cancela el temporizador de armado)
      if (!arrastre.armado) { clearTimeout(lpTimer); return; }
      const p = punto(ev);
      const a = annos[arrastre.hit];
      const mdx = p.x - arrastre.ult.x, mdy = p.y - arrastre.ult.y;
      if (a.t === 'cota') {
        // el movimiento se guarda en el marco de la cota (a lo largo / perpendicular)
        const len = Math.hypot(a.x2 - a.x1, a.y2 - a.y1) || 1;
        const dx = (a.x2 - a.x1) / len, dy = (a.y2 - a.y1) / len;
        a.lt = (a.lt || 0) + (mdx * dx + mdy * dy);
        a.ln = ((a.ln != null) ? a.ln : fontPx(a) * 1.1) + (mdx * -dy + mdy * dx);
      } else {
        a.lox = (a.lox || 0) + mdx;
        a.loy = (a.loy || 0) + mdy;
      }
      arrastre.ult = p;
      render();
    } else if (modo === 'pan') {
      const k = px2sv();
      vista.x = arrastre.vista0.x - dxs * k;
      vista.y = arrastre.vista0.y - dys * k;
      clampVista();
      render();
    }
  }

  function onUp(ev) {
    punteros.delete(ev.pointerId);
    lupaOcultar();
    if (modo === 'pinch') {
      if (punteros.size < 2) { modo = null; arrastre = null; }
      return;
    }
    clearTimeout(lpTimer);
    if (!arrastre) { modo = null; etiquetaArmada = null; return; }

    const teniaArmada = !!etiquetaArmada;
    etiquetaArmada = null;
    const fueTap = !arrastre.movio;
    // en la cajita, "movió de verdad" solo si estaba armada (mantuvo presionado)
    const movio = arrastre.movio && (modo !== 'etiqueta' || arrastre.armado);
    if ((modo === 'handle' || modo === 'cuerpo' || modo === 'etiqueta') && movio) {
      pushHist(arrastre.pre);
      guardarBorrador();
    } else if (fueTap && modo === 'pan') {
      if (sel >= 0) { sel = -1; render(); }
    } else if (fueTap && (modo === 'cuerpo' || (modo === 'etiqueta' && !arrastre.armado))) {
      // tocar la cajita (sin mantener presionado) → poner/editar el valor
      const a = annos[arrastre.hit];
      if (hitEtiqueta(a, arrastre.p)) editarContenido(a);
    }
    modo = null; arrastre = null;
    actualizarBotones();
    if (teniaArmada) render();   // limpia el resaltado de "listo para mover"
  }

  /* guarda las anotaciones (sin exportar) para no perder trabajo */
  let borradorTimer = null;
  function guardarBorrador() {
    clearTimeout(borradorTimer);
    borradorTimer = setTimeout(() => {
      if (!foto) return;
      foto.anotaciones = snap();
      DB.guardarFoto(foto);
    }, 600);
  }

  /* ══════════════ export a canvas (JPG final) ══════════════ */
  function chipCanvas(ctx, caja, colorFondo, colorTexto) {
    ctx.save();
    if (colorFondo) {
      ctx.fillStyle = colorFondo;
      const r = caja.h * 0.24;
      ctx.beginPath();
      ctx.roundRect(caja.cx - caja.w / 2, caja.cy - caja.h / 2, caja.w, caja.h, r);
      ctx.fill();
    }
    ctx.fillStyle = colorTexto;
    ctx.font = `700 ${caja.fpx}px Montserrat, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(caja.txt, caja.cx, caja.cy + caja.fpx * 0.06);
    ctx.restore();
  }

  function guiaCanvas(ctx, a) {
    if (!etiquetaMovida(a)) return;
    const c = cajaEtiqueta(a);
    ctx.save();
    ctx.strokeStyle = a.color; ctx.fillStyle = a.color;
    ctx.lineWidth = strokePx(a) * 0.6;
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.moveTo(c.ax, c.ay); ctx.lineTo(c.cx, c.cy);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(c.ax, c.ay, strokePx(a) * 1.4, 0, 2 * Math.PI);
    ctx.fill();
    ctx.restore();
  }

  function puntaCanvas(ctx, x, y, dx, dy, a) {
    const L = Math.hypot(dx, dy) || 1;
    const ux = dx / L, uy = dy / L, s = strokePx(a) * 3.6;
    ctx.beginPath();
    ctx.moveTo(x - ux * s - uy * s * 0.6, y - uy * s + ux * s * 0.6);
    ctx.lineTo(x, y);
    ctx.lineTo(x - ux * s + uy * s * 0.6, y - uy * s - ux * s * 0.6);
    ctx.stroke();
  }

  function annoCanvas(ctx, a) {
    ctx.save();
    ctx.strokeStyle = a.color;
    ctx.lineWidth = strokePx(a);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (a.t === 'cota') {
      const len = Math.hypot(a.x2 - a.x1, a.y2 - a.y1) || 1;
      const nx = -(a.y2 - a.y1) / len * tickPx(a), ny = (a.x2 - a.x1) / len * tickPx(a);
      ctx.beginPath();
      ctx.moveTo(a.x1, a.y1); ctx.lineTo(a.x2, a.y2);
      ctx.moveTo(a.x1 - nx, a.y1 - ny); ctx.lineTo(a.x1 + nx, a.y1 + ny);
      ctx.moveTo(a.x2 - nx, a.y2 - ny); ctx.lineTo(a.x2 + nx, a.y2 + ny);
      ctx.stroke();
      guiaCanvas(ctx, a);
      chipCanvas(ctx, cajaEtiqueta(a), 'rgba(7,24,36,.82)', a.color);
    } else if (a.t === 'flecha') {
      ctx.beginPath(); ctx.moveTo(a.x1, a.y1); ctx.lineTo(a.x2, a.y2); ctx.stroke();
      puntaCanvas(ctx, a.x2, a.y2, a.x2 - a.x1, a.y2 - a.y1, a);
    } else if (a.t === 'curva') {
      ctx.beginPath(); ctx.moveTo(a.x1, a.y1); ctx.quadraticCurveTo(a.cx, a.cy, a.x2, a.y2); ctx.stroke();
      puntaCanvas(ctx, a.x2, a.y2, a.x2 - a.cx, a.y2 - a.cy, a);
    } else if (a.t === 'angulo') {
      const i = anguloInfo(a);
      const r = Math.min(dist({ x: a.x1, y: a.y1 }, { x: a.xv, y: a.yv }),
                         dist({ x: a.x2, y: a.y2 }, { x: a.xv, y: a.yv })) * 0.42;
      ctx.beginPath();
      ctx.moveTo(a.x1, a.y1); ctx.lineTo(a.xv, a.yv); ctx.lineTo(a.x2, a.y2);
      ctx.stroke();
      ctx.beginPath();
      ctx.lineWidth = strokePx(a) * 0.8;
      ctx.arc(a.xv, a.yv, r, i.a1, i.a2, i.d < 0);
      ctx.stroke();
      ctx.lineWidth = strokePx(a);
      guiaCanvas(ctx, a);
      chipCanvas(ctx, cajaEtiqueta(a), 'rgba(7,24,36,.82)', a.color);
    } else if (a.t === 'texto') {
      chipCanvas(ctx, cajaEtiqueta(a), a.color, colorContraste(a.color));
    } else if (a.t === 'rect') {
      ctx.beginPath();
      ctx.roundRect(Math.min(a.x1, a.x2), Math.min(a.y1, a.y2),
        Math.abs(a.x2 - a.x1), Math.abs(a.y2 - a.y1), strokePx(a) * 2);
      ctx.stroke();
    } else if (a.t === 'elipse') {
      ctx.beginPath();
      ctx.ellipse((a.x1 + a.x2) / 2, (a.y1 + a.y2) / 2,
        Math.abs(a.x2 - a.x1) / 2 || 1, Math.abs(a.y2 - a.y1) / 2 || 1, 0, 0, 2 * Math.PI);
      ctx.stroke();
    }
    ctx.restore();
  }

  function cargarImg(blob) {
    return new Promise((res, rej) => {
      const im = new Image();
      const u = URL.createObjectURL(blob);
      im.onload = () => { res({ im, u }); };
      im.onerror = () => { URL.revokeObjectURL(u); rej(new Error('img')); };
      im.src = u;
    });
  }

  /* Las cotas están en coordenadas del espacio de edición (W×H = proxy).
     Al exportar usamos el original a máxima resolución si sigue en el teléfono;
     si ya se liberó, exportamos a la resolución del proxy. */
  async function exportarBlob() {
    let bg = img, bw = W, bh = H, urlTmp = null;
    const fullRes = (foto && foto.blobOriginal) || origSesion;
    if (fullRes) {
      try {
        const r = await cargarImg(fullRes);
        bg = r.im; urlTmp = r.u;
        bw = r.im.naturalWidth; bh = r.im.naturalHeight;
      } catch {}
    }
    const cv = document.createElement('canvas');
    cv.width = bw; cv.height = bh;
    const ctx = cv.getContext('2d');
    ctx.drawImage(bg, 0, 0, bw, bh);
    ctx.save();
    ctx.scale(bw / W, bh / H);
    annos.forEach(a => annoCanvas(ctx, a));
    if (Ajustes.marca && proyecto) {
      const f = base * 0.02;
      const txt = `${proyecto.nombre} · ${new Date().toLocaleDateString('es-AR')}`;
      ctx.font = `600 ${f}px Montserrat, sans-serif`;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      ctx.fillStyle = 'rgba(7,24,36,.55)';
      const wTxt = ctx.measureText(txt).width;
      ctx.fillRect(W - wTxt - f * 1.6, H - f * 2.1, wTxt + f * 1.2, f * 1.7);
      ctx.fillStyle = '#fff';
      ctx.fillText(txt, W - f, H - f * 0.7);
    }
    ctx.restore();
    const blob = await new Promise(res => cv.toBlob(res, 'image/jpeg', Ajustes.calidad));
    if (urlTmp) URL.revokeObjectURL(urlTmp);
    return blob;
  }

  async function guardar() {
    $('ed-guardar').textContent = 'Guardando…';
    try {
      foto.blobFinal = await exportarBlob();
      foto.anotaciones = snap();
      foto.estadoDrive = Drive.activo() ? 'pendiente' : 'local';
      await DB.guardarFoto(foto);
      Drive.procesarCola(App.alCambiarEstadoFoto);
      App.toast(Drive.activo() ? 'Guardada — subiendo a tu Drive' : 'Guardada en el proyecto');
      cerrar();
      App.abrirProyecto(proyecto.id);
    } finally {
      $('ed-guardar').textContent = 'Guardar';
    }
  }

  async function compartir() {
    const blob = await exportarBlob();
    const file = new File([blob], (proyecto ? proyecto.nombre : 'foto') + '.jpg', { type: 'image/jpeg' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: proyecto ? proyecto.nombre : 'Cotas Venue' }); } catch {}
    } else {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = file.name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      App.toast('Imagen descargada');
    }
  }

  /* ══════════════ props ══════════════ */
  function aplicarProp(cambio) {
    if (sel >= 0 && annos[sel]) {
      pushHist(snap());
      Object.assign(annos[sel], cambio);
      guardarBorrador();
      render();
    }
    if ('color' in cambio) guardarDefaults({ color: cambio.color });
  }

  /* ══════════════ abrir / cerrar ══════════════ */
  async function abrir(fotoId) {
    foto = await DB.foto(fotoId);
    if (!foto) return;
    proyecto = await DB.proyecto(foto.proyectoId);
    annos = JSON.parse(JSON.stringify(foto.anotaciones || []));
    sel = -1; historia = []; futuro = [];

    // imagen de EDICIÓN = proxy 1600px (así las cotas coinciden en cualquier teléfono).
    // Si no hay proxy local, se baja el original de Drive y se regenera.
    origSesion = foto.blobOriginal || null;
    let proxyBlob = foto.proxy;
    if (!proxyBlob) {
      let orig = foto.blobOriginal;
      if (!orig && foto.driveOrigId && Drive.activo()) {
        App.toast('Bajando la foto de tu Drive…');
        try { orig = await Drive.descargar(foto.driveOrigId); } catch {}
      }
      if (orig) {
        origSesion = orig;
        proxyBlob = await DB.escalar(orig, 1600, 0.82);
        foto.proxy = proxyBlob;                       // cache local para próximas veces
        if (!foto.thumb) foto.thumb = await DB.escalar(orig, 480, 0.72);
        await DB.guardarFoto(foto);
      }
    }
    // si vino de Drive y no se pudo bajar el original, la miniatura no sirve para
    // editar (las cotas quedarían desalineadas): pedimos señal y salimos.
    if (!proxyBlob && (foto.anotaciones || []).length && foto.driveOrigId) {
      App.toast('Necesitás señal para abrir esta foto la primera vez (se baja de tu Drive)', 4200);
      return;
    }
    let fuente = proxyBlob || foto.thumb;
    if (!fuente && foto.driveFileId && Drive.activo()) {
      try { fuente = await Drive.descargar(foto.driveFileId); } catch {}
    }
    if (!fuente) { App.toast('No se pudo abrir la foto'); return; }

    if (imgURL) URL.revokeObjectURL(imgURL);
    imgURL = URL.createObjectURL(fuente);
    img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = imgURL; });
    W = img.naturalWidth; H = img.naturalHeight; base = Math.max(W, H);
    vista = { x: 0, y: 0, w: W, h: H };

    App.mostrar('scr-editor');
    render();
  }

  function cerrar() {
    clearTimeout(lpTimer);
    etiquetaArmada = null; arrastre = null; modo = null;
    if (imgURL) { URL.revokeObjectURL(imgURL); imgURL = ''; }
    svg().innerHTML = '';
    foto = null; img = null; annos = []; origSesion = null;
  }

  /* ══════════════ wiring ══════════════ */
  function init() {
    const st = stage();
    st.addEventListener('pointerdown', onDown);
    st.addEventListener('pointermove', onMove);
    st.addEventListener('pointerup', onUp);
    st.addEventListener('pointercancel', onUp);
    // al mantener presionado, iOS abre su menú de imagen (Copiar/Descargar/…):
    // lo bloqueamos para que el "mantener presionado" sea solo para mover la cajita
    st.addEventListener('contextmenu', e => e.preventDefault());

    document.querySelectorAll('.ed-tools .tool').forEach(b => {
      b.addEventListener('click', () => {
        document.querySelectorAll('.ed-tools .tool').forEach(x => x.classList.remove('activo'));
        b.classList.add('activo');
        ultimaTool = b.dataset.tool;
        agregar(b.dataset.tool);
      });
    });

    document.querySelectorAll('#ed-props .cdot').forEach(b =>
      b.addEventListener('click', () => aplicarProp({ color: b.dataset.color })));

    document.querySelectorAll('#ed-props .unidad').forEach(b =>
      b.addEventListener('click', () => {
        if (sel >= 0 && annos[sel] && annos[sel].t === 'cota') aplicarProp({ u: b.dataset.u });
        else { Ajustes.guardar({ unidad: b.dataset.u }); marcarProps(); }
      }));

    $('ed-txt-menos').addEventListener('click', () => {
      const a = sel >= 0 ? annos[sel] : null;
      const fs = Math.max(0.45, ((a ? a.fs : defaults().fs) || 1) / 1.25);
      if (a) aplicarProp({ fs }); else guardarDefaults({ fs });
    });
    $('ed-txt-mas').addEventListener('click', () => {
      const a = sel >= 0 ? annos[sel] : null;
      const fs = Math.min(3, ((a ? a.fs : defaults().fs) || 1) * 1.25);
      if (a) aplicarProp({ fs }); else guardarDefaults({ fs });
    });
    $('ed-grosor').addEventListener('click', () => {
      const pasos = [0.7, 1, 1.5, 2.2];
      const a = sel >= 0 ? annos[sel] : null;
      const actual = (a ? a.grosor : defaults().grosor) || 1;
      const idx = pasos.findIndex(p => Math.abs(p - actual) < 0.01);
      const grosor = pasos[(idx + 1) % pasos.length];
      if (a) aplicarProp({ grosor }); else guardarDefaults({ grosor });
    });

    $('ctx-rotar').addEventListener('click', rotarSel);
    $('ctx-eje').addEventListener('click', toggleEje);
    $('ed-undo').addEventListener('click', undo);
    $('ed-redo').addEventListener('click', redo);
    $('ed-borrar').addEventListener('click', () => {
      if (sel < 0) return;
      pushHist(snap());
      annos.splice(sel, 1);
      sel = -1;
      guardarBorrador();
      render();
    });
    $('ed-dup').addEventListener('click', () => {
      if (sel < 0) return;
      pushHist(snap());
      const copia = JSON.parse(JSON.stringify(annos[sel]));
      mover(copia, vista.w * 0.05, vista.w * 0.05);
      annos.push(copia);
      sel = annos.length - 1;
      guardarBorrador();
      render();
    });
    $('ed-guardar').addEventListener('click', guardar);
    $('ed-compartir').addEventListener('click', compartir);
    $('btn-ed-volver').addEventListener('click', () => {
      const pid = proyecto ? proyecto.id : null;
      foto.anotaciones = snap();
      DB.guardarFoto(foto).then(() => {
        cerrar();
        if (pid) App.abrirProyecto(pid); else App.mostrar('scr-home');
      });
    });

    window.addEventListener('resize', () => {
      if (foto) render();
    });
  }

  return { init, abrir };
})();
