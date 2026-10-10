/* boda-api.js - Capa de red UNICA para Ylene & Jhonatan (portada + RSVP).
 * - Una sola URL del Web App de Apps Script (antes estaba en el landing y en rsvp.js).
 * - Una sola implementacion de lectura robusta (antes habia dos: leerInvitado y apiGet).
 * - La lectura del invitado por codigo se hace UNA vez y la comparten la portada y el RSVP.
 * Cargar en el <head>, SIN defer, antes que cualquier otro script que lo use.
 * Si usas rsvp.html por separado, incluye tambien este archivo antes de rsvp.js.
 */
(function () {
  'use strict';
  if (window.BODA) return;

  /* ======================= CONFIGURACION ======================= */
  var API = 'https://script.google.com/macros/s/AKfycbzvYouV1UMe3l8JRGDKPkP2RxVaI79ZqGixOs6-PssPmxfYNs714tjV0xYfBtjUr93q/exec';  // <-- UNICO lugar (termina en /exec)
  var TIMEOUTS = [6000, 9000, 12000, 15000];   // ms por intento: crecen porque el 1er intento suele "despertar" a Google
  var ESPERAS  = [1500, 2500, 4000, 4000];     // ms de espera antes de cada reintento (backoff)
  /* ============================================================= */

  function esperar(ms) { return new Promise(function (ok) { setTimeout(ok, ms); }); }
  function qs(o) { return new URLSearchParams(o).toString(); }
  function copia(o) { var r = {}; Object.keys(o || {}).forEach(function (k) { r[k] = o[k]; }); return r; }

  // JSONP (sin CORS; funciona incluso desde file://). Si la respuesta llega tarde, el callback queda como no-op (sin errores en consola).
  function jsonp(params, ms) {
    return new Promise(function (ok, ko) {
      var cb = '__boda_' + Date.now() + '_' + Math.floor(Math.random() * 1e6), s = document.createElement('script'), t, vivo = true;
      function fin() { vivo = false; clearTimeout(t); window[cb] = function () { try { delete window[cb]; } catch (e) {} }; if (s.parentNode) s.parentNode.removeChild(s); }
      window[cb] = function (d) { if (!vivo) return; fin(); ok(d); };
      s.onerror = function () { if (!vivo) return; fin(); ko(new Error('red (posible arranque en frio de Google)')); };
      t = setTimeout(function () { fin(); ko(new Error('timeout ' + ms + ' ms')); }, ms);
      var p = copia(params); p.callback = cb;
      s.src = API + '?' + qs(p);
      (document.head || document.documentElement).appendChild(s);
    });
  }

  // fetch con timeout REAL (AbortController cancela la peticion; antes el timer no abortaba nada)
  function fetchJson(params, ms) {
    var ctl = ('AbortController' in window) ? new AbortController() : null, t;
    var red = fetch(API + '?' + qs(params), { cache: 'no-store', signal: ctl ? ctl.signal : undefined }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status + ' (posible arranque en frio de Google)');
      return r.json();
    });
    var limite = new Promise(function (ok, ko) { t = setTimeout(function () { if (ctl) ctl.abort(); ko(new Error('timeout ' + ms + ' ms')); }, ms); });
    return Promise.race([red, limite]).then(function (v) { clearTimeout(t); return v; }, function (e) { clearTimeout(t); throw e; });
  }

  /* Lectura robusta: alterna fetch (pares) y JSONP (impares), timeouts crecientes y backoff.
     opc: { intentos (reintentos extra, por defecto 3), alReintentar(i, total) } */
  function leer(params, opc) {
    opc = opc || {};
    if (!API) return Promise.reject(new Error('sin_api'));
    var reintentos = opc.intentos == null ? 3 : opc.intentos;
    function intentar(i) {
      var ms = TIMEOUTS[Math.min(i, TIMEOUTS.length - 1)];
      var p = (i % 2 === 0) ? fetchJson(params, ms) : jsonp(params, ms);
      return p.then(function (r) {
        if (!r || typeof r !== 'object' || r.ok === false) throw new Error('respuesta invalida' + (r && r.detalle ? ': ' + r.detalle : ''));
        return r;
      }).catch(function (err) {
        console.warn('[BODA] Lectura fallida (intento ' + (i + 1) + ' de ' + (reintentos + 1) + '):', err.message);
        if (i >= reintentos) throw err;
        if (opc.alReintentar) opc.alReintentar(i + 1, reintentos);
        return esperar(ESPERAS[Math.min(i, ESPERAS.length - 1)]).then(function () { return intentar(i + 1); });
      });
    }
    return intentar(0);
  }

  /* Lectura del invitado por codigo, COMPARTIDA: la primera llamada (portada) dispara la peticion;
     el RSVP recibe la misma promesa en vez de lanzar otra. Si falla, se olvida para poder reintentar. */
  var cache = {};
  function invitado(codigo, opc) {
    if (!codigo) return Promise.reject(new Error('sin_codigo'));
    if (!cache[codigo]) {
      /* Avisa cada reintento por evento: asi el RSVP muestra "reintento i de n" aunque la peticion la haya lanzado la portada */
      var o = copia(opc); var cb = o.alReintentar;
      o.alReintentar = function (i, t) { if (cb) cb(i, t); try { window.dispatchEvent(new CustomEvent('boda:reintento', { detail: { i: i, total: t } })); } catch (e) {} };
      cache[codigo] = leer({ to: codigo }, o);
      cache[codigo].catch(function () { delete cache[codigo]; });
    }
    return cache[codigo];
  }

  // POST legible (text/plain evita el preflight CORS que Apps Script no responde)
  function post(cuerpo, ms) {
    if (!API) return Promise.reject(new Error('sin_api'));
    var ctl = ('AbortController' in window) ? new AbortController() : null, t;
    var red = fetch(API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(cuerpo),
                           signal: ctl ? ctl.signal : undefined }).then(function (r) { return r.json(); });
    var limite = new Promise(function (ok, ko) { t = setTimeout(function () { if (ctl) ctl.abort(); ko(new Error('timeout ' + ms + ' ms')); }, ms || 25000); });
    return Promise.race([red, limite]).then(function (v) { clearTimeout(t); return v; }, function (e) { clearTimeout(t); throw e; });
  }
  // POST "a ciegas" (no-cors): llega al servidor pero no se puede leer la respuesta
  function postCiego(cuerpo) {
    return fetch(API, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(cuerpo) });
  }

  /* Calentamiento: si el invitado NO trae codigo, nadie llama al servidor hasta que envie el formulario
     (y ahi pagaria el arranque en frio). Un GET ligero al cargar deja la instancia despierta. */
  var despierto = false;
  function despertar() {
    if (despierto || !API) return; despierto = true;
    try { fetch(API + '?' + qs({ ping: 1 }), { mode: 'no-cors', cache: 'no-store' }).catch(function () {}); } catch (e) {}
  }

  window.BODA = { api: API, leer: leer, invitado: invitado, post: post, postCiego: postCiego, despertar: despertar, esperar: esperar };
})();
