/* pyd-config.js — Configuración ÚNICA compartida por todas las páginas (invitaciones, rsvp, staff, panel).
 * Cargar primero, SIN defer.
 *
 * Supabase › Project Settings › API Keys:
 *   SUPABASE_URL   → Project URL (https://xxxx.supabase.co)
 *   SUPABASE_ANON  → Publishable key (sb_publishable_…)  ·  también acepta la "anon" antigua (eyJ…)
 */
window.PYD = Object.assign({
  SUPABASE_URL: 'https://oydjnnbdwtbyufsqrqyh.supabase.co',
  SUPABASE_ANON: 'sb_publishable_ZmQvP46dCnxI0efhr4H1aA_X2S71GVF',
  WEB: 'https://www.parteydetalles.com/',
  INSTAGRAM: 'https://www.instagram.com/parteydetalles/',
  TIKTOK: 'https://www.tiktok.com/@parteydetalles',
  WHATSAPP: '51907954996',                            // sin "+" ni espacios
  VERSION_PANEL: 'v1.05'
}, window.PYD || {});

(function () {
  'use strict';
  var P = window.PYD;

  /* Raíz del sitio = carpeta que contiene /assets/ (funciona en dominio propio o en una subcarpeta,
     p. ej. usuario.github.io/repo/). panel.html y staff.html viven en esa raíz. */
  var src = (document.currentScript && document.currentScript.src) || '';
  P.RAIZ = src ? src.replace(/assets\/pyd-config\.js(\?.*)?$/, '') : location.origin + '/';
  P.STAFF_URL = P.STAFF_URL || P.RAIZ + 'staff.html';
  P.PANEL_URL = P.PANEL_URL || P.RAIZ + 'panel.html';

  /* Proyecto actual: ?p=slug  →  window.BODA_PROYECTO  →  carpeta donde está la página (/…/ignacioysuly/rsvp.html) */
  P.slug = (function () {
    var s = new URLSearchParams(location.search).get('p') || window.BODA_PROYECTO || '';
    if (!s) {
      var seg = location.pathname.split('/').filter(Boolean);
      if (seg.length && /\.[a-z0-9]+$/i.test(seg[seg.length - 1])) seg.pop();   // quita "rsvp.html" / "index.html"
      s = seg.length ? seg[seg.length - 1] : '';
    }
    return String(s).toLowerCase().replace(/[^a-z0-9-]/g, '');
  })();

  P.configurado = !/TU-PROYECTO|TU-PUBLISHABLE|TU-ANON/.test(P.SUPABASE_URL + P.SUPABASE_ANON);

  /* Cabeceras para llamar a Supabase sin librería. Las llaves nuevas (sb_publishable_…) NO son JWT:
     van solo en "apikey". La llave antigua (eyJ…) también se envía como Bearer. */
  P.cabeceras = function (token) {
    var h = { 'Content-Type': 'application/json', apikey: P.SUPABASE_ANON };
    if (token) h.Authorization = 'Bearer ' + token;
    else if (/^eyJ/.test(P.SUPABASE_ANON)) h.Authorization = 'Bearer ' + P.SUPABASE_ANON;
    return h;
  };

  /* ¿Este navegador tiene una sesión del equipo? (no cuenta vistas como invitado) */
  P.haySesion = function () {
    try { for (var i = 0; i < localStorage.length; i++) if (/^sb-.*-auth-token$/.test(localStorage.key(i))) return true; } catch (e) {}
    return false;
  };

  /* -------------------------------------------------------------------------------------
   * Crédito "Hecho con amor ♥ por Parte y Detalles"
   * P.credito({ modo, lang, oscuro, extra, contenedor })
   *   modo: 'flotante'  píldora fija abajo: aparece unos segundos, se oculta al bajar y vuelve al final de la página
   *         'discreto'  solo un corazón pequeño en la esquina; al tocarlo muestra el crédito
   *         'final'     una línea al final del contenido (estática)
   *         'oculto'    no se muestra
   *   contenedor: para 'final', dónde insertarlo (por defecto, el elemento [data-credito] o el final del body)
   * ------------------------------------------------------------------------------------- */
  var IC = {
    web: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
    ig: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".8"/>',
    tt: '<path d="M14 3v11.5a3.5 3.5 0 1 1-3.5-3.5"/><path d="M14 3c.5 2.8 2.4 4.6 5 5"/>',
    wa: '<path d="M3 21l1.7-4.6A8.5 8.5 0 1 1 8 19.6L3 21z"/><path d="M9 9.5c.3 1.6 2.4 4 4.5 4.7l1.2-1.2 2 .9c-.2 1.3-1.2 1.9-2.4 1.8-3.3-.4-6.6-3.7-6.9-6.9-.1-1.2.6-2.2 1.8-2.4l.9 2-1.1 1.1z"/>'
  };
  var COR = '<svg class="pc-cor" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7.5-4.6-9.6-9.3C.9 8.4 2.9 4.5 6.6 4.5c2.2 0 3.6 1.3 4.4 2.6.8-1.3 2.2-2.6 4.4-2.6 3.7 0 5.7 3.9 4.2 7.2C19.5 16.4 12 21 12 21z"/></svg>';
  var CSS = '.pc{--pc-t:#6f655c;--pc-b:rgba(255,255,255,.88);--pc-l:rgba(43,38,34,.12);font:12.5px/1.3 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:var(--pc-t);box-sizing:border-box}' +
    '.pc.oscuro{--pc-t:#ece4d9;--pc-b:rgba(28,24,20,.72);--pc-l:rgba(255,255,255,.18)}' +
    '.pc *{box-sizing:border-box}.pc a{color:inherit}' +
    '.pc-linea{display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:4px 10px}' +
    '.pc-txt{display:inline-flex;align-items:center;gap:5px;white-space:nowrap}.pc-txt b{font-weight:600}' +
    '.pc-cor{width:13px;height:13px;fill:#d9587c;flex:none;transform-origin:50% 60%;animation:pcLatido 2.6s ease-in-out infinite}' +
    '@keyframes pcLatido{0%,60%,100%{transform:scale(1)}10%{transform:scale(1.22)}20%{transform:scale(1)}30%{transform:scale(1.14)}}' +
    '.pc-redes{display:inline-flex;gap:2px}' +
    '.pc-redes a{width:26px;height:26px;display:grid;place-items:center;border-radius:50%;text-decoration:none;opacity:.8;transition:opacity .2s,background .2s}' +
    '.pc-redes a:hover,.pc-redes a:focus-visible{opacity:1;background:var(--pc-l)}.pc a:focus-visible,.pc button:focus-visible{outline:2px solid #b9966f;outline-offset:2px}' +
    '.pc-redes svg{width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}' +
    '.pc-final{width:100%;padding:22px 12px calc(14px + env(safe-area-inset-bottom));text-align:center}' +
    '.pc-final small{display:block;margin-top:4px;opacity:.7;font-size:11px}' +
    '.pc-flota{position:fixed;left:50%;bottom:calc(10px + env(safe-area-inset-bottom));z-index:2147483000;transform:translate(-50%,0);' +
      'max-width:calc(100vw - 16px);padding:3px 4px 3px 12px;font-size:12px;border-radius:999px;background:var(--pc-b);border:1px solid var(--pc-l);' +
      'box-shadow:0 6px 18px rgba(0,0,0,.08);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);transition:transform .45s cubic-bezier(.2,.8,.2,1),opacity .35s}' +
    '.pc-flota .pc-linea{flex-wrap:nowrap;gap:6px}.pc-flota .pc-redes a{width:24px;height:24px}' +
    '.pc-flota.oculta{transform:translate(-50%,140%);opacity:0;pointer-events:none}' +
    '.pc-disc{position:fixed;right:calc(12px + env(safe-area-inset-right));bottom:calc(12px + env(safe-area-inset-bottom));z-index:2147483000;display:flex;align-items:center;justify-content:flex-end}' +
    '.pc-btn{width:32px;height:32px;border-radius:50%;border:1px solid var(--pc-l);background:var(--pc-b);display:grid;place-items:center;cursor:pointer;padding:0;' +
      'opacity:.75;-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);box-shadow:0 4px 12px rgba(0,0,0,.08);transition:opacity .2s}.pc-btn:hover{opacity:1}' +
    '.pc-disc .pc-linea{position:absolute;right:0;bottom:40px;width:max-content;max-width:calc(100vw - 24px);justify-content:flex-end;padding:6px 8px 6px 12px;border-radius:18px;background:var(--pc-b);' +
      'border:1px solid var(--pc-l);box-shadow:0 6px 18px rgba(0,0,0,.1);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);transform-origin:100% 100%;transition:transform .3s,opacity .3s}' +
    '.pc-disc:not(.abierto) .pc-linea{transform:scale(.9) translateY(6px);opacity:0;pointer-events:none}' +
    '@media (max-width:359px){.pc-flota .pc-redes{display:none}}' +
    '@media print{.pc{display:none!important}}';

  P.credito = function (opc) {
    opc = opc || {};
    var modo = opc.modo || 'flotante';
    var viejo = document.getElementById('pyd-credito'); if (viejo) viejo.remove();
    if (modo === 'oculto') return null;
    if (!document.getElementById('pyd-credito-css')) {
      var st = document.createElement('style'); st.id = 'pyd-credito-css'; st.textContent = CSS; document.head.appendChild(st);
    }
    var en = opc.lang === 'en';
    var red = [['web', P.WEB, en ? 'Website' : 'Sitio web'], ['ig', P.INSTAGRAM, 'Instagram'], ['tt', P.TIKTOK, 'TikTok'], ['wa', 'https://wa.me/' + P.WHATSAPP, 'WhatsApp']];
    var linea = '<span class="pc-linea"><span class="pc-txt">' + (en ? 'Made with love' : 'Hecho con amor') + ' ' + COR + ' ' + (en ? 'by' : 'por') + ' <b>Parte y Detalles</b></span>' +
      '<span class="pc-redes">' + red.map(function (r) {
        return '<a href="' + r[1] + '" target="_blank" rel="noopener" aria-label="' + r[2] + '" title="' + r[2] + '"><svg viewBox="0 0 24 24" aria-hidden="true">' + IC[r[0]] + '</svg></a>';
      }).join('') + '</span></span>';
    var el = document.createElement(modo === 'final' ? 'footer' : 'div');
    el.id = 'pyd-credito'; el.className = 'pc' + (opc.oscuro ? ' oscuro' : '');
    if (modo === 'final') {
      el.className += ' pc-final';
      el.innerHTML = linea + (opc.extra ? '<small>' + opc.extra + '</small>' : '');
      (opc.contenedor || document.querySelector('[data-credito]') || document.body).appendChild(el);
      return el;
    }
    if (modo === 'discreto') {
      el.className += ' pc-disc';
      el.innerHTML = linea + '<button type="button" class="pc-btn" aria-expanded="false" aria-label="Parte y Detalles">' + COR + '</button>';
      document.body.appendChild(el);
      var b = el.querySelector('.pc-btn'), t;
      var abrir = function (si) { el.classList.toggle('abierto', si); b.setAttribute('aria-expanded', String(si)); clearTimeout(t); if (si) t = setTimeout(function () { abrir(false); }, 6000); };
      b.addEventListener('click', function () { abrir(!el.classList.contains('abierto')); });
      document.addEventListener('click', function (e) { if (!el.contains(e.target)) abrir(false); });
      return el;
    }
    /* flotante: visible 4 s al entrar · se oculta al bajar · aparece al subir o al llegar al final */
    el.className += ' pc-flota';
    el.innerHTML = linea;
    document.body.appendChild(el);
    var ultimo = window.scrollY, ocultarT, pedido = false;
    var mostrar = function (si) { el.classList.toggle('oculta', !si); };
    var temporal = function () { mostrar(true); clearTimeout(ocultarT); ocultarT = setTimeout(function () { if (!alFinal()) mostrar(false); }, 4000); };
    var alFinal = function () { return window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 40; };
    window.addEventListener('scroll', function () {
      if (pedido) return; pedido = true;
      requestAnimationFrame(function () {
        pedido = false;
        var y = window.scrollY;
        if (alFinal()) { clearTimeout(ocultarT); mostrar(true); }
        else if (y < ultimo - 8) temporal();
        else if (y > ultimo + 8) mostrar(false);
        ultimo = y;
      });
    }, { passive: true });
    el.addEventListener('pointerenter', function () { clearTimeout(ocultarT); });
    temporal();
    return el;
  };

  /* Redirección del rol STAFF: si este navegador tiene sesión de recepción para este proyecto,
     va directo a staff.html sin descargar videos, música ni imágenes. Saltar con ?invitado=1 */
  try {
    var q = new URLSearchParams(location.search);
    if (q.get('invitado') !== '1' && P.slug && !/staff\.html$|panel\.html$/.test(location.pathname)) {
      var s = JSON.parse(localStorage.getItem('pyd.staff') || 'null');
      if (s && s.proyectos && s.proyectos.indexOf(P.slug) >= 0 && P.haySesion()) {
        var to = (q.get('to') || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
        location.replace(P.STAFF_URL + '?p=' + encodeURIComponent(P.slug) + (to ? '&to=' + to : ''));
      }
    }
  } catch (e) {}
})();
