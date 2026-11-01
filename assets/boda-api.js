/* boda-api.js — Capa de red del invitado (portada, RSVP y tarjeta) sobre Supabase.
 * Requiere assets/pyd-config.js antes. Mantiene la interfaz anterior (BODA.invitado, BODA.leer, BODA.post…).
 * Sin librerías: llama a las funciones RPC con fetch. Cargar en el <head>, SIN defer. */
(function () {
  'use strict';
  if (window.BODA) return;
  var P = window.PYD || {};
  var TIMEOUTS = [6000, 9000, 12000], ESPERAS = [800, 1600, 3000];
  window.BODA_CFG = { url: P.SUPABASE_URL, anon: P.SUPABASE_ANON };

  function esperar(ms) { return new Promise(function (ok) { setTimeout(ok, ms); }); }

  function rpc(fn, args, ms) {
    var ctl = ('AbortController' in window) ? new AbortController() : null, t;
    var red = fetch(P.SUPABASE_URL + '/rest/v1/rpc/' + fn, {
      method: 'POST', cache: 'no-store', signal: ctl ? ctl.signal : undefined,
      headers: { 'Content-Type': 'application/json', apikey: P.SUPABASE_ANON, Authorization: 'Bearer ' + P.SUPABASE_ANON },
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

  var ETIQUETA = { si: 'S\u00ed, asistir\u00e9', no: 'No podr\u00e9 asistir' };
  function ficha(g) {
    if (!g) return g;
    return {
      nombre: g.nombre || '', tratamiento: g.tratamiento || '', codigo: g.codigo || '',
      asistenciaCodigo: g.asistencia || '', asistencia: ETIQUETA[g.asistencia] || '',
      pases: g.pases || 1, pasesConfirmados: g.pasesConfirmados == null ? null : g.pasesConfirmados,
      acompanantes: g.acompanantes || '', respuestas: g.respuestas || {},
      mensaje: g.mensaje || '', respuestaNovios: g.respuestaNovios || '', mesa: g.mesa || '',
      primera: g.primera || '', ultima: g.ultima || '', ediciones: g.ediciones || 0
    };
  }
  var proyecto = null, esperandoProyecto = [];
  function adaptar(j) {
    if (!j || typeof j !== 'object') throw new Error('respuesta inv\u00e1lida');
    if (j.ok === false && j.error === 'proyecto') { var e = new Error('proyecto'); e.codigo = 'proyecto'; throw e; }
    if (j.proyecto) { proyecto = j.proyecto; esperandoProyecto.splice(0).forEach(function (f) { f(proyecto); }); }
    if (j.invitado) j.invitado = ficha(j.invitado);
    j.rsvp = proyecto;   // compatibilidad con código anterior
    return j;
  }

  function llamada(params) {
    if (params.action === 'buscar') return { fn: 'rsvp_buscar', args: { p_proyecto: P.slug, p_nombre: params.q || '' } };
    if (params.to || params.action === 'codigo')
      return { fn: 'rsvp_obtener', args: { p_proyecto: P.slug, p_codigo: params.to || params.c || '', p_registrar: !P.haySesion() && params.registrar !== false } };
    return { fn: 'rsvp_publico', args: { p_proyecto: P.slug } };
  }

  function leer(params, opc) {
    opc = opc || {};
    var reintentos = opc.intentos == null ? 2 : opc.intentos, l = llamada(params || {});
    function intentar(i) {
      return rpc(l.fn, l.args, TIMEOUTS[Math.min(i, TIMEOUTS.length - 1)]).then(adaptar).catch(function (err) {
        if (err.codigo === 'proyecto') throw err;
        console.warn('[BODA] Lectura fallida (intento ' + (i + 1) + ' de ' + (reintentos + 1) + '):', err.message);
        if (i >= reintentos) throw err;
        if (opc.alReintentar) opc.alReintentar(i + 1, reintentos);
        return esperar(ESPERAS[Math.min(i, ESPERAS.length - 1)]).then(function () { return intentar(i + 1); });
      });
    }
    return intentar(0);
  }

  /* Lectura del invitado COMPARTIDA: portada y RSVP usan la misma petición (la vista se cuenta una vez) */
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

  /* cuerpo: { modo, codigo, nombre, asistencia: 'si'|'no', pasesConfirmados, acompanantes, respuestas, mensaje, pases } */
  function post(cuerpo, ms) {
    var a = String(cuerpo.asistencia || '');
    if (a.indexOf('S') === 0) a = 'si'; else if (a.indexOf('No') === 0) a = 'no';
    var p = { modo: cuerpo.modo, codigo: cuerpo.codigo || '', nombre: cuerpo.nombre || '', asistencia: a,
              pases_confirmados: cuerpo.pasesConfirmados, acompanantes: cuerpo.acompanantes || '',
              respuestas: cuerpo.respuestas || {}, mensaje: cuerpo.mensaje || '', pases: cuerpo.pases };
    return rpc('rsvp_guardar', { p_proyecto: P.slug, p: p }, ms || 15000).then(adaptar).then(function (r) {
      if (r.ok && r.invitado && r.invitado.codigo)
        cache[r.invitado.codigo] = Promise.resolve({ ok: true, encontrado: true, invitado: r.invitado, proyecto: proyecto, rsvp: proyecto });
      return r;
    });
  }

  /* Configuración pública del proyecto (formulario, tarjeta, fechas). Reutiliza la lectura del invitado si ya hubo. */
  var pidiendo = null;
  function obtenerProyecto() {
    if (proyecto) return Promise.resolve(proyecto);
    if (!pidiendo) { pidiendo = leer({ ping: 1 }, { intentos: 1 }).then(function () { return proyecto; }); pidiendo.catch(function () { pidiendo = null; }); }
    return pidiendo;
  }
  function alProyecto(f) { if (proyecto) f(proyecto); else esperandoProyecto.push(f); }

  window.BODA = {
    api: P.SUPABASE_URL, slug: P.slug, leer: leer, invitado: invitado, post: post, postCiego: post,
    proyecto: obtenerProyecto, alProyecto: alProyecto, rsvp: obtenerProyecto,
    despertar: function () { obtenerProyecto().catch(function () {}); },
    esperar: esperar, esStaff: P.haySesion, rpc: rpc
  };
})();
