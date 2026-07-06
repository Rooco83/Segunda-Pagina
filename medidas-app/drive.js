/* Cotas Venue · drive.js — ajustes + cola de subida al backend de Apps Script */
'use strict';

const Ajustes = {
  leer() {
    try { return JSON.parse(localStorage.getItem('cv-ajustes')) || {}; }
    catch { return {}; }
  },
  guardar(cambios) {
    const a = Object.assign(this.leer(), cambios);
    localStorage.setItem('cv-ajustes', JSON.stringify(a));
    return a;
  },
  get url()      { return (this.leer().url || '').trim(); },
  get unidad()   { return this.leer().unidad || 'm'; },
  get calidad()  { return parseFloat(this.leer().calidad || '0.92'); },
  get marca()    { return !!this.leer().marca; }
};

const Drive = (() => {
  let subiendo = false;

  function blobABase64(blob) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result.split(',')[1]);
      r.onerror = () => rej(r.error);
      r.readAsDataURL(blob);
    });
  }

  /* POST como text/plain: evita el preflight CORS con Apps Script */
  async function llamar(datos) {
    const url = Ajustes.url;
    if (!url) throw new Error('sin-backend');
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(datos),
      redirect: 'follow'
    });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const json = await resp.json();
    if (!json.ok) throw new Error(json.error || 'error del backend');
    return json;
  }

  async function probar() {
    return llamar({ accion: 'ping' });
  }

  async function subirFoto(foto, nombreProyecto, numero) {
    const blob = foto.blobFinal || foto.blobOriginal;
    const base64 = await blobABase64(blob);
    const nombreArchivo = `${nombreProyecto} ${String(numero).padStart(3, '0')}.jpg`;
    return llamar({
      accion: 'subirFoto',
      proyecto: nombreProyecto,
      nombreArchivo,
      fotoId: foto.id,
      jpegBase64: base64
    });
  }

  /* Recorre las fotos pendientes y las sube una por una. */
  async function procesarCola(alTerminarUna) {
    if (subiendo || !Ajustes.url || !navigator.onLine) return;
    subiendo = true;
    try {
      const pendientes = await DB.fotosPendientes();
      for (const foto of pendientes) {
        const proyecto = await DB.proyecto(foto.proyectoId);
        if (!proyecto) continue;
        const hermanas = await DB.fotosDe(foto.proyectoId);
        const numero = hermanas.findIndex(f => f.id === foto.id) + 1;
        foto.estadoDrive = 'subiendo';
        await DB.guardarFoto(foto);
        if (alTerminarUna) alTerminarUna(foto);
        try {
          const r = await subirFoto(foto, proyecto.nombre, numero);
          foto.estadoDrive = 'subida';
          foto.driveUrl = r.url || '';
        } catch (e) {
          foto.estadoDrive = (e.message === 'sin-backend') ? 'local' : 'error';
        }
        await DB.guardarFoto(foto);
        if (alTerminarUna) alTerminarUna(foto);
      }
    } finally {
      subiendo = false;
    }
  }

  return { probar, procesarCola };
})();

window.addEventListener('online', () => {
  Drive.procesarCola(window.App && App.alCambiarEstadoFoto);
});
