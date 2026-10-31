/* boda-staff.js — Modo recepción / seguridad.
 * El QR de la tarjeta lleva a la invitación (…?to=CODIGO). Para el invitado es la invitación normal.
 * Si quien lo escanea tiene sesión del equipo (inició sesión en /panel en este mismo navegador),
 * aparece encima una ficha con nombre, pases confirmados, mesa y el registro de ingreso.
 * Sin sesión no carga nada extra (ni siquiera la librería de Supabase).
 */
(function () {
  'use strict';
  var COD = (new URLSearchParams(location.search).get('to') || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  var CFG = window.BODA_CFG;
  if (!COD || !CFG || !window.BODA || !window.BODA.esStaff()) return;

  function cargarLib() {
    if (window.supabase) return Promise.resolve();
    return new Promise(function (ok, ko) {
      var s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
      s.onload = ok; s.onerror = ko; document.head.appendChild(s);
    });
  }
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  cargarLib().then(function () {
    var sb = window.supabase.createClient(CFG.url, CFG.anon);
    return sb.auth.getSession().then(function (r) {
      if (!r.data || !r.data.session) return;
      return sb.rpc('staff_ficha', { p_codigo: COD }).then(function (res) {
        if (res.error || !res.data || !res.data.ok) return;
        mostrar(sb, res.data);
      });
    });
  }).catch(function (e) { console.warn('[staff]', e); });

  function mostrar(sb, d) {
    var host = document.createElement('div');
    host.style.cssText = 'position:fixed!important;inset:0!important;z-index:2147483600!important;display:block!important';
    document.body.appendChild(host);
    var root = host.attachShadow ? host.attachShadow({ mode: 'open' }) : host;
    var g = d.invitado || {}, ingresos = g.ingresoPases || 0;
    var asignados = g.pases || 1, confirmados = g.asistencia === 'si' ? (g.pasesConfirmados || asignados) : 0;
    var estado = !d.encontrado ? ['C\u00f3digo no encontrado', '#b3402f'] : g.asistencia === 'si' ? ['Confirmado', '#3f7a46'] : g.asistencia === 'no' ? ['No asistir\u00e1', '#b3402f'] : ['Sin confirmar', '#a16207'];
    var nombre = d.encontrado ? (g.tratamiento && g.nombre.toLowerCase().indexOf(g.tratamiento.toLowerCase()) !== 0 ? g.tratamiento + ' ' : '') + g.nombre : COD;
    root.innerHTML = '<style>' +
      '*{box-sizing:border-box}.fondo{position:absolute;inset:0;background:rgba(20,16,12,.72);display:grid;place-items:center;padding:16px;font:15px/1.4 system-ui,-apple-system,"Segoe UI",sans-serif;color:#1c1c1c}' +
      '.ficha{width:100%;max-width:380px;background:#fff;border-radius:20px;padding:22px;box-shadow:0 20px 50px rgba(0,0,0,.35)}' +
      '.rol{font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#7a7066;margin:0 0 10px}.nom{font-size:22px;font-weight:700;margin:0}' +
      '.chip{display:inline-block;margin-top:8px;padding:4px 10px;border-radius:999px;color:#fff;font-size:12px;font-weight:600}' +
      '.datos{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:18px 0}.dato{background:#f7f3ee;border-radius:14px;padding:12px}.dato b{display:block;font-size:26px}.dato span{font-size:12px;color:#7a7066}' +
      '.ing{display:flex;align-items:center;justify-content:space-between;gap:10px;background:#f7f3ee;border-radius:14px;padding:10px 12px}' +
      '.ing button{width:44px;height:44px;border-radius:50%;border:1.5px solid #a3825c;background:#fff;font-size:22px;color:#a3825c;cursor:pointer}' +
      '.ing output{font-size:24px;font-weight:700;min-width:70px;text-align:center}.acc{display:grid;gap:8px;margin-top:14px}' +
      '.btn{height:46px;border-radius:999px;border:0;font-weight:700;font-size:14px;cursor:pointer}.p{background:#b9966f;color:#fff}.s{background:#fff;border:1.5px solid #ccc;color:#333}' +
      '.msg{min-height:1.3em;margin:10px 0 0;text-align:center;font-size:13px;color:#3f7a46}.nota{font-size:12px;color:#7a7066;margin:8px 0 0}</style>' +
      '<div class="fondo"><div class="ficha" role="dialog" aria-modal="true" aria-label="Ficha de recepci\u00f3n">' +
      '<p class="rol">Modo recepci\u00f3n \u00b7 ' + esc(d.rol || '') + '</p>' +
      '<p class="nom">' + esc(nombre) + '</p>' +
      '<span class="chip" style="background:' + estado[1] + '">' + estado[0] + '</span>' +
      (d.encontrado ? '<div class="datos"><div class="dato"><b>' + confirmados + '<small style="font-size:14px;color:#7a7066"> / ' + asignados + '</small></b><span>Pases confirmados / asignados</span></div>' +
        '<div class="dato"><b>' + esc(g.mesa || '\u2014') + '</b><span>Mesa</span></div></div>' +
        '<div class="ing"><button type="button" id="menos" aria-label="Uno menos">\u2212</button><div style="text-align:center"><output id="n">' + ingresos + '</output><div style="font-size:12px;color:#7a7066">ingresaron</div></div><button type="button" id="mas" aria-label="Uno m\u00e1s">+</button></div>' +
        '<p class="nota" id="nota">' + (g.ingresoFecha ? '\u00daltimo registro: ' + new Date(g.ingresoFecha).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }) : 'A\u00fan no registra ingreso.') + '</p>' +
        '<div class="acc"><button type="button" class="btn p" id="guardar">Registrar ingreso</button><button type="button" class="btn s" id="cerrar">Ver invitaci\u00f3n</button></div>'
        : '<div class="acc"><button type="button" class="btn s" id="cerrar">Cerrar</button></div>') +
      '<p class="msg" id="msg" role="status" aria-live="polite"></p></div></div>';
    var $ = function (id) { return root.getElementById ? root.getElementById(id) : root.querySelector('#' + id); };
    var n = ingresos;
    function pintar() { $('n').textContent = n; }
    if (d.encontrado) {
      $('menos').addEventListener('click', function () { n = Math.max(0, n - 1); pintar(); });
      $('mas').addEventListener('click', function () { n = Math.min(asignados, n + 1); pintar(); });
      if (!n && confirmados) { n = confirmados; pintar(); }
      $('guardar').addEventListener('click', function () {
        $('guardar').disabled = true; $('msg').textContent = 'Guardando\u2026';
        sb.rpc('staff_ingreso', { p_codigo: COD, p_pases: n }).then(function (r) {
          $('guardar').disabled = false;
          if (r.error || !r.data || !r.data.ok) { $('msg').style.color = '#b3402f'; $('msg').textContent = 'No se pudo registrar.'; return; }
          $('msg').style.color = '#3f7a46'; $('msg').textContent = 'Ingreso registrado: ' + n + ' de ' + asignados + '.';
          $('nota').textContent = '\u00daltimo registro: ' + new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
        });
      });
    }
    $('cerrar').addEventListener('click', function () { host.remove(); });
  }
})();
