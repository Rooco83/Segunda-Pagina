/* Cotas Venue · camara.js — cámara pro con getUserMedia.
   Detecta las capacidades del dispositivo (zoom, linterna, exposición) y
   oculta los controles que no estén soportados. Si el navegador no da
   acceso a la cámara, cae al selector nativo (input capture). */
'use strict';

const Camara = (() => {
  let stream = null, track = null;
  let frontal = false;
  let timerOn = false, torchOn = false;
  let ev = 0, evPaso = 0.33, evMin = -2, evMax = 2;
  let nivelHandler = null;
  let proyectoId = null;
  let zoomCap = null, zoomActual = 1;        // pinch-to-zoom

  const $ = id => document.getElementById(id);

  async function abrir(pid) {
    proyectoId = pid;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      fallback();
      return;
    }
    App.mostrar('scr-cam');
    try {
      await iniciarStream();
    } catch (e) {
      cerrar();
      fallback();
    }
  }

  /* la cámara del navegador no anduvo: usamos la app de cámara del teléfono */
  function fallback() {
    const input = $('input-captura');
    input.onchange = async () => {
      if (input.files && input.files[0]) {
        await App.agregarFotos(proyectoId, [input.files[0]], true);
      }
      input.value = '';
    };
    input.click();
  }

  async function iniciarStream() {
    detenerStream();
    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: frontal ? 'user' : 'environment',
        width: { ideal: 4096 },
        height: { ideal: 3072 }
      },
      audio: false
    });
    track = stream.getVideoTracks()[0];
    $('cam-video').srcObject = stream;

    const st = track.getSettings();
    $('cam-res').textContent = st.width && st.height
      ? Math.round(st.width * st.height / 1e6) + ' MP'
      : 'HD';

    configurarControles();
  }

  function detenerStream() {
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      stream = null; track = null;
    }
  }

  /* ── capacidades del dispositivo ── */
  function configurarControles() {
    const caps = track.getCapabilities ? track.getCapabilities() : {};

    // zoom → pellizco con dos dedos (pinch), simple y como la cámara nativa
    if (caps.zoom && caps.zoom.max > caps.zoom.min) {
      zoomCap = caps.zoom;
      zoomActual = track.getSettings().zoom || caps.zoom.min;
    } else {
      zoomCap = null;
    }

    // linterna
    const bt = $('cam-torch');
    if (caps.torch) {
      bt.classList.remove('oculto');
      torchOn = false;
      bt.classList.remove('activo');
      bt.onclick = () => {
        torchOn = !torchOn;
        track.applyConstraints({ advanced: [{ torch: torchOn }] }).catch(() => {});
        bt.classList.toggle('activo', torchOn);
      };
    } else bt.classList.add('oculto');

    // compensación de exposición
    const ew = $('cam-ev-wrap');
    if (caps.exposureCompensation && caps.exposureCompensation.max > caps.exposureCompensation.min) {
      ew.classList.remove('oculto');
      evMin = caps.exposureCompensation.min;
      evMax = caps.exposureCompensation.max;
      evPaso = caps.exposureCompensation.step || 0.33;
      ev = track.getSettings().exposureCompensation || 0;
      pintarEV();
      $('cam-ev-mas').onclick = () => ajustarEV(+1);
      $('cam-ev-menos').onclick = () => ajustarEV(-1);
    } else ew.classList.add('oculto');
  }

  function ajustarEV(dir) {
    ev = Math.max(evMin, Math.min(evMax, ev + dir * evPaso));
    track.applyConstraints({ advanced: [{ exposureCompensation: ev }] }).catch(() => {});
    pintarEV();
  }
  function pintarEV() {
    $('cam-ev-val').textContent = (ev > 0 ? '+' : '') + ev.toFixed(1) + ' EV';
  }

  /* ── nivel de burbuja ── */
  function nivelOn() {
    const cont = $('cam-nivel');
    cont.classList.remove('oculto');
    nivelHandler = (e) => {
      // en vertical (retrato), gamma ≈ inclinación lateral del teléfono
      let roll = e.gamma || 0;
      if (Math.abs(e.beta) > 135) roll = -roll; // teléfono boca abajo
      const deg = Math.max(-45, Math.min(45, roll));
      $('cam-nivel-linea').style.transform = `rotate(${deg}deg)`;
      $('cam-nivel-deg').textContent = Math.abs(deg).toFixed(0) + '°';
      cont.classList.toggle('ok', Math.abs(deg) < 1.5);
    };
    window.addEventListener('deviceorientation', nivelHandler);
  }
  function nivelOff() {
    $('cam-nivel').classList.add('oculto');
    if (nivelHandler) window.removeEventListener('deviceorientation', nivelHandler);
    nivelHandler = null;
  }

  /* ── captura ── */
  async function capturar() {
    if (!track) return;
    if (timerOn) {
      const cu = $('cam-cuenta');
      for (let n = 3; n > 0; n--) {
        cu.textContent = n;
        cu.classList.remove('oculto');
        await new Promise(r => setTimeout(r, 1000));
      }
      cu.classList.add('oculto');
    }
    let blob = null;
    if (window.ImageCapture) {
      try {
        blob = await new ImageCapture(track).takePhoto();
      } catch { blob = null; }
    }
    if (!blob) {
      const v = $('cam-video');
      const cv = document.createElement('canvas');
      cv.width = v.videoWidth; cv.height = v.videoHeight;
      cv.getContext('2d').drawImage(v, 0, 0);
      blob = await new Promise(r => cv.toBlob(r, 'image/jpeg', 0.95));
    }
    if (blob) {
      cerrar();
      await App.agregarFotos(proyectoId, [blob], true);
    }
  }

  function cerrar() {
    detenerStream();
    nivelOff();
    zoomCap = null;
    $('cam-zoom-ind').classList.add('oculto');
  }

  /* ── pinch-to-zoom sobre el visor ── */
  const pinchPts = new Map();
  let pinchDist0 = 0, pinchZoom0 = 1, indTimer = null;

  function aplicarZoom(z) {
    if (!zoomCap || !track) return;
    zoomActual = Math.max(zoomCap.min, Math.min(zoomCap.max, z));
    track.applyConstraints({ advanced: [{ zoom: zoomActual }] }).catch(() => {});
    const ind = $('cam-zoom-ind');
    ind.textContent = zoomActual.toFixed(1) + '×';
    ind.classList.remove('oculto');
    clearTimeout(indTimer);
    indTimer = setTimeout(() => ind.classList.add('oculto'), 900);
  }
  function pinchDown(e) {
    pinchPts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinchPts.size === 2) {
      const [a, b] = [...pinchPts.values()];
      pinchDist0 = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      pinchZoom0 = zoomActual;
    }
  }
  function pinchMove(e) {
    if (!pinchPts.has(e.pointerId)) return;
    pinchPts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinchPts.size === 2 && zoomCap) {
      const [a, b] = [...pinchPts.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      aplicarZoom(pinchZoom0 * (d / pinchDist0));
    }
  }
  function pinchUp(e) { pinchPts.delete(e.pointerId); }

  function init() {
    $('cam-disparar').addEventListener('click', capturar);
    const sec = $('scr-cam');
    sec.addEventListener('pointerdown', pinchDown);
    sec.addEventListener('pointermove', pinchMove);
    sec.addEventListener('pointerup', pinchUp);
    sec.addEventListener('pointercancel', pinchUp);
    $('btn-cam-volver').addEventListener('click', () => {
      cerrar();
      App.abrirProyecto(proyectoId);
    });
    $('cam-flip').addEventListener('click', async () => {
      frontal = !frontal;
      try { await iniciarStream(); } catch {}
    });
    $('cam-timer').addEventListener('click', () => {
      timerOn = !timerOn;
      $('cam-timer').classList.toggle('activo', timerOn);
    });
    $('cam-gridbtn').addEventListener('click', () => {
      const g = $('cam-grilla');
      const visible = !g.classList.contains('oculto');
      g.classList.toggle('oculto', visible);
      $('cam-gridbtn').classList.toggle('activo', !visible);
    });
    $('cam-nivelbtn').addEventListener('click', async () => {
      if (nivelHandler) {
        nivelOff();
        $('cam-nivelbtn').classList.remove('activo');
        return;
      }
      // iOS pide permiso explícito para el giroscopio
      if (window.DeviceOrientationEvent && DeviceOrientationEvent.requestPermission) {
        try {
          const r = await DeviceOrientationEvent.requestPermission();
          if (r !== 'granted') return;
        } catch { return; }
      }
      nivelOn();
      $('cam-nivelbtn').classList.add('activo');
    });
  }

  return { init, abrir, cerrar };
})();
