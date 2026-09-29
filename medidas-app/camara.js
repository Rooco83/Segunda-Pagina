/* Cotas Venue · camara.js — usa la cámara NATIVA del teléfono.
   Al tocar "Sacar foto" abrimos la app de cámara propia del celular (con todas
   sus opciones y su calidad real). La persona saca la foto y vuelve entera a la
   app —sin recortes— para marcarle las cotas. */
'use strict';

const Camara = (() => {
  let proyectoId = null;
  const $ = id => document.getElementById(id);

  function abrir(pid) {
    proyectoId = pid;
    const input = $('input-captura');
    input.onchange = async () => {
      if (input.files && input.files[0]) {
        await App.agregarFotos(proyectoId, [input.files[0]], true);
      }
      input.value = '';
    };
    input.click();
  }

  function init() { /* nada que preparar: la cámara es la del teléfono */ }
  function cerrar() { }

  return { init, abrir, cerrar };
})();
