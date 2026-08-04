/* Cotas Venue · gauth.js — "Entrar con Google" (Google Identity Services).
   Login del lado del navegador: cada usuario obtiene un token para acceder a
   SU propio Drive (scope drive.file = la app solo ve/gestiona lo que ella crea).
   No usa el "secreto del cliente". El token dura ~1h y se refresca en silencio
   mientras la sesión de Google del usuario siga activa. */
'use strict';

const GAuth = (() => {
  const SCOPES = 'openid email profile https://www.googleapis.com/auth/drive.file';
  let tokenClient = null;
  let accessToken = null;
  let expiraEn = 0;
  let usuario = null;              // { email, name, picture }
  const listeners = [];

  function configurado() {
    return CV_CONFIG.googleClientId && !CV_CONFIG.googleClientId.startsWith('PEGA');
  }

  function cargarGIS() {
    return new Promise((res, rej) => {
      if (window.google && google.accounts && google.accounts.oauth2) return res();
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.async = true; s.defer = true;
      s.onload = () => res();
      s.onerror = () => rej(new Error('No se pudo cargar Google Sign-In'));
      document.head.appendChild(s);
    });
  }

  async function init() {
    if (!configurado()) return;
    // recuperamos la SESIÓN guardada (usuario + token) para no tener que iniciar
    // sesión en cada apertura. Clave en el celu/instalada: ahí Safari bloquea el
    // refresco silencioso de Google, así que sin token guardado siempre pediría
    // login. También sobrevive a las recargas de la auto-actualización.
    try {
      const g = JSON.parse(localStorage.getItem('cv-usuario'));
      if (g) usuario = g;
    } catch {}
    try {
      const s = JSON.parse(localStorage.getItem('cv-token'));
      if (s && s.token && s.exp && Date.now() < s.exp) {
        accessToken = s.token;
        expiraEn = s.exp;
      }
    } catch {}
    try {
      await cargarGIS();
      tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CV_CONFIG.googleClientId,
        scope: SCOPES,
        callback: () => {}   // se reemplaza en cada pedido
      });
      // si no hay token válido guardado, probamos uno silencioso (anda en la web;
      // en el celu suele fallar y ahí el usuario toca "Entrar" una vez).
      if (!estaLogueado()) { try { await pedirToken(false); } catch {} }
    } catch {
      // sin red / Google no disponible: seguimos con lo guardado (o modo local)
    }
    notificar();
  }

  /* interactivo=true abre el popup de Google (debe salir de un clic del usuario) */
  function pedirToken(interactivo) {
    return new Promise((res, rej) => {
      if (!tokenClient) return rej(new Error('Google no está listo'));
      tokenClient.callback = async (resp) => {
        if (resp && resp.error) return rej(new Error(resp.error));
        accessToken = resp.access_token;
        expiraEn = Date.now() + ((resp.expires_in || 3600) - 90) * 1000;
        try { localStorage.setItem('cv-token', JSON.stringify({ token: accessToken, exp: expiraEn })); } catch {}
        await obtenerUsuario();
        notificar();
        res(accessToken);
      };
      try {
        tokenClient.requestAccessToken({ prompt: interactivo ? '' : 'none' });
      } catch (e) { rej(e); }
    });
  }

  async function obtenerUsuario() {
    try {
      const r = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: 'Bearer ' + accessToken }
      });
      if (r.ok) {
        const j = await r.json();
        usuario = { email: j.email, name: j.name || j.email, picture: j.picture || '' };
        localStorage.setItem('cv-usuario', JSON.stringify(usuario));
      }
    } catch {}
  }

  /* devuelve un token válido; refresca en silencio si venció */
  async function token() {
    if (accessToken && Date.now() < expiraEn) return accessToken;
    return pedirToken(false);
  }

  function entrar() { return pedirToken(true); }

  function salir() {
    if (accessToken && window.google && google.accounts.oauth2) {
      try { google.accounts.oauth2.revoke(accessToken, () => {}); } catch {}
    }
    accessToken = null; expiraEn = 0; usuario = null;
    localStorage.removeItem('cv-usuario');
    localStorage.removeItem('cv-token');
    notificar();
  }

  const estaLogueado = () => !!accessToken && Date.now() < expiraEn;
  const getUsuario = () => usuario;
  const alCambiar = (fn) => listeners.push(fn);
  function notificar() { listeners.forEach(f => { try { f(); } catch {} }); }

  return { init, entrar, salir, token, estaLogueado, getUsuario, alCambiar, configurado };
})();
