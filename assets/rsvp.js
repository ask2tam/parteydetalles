/* rsvp.js — Componente RSVP + Tarjeta (Save the Date / Pase) · Parte y Detalles
 * Autosuficiente: dibuja su propio HTML/CSS dentro de <div id="rsvp"></div> (Shadow DOM).
 * Lo usan la invitación (index.html) y la página directa rsvp.html (destino del QR).
 * Todo lo configurable (preguntas, textos, colores, evento) viene del proyecto en Supabase.
 * Requiere: assets/pyd-config.js + assets/boda-api.js (head) y assets/qr.js.
 *
 * URL:  ?to=AB12  → invitado con código (nombre bloqueado, pases, últimas respuestas)
 *       ?pase=2   → invitado nuevo sin código con 2 pases
 * Eventos en window: 'rsvp:proyecto' (detail = config pública) · 'rsvp:invitado' (detail = ficha)
 * Variable CSS en el host: --rsvp-zoom (p. ej. .85 dentro de un diseño de Canva)
 */
(function () {
  'use strict';
  if (window.__rsvpIniciado) return;
  var HOST = document.getElementById('rsvp');
  var API = window.BODA;
  if (!HOST) return;
  if (!API) { console.warn('[RSVP] Falta assets/boda-api.js'); return; }
  window.__rsvpIniciado = true;

  /* ---------------------------------------------------------------- valores por defecto */
  var DEF_FORM = { preguntar_pases: true, permitir_mensaje: true, pedir_acompanantes: false, preguntas: [] };
  var DEF_TARJETA = {
    titulo: '', fecha: '', lugar: '', logo_qr: '',
    colores: { papel: '#FBF8F3', tinta: '#2B2622', acento: '#B08D57', suave: '#8A7F75' },
    textos: {
      etiqueta_pendiente: 'Save the date', etiqueta_si: 'Te esperamos', etiqueta_no: 'Gracias',
      mensaje_pendiente: 'Confirma tu asistencia antes del {fecha_limite}',
      mensaje_si: '\u00a1Gracias por confirmar! Nos hace muy felices celebrar este d\u00eda contigo.',
      mensaje_no: 'Gracias por avisarnos. Te tendremos presente en nuestro d\u00eda.'
    },
    evento: { titulo: '', inicio: '', fin: '', lugar: '', detalle: '' }
  };
  var FUENTES = { titulo: '"Titulo Boda", "Snell Roundhand", Georgia, serif', texto: 'Georgia, "Times New Roman", serif' };
  var GIRO = { umbral: 90, duracion: 650, autoGirar: true };
  function fusionar(base, extra) {
    var r = {}; Object.keys(base).forEach(function (k) { r[k] = base[k]; });
    Object.keys(extra || {}).forEach(function (k) {
      var v = extra[k];
      if (v && typeof v === 'object' && !Array.isArray(v) && base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) r[k] = fusionar(base[k], v);
      else if (v !== '' && v != null) r[k] = v;
    });
    return r;
  }

  /* ---------------------------------------------------------------- HTML + CSS */
  var ESTILOS = '\
:host{display:block}\
.rsvp-raiz{all:initial;display:block;box-sizing:border-box;width:100%;--sombra:0 10px 32px rgba(0,0,0,.16);--campo:#f9f5f2;--boton:#b9966f;--boton-osc:#a3825c;\
 --texto:#1c1c1c;--suave:#7a7066;--error:#b3402f;--ok:#4d7a4a;position:relative;padding:var(--rsvp-relleno,0 22px 40px);\
 font-family:Montserrat,system-ui,-apple-system,"Segoe UI",sans-serif;font-size:16px;line-height:1.4;color:var(--texto);text-align:left;-webkit-text-size-adjust:100%;text-size-adjust:100%;-webkit-tap-highlight-color:transparent}\
.rsvp-raiz *,.rsvp-raiz *::before,.rsvp-raiz *::after{box-sizing:border-box}.rsvp-raiz [hidden]{display:none!important}\
.escena{position:relative;perspective:1600px;touch-action:pan-y}.escena.arrastrando{cursor:grabbing;-webkit-user-select:none;user-select:none}\
.giro{display:grid;align-items:start;transform-style:preserve-3d;-webkit-transform-style:preserve-3d;--shade:0;transition:transform var(--dur,600ms) cubic-bezier(.2,.75,.25,1);will-change:transform}\
.arrastrando .giro{transition:none}\
.cara{grid-area:1/1;position:relative;min-width:0;display:flex;flex-direction:column;backface-visibility:hidden;-webkit-backface-visibility:hidden}\
.reverso{transform:rotateY(180deg)}\
.cara::after{content:"";position:absolute;inset:0;pointer-events:none;border-radius:6px;background:linear-gradient(90deg,rgba(0,0,0,.22),rgba(0,0,0,0) 65%);opacity:var(--shade)}\
.caja{flex:1;zoom:var(--rsvp-zoom,1);width:100%;max-width:420px;margin:0 auto;background:#fff;border-radius:8px;padding:26px 24px;box-shadow:var(--sombra);-webkit-user-select:text;user-select:text}\
.saludo{margin:0 0 18px;padding-bottom:14px;border-bottom:1px solid #efe8e1;text-align:center}\
.saludo .nombres{font:400 30px/1.1 "Titulo Boda","Snell Roundhand","Brush Script MT",cursive;margin:0}\
.saludo .linea{margin:6px 0 0;font-size:12px;letter-spacing:.06em;color:var(--suave)}\
.plazo{margin:0 0 18px;text-align:center;font-size:12.5px;color:var(--suave)}\
.aviso-cierre{margin:0 0 18px;padding:12px 14px;border-radius:12px;background:#f6eeee;color:#7a3328;font-size:13px;line-height:1.45;text-align:center}\
form{margin:0;padding:0}label,.lbl{display:block;margin:0 0 9px;font-weight:700;font-size:16px;line-height:1.25}\
.campo{margin-bottom:22px}\
input[type=text],select,textarea{display:block;width:100%;margin:0;border:1px solid transparent;border-radius:14px;background-color:var(--campo);font:500 16px/1.3 Montserrat,system-ui,sans-serif;color:var(--texto);padding:0 14px;height:42px;outline:none;box-shadow:none;transition:border-color .2s,box-shadow .2s;-webkit-appearance:none;appearance:none}\
select{padding-right:38px;cursor:pointer;background-image:url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'14\' height=\'9\' viewBox=\'0 0 14 9\'%3E%3Cpath d=\'M1 1l6 6 6-6\' fill=\'none\' stroke=\'%237a7066\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 15px center}\
textarea{height:96px;padding:12px 14px;resize:vertical}textarea.corto{height:70px}\
input:focus,select:focus,textarea:focus{border-color:var(--boton);box-shadow:0 0 0 3px color-mix(in srgb,var(--boton) 25%,transparent)}\
input[readonly]{color:#6b6258;cursor:not-allowed;background-color:#f1ebe6}:disabled{opacity:.7;cursor:not-allowed}\
.invalido{border-color:var(--error)!important}.grupo.invalido{border:1px solid var(--error);border-radius:14px;padding:6px}\
.opciones{display:flex;flex-wrap:wrap;gap:8px}\
.opciones label{display:inline-flex;align-items:center;gap:8px;margin:0;padding:9px 14px;border-radius:999px;background:var(--campo);font-weight:500;font-size:14px;cursor:pointer;border:1px solid transparent}\
.opciones input{accent-color:var(--boton);width:16px;height:16px;margin:0}\
.opciones label:has(input:checked){border-color:var(--boton);background:color-mix(in srgb,var(--boton) 12%,#fff)}\
details.mensaje{display:block;margin:0 0 22px}\
details.mensaje>summary{list-style:none;cursor:pointer;font-weight:700;font-size:16px;line-height:1.25;display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:9px;-webkit-user-select:none;user-select:none}\
details.mensaje>summary::-webkit-details-marker{display:none}details.mensaje>summary::marker{content:""}\
details.mensaje>summary .opc{font-weight:500;font-size:12px;color:var(--suave)}\
details.mensaje>summary::after{content:"";width:9px;height:9px;border-right:2px solid var(--suave);border-bottom:2px solid var(--suave);transform:rotate(45deg);transition:transform .2s;margin:-4px 4px 0 auto;flex:none}\
details.mensaje[open]>summary::after{transform:rotate(-135deg);margin-top:4px}\
.contador{margin-top:5px;text-align:right;font-size:11px;color:var(--suave)}\
.ayuda{margin:8px 2px 0;font-size:12.5px;line-height:1.45;color:var(--suave)}.ayuda.error{color:var(--error)}\
.acciones-nombre{margin-top:8px;display:flex;flex-wrap:wrap;gap:6px 16px}\
.enlace{background:none;border:0;padding:0;margin:0;cursor:pointer;font:600 12.5px/1.4 Montserrat,sans-serif;color:var(--boton-osc);text-decoration:underline;text-underline-offset:3px}\
.candidatos{margin-top:8px;display:grid;gap:6px}\
.candidatos button{display:block;width:100%;text-align:left;border:1px solid #eadfd5;background:#fff;border-radius:12px;padding:9px 12px;color:var(--texto);font:500 13px/1.3 Montserrat,sans-serif;cursor:pointer}\
.resp-novios{margin:0 0 22px;padding:14px 16px;border-radius:14px;background:#fbf6ea;border:1px solid #efe3c6}\
.resp-novios .t{margin:0 0 6px;font-weight:700;font-size:13px;letter-spacing:.04em;color:var(--boton-osc)}\
.resp-novios .c{margin:0;font-size:14px;line-height:1.5;white-space:pre-wrap}\
.enviar-fila{display:flex;justify-content:center}\
.btn-enviar{width:216px;height:38px;border:0;border-radius:999px;background:var(--boton);color:#fff;cursor:pointer;font:500 14.5px/1 Montserrat,system-ui,sans-serif;letter-spacing:.06em;text-transform:uppercase;transition:background .2s,transform .15s}\
.btn-enviar:hover{background:var(--boton-osc)}.btn-enviar:active{transform:scale(.98)}.btn-enviar:disabled{opacity:.6;cursor:wait}\
.estado{margin:14px 0 0;min-height:1.4em;text-align:center;font-size:13px;line-height:1.45}.estado.ok{color:var(--ok);font-weight:600}.estado.error{color:var(--error)}\
.meta{margin:12px 0 0;text-align:center;font-size:11.5px;line-height:1.6;color:var(--suave)}\
.ver-tarjeta{display:flex;justify-content:center;margin-top:14px}.ver-tarjeta .enlace{display:inline-flex;align-items:center;gap:6px;text-decoration:none}\
.trampa{position:absolute;left:0;top:0;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);opacity:0;pointer-events:none}\
button:focus-visible,summary:focus-visible{outline:2px solid var(--boton-osc);outline-offset:3px}\
.std{flex:1;zoom:var(--rsvp-zoom,1);width:100%;max-width:420px;margin:0 auto;display:flex;flex-direction:column;align-items:center;gap:12px}\
.std canvas{display:block;width:100%;height:auto;aspect-ratio:5/7;border-radius:8px;box-shadow:var(--sombra);background:#fbf8f3}\
.iconos{display:flex;justify-content:center;flex-wrap:wrap;gap:10px}\
.icono{width:48px;height:48px;border-radius:50%;border:1.5px solid var(--boton-osc);background:#fff;color:var(--boton-osc);display:grid;place-items:center;cursor:pointer;padding:0}\
.icono.principal{background:var(--boton);border-color:var(--boton);color:#fff}\
.icono svg{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}.icono:active{transform:scale(.94)}\
.btn-confirmar{border:0;border-radius:999px;background:var(--boton);color:#fff;padding:11px 22px;cursor:pointer;font:600 13px/1 Montserrat,sans-serif;letter-spacing:.06em;text-transform:uppercase}\
.menu-cal{display:grid;gap:8px;width:100%;max-width:300px;padding:12px;background:#fff;border-radius:14px;box-shadow:var(--sombra)}\
.menu-cal button{border:1px solid #eadfd5;background:#fff;border-radius:12px;padding:11px 12px;cursor:pointer;font:600 13px/1.2 Montserrat,sans-serif;color:var(--texto);text-align:left}\
.aviso-std{min-height:1.3em;margin:0;text-align:center;font-size:13px;color:var(--ok)}\
.pista{margin:12px 0 0;text-align:center;font-size:12px;color:var(--suave);transition:opacity .4s}.pista.oculta{opacity:0}\
@media (prefers-reduced-motion:reduce){.pista,input,select,textarea{transition:none}}';

  var I = {
    giro: '<path d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6"/>',
    cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18M12 13v5M9.5 15.5h5"/>',
    compartir: '<path d="M12 3v12M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/>',
    copiar: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/>',
    imprimir: '<path d="M6 9V3h12v6M6 18H4a1 1 0 0 1-1-1v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6a1 1 0 0 1-1 1h-2"/><rect x="6" y="14" width="12" height="7"/>'
  };
  var svg = function (k) { return '<svg viewBox="0 0 24 24" aria-hidden="true">' + I[k] + '</svg>'; };
  var HTML = '<style>' + ESTILOS + '</style><div class="rsvp-raiz"><div class="escena" id="escena"><div class="giro" id="giro">' +
    '<section class="cara frente" id="frente" aria-label="Confirmaci\u00f3n de asistencia"><div class="caja">' +
      '<header class="saludo" id="saludo" hidden><p class="nombres" id="saludo-nombre"></p><p class="linea" id="saludo-linea"></p></header>' +
      '<p class="plazo" id="plazo" hidden></p><p class="aviso-cierre" id="aviso-cierre" hidden></p>' +
      '<form id="form" novalidate autocomplete="off">' +
        '<div class="campo"><label for="nombre">*Nombre completo:</label><input type="text" id="nombre" maxlength="80" autocomplete="name" required>' +
          '<p class="ayuda" id="ayuda-nombre" hidden></p><div class="candidatos" id="candidatos" hidden></div>' +
          '<div class="acciones-nombre"><button type="button" class="enlace" id="btn-buscar" hidden>Buscar mi registro</button>' +
          '<button type="button" class="enlace" id="btn-cambiar" hidden>No soy yo / cambiar nombre</button></div></div>' +
        '<div class="campo"><label for="asistencia">*\u00bfAsistir\u00e1s a nuestra boda?</label><select id="asistencia" required>' +
          '<option value="">Selecciona una opci\u00f3n</option><option value="si">S\u00ed, asistir\u00e9</option><option value="no">No podr\u00e9 asistir</option></select></div>' +
        '<div class="campo" id="campo-pases" hidden><label for="pases">*\u00bfCu\u00e1ntos asistir\u00e1n?</label><select id="pases"></select><p class="ayuda" id="ayuda-pases"></p></div>' +
        '<div class="campo" id="campo-acomp" hidden><label for="acompanantes">*Nombres de tus acompa\u00f1antes</label>' +
          '<textarea id="acompanantes" class="corto" maxlength="500" placeholder="Nombre Apellido, Nombre Apellido"></textarea><p class="ayuda" id="ayuda-acomp"></p></div>' +
        '<div id="extras"></div>' +
        '<details class="mensaje" id="det-mensaje"><summary>D\u00e9janos un mensajito <span class="opc">(opcional)</span></summary>' +
          '<textarea id="mensaje" maxlength="1000" aria-label="Mensaje para los novios"></textarea><div class="contador"><span id="contador">0</span>/1000</div></details>' +
        '<section class="resp-novios" id="resp-novios" hidden><p class="t">\ud83d\udc8c Respuesta de los novios</p><p class="c" id="resp-novios-txt"></p></section>' +
        '<div class="trampa" aria-hidden="true"><label>No llenar <input type="text" id="web" tabindex="-1" autocomplete="off"></label></div>' +
        '<div class="enviar-fila"><button type="submit" class="btn-enviar" id="btn-enviar">Enviar</button></div>' +
        '<p class="estado" id="estado" role="status" aria-live="polite"></p><p class="meta" id="meta" hidden></p>' +
      '</form>' +
      '<div class="ver-tarjeta"><button type="button" class="enlace" id="btn-ver-tarjeta"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + I.giro + '</svg>Ver mi tarjeta</button></div>' +
    '</div></section>' +
    '<section class="cara reverso" id="reverso" aria-label="Tu tarjeta" inert aria-hidden="true"><div class="std">' +
      '<canvas id="tarjeta" width="1200" height="1680" role="img" aria-label="Tarjeta"></canvas>' +
      '<button type="button" class="btn-confirmar" id="btn-confirmar" hidden>Confirmar asistencia</button>' +
      '<div class="iconos" role="toolbar" aria-label="Acciones de la tarjeta">' +
        '<button type="button" class="icono principal" id="btn-volver" aria-label="Volver al formulario" title="Volver al formulario">' + svg('giro') + '</button>' +
        '<button type="button" class="icono" id="btn-cal" aria-label="Agregar al calendario" title="Agregar al calendario" aria-expanded="false">' + svg('cal') + '</button>' +
        '<button type="button" class="icono" id="btn-compartir" aria-label="Compartir" title="Compartir" hidden>' + svg('compartir') + '</button>' +
        '<button type="button" class="icono" id="btn-copiar" aria-label="Guardar o copiar imagen" title="Guardar o copiar imagen">' + svg('copiar') + '</button>' +
        '<button type="button" class="icono" id="btn-imprimir" aria-label="Imprimir" title="Imprimir">' + svg('imprimir') + '</button></div>' +
      '<div class="menu-cal" id="menu-cal" hidden><button type="button" id="cal-ics">Apple / Outlook / otros (.ics)</button><button type="button" id="cal-google">Google Calendar</button></div>' +
      '<p class="aviso-std" id="aviso-std" role="status" aria-live="polite"></p>' +
    '</div></section></div></div><p class="pista" id="pista">Desliza la tarjeta para girarla</p></div>';

  var RAIZ = HOST.shadowRoot || (HOST.attachShadow ? HOST.attachShadow({ mode: 'open' }) : HOST);
  RAIZ.innerHTML = HTML;
  if (!document.getElementById('rsvp-fuentes')) {
    var lf = document.createElement('link'); lf.id = 'rsvp-fuentes'; lf.rel = 'stylesheet';
    lf.href = 'https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&display=swap';
    (document.head || document.documentElement).appendChild(lf);
  }
  var $ = function (id) { return RAIZ.getElementById ? RAIZ.getElementById(id) : RAIZ.querySelector('#' + id); };
  var el = {};
  ['form', 'nombre', 'asistencia', 'pases', 'mensaje', 'det-mensaje', 'contador', 'saludo', 'saludo-nombre', 'saludo-linea',
   'ayuda-nombre', 'candidatos', 'btn-buscar', 'btn-cambiar', 'btn-enviar', 'estado', 'meta', 'resp-novios', 'resp-novios-txt',
   'web', 'campo-pases', 'ayuda-pases', 'campo-acomp', 'acompanantes', 'ayuda-acomp', 'extras', 'plazo', 'aviso-cierre',
   'escena', 'giro', 'frente', 'reverso', 'tarjeta', 'pista', 'btn-ver-tarjeta', 'btn-volver', 'btn-cal', 'menu-cal', 'cal-ics',
   'cal-google', 'btn-compartir', 'btn-copiar', 'btn-imprimir', 'btn-confirmar', 'aviso-std']
    .forEach(function (id) { el[id.replace(/-(\w)/g, function (_, c) { return c.toUpperCase(); })] = $(id); });

  /* ---------------------------------------------------------------- estado */
  var q = new URLSearchParams(location.search);
  var CODIGO_URL = (q.get('to') || q.get('codigo') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  var PASE_URL = q.get('pase') || q.get('pases');
  var cfg = { form: DEF_FORM, tarjeta: DEF_TARJETA, nombre: '', urlRsvp: '', urlInvitacion: '', pasesMax: 10 };
  var estado = { listo: false, modo: 'nuevo', codigo: '', pases: 1, existente: false, tratamiento: '', g: null,
                 abierto: true, fechaLimite: null, permitirNuevos: true };
  estado.pases = Math.max(1, Math.min(10, parseInt(PASE_URL, 10) || 1));

  /* ---------------------------------------------------------------- utilidades */
  function fechaLarga(iso) { var d = iso ? new Date(iso) : null; return d && !isNaN(d) ? d.toLocaleString('es-PE', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }) : ''; }
  function fechaCorta(iso) { var d = iso ? new Date(iso) : null; return d && !isNaN(d) ? d.toLocaleDateString('es-PE', { day: 'numeric', month: 'long' }) : ''; }
  function conTrato(g) { var t = (g.tratamiento || '').trim(), n = g.nombre || ''; return t && n.toLowerCase().indexOf(t.toLowerCase()) !== 0 ? t + ' ' + n : n; }
  function plural(n, s, p) { n = parseInt(n, 10) || 0; return n + ' ' + (n === 1 ? s : p); }
  function mensajeEstado(txt, tipo) { el.estado.textContent = txt || ''; el.estado.className = 'estado' + (tipo ? ' ' + tipo : ''); }
  function ayuda(txt, error) { el.ayudaNombre.hidden = !txt; el.ayudaNombre.textContent = txt || ''; el.ayudaNombre.className = 'ayuda' + (error ? ' error' : ''); }
  var avisoT;
  function avisoStd(txt) { el.avisoStd.textContent = txt; clearTimeout(avisoT); avisoT = setTimeout(function () { el.avisoStd.textContent = ''; }, 4000); }
  function actualizarContador() { el.contador.textContent = el.mensaje.value.length; }
  function emitir(n, d) { try { window.dispatchEvent(new CustomEvent(n, { detail: d })); } catch (e) {} }
  function oscurecer(hex, f) { var m = /^#?([0-9a-f]{6})$/i.exec(hex || ''); if (!m) return hex; var n = parseInt(m[1], 16);
    var c = [n >> 16, (n >> 8) & 255, n & 255].map(function (v) { return Math.round(v * (1 - f)); }); return '#' + c.map(function (v) { return ('0' + v.toString(16)).slice(-2); }).join(''); }
  function iniciales(t) { var p = String(t || '').split(/\s*(?:&|\sy\s)\s*/i).filter(Boolean); return p.length > 1 ? p[0].trim()[0] + '&' + p[1].trim()[0] : String(t || '').trim().slice(0, 2); }
  function conTo(base, cod) { var u; try { u = new URL(base || location.href, location.href); } catch (e) { u = new URL(location.href); }
    if (!base) { u.search = ''; } u.hash = ''; u.searchParams.delete('to'); if (cod) u.searchParams.set('to', cod); return u.toString(); }
  function nombres(t) { return String(t || '').split(/[,;\n]+/).map(function (s) { return s.trim(); }).filter(Boolean); }
  var HINT_DUP = 'Si hay otra persona con tu mismo nombre, agrega tu apellido o el parentesco entre par\u00e9ntesis, por ejemplo: P\u00e9rez (Padre).';

  /* ---------------------------------------------------------------- configuración del proyecto */
  function aplicarProyecto(p) {
    if (!p) return;
    cfg.nombre = p.nombre || ''; cfg.urlRsvp = p.urlRsvp || ''; cfg.urlInvitacion = p.urlInvitacion || '';
    cfg.pasesMax = p.pasesMax || 10;
    cfg.form = fusionar(DEF_FORM, p.formulario || {});
    cfg.form.preguntas = Array.isArray((p.formulario || {}).preguntas) ? p.formulario.preguntas : [];
    cfg.tarjeta = fusionar(DEF_TARJETA, p.tarjeta || {});
    estado.fechaLimite = p.fechaLimite || null; estado.abierto = p.abierto !== false; estado.permitirNuevos = p.permitirNuevos !== false;
    if (!estado.existente) estado.pases = Math.max(1, Math.min(cfg.pasesMax, parseInt(PASE_URL, 10) || 1));
    var raiz = RAIZ.querySelector('.rsvp-raiz'), ac = cfg.tarjeta.colores.acento;
    raiz.style.setProperty('--boton', ac); raiz.style.setProperty('--boton-osc', oscurecer(ac, .14));
    el.detMensaje.hidden = !cfg.form.permitir_mensaje;
    renderPreguntas();
    if (!estado.existente) llenarPases(estado.pases, estado.pases);
    actualizarCondicionales(); pintarCierre(); pintarSaludo(); bloquearNombre(el.nombre.readOnly);
    if (estado.g) cargarRespuestas(estado.g);
    estado.listo = true; el.btnEnviar.disabled = false;
    emitir('rsvp:proyecto', p);
    pintarTarjeta();
  }

  /* ---------------------------------------------------------------- preguntas configurables */
  function renderPreguntas() {
    el.extras.innerHTML = '';
    cfg.form.preguntas.forEach(function (pq, i) {
      if (!pq || !pq.id) return;
      var id = 'pq-' + i, d = document.createElement('div'), tipo = pq.tipo || 'texto', ops = Array.isArray(pq.opciones) ? pq.opciones : [];
      d.className = 'campo'; d.dataset.pregunta = pq.id; d.dataset.tipo = tipo; if (pq.solo_si_asiste) d.dataset.siAsiste = '1';
      var lab = (pq.obligatoria ? '*' : '') + (pq.etiqueta || pq.id);
      if (tipo === 'multiple') {
        var g = document.createElement('div'); g.className = 'lbl'; g.textContent = lab; g.id = id + '-l';
        var box = document.createElement('div'); box.className = 'opciones grupo'; box.setAttribute('role', 'group'); box.setAttribute('aria-labelledby', id + '-l');
        ops.forEach(function (o) { var l = document.createElement('label'), c = document.createElement('input'); c.type = 'checkbox'; c.value = o; l.appendChild(c); l.appendChild(document.createTextNode(o)); box.appendChild(l); });
        d.appendChild(g); d.appendChild(box);
      } else {
        var l2 = document.createElement('label'); l2.htmlFor = id; l2.textContent = lab; d.appendChild(l2);
        var inp;
        if (tipo === 'parrafo') { inp = document.createElement('textarea'); inp.className = 'corto'; inp.maxLength = 500; }
        else if (tipo === 'opcion' || tipo === 'sino') {
          inp = document.createElement('select');
          var lista = tipo === 'sino' ? [['si', 'S\u00ed'], ['no', 'No']] : ops.map(function (o) { return [o, o]; });
          inp.innerHTML = '<option value="">Selecciona una opci\u00f3n</option>';
          lista.forEach(function (o) { var op = document.createElement('option'); op.value = o[0]; op.textContent = o[1]; inp.appendChild(op); });
        } else { inp = document.createElement('input'); inp.type = 'text'; inp.maxLength = 300; }
        inp.id = id; d.appendChild(inp);
        inp.addEventListener('input', function () { inp.classList.remove('invalido'); });
      }
      if (pq.ayuda) { var a = document.createElement('p'); a.className = 'ayuda'; a.textContent = pq.ayuda; d.appendChild(a); }
      el.extras.appendChild(d);
    });
  }
  function leerRespuestas() {
    var r = {};
    el.extras.querySelectorAll('[data-pregunta]').forEach(function (d) {
      if (d.hidden) return;
      var k = d.dataset.pregunta;
      if (d.dataset.tipo === 'multiple') { var v = [].map.call(d.querySelectorAll('input:checked'), function (c) { return c.value; }); if (v.length) r[k] = v; }
      else { var x = d.querySelector('input,select,textarea').value.trim(); if (x) r[k] = x; }
    });
    return r;
  }
  function cargarRespuestas(g) {
    var r = g.respuestas || {};
    el.extras.querySelectorAll('[data-pregunta]').forEach(function (d) {
      var v = r[d.dataset.pregunta];
      if (d.dataset.tipo === 'multiple') d.querySelectorAll('input').forEach(function (c) { c.checked = Array.isArray(v) && v.indexOf(c.value) >= 0; });
      else d.querySelector('input,select,textarea').value = v == null ? '' : v;
    });
    el.acompanantes.value = g.acompanantes || '';
  }

  /* ---------------------------------------------------------------- formulario */
  function llenarPases(asignados, valor) {
    el.pases.innerHTML = '';
    for (var i = 1; i <= asignados; i++) {
      var o = document.createElement('option'); o.value = i;
      o.textContent = i === 1 ? '1 (solo yo)' : i + ' (yo + ' + plural(i - 1, 'acompa\u00f1ante', 'acompa\u00f1antes') + ')';
      el.pases.appendChild(o);
    }
    el.pases.value = String(Math.max(1, Math.min(asignados, valor || asignados)));
    el.ayudaPases.textContent = 'Tienes ' + plural(asignados, 'pase reservado', 'pases reservados') + '.';
  }
  function pasesElegidos() { return cfg.form.preguntar_pases ? (parseInt(el.pases.value, 10) || estado.pases) : estado.pases; }
  function actualizarCondicionales() {
    var si = el.asistencia.value === 'si';
    el.campoPases.hidden = !(si && cfg.form.preguntar_pases && estado.pases > 1);
    var n = pasesElegidos() - 1;
    el.campoAcomp.hidden = !(si && cfg.form.pedir_acompanantes && n > 0);
    if (!el.campoAcomp.hidden) {
      var k = nombres(el.acompanantes.value).length;
      el.ayudaAcomp.textContent = 'Escribe ' + (n === 1 ? 'el nombre de tu acompa\u00f1ante' : 'los nombres de tus ' + n + ' acompa\u00f1antes, separados por comas') + ' \u00b7 ' + k + ' de ' + n;
    }
    el.extras.querySelectorAll('[data-pregunta]').forEach(function (d) { d.hidden = d.dataset.siAsiste === '1' && !si; });
  }
  function pintarSaludo() {
    var mesa = estado.g && estado.g.mesa ? ' \u00b7 Mesa ' + estado.g.mesa : '';
    if (!estado.existente) {
      el.saludo.hidden = !PASE_URL;
      el.saludoNombre.textContent = '\u00a1Nos har\u00e1 felices contar contigo!';
      el.saludoLinea.textContent = plural(estado.pases, 'pase reservado', 'pases reservados');
      return;
    }
    el.saludo.hidden = false;
    el.saludoNombre.textContent = conTrato({ tratamiento: estado.tratamiento, nombre: el.nombre.value.trim() });
    el.saludoLinea.textContent = plural(estado.pases, 'pase reservado', 'pases reservados') + mesa;
  }
  function pintarMeta(g) {
    if (!g || !g.primera) { el.meta.hidden = true; return; }
    var partes = ['Primera respuesta: ' + fechaLarga(g.primera)];
    if (g.ultima) partes.push('\u00daltima modificaci\u00f3n: ' + fechaLarga(g.ultima));
    partes.push('Ediciones: ' + (g.ediciones || 1));
    el.meta.textContent = '';
    partes.forEach(function (t, i) { if (i) el.meta.appendChild(document.createElement('br')); el.meta.appendChild(document.createTextNode(t)); });
    el.meta.hidden = false;
  }
  function pintarCierre() {
    var f = estado.fechaLimite;
    el.plazo.hidden = !f || !estado.abierto;
    if (f) el.plazo.textContent = 'Confirma antes del ' + fechaLarga(f) + ' h';
    el.avisoCierre.hidden = estado.abierto;
    if (!estado.abierto) {
      el.avisoCierre.textContent = 'La confirmaci\u00f3n cerr\u00f3 el ' + fechaLarga(f) + ' h. Si necesitas cambiar algo, escr\u00edbenos directamente.';
      el.form.querySelectorAll('input,select,textarea').forEach(function (x) { x.disabled = true; });
      el.btnEnviar.hidden = true; el.btnBuscar.hidden = true; el.btnCambiar.hidden = true;
    }
  }
  function bloquearNombre(si) {
    el.nombre.readOnly = !!si;
    el.btnCambiar.hidden = !(si && estado.modo === 'editar') || !estado.abierto;
    el.btnBuscar.hidden = !!si || !estado.abierto;
  }
  function cargarInvitado(g, modo) {
    estado.modo = modo; estado.existente = true; estado.codigo = g.codigo || ''; estado.tratamiento = g.tratamiento || '';
    estado.pases = g.pases || 1; estado.g = g;
    el.nombre.value = g.nombre; el.nombre.classList.remove('invalido');
    el.asistencia.value = g.asistenciaCodigo || '';
    llenarPases(estado.pases, g.pasesConfirmados || estado.pases);
    el.mensaje.value = g.mensaje || ''; actualizarContador(); el.detMensaje.open = !!g.mensaje;
    cargarRespuestas(g);
    el.respNovios.hidden = !g.respuestaNovios; el.respNoviosTxt.textContent = g.respuestaNovios || '';
    el.btnEnviar.textContent = g.primera ? 'Actualizar' : 'Enviar';
    ayuda(''); el.candidatos.hidden = true; el.candidatos.innerHTML = '';
    actualizarCondicionales(); bloquearNombre(true); pintarSaludo(); pintarMeta(g); pintarTarjeta();
    emitir('rsvp:invitado', g);
  }
  function reiniciarComoNuevo(limpiarNombre) {
    estado.modo = 'nuevo'; estado.existente = false; estado.codigo = ''; estado.tratamiento = ''; estado.g = null;
    estado.pases = Math.max(1, Math.min(cfg.pasesMax, parseInt(PASE_URL, 10) || 1));
    if (limpiarNombre) el.nombre.value = '';
    el.asistencia.value = ''; llenarPases(estado.pases, estado.pases);
    el.mensaje.value = ''; actualizarContador(); el.detMensaje.open = false;
    cargarRespuestas({});
    el.respNovios.hidden = true; el.meta.hidden = true; el.btnEnviar.textContent = 'Enviar';
    el.candidatos.hidden = true; el.candidatos.innerHTML = '';
    actualizarCondicionales(); bloquearNombre(false); pintarSaludo(); mensajeEstado(''); pintarTarjeta();
  }

  function buscarPorNombre(nombre) {
    nombre = (nombre || el.nombre.value).trim();
    if (nombre.length < 3) { ayuda('Escribe al menos 3 letras de tu nombre.', true); return; }
    ayuda('Buscando\u2026'); el.candidatos.hidden = true;
    API.leer({ action: 'buscar', q: nombre }).then(function (r) {
      if (r.encontrado) { cargarInvitado(r.invitado, 'editar'); mensajeEstado('Encontramos tu registro. Puedes revisarlo y actualizarlo.', 'ok'); return; }
      if (r.candidatos && r.candidatos.length) {
        ayuda('No hay un registro exacto. \u00bfEres alguno de estos?');
        el.candidatos.innerHTML = '';
        r.candidatos.forEach(function (n) {
          var b = document.createElement('button'); b.type = 'button'; b.textContent = n;
          b.addEventListener('click', function () { el.nombre.value = n; buscarPorNombre(n); });
          el.candidatos.appendChild(b);
        });
        el.candidatos.hidden = false; return;
      }
      ayuda(estado.permitirNuevos ? 'No encontramos ese nombre. Si es tu primera vez, completa el formulario y crearemos tu registro. ' + HINT_DUP
                                  : 'No encontramos ese nombre en la lista. Revisa c\u00f3mo est\u00e1 escrito o escr\u00edbenos.');
    }).catch(function () { ayuda('No pudimos buscar en este momento. Intenta de nuevo en unos segundos.', true); });
  }

  function marcar(nodo) { nodo.classList.add('invalido'); if (nodo.focus) nodo.focus(); }
  function validar() {
    var primero = null, m = function (n) { n.classList.add('invalido'); if (!primero) primero = n; };
    RAIZ.querySelectorAll('.invalido').forEach(function (n) { n.classList.remove('invalido'); });
    if (el.nombre.value.trim().length < 3) m(el.nombre);
    if (!el.asistencia.value) m(el.asistencia);
    if (!el.campoAcomp.hidden) { var n = pasesElegidos() - 1; if (nombres(el.acompanantes.value).length !== n) m(el.acompanantes); }
    var resp = leerRespuestas();
    cfg.form.preguntas.forEach(function (pq) {
      var d = el.extras.querySelector('[data-pregunta="' + (window.CSS && window.CSS.escape ? window.CSS.escape(pq.id) : pq.id) + '"]');
      if (pq.obligatoria && d && !d.hidden && !(pq.id in resp)) m(d.querySelector('.grupo,input,select,textarea'));
    });
    if (primero) {
      mensajeEstado(primero === el.acompanantes ? el.ayudaAcomp.textContent.split(' \u00b7 ')[0] + '.' : 'Por favor completa los campos obligatorios (*).', 'error');
      if (primero.focus) primero.focus(); else primero.scrollIntoView({ block: 'center' });
      return null;
    }
    return resp;
  }

  el.form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    if (el.web.value || !estado.abierto || !estado.listo) return;
    var resp = validar(); if (!resp) return;
    mensajeEstado('Guardando\u2026'); el.btnEnviar.disabled = true;
    var asis = el.asistencia.value, pc = asis === 'si' ? pasesElegidos() : 0;
    API.post({
      modo: estado.modo, codigo: estado.codigo, nombre: el.nombre.value.trim(), asistencia: asis, pasesConfirmados: pc,
      acompanantes: el.campoAcomp.hidden ? '' : nombres(el.acompanantes.value).join(', '),
      respuestas: resp, mensaje: cfg.form.permitir_mensaje ? el.mensaje.value.trim() : '', pases: estado.pases
    }).then(function (r) {
      if (r.ok) {
        var yaTenia = !!(estado.g && estado.g.primera);
        cargarInvitado(r.invitado, estado.modo === 'codigo' ? 'codigo' : 'editar');
        if (r.invitado.codigo && history.replaceState && !CODIGO_URL) {
          var u = new URL(location.href); u.searchParams.delete('pase'); u.searchParams.set('to', r.invitado.codigo); history.replaceState(null, '', u.toString());
        }
        mensajeEstado(r.cambio === false ? 'Tu respuesta ya estaba guardada.' : yaTenia ? '\u00a1Listo! Actualizamos tu respuesta. \ud83d\udc9b' : '\u00a1Gracias! Recibimos tu respuesta. \ud83d\udc9b', 'ok');
        if (GIRO.autoGirar) setTimeout(function () { girarA('reverso'); }, 900);
        return;
      }
      var e = r.error;
      if (e === 'duplicado') { marcar(el.nombre); mensajeEstado(''); ayuda('Ese nombre ya est\u00e1 registrado. ' + HINT_DUP, true); return; }
      if (e === 'no_encontrado') { mensajeEstado('No encontramos tu registro. Vuelve a buscarlo por nombre.', 'error'); reiniciarComoNuevo(false); return; }
      if (e === 'sin_registro') { mensajeEstado('No encontramos tu nombre en la lista de invitados. Revisa c\u00f3mo est\u00e1 escrito o escr\u00edbenos.', 'error'); return; }
      if (e === 'pregunta') { var d = el.extras.querySelector('[data-pregunta="' + r.campo + '"]'); if (d) marcar(d.querySelector('.grupo,input,select,textarea')); mensajeEstado('Por favor completa los campos obligatorios (*).', 'error'); return; }
      if (e === 'cerrado') { estado.abierto = false; pintarCierre(); mensajeEstado(''); return; }
      throw new Error(e || 'servidor');
    }).catch(function () {
      mensajeEstado('No pudimos guardar. Revisa tu conexi\u00f3n e int\u00e9ntalo de nuevo.', 'error');
    }).then(function () { el.btnEnviar.disabled = false; });
  });

  el.mensaje.addEventListener('input', actualizarContador);
  el.form.addEventListener('input', function () { if (/error/.test(el.estado.className)) mensajeEstado(''); });
  el.asistencia.addEventListener('change', function () { el.asistencia.classList.remove('invalido'); actualizarCondicionales(); });
  el.pases.addEventListener('change', actualizarCondicionales);
  el.acompanantes.addEventListener('input', function () { el.acompanantes.classList.remove('invalido'); actualizarCondicionales(); });
  el.extras.addEventListener('change', function (e) { var g = e.target.closest('.grupo'); if (g) g.classList.remove('invalido'); e.target.classList.remove('invalido'); });
  el.btnBuscar.addEventListener('click', function () { buscarPorNombre(); });
  el.btnCambiar.addEventListener('click', function () { reiniciarComoNuevo(true); el.nombre.focus(); });
  el.nombre.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !el.nombre.readOnly) { e.preventDefault(); buscarPorNombre(); } });
  el.nombre.addEventListener('input', function () { el.nombre.classList.remove('invalido'); if (!el.nombre.readOnly) { ayuda(''); el.candidatos.hidden = true; } });

  /* ---------------------------------------------------------------- tarjeta (canvas 1200×1680 = 5×7 in) */
  function situacion() { var a = estado.g && estado.g.asistenciaCodigo; return a === 'si' || a === 'no' ? a : 'pendiente'; }
  function urlQR() { return conTo(cfg.urlRsvp || '', estado.codigo); }
  function envolver(ctx, texto, cx, y, maxW, lh, maxLineas) {
    var palabras = String(texto).split(/\s+/), linea = '', n = 0;
    for (var i = 0; i < palabras.length; i++) {
      var t = linea ? linea + ' ' + palabras[i] : palabras[i];
      if (ctx.measureText(t).width > maxW && linea) {
        if (++n === maxLineas) { ctx.fillText(linea + '\u2026', cx, y); return y; }
        ctx.fillText(linea, cx, y); y += lh; linea = palabras[i];
      } else linea = t;
    }
    if (linea) ctx.fillText(linea, cx, y);
    return y;
  }
  function espaciado(ctx, texto, cx, y, sp) {
    var ch = Array.from(texto), w = ch.reduce(function (a, c) { return a + ctx.measureText(c).width; }, 0) + sp * (ch.length - 1), x = cx - w / 2;
    ctx.textAlign = 'left'; ch.forEach(function (c) { ctx.fillText(c, x, y); x += ctx.measureText(c).width + sp; }); ctx.textAlign = 'center';
  }
  var pintando = null, repintar = false;
  function pintarTarjeta() {
    if (pintando) { repintar = true; return pintando; }
    pintando = dibujarTarjeta().catch(function (e) { console.warn('[RSVP] tarjeta:', e); }).then(function () {
      pintando = null; if (repintar) { repintar = false; return pintarTarjeta(); }
    });
    return pintando;
  }
  function dibujarTarjeta() {
    var cv = el.tarjeta, ctx = cv.getContext('2d'), W = cv.width, H = cv.height, T = cfg.tarjeta, C = T.colores, X = T.textos, s = situacion(), g = estado.g || {};
    var titulo = T.titulo || cfg.nombre || '';
    var fuentes = document.fonts ? Promise.all([document.fonts.load('100px ' + FUENTES.titulo, titulo || 'A'), document.fonts.load('40px ' + FUENTES.texto)]).catch(function () {}) : Promise.resolve();
    return fuentes.then(function () {
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = C.papel; ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = C.acento; ctx.lineWidth = 4; ctx.strokeRect(48, 48, W - 96, H - 96);
      ctx.lineWidth = 1.5; ctx.strokeRect(64, 64, W - 128, H - 128);
      ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      var y = 200, etq = { pendiente: X.etiqueta_pendiente, si: X.etiqueta_si, no: X.etiqueta_no }[s];
      ctx.fillStyle = C.acento; ctx.font = '600 36px ' + FUENTES.texto; espaciado(ctx, String(etq).toUpperCase(), W / 2, y, 12);
      y += 150; ctx.fillStyle = C.tinta; ctx.font = '400 116px ' + FUENTES.titulo; y = envolver(ctx, titulo, W / 2, y, W - 240, 120, 2);
      y += 56; ctx.strokeStyle = C.acento; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(W / 2 - 130, y); ctx.lineTo(W / 2 + 130, y); ctx.stroke();
      ctx.fillStyle = C.acento; ctx.beginPath(); ctx.arc(W / 2, y, 7, 0, Math.PI * 2); ctx.fill();
      if (T.fecha) { y += 84; ctx.fillStyle = C.tinta; ctx.font = '500 52px ' + FUENTES.texto; espaciado(ctx, T.fecha, W / 2, y, 6); }
      if (T.lugar) { y += 56; ctx.fillStyle = C.suave; ctx.font = '34px ' + FUENTES.texto; ctx.fillText(T.lugar, W / 2, y); }
      if (g.nombre) { y += 92; ctx.fillStyle = C.tinta; ctx.font = 'italic 46px ' + FUENTES.texto; y = envolver(ctx, conTrato(g), W / 2, y, W - 260, 54, 2); }
      var linea = s === 'si' ? plural(g.pasesConfirmados || g.pases, 'pase confirmado', 'pases confirmados') + (g.mesa ? '  \u00b7  Mesa ' + g.mesa : '')
                : s === 'pendiente' && g.nombre ? plural(g.pases, 'pase reservado', 'pases reservados') : '';
      if (linea) { y += 64; ctx.fillStyle = C.acento; ctx.font = '600 32px ' + FUENTES.texto; espaciado(ctx, linea.toUpperCase(), W / 2, y, 4); }
      var msg;
      if (s === 'pendiente') {
        msg = X.mensaje_pendiente || '';
        msg = /\{fecha_limite\}/.test(msg) ? (estado.fechaLimite ? msg.replace(/\{fecha_limite\}/g, fechaCorta(estado.fechaLimite)) : 'Confirma tu asistencia escaneando el c\u00f3digo') : msg;
      } else msg = g.respuestaNovios || (s === 'si' ? X.mensaje_si : X.mensaje_no);
      ctx.fillStyle = C.suave; ctx.font = 'italic 36px ' + FUENTES.texto;
      if (s === 'no') { y = Math.max(y + 140, H / 2 + 40); envolver(ctx, msg, W / 2, y, W - 300, 50, 8); return; }
      y += 74; y = envolver(ctx, msg, W / 2, y, W - 280, 46, 3);
      var codigo = estado.codigo, abajo = H - (codigo ? 150 : 110), qs = Math.max(320, Math.min(520, abajo - y - 50)), qx = (W - qs) / 2, qy = abajo - qs;
      ctx.save(); ctx.fillStyle = '#FFFFFF'; ctx.shadowColor = 'rgba(0,0,0,.08)'; ctx.shadowBlur = 24; ctx.fillRect(qx - 12, qy - 12, qs + 24, qs + 24); ctx.restore();
      var logo = T.logo_qr || iniciales(titulo);
      return QR.dibujarEn(ctx, urlQR(), qx, qy, qs, { ecc: 'M', estilo: 'redondeado', color: C.tinta,
        logo: { activo: !!logo, tipo: 'texto', texto: logo, colorTexto: '#FFFFFF', fondo: C.acento, forma: 'circulo',
                fuente: 'italic 600 {px}px Georgia, serif', halo: .1, tamano: 'max', ladoMax: .3, ecc: 'H', reservaECC: .5 } }).then(function () {
        if (codigo) { ctx.fillStyle = C.suave; ctx.font = '26px ' + FUENTES.texto; espaciado(ctx, codigo, W / 2, H - 98, 10); }
      });
    }).then(function () { actualizarAcciones(); });
  }
  function actualizarAcciones() {
    var s = situacion(), titulo = cfg.tarjeta.titulo || cfg.nombre;
    el.tarjeta.setAttribute('aria-label', s === 'si' ? 'Tu pase para la boda de ' + titulo : s === 'no' ? 'Mensaje de agradecimiento' : 'Save the Date de ' + titulo);
    el.btnConfirmar.hidden = s !== 'pendiente' || !estado.abierto;
    el.btnCal.hidden = s === 'no' || !cfg.tarjeta.evento.inicio;
    el.btnCompartir.hidden = s === 'no' || !puedeCompartir;
    el.btnCopiar.hidden = s === 'no';
    el.btnImprimir.hidden = s === 'no';
    if (el.btnCal.hidden) el.menuCal.hidden = true;
  }

  /* ---------------------------------------------------------------- acciones de la tarjeta */
  var puedeCompartir = !!(navigator.share && navigator.canShare && navigator.canShare({ files: [new File([''], 'x.png', { type: 'image/png' })] }));
  function nombreArchivo() { return 'save_the_date_' + (estado.codigo || 'invitacion') + '.png'; }
  function blobTarjeta() { return pintarTarjeta().then(function () { return new Promise(function (ok, ko) { el.tarjeta.toBlob(function (b) { b ? ok(b) : ko(new Error('png')); }, 'image/png'); }); }); }
  function descargar(blob, nombre) {
    var u = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = u; a.download = nombre; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(u); }, 5000);
  }
  el.btnCompartir.addEventListener('click', function () {
    blobTarjeta().then(function (b) {
      return navigator.share({ files: [new File([b], nombreArchivo(), { type: 'image/png' })], title: cfg.tarjeta.titulo || cfg.nombre, text: urlQR() });
    }).catch(function (e) { if (e.name !== 'AbortError') avisoStd('No se pudo compartir.'); });
  });
  el.btnCopiar.addEventListener('click', function () {
    var ok = navigator.clipboard && window.ClipboardItem && window.isSecureContext;
    (ok ? navigator.clipboard.write([new ClipboardItem({ 'image/png': blobTarjeta() })]).then(function () { avisoStd('Imagen copiada.'); })
        : Promise.reject(new Error('sin portapapeles'))
    ).catch(function () { return blobTarjeta().then(function (b) { descargar(b, nombreArchivo()); avisoStd('Imagen descargada.'); }); })
     .catch(function () { avisoStd('No se pudo generar la imagen.'); });
  });
  el.btnImprimir.addEventListener('click', function () {
    blobTarjeta().then(function (b) {
      var st = document.getElementById('std-print-css');
      if (!st) {
        st = document.createElement('style'); st.id = 'std-print-css';
        st.textContent = '#std-print{display:none}@media print{@page{size:5in 7in;margin:0}html,body{height:auto!important;overflow:visible!important;position:static!important;width:auto!important;background:#fff!important}' +
          'body>*:not(#std-print){display:none!important}#std-print{display:block!important}#std-print img{display:block;width:5in;height:7in}}';
        document.head.appendChild(st);
      }
      var box = document.getElementById('std-print') || document.body.appendChild(Object.assign(document.createElement('div'), { id: 'std-print' }));
      box.innerHTML = ''; var img = new Image(); img.alt = '';
      img.onload = function () { setTimeout(function () { window.print(); }, 60); };
      img.src = URL.createObjectURL(b); box.appendChild(img);
    }).catch(function () { avisoStd('No se pudo preparar la impresi\u00f3n.'); });
  });

  function utc(iso) { return new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''); }
  function escIcs(t) { return String(t).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n'); }
  function evento() { var E = cfg.tarjeta.evento, fin = E.fin || new Date(new Date(E.inicio).getTime() + 6 * 3600e3).toISOString();
    return { titulo: E.titulo || 'Boda de ' + (cfg.tarjeta.titulo || cfg.nombre), inicio: E.inicio, fin: fin, lugar: E.lugar || cfg.tarjeta.lugar || '', detalle: E.detalle || '' }; }
  function detalleEvento() {
    var g = estado.g || {}, s = situacion(), url = conTo(cfg.urlInvitacion || cfg.urlRsvp, estado.codigo), d = [evento().detalle];
    if (s === 'si') { d.push(plural(g.pasesConfirmados || g.pases, 'pase confirmado', 'pases confirmados') + (g.mesa ? ' \u00b7 Mesa ' + g.mesa : '')); d.push('Tu invitaci\u00f3n: ' + url); }
    else d.push('Confirma tu asistencia' + (estado.fechaLimite ? ' antes del ' + fechaCorta(estado.fechaLimite) : '') + ': ' + urlQR());
    return d.filter(Boolean).join('\n');
  }
  el.btnCal.addEventListener('click', function () { el.menuCal.hidden = !el.menuCal.hidden; el.btnCal.setAttribute('aria-expanded', String(!el.menuCal.hidden)); });
  el.calIcs.addEventListener('click', function () {
    var E = evento(), uid = (estado.codigo || 'general') + '-' + utc(E.inicio) + '@parteydetalles.com';
    var ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//parteydetalles//boda//ES', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'BEGIN:VEVENT',
      'UID:' + uid, 'DTSTAMP:' + utc(new Date().toISOString()), 'DTSTART:' + utc(E.inicio), 'DTEND:' + utc(E.fin),
      'SUMMARY:' + escIcs(E.titulo), 'LOCATION:' + escIcs(E.lugar), 'DESCRIPTION:' + escIcs(detalleEvento()), 'URL:' + urlQR(),
      'BEGIN:VALARM', 'TRIGGER:-P7D', 'ACTION:DISPLAY', 'DESCRIPTION:' + escIcs(E.titulo), 'END:VALARM',
      'BEGIN:VALARM', 'TRIGGER:-P1D', 'ACTION:DISPLAY', 'DESCRIPTION:' + escIcs(E.titulo), 'END:VALARM',
      'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    descargar(new Blob([ics], { type: 'text/calendar;charset=utf-8' }), 'boda.ics');
    el.menuCal.hidden = true;
  });
  el.calGoogle.addEventListener('click', function () {
    var E = evento(), p = new URLSearchParams({ action: 'TEMPLATE', text: E.titulo, dates: utc(E.inicio) + '/' + utc(E.fin), details: detalleEvento(), location: E.lugar });
    window.open('https://calendar.google.com/calendar/render?' + p.toString(), '_blank', 'noopener');
    el.menuCal.hidden = true;
  });

  /* ---------------------------------------------------------------- giro controlado por el dedo */
  var reducido = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var rot = 0, actual = 0, ini = null, arrastrando = false;
  function aplicar(ang, dur) {
    el.giro.style.setProperty('--dur', (reducido ? Math.min(dur, 150) : dur) + 'ms');
    el.giro.style.transform = 'rotateY(' + ang + 'deg)';
    el.giro.style.setProperty('--shade', (Math.abs(Math.sin(ang * Math.PI / 180)) * .9).toFixed(3));
    actual = ang;
  }
  /* La cara oculta no aporta altura: tras el giro, la página se ajusta al tamaño de la cara visible */
  var altoT;
  function liberarAltura() { clearTimeout(altoT); [el.frente, el.reverso].forEach(function (c) { c.style.maxHeight = ''; c.style.overflow = ''; }); }
  function ajustarAltura() {
    var atras = lado() === 'reverso', vis = atras ? el.reverso : el.frente, oc = atras ? el.frente : el.reverso;
    vis.style.maxHeight = ''; vis.style.overflow = ''; oc.style.maxHeight = vis.offsetHeight + 'px'; oc.style.overflow = 'hidden';
  }
  function asentar(destino) {
    var dur = Math.max(180, GIRO.duracion * Math.abs(destino - actual) / 180);
    liberarAltura();
    rot = destino; aplicar(destino, dur);
    altoT = setTimeout(ajustarAltura, dur + 30);
    var atras = ((Math.round(rot / 180) % 2) + 2) % 2 === 1;
    el.frente.inert = atras; el.reverso.inert = !atras;
    el.frente.setAttribute('aria-hidden', String(atras)); el.reverso.setAttribute('aria-hidden', String(!atras));
    if (destino !== 0) el.pista.classList.add('oculta');
    if (!atras) el.menuCal.hidden = true;
  }
  function lado() { return ((Math.round(rot / 180) % 2) + 2) % 2 === 1 ? 'reverso' : 'frente'; }
  function girarA(destino) { if (lado() !== destino) { actual = rot; asentar(rot - 180); } }
  window.RSVP_TARJETA = { girar: girarA, repintar: pintarTarjeta };
  el.escena.addEventListener('pointerdown', function (e) {
    if (e.button !== 0 || e.target.closest('input,textarea,select,button,a,label,summary,.candidatos,.opciones,[data-no-giro]')) return;
    ini = { x: e.clientX, y: e.clientY, id: e.pointerId, w: el.escena.getBoundingClientRect().width || 1 };
  });
  el.escena.addEventListener('pointermove', function (e) {
    if (!ini || e.pointerId !== ini.id) return;
    var dx = e.clientX - ini.x, dy = e.clientY - ini.y;
    if (!arrastrando) {
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
      if (Math.abs(dy) > Math.abs(dx)) { ini = null; return; }
      arrastrando = true; el.escena.classList.add('arrastrando'); el.escena.setPointerCapture(e.pointerId); liberarAltura();
    }
    e.preventDefault();
    aplicar(rot + Math.max(-180, Math.min(180, dx / ini.w * 180)), 0);
  });
  function soltar(e) {
    if (!ini || e.pointerId !== ini.id) return;
    ini = null; if (!arrastrando) return;
    arrastrando = false; el.escena.classList.remove('arrastrando');
    var delta = actual - rot;
    asentar(Math.abs(delta) > GIRO.umbral ? rot + Math.sign(delta) * 180 : rot);
  }
  el.escena.addEventListener('pointerup', soltar);
  el.escena.addEventListener('pointercancel', soltar);
  el.escena.addEventListener('lostpointercapture', soltar);
  el.btnVerTarjeta.addEventListener('click', function () { girarA('reverso'); });
  el.btnVolver.addEventListener('click', function () { girarA('frente'); });
  el.btnConfirmar.addEventListener('click', function () { girarA('frente'); setTimeout(function () { (el.nombre.readOnly ? el.asistencia : el.nombre).focus({ preventScroll: true }); }, GIRO.duracion); });

  /* ---------------------------------------------------------------- arranque */
  el.btnEnviar.disabled = true;
  llenarPases(estado.pases, estado.pases);
  function errorProyecto() { mensajeEstado('No encontramos esta invitaci\u00f3n. Revisa el link que recibiste.', 'error'); el.form.querySelectorAll('input,select,textarea,button').forEach(function (x) { x.disabled = true; }); }
  function sinCodigo(aviso) { reiniciarComoNuevo(true); ayuda(aviso || ''); }
  if (!CODIGO_URL) {
    sinCodigo('Escribe tu nombre completo. Si ya respondiste antes, pulsa "Buscar mi registro" para ver o cambiar tu respuesta.');
    API.proyecto().then(aplicarProyecto).catch(function (e) { if (e && e.codigo === 'proyecto') errorProyecto(); else mensajeEstado('No pudimos cargar el formulario. Revisa tu conexi\u00f3n.', 'error'); });
  } else {
    mensajeEstado('Cargando tu invitaci\u00f3n\u2026');
    var alReintento = function (e) { mensajeEstado('Cargando tu invitaci\u00f3n\u2026 (reintento ' + e.detail.i + ' de ' + e.detail.total + ')'); };
    window.addEventListener('boda:reintento', alReintento);
    API.invitado(CODIGO_URL).then(function (r) {
      window.removeEventListener('boda:reintento', alReintento); mensajeEstado('');
      aplicarProyecto(r.proyecto);
      if (r.encontrado) cargarInvitado(r.invitado, 'codigo');
      else sinCodigo('No encontramos tu c\u00f3digo. Escribe tu nombre para buscar tu registro o crear uno nuevo. ' + HINT_DUP);
    }).catch(function (e) {
      window.removeEventListener('boda:reintento', alReintento); mensajeEstado('');
      if (e && e.codigo === 'proyecto') return errorProyecto();
      sinCodigo('No pudimos cargar tus datos. Escribe tu nombre para continuar.');
      API.proyecto().then(aplicarProyecto).catch(function () {});
    });
  }
})();
