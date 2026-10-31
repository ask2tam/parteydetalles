/* boda-api.js — Capa de red ÚNICA (portada + RSVP + tarjeta) sobre Supabase.
 * Mantiene la interfaz anterior (BODA.invitado, BODA.leer, BODA.post...) para que index.html no cambie.
 * Sin librerías: llama a las funciones RPC de Supabase con fetch (rápido, sin arranque en frío).
 * Cargar en el <head>, SIN defer, antes que cualquier otro script que lo use.
 */
(function () {
  'use strict';
  if (window.BODA) return;

  /* ======================= CONFIGURACIÓN ======================= */
  var SUPABASE_URL = 'https://wpnhiwiqlhzbykqecjkw.supabase.co';   // Supabase > Project Settings > API > Project URL
  var SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indwbmhpd2lxbGh6YnlrcWVjamt3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM0MjY2NTEsImV4cCI6MjEwOTAwMjY1MX0.j8plQ_bVg-cmYcHUgQ03sNtR-ld-Y7udwElKwevJ2VA';                       // Supabase > Project Settings > API > anon public (es pública: la protege RLS)
  var TIMEOUTS = [6000, 9000, 12000];                      // ms por intento
  var ESPERAS  = [800, 1600, 3000];                        // ms antes de cada reintento
  /* ============================================================= */

  window.BODA_CFG = { url: SUPABASE_URL, anon: SUPABASE_ANON };

  function esperar(ms) { return new Promise(function (ok) { setTimeout(ok, ms); }); }

  /* ¿Hay una sesión del equipo (panel) en este navegador? Entonces no se cuentan sus vistas. */
  function esStaff() {
    try { for (var i = 0; i < localStorage.length; i++) if (/^sb-.*-auth-token$/.test(localStorage.key(i))) return true; } catch (e) {}
    return false;
  }

  function rpc(fn, args, ms) {
    var ctl = ('AbortController' in window) ? new AbortController() : null, t;
    var red = fetch(SUPABASE_URL + '/rest/v1/rpc/' + fn, {
      method: 'POST', cache: 'no-store', signal: ctl ? ctl.signal : undefined,
      headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON, Authorization: 'Bearer ' + SUPABASE_ANON },
      body: JSON.stringify(args || {})
    }).then(function (r) {
      return r.json().catch(function () { return null; }).then(function (j) {
        if (!r.ok) throw new Error('HTTP ' + r.status + (j && j.message ? ': ' + j.message : ''));
        return j;
      });
    });
    var limite = new Promise(function (ok, ko) { t = setTimeout(function () { if (ctl) ctl.abort(); ko(new Error('timeout ' + ms + ' ms')); }, ms); });
    return Promise.race([red, limite]).then(function (v) { clearTimeout(t); return v; }, function (e) { clearTimeout(t); throw e; });
  }

  /* Normaliza la ficha del servidor y mantiene los campos que usa index.html */
  var ETIQUETA = { si: 'S\u00ed, asistir\u00e9', no: 'No podr\u00e9 asistir' };
  function ficha(g) {
    if (!g) return g;
    return {
      nombre: g.nombre || '', tratamiento: g.tratamiento || '', codigo: g.codigo || '',
      asistenciaCodigo: g.asistencia || '', asistencia: ETIQUETA[g.asistencia] || '',
      pases: g.pases || 1, pasesConfirmados: g.pasesConfirmados == null ? null : g.pasesConfirmados,
      mensaje: g.mensaje || '', respuestaNovios: g.respuestaNovios || '', mesa: g.mesa || '',
      primera: g.primera || '', ultima: g.ultima || '', ediciones: g.ediciones || 0
    };
  }
  var rsvpEstado = null;
  function adaptar(j) {
    if (!j || typeof j !== 'object') throw new Error('respuesta inv\u00e1lida');
    if (j.rsvp) rsvpEstado = j.rsvp;
    if (j.invitado) j.invitado = ficha(j.invitado);
    return j;
  }

  /* params (compatibles con la versión Apps Script):
       { to: COD } | { action: 'codigo', c: COD } → rsvp_obtener
       { action: 'buscar', q: 'Nombre' }          → rsvp_buscar
       { ping: 1 }                                → rsvp_publico                                  */
  function llamada(params) {
    if (params.action === 'buscar') return { fn: 'rsvp_buscar', args: { p_nombre: params.q || '' } };
    if (params.to || params.action === 'codigo') return { fn: 'rsvp_obtener', args: { p_codigo: params.to || params.c || '', p_registrar: !esStaff() && params.registrar !== false } };
    return { fn: 'rsvp_publico', args: {} };
  }

  /* Lectura con reintentos. opc: { intentos (reintentos extra, por defecto 2), alReintentar(i, total) } */
  function leer(params, opc) {
    opc = opc || {};
    var reintentos = opc.intentos == null ? 2 : opc.intentos, l = llamada(params || {});
    function intentar(i) {
      return rpc(l.fn, l.args, TIMEOUTS[Math.min(i, TIMEOUTS.length - 1)]).then(adaptar).catch(function (err) {
        console.warn('[BODA] Lectura fallida (intento ' + (i + 1) + ' de ' + (reintentos + 1) + '):', err.message);
        if (i >= reintentos) throw err;
        if (opc.alReintentar) opc.alReintentar(i + 1, reintentos);
        return esperar(ESPERAS[Math.min(i, ESPERAS.length - 1)]).then(function () { return intentar(i + 1); });
      });
    }
    return intentar(0);
  }

  /* Lectura del invitado COMPARTIDA (portada y RSVP usan la misma petición; la vista se cuenta una vez) */
  var cache = {};
  function invitado(codigo, opc) {
    if (!codigo) return Promise.reject(new Error('sin_codigo'));
    if (!cache[codigo]) {
      var o = {}; Object.keys(opc || {}).forEach(function (k) { o[k] = opc[k]; });
      var cb = o.alReintentar;
      o.alReintentar = function (i, t) { if (cb) cb(i, t); try { window.dispatchEvent(new CustomEvent('boda:reintento', { detail: { i: i, total: t } })); } catch (e) {} };
      cache[codigo] = leer({ to: codigo }, o);
      cache[codigo].catch(function () { delete cache[codigo]; });
    }
    return cache[codigo];
  }

  /* Guardar. cuerpo: { action:'guardar', modo, codigo, nombre, asistencia: 'si'|'no', pasesConfirmados, mensaje, pases } */
  function post(cuerpo, ms) {
    var a = String(cuerpo.asistencia || '');
    if (a.indexOf('S') === 0) a = 'si'; else if (a.indexOf('No') === 0) a = 'no';   // compatibilidad con las etiquetas antiguas
    var p = { modo: cuerpo.modo, codigo: cuerpo.codigo || '', nombre: cuerpo.nombre || '', asistencia: a,
              pases_confirmados: cuerpo.pasesConfirmados, mensaje: cuerpo.mensaje || '', pases: cuerpo.pases };
    return rpc('rsvp_guardar', { p: p }, ms || 15000).then(adaptar).then(function (r) {
      if (r.ok && r.invitado && r.invitado.codigo) cache[r.invitado.codigo] = Promise.resolve({ ok: true, encontrado: true, invitado: r.invitado, rsvp: rsvpEstado });
      return r;
    });
  }

  function estadoRsvp() { return rsvpEstado ? Promise.resolve(rsvpEstado) : leer({ ping: 1 }, { intentos: 1 }).then(function () { return rsvpEstado; }); }

  window.BODA = {
    api: SUPABASE_URL, leer: leer, invitado: invitado, post: post,
    postCiego: post,                        // compatibilidad: con Supabase la respuesta siempre es legible
    despertar: function () { estadoRsvp().catch(function () {}); },
    esperar: esperar, esStaff: esStaff, rsvp: estadoRsvp, rpc: rpc
  };
})();
