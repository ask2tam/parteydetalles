/* rsvp.js — Componente RSVP + Tarjeta (Save the Date / Pase) · Parte y Detalles · v3.9.0
 * Autosuficiente: dibuja su propio HTML/CSS dentro de <div id="rsvp"></div> (Shadow DOM).
 * Lo usan la invitación (index.html) y la página directa rsvp.html (destino del QR).
 * Todo lo configurable (preguntas, textos, colores, fondos, idioma) viene del proyecto en Supabase.
 * Requiere: assets/pyd-config.js + assets/boda-api.js (head) y assets/qr.js.
 *
 * URL:  ?to=AB12   invitado con código     ·  ?pase=2  invitado nuevo con 2 pases  ·  ?lang=en  idioma
 * Eventos en window: 'rsvp:proyecto' · 'rsvp:invitado' · 'rsvp:idioma'
 * API: window.RSVP_IDIOMA = { actual(), disponibles(), cambiar('es'|'en') } · window.RSVP_TARJETA = { girar, repintar }
 * Variable CSS en el host: --rsvp-zoom (p. ej. .85 dentro de un diseño de Canva)
 */
(function () {
  'use strict';
  if (window.__rsvpIniciado) return;
  var HOST = document.getElementById('rsvp');
  var API = window.BODA, PYD = window.PYD || {};
  if (!HOST) return;
  if (!API) { console.warn('[RSVP] Falta assets/boda-api.js'); return; }
  window.__rsvpIniciado = true;

  /* ================================================================ TEXTOS (es / en) */
  var TXT = {
    es: {
      loc: 'es-PE', frenteAria: 'Confirmación de asistencia', reversoAria: 'Tu tarjeta', accionesAria: 'Acciones de la tarjeta',
      nombreLbl: '*Nombre completo:', buscar: 'Buscar mi registro', cambiar: 'No soy yo / cambiar nombre',
      asisLbl: '*¿Asistirás a nuestra boda?', selOpcion: 'Selecciona una opción', si: 'Sí, asistiré', no: 'No podré asistir',
      pasesLbl: '*¿Cuántos asistirán?', acompLbl: '*Nombres de tus acompañantes', acompPh: 'Nombre Apellido, Nombre Apellido',
      msgLbl: 'Déjanos un mensajito', opcional: '(opcional)', msgAria: 'Mensaje para los novios', respNovios: 'Respuesta de los novios',
      enviar: 'Enviar', actualizar: 'Actualizar', voltear: 'Voltear tarjeta', confirmar: 'Confirmar asistencia',
      volver: 'Volver al formulario', cal: 'Agregar al calendario', compartir: 'Compartir', copiar: 'Guardar o copiar imagen', imprimir: 'Imprimir',
      calIcs: 'Apple / Outlook / otros (.ics)',
      soloYo: '1 (solo yo)', yoMas: function (v) { return v.n + ' (yo + ' + v.k + (v.k === 1 ? ' acompañante)' : ' acompañantes)'); },
      pasesRes: function (v) { return v.n + (v.n === 1 ? ' pase reservado' : ' pases reservados'); },
      pasesConf: function (v) { return v.n + (v.n === 1 ? ' pase confirmado' : ' pases confirmados'); },
      tienes: 'Tienes {p}.', mesa: 'Mesa', bienvenida: '¡Nos hará felices contar contigo!',
      primera: 'Primera respuesta', ultima: 'Última modificación', ediciones: 'Ediciones',
      plazo: 'Confirma antes del {f} h', cerrado: 'La confirmación cerró el {f} h. Si necesitas cambiar algo, escríbenos directamente.', inactivo: 'Las confirmaciones para este evento ya están cerradas. Si necesitas cambiar algo, escríbenos directamente.',
      acomp1: 'Escribe el nombre de tu acompañante', acompN: 'Escribe los nombres de tus {n} acompañantes, separados por comas', deN: '{k} de {n}',
      min3: 'Escribe al menos 3 letras de tu nombre.', buscando: 'Buscando…', encontrado: 'Encontramos tu registro. Puedes revisarlo y actualizarlo.',
      candidatos: 'No hay un registro exacto. ¿Eres alguno de estos?',
      noNombreNuevo: 'No encontramos ese nombre. Si es tu primera vez, completa el formulario y crearemos tu registro. ',
      noNombre: 'No encontramos ese nombre en la lista. Revisa cómo está escrito o escríbenos.',
      errBuscar: 'No pudimos buscar en este momento. Intenta de nuevo en unos segundos.',
      hintDup: 'Si hay otra persona con tu mismo nombre, agrega tu apellido o el parentesco entre paréntesis, por ejemplo: Pérez (Padre).',
      obligatorios: 'Por favor completa los campos obligatorios (*).', guardando: 'Guardando…', yaGuardada: 'Tu respuesta ya estaba guardada.',
      actualizada: '¡Listo! Actualizamos tu respuesta. 💛', recibida: '¡Gracias! Recibimos tu respuesta. 💛', dupNombre: 'Ese nombre ya está registrado. ',
      noRegistro: 'No encontramos tu registro. Vuelve a buscarlo por nombre.',
      sinRegistro: 'No encontramos tu nombre en la lista de invitados. Revisa cómo está escrito o escríbenos.',
      errGuardar: 'No pudimos guardar. Revisa tu conexión e inténtalo de nuevo.', cargando: 'Cargando tu invitación…', reintento: '(reintento {i} de {n})',
      intro: 'Escribe tu nombre completo. Si ya respondiste antes, pulsa "Buscar mi registro" para ver o cambiar tu respuesta.',
      noCodigo: 'No encontramos tu código. Escribe tu nombre para buscar tu registro o crear uno nuevo. ',
      errDatos: 'No pudimos cargar tus datos. Escribe tu nombre para continuar.',
      noProyecto: 'No encontramos esta invitación. Revisa el link que recibiste.', errForm: 'No pudimos cargar el formulario. Revisa tu conexión.',
      siCorto: 'Sí', noCorto: 'No', copiada: 'Imagen copiada.', descargada: 'Imagen descargada.', errImagen: 'No se pudo generar la imagen.',
      errCompartir: 'No se pudo compartir.', errImprimir: 'No se pudo preparar la impresión.',
      etqPend: 'Save the date', etqSi: 'Te esperamos', etqNo: 'Gracias',
      msgPend: 'Confirma tu asistencia antes del {fecha_limite}', msgSi: '¡Gracias por confirmar! Nos hace muy felices celebrar este día contigo.',
      msgNo: 'Gracias por avisarnos. Te tendremos presente en nuestro día.', msgEscanear: 'Confirma tu asistencia escaneando el código',
      ariaSi: 'Tu pase para la boda de {t}', ariaNo: 'Mensaje de agradecimiento', ariaPend: 'Save the Date de {t}',
      bodaDe: 'Boda de {t}', tuInv: 'Tu invitación: ', confirmaCal: 'Confirma tu asistencia', antesDel: ' antes del {f}'
    },
    en: {
      loc: 'en-US', frenteAria: 'RSVP', reversoAria: 'Your card', accionesAria: 'Card actions',
      nombreLbl: '*Full name:', buscar: 'Find my RSVP', cambiar: 'Not me / change name',
      asisLbl: '*Will you attend our wedding?', selOpcion: 'Select an option', si: 'Yes, I’ll be there', no: 'Sorry, I can’t make it',
      pasesLbl: '*How many will attend?', acompLbl: '*Names of your guests', acompPh: 'First Last, First Last',
      msgLbl: 'Leave us a message', opcional: '(optional)', msgAria: 'Message for the couple', respNovios: 'A note from the couple',
      enviar: 'Send', actualizar: 'Update', voltear: 'Flip card', confirmar: 'RSVP now',
      volver: 'Back to the form', cal: 'Add to calendar', compartir: 'Share', copiar: 'Save or copy image', imprimir: 'Print',
      calIcs: 'Apple / Outlook / other (.ics)',
      soloYo: '1 (just me)', yoMas: function (v) { return v.n + ' (me + ' + v.k + (v.k === 1 ? ' guest)' : ' guests)'); },
      pasesRes: function (v) { return v.n + (v.n === 1 ? ' seat reserved' : ' seats reserved'); },
      pasesConf: function (v) { return v.n + (v.n === 1 ? ' seat confirmed' : ' seats confirmed'); },
      tienes: 'You have {p}.', mesa: 'Table', bienvenida: 'We’d love to celebrate with you!',
      primera: 'First reply', ultima: 'Last updated', ediciones: 'Edits',
      plazo: 'Please reply by {f}', cerrado: 'RSVP closed on {f}. If you need to change anything, please contact us directly.', inactivo: 'RSVP for this event is now closed. If you need to change anything, please contact us directly.',
      acomp1: 'Write your guest’s name', acompN: 'Write the names of your {n} guests, separated by commas', deN: '{k} of {n}',
      min3: 'Type at least 3 letters of your name.', buscando: 'Searching…', encontrado: 'We found your RSVP. You can review and update it.',
      candidatos: 'No exact match. Are you one of these?',
      noNombreNuevo: 'We couldn’t find that name. If this is your first time, fill in the form and we’ll create your RSVP. ',
      noNombre: 'We couldn’t find that name on the guest list. Check the spelling or contact us.',
      errBuscar: 'We couldn’t search right now. Please try again in a few seconds.',
      hintDup: 'If someone else has your same name, add your surname or relationship in brackets, e.g. Smith (Father).',
      obligatorios: 'Please complete the required fields (*).', guardando: 'Saving…', yaGuardada: 'Your reply was already saved.',
      actualizada: 'Done! We updated your reply. 💛', recibida: 'Thank you! We received your reply. 💛', dupNombre: 'That name is already registered. ',
      noRegistro: 'We couldn’t find your RSVP. Please search for it by name again.',
      sinRegistro: 'We couldn’t find your name on the guest list. Check the spelling or contact us.',
      errGuardar: 'We couldn’t save. Check your connection and try again.', cargando: 'Loading your invitation…', reintento: '(retry {i} of {n})',
      intro: 'Type your full name. If you already replied, tap "Find my RSVP" to view or change your answer.',
      noCodigo: 'We couldn’t find your code. Type your name to find your RSVP or create a new one. ',
      errDatos: 'We couldn’t load your details. Type your name to continue.',
      noProyecto: 'We couldn’t find this invitation. Please check the link you received.', errForm: 'We couldn’t load the form. Check your connection.',
      siCorto: 'Yes', noCorto: 'No', copiada: 'Image copied.', descargada: 'Image downloaded.', errImagen: 'Couldn’t create the image.',
      errCompartir: 'Couldn’t share.', errImprimir: 'Couldn’t prepare printing.',
      etqPend: 'Save the date', etqSi: 'See you there', etqNo: 'Thank you',
      msgPend: 'Please RSVP by {fecha_limite}', msgSi: 'Thank you for confirming! We’re so happy to celebrate this day with you.',
      msgNo: 'Thank you for letting us know. We’ll keep you in our hearts on our day.', msgEscanear: 'Scan the code to RSVP',
      ariaSi: 'Your pass for the wedding of {t}', ariaNo: 'Thank-you note', ariaPend: 'Save the Date for {t}',
      bodaDe: 'Wedding of {t}', tuInv: 'Your invitation: ', confirmaCal: 'Please RSVP', antesDel: ' by {f}'
    }
  };
  var lang = 'es';
  function T(k, v) {
    var s = (TXT[lang] || TXT.es)[k]; if (s == null) s = TXT.es[k]; if (s == null) return k;
    if (typeof s === 'function') return s(v || {});
    return v ? s.replace(/\{(\w+)\}/g, function (m, x) { return v[x] != null ? v[x] : m; }) : s;
  }
  /* Textos de la tarjeta: si el valor guardado es el predeterminado en español (o vacío), se usa el del idioma actual */
  var DEF_ES = { etiqueta_pendiente: 'etqPend', etiqueta_si: 'etqSi', etiqueta_no: 'etqNo', mensaje_pendiente: 'msgPend', mensaje_si: 'msgSi', mensaje_no: 'msgNo' };
  function textoTarjeta(k) { var v = (cfg.tarjeta.textos || {})[k]; return !v || v === TXT.es[DEF_ES[k]] ? T(DEF_ES[k]) : v; }

  /* ================================================================ valores por defecto */
  var DEF_FORM = { preguntar_pases: true, permitir_mensaje: true, pedir_acompanantes: false, mostrar_saludo: true, mostrar_nombre_codigo: true,
                   mostrar_fechas: true, mostrar_voltear: true, permitir_giro: true,
                   sugerir_nombres: true, logo: { mostrar: false, ancho: 140 }, escala_fuente: 100, preguntas: [] };
  var DEF_TARJETA = {
    titulo: '', fecha: '', lugar: '', logo_qr: '',
    colores: { papel: '#FBF8F3', tinta: '#2B2622', acento: '#B08D57', suave: '#8A7F75', campo: '#F9F5F2' }, campo_alfa: 100, escala_texto: 100,
    qr: { estilo: 'redondeado', color: '', logo_forma: 'circulo', logo_fondo: '', logo_texto: '#FFFFFF', escala: 100 },
    fondos: { pagina: { tipo: 'color', color: '' }, formulario: { tipo: 'color', color: '#FFFFFF' }, tarjeta: { tipo: 'color' } },
    textos: {}, evento: { titulo: '', inicio: '', fin: '', lugar: '', detalle: '' }
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
  /* Imágenes propias del evento: /<evento>/assets/rsvp_fondo_*.png y rsvp_logo.png */
  function urlEvento(archivo) {
    return PYD.RAIZ && PYD.slug ? PYD.RAIZ + PYD.slug + '/assets/' + archivo : new URL('assets/' + archivo, location.href).href;
  }
  /* Fondos: se prefiere .jpg (más liviano) y, si no existe, .png. Se comprueba una sola vez por fondo. */
  var _fondos = {}, _fondosImg = [];
  function resolverFondo(k) {
    if (!_fondos[k]) _fondos[k] = new Promise(function (ok) {
      var im = new Image(), j = urlEvento('rsvp_fondo_' + k + '.jpg');
      im.onload = function () { _fondosImg.push(im); ok(j); }; im.onerror = function () { ok(urlEvento('rsvp_fondo_' + k + '.png')); }; im.src = j;   /* se conserva: el fondo CSS reutiliza esta descarga */
    });
    return _fondos[k];
  }
  /* Porcentaje (50–200) → factor. Vacío o inválido = 100 % */
  function escala(v) { var n = parseFloat(v); return isFinite(n) && n > 0 ? Math.max(.5, Math.min(2, n / 100)) : 1; }
  function rgba(hex, alfa) {
    var m = /^#?([0-9a-f]{6})$/i.exec(hex || ''); if (!m) return hex;
    var n = parseInt(m[1], 16), a = Math.max(0, Math.min(100, alfa == null ? 100 : +alfa)) / 100;
    return 'rgba(' + (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }

  /* ================================================================ HTML + CSS */
  var ESTILOS = '\
:host{display:block}\
.rsvp-raiz{all:initial;display:block;box-sizing:border-box;width:100%;--sombra:0 10px 32px rgba(0,0,0,.16);--campo:#f9f5f2;--boton:#b9966f;--boton-osc:#a3825c;\
 --texto:#1c1c1c;--suave:#7a7066;--error:#b3402f;--ok:#4d7a4a;position:relative;padding:var(--rsvp-relleno,0 22px 40px);\
 font-family:Montserrat,system-ui,-apple-system,"Segoe UI",sans-serif;font-size:16px;line-height:1.4;color:var(--texto);text-align:left;-webkit-text-size-adjust:100%;text-size-adjust:100%;-webkit-tap-highlight-color:transparent}\
.rsvp-raiz *,.rsvp-raiz *::before,.rsvp-raiz *::after{box-sizing:border-box}.rsvp-raiz [hidden]{display:none!important}\
.escena{position:relative;touch-action:pan-y}.escena.arrastrando{cursor:grabbing;-webkit-user-select:none;user-select:none}\
.giro{display:grid;align-items:start}\
.cara{grid-area:1/1;position:relative;min-width:0;display:flex;flex-direction:column;--shade:0;transform-origin:50% 50%;will-change:transform}\
.reverso{visibility:hidden}\
.cara::after{content:"";position:absolute;inset:0;pointer-events:none;border-radius:8px;background:linear-gradient(90deg,rgba(0,0,0,.22),rgba(0,0,0,0) 65%);opacity:var(--shade)}\
.caja{flex:1;zoom:var(--rsvp-zoom,1);width:100%;max-width:420px;margin:0 auto;background:#fff;border-radius:8px;padding:26px 24px;display:flex;flex-direction:column;justify-content:center;background-size:cover;background-position:50% 50%;background-repeat:no-repeat;box-shadow:var(--sombra);-webkit-user-select:text;user-select:text}\
.saludo{margin:0 0 18px;padding-bottom:14px;border-bottom:1px solid rgba(0,0,0,.08);text-align:center}\
.saludo .nombres{font:400 calc(30px*var(--fz,1))/1.1 "Titulo Boda","Snell Roundhand","Brush Script MT",cursive;margin:0}\
.saludo .linea{margin:6px 0 0;font-size:calc(12px*var(--fz,1));letter-spacing:.06em;color:var(--suave)}\
.plazo{margin:0 0 18px;text-align:center;font-size:calc(12.5px*var(--fz,1));color:var(--suave)}\
.aviso-cierre{margin:0 0 18px;padding:12px 14px;border-radius:12px;background:#f6eeee;color:#7a3328;font-size:calc(13px*var(--fz,1));line-height:1.45;text-align:center}\
form{margin:0;padding:0}label,.lbl{display:block;margin:0 0 9px;font-weight:700;font-size:calc(16px*var(--fz,1));line-height:1.25}\
.campo{margin-bottom:22px}\
input[type=text],select,textarea{display:block;width:100%;margin:0;border:1px solid transparent;border-radius:14px;background-color:var(--campo);font:500 calc(16px*var(--fz,1))/1.3 Montserrat,system-ui,sans-serif;color:var(--texto);padding:0 14px;height:calc(42px*var(--fz,1));outline:none;box-shadow:none;transition:border-color .2s,box-shadow .2s;-webkit-appearance:none;appearance:none}\
select{padding-right:38px;cursor:pointer;background-image:url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'14\' height=\'9\' viewBox=\'0 0 14 9\'%3E%3Cpath d=\'M1 1l6 6 6-6\' fill=\'none\' stroke=\'%237a7066\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 15px center}\
textarea{height:calc(96px*var(--fz,1));padding:12px 14px;resize:vertical}textarea.corto{height:calc(70px*var(--fz,1))}\
input:focus,select:focus,textarea:focus{border-color:var(--boton);box-shadow:0 0 0 3px color-mix(in srgb,var(--boton) 25%,transparent)}\
input[readonly]{color:#6b6258;cursor:not-allowed;filter:brightness(.97)}\
.logo-rsvp{display:block;margin:0 auto 18px;max-width:100%;height:auto}:disabled{opacity:.7;cursor:not-allowed}\
.invalido{border-color:var(--error)!important}.grupo.invalido{border:1px solid var(--error);border-radius:14px;padding:6px}\
.opciones{display:flex;flex-wrap:wrap;gap:8px}\
.opciones label{display:inline-flex;align-items:center;gap:8px;margin:0;padding:9px 14px;border-radius:999px;background:var(--campo);font-weight:500;font-size:calc(14px*var(--fz,1));cursor:pointer;border:1px solid transparent}\
.opciones input{accent-color:var(--boton);width:calc(16px*var(--fz,1));height:calc(16px*var(--fz,1));margin:0}\
.opciones label:has(input:checked){border-color:var(--boton);background:color-mix(in srgb,var(--boton) 12%,#fff)}\
details.mensaje{display:block;margin:0 0 22px}\
details.mensaje>summary{list-style:none;cursor:pointer;font-weight:700;font-size:calc(16px*var(--fz,1));line-height:1.25;display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:9px;-webkit-user-select:none;user-select:none}\
details.mensaje>summary::-webkit-details-marker{display:none}details.mensaje>summary::marker{content:""}\
details.mensaje>summary .opc{font-weight:500;font-size:calc(12px*var(--fz,1));color:var(--suave)}\
details.mensaje>summary::after{content:"";width:9px;height:9px;border-right:2px solid var(--suave);border-bottom:2px solid var(--suave);transform:rotate(45deg);transition:transform .2s;margin:-4px 4px 0 auto;flex:none}\
details.mensaje[open]>summary::after{transform:rotate(-135deg);margin-top:4px}\
.contador{margin-top:5px;text-align:right;font-size:calc(11px*var(--fz,1));color:var(--suave)}\
.ayuda{margin:8px 2px 0;font-size:calc(12.5px*var(--fz,1));line-height:1.45;color:var(--suave)}.ayuda.error{color:var(--error)}\
.acciones-nombre{margin-top:8px;display:flex;flex-wrap:wrap;gap:6px 16px}\
.enlace{background:none;border:0;padding:0;margin:0;cursor:pointer;font:600 calc(12.5px*var(--fz,1))/1.4 Montserrat,sans-serif;color:var(--boton-osc);text-decoration:underline;text-underline-offset:3px}\
.candidatos{margin-top:8px;display:grid;gap:6px}\
.candidatos button{display:block;width:100%;text-align:left;border:1px solid #eadfd5;background:#fff;border-radius:12px;padding:9px 12px;color:var(--texto);font:500 calc(13px*var(--fz,1))/1.3 Montserrat,sans-serif;cursor:pointer}\
.resp-novios{margin:0 0 22px;padding:14px 16px;border-radius:14px;background:#fbf6ea;border:1px solid #efe3c6}\
.resp-novios .t{margin:0 0 6px;font-weight:700;font-size:calc(13px*var(--fz,1));letter-spacing:.04em;color:var(--boton-osc)}\
.resp-novios .c{margin:0;font-size:calc(14px*var(--fz,1));line-height:1.5;white-space:pre-wrap}\
.enviar-fila{display:flex;justify-content:center}\
.btn-enviar{width:min(100%,calc(216px*var(--fz,1)));height:calc(38px*var(--fz,1));border:0;border-radius:999px;background:var(--boton);color:#fff;cursor:pointer;font:500 calc(14.5px*var(--fz,1))/1 Montserrat,system-ui,sans-serif;letter-spacing:.06em;text-transform:uppercase;transition:background .2s,transform .15s}\
.btn-enviar:hover{background:var(--boton-osc)}.btn-enviar:active{transform:scale(.98)}.btn-enviar:disabled{opacity:.6;cursor:wait}\
.estado{margin:14px 0 0;min-height:1.4em;text-align:center;font-size:calc(13px*var(--fz,1));line-height:1.45}.estado.ok{color:var(--ok);font-weight:600}.estado.error{color:var(--error)}\
.meta{margin:12px 0 0;text-align:center;font-size:calc(11.5px*var(--fz,1));line-height:1.6;color:var(--suave)}\
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
'; /* sin @media (prefers-reduced-motion): las animaciones corren siempre */

  var I = {
    giro: '<path d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6"/>',
    cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18M12 13v5M9.5 15.5h5"/>',
    compartir: '<path d="M12 3v12M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/>',
    copiar: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/>',
    imprimir: '<path d="M6 9V3h12v6M6 18H4a1 1 0 0 1-1-1v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6a1 1 0 0 1-1 1h-2"/><rect x="6" y="14" width="12" height="7"/>'
  };
  var svg = function (k) { return '<svg viewBox="0 0 24 24" aria-hidden="true">' + I[k] + '</svg>'; };
  var ib = function (id, k, t, cls, extra) { return '<button type="button" class="icono' + (cls ? ' ' + cls : '') + '" id="' + id + '" data-ta="' + t + '"' + (extra || '') + '>' + svg(k) + '</button>'; };
  var HTML = '<style>' + ESTILOS + '</style><div class="rsvp-raiz"><div class="escena" id="escena"><div class="giro" id="giro">' +
    '<section class="cara frente" id="frente" data-ta="frenteAria"><div class="caja" id="caja">' +
      '<img class="logo-rsvp" id="logo-rsvp" alt="" hidden>' +
      '<header class="saludo" id="saludo" hidden><p class="nombres" id="saludo-nombre"></p><p class="linea" id="saludo-linea"></p></header>' +
      '<p class="plazo" id="plazo" hidden></p><p class="aviso-cierre" id="aviso-cierre" hidden></p>' +
      '<form id="form" novalidate autocomplete="off">' +
        '<div class="campo" id="campo-nombre"><label for="nombre" data-t="nombreLbl"></label><input type="text" id="nombre" maxlength="80" autocomplete="name" required>' +
          '<p class="ayuda" id="ayuda-nombre" hidden></p><div class="candidatos" id="candidatos" hidden></div>' +
          '<div class="acciones-nombre"><button type="button" class="enlace" id="btn-buscar" data-t="buscar" hidden></button>' +
          '<button type="button" class="enlace" id="btn-cambiar" data-t="cambiar" hidden></button></div></div>' +
        '<div class="campo"><label for="asistencia" data-t="asisLbl"></label><select id="asistencia" required>' +
          '<option value="" data-t="selOpcion"></option><option value="si" data-t="si"></option><option value="no" data-t="no"></option></select></div>' +
        '<div class="campo" id="campo-pases" hidden><label for="pases" data-t="pasesLbl"></label><select id="pases"></select><p class="ayuda" id="ayuda-pases"></p></div>' +
        '<div class="campo" id="campo-acomp" hidden><label for="acompanantes" data-t="acompLbl"></label>' +
          '<textarea id="acompanantes" class="corto" maxlength="500" data-tph="acompPh"></textarea><p class="ayuda" id="ayuda-acomp"></p></div>' +
        '<div id="extras"></div>' +
        '<details class="mensaje" id="det-mensaje"><summary><span data-t="msgLbl"></span> <span class="opc" data-t="opcional"></span></summary>' +
          '<textarea id="mensaje" maxlength="1000" data-ta="msgAria"></textarea><div class="contador"><span id="contador">0</span>/1000</div></details>' +
        '<section class="resp-novios" id="resp-novios" hidden><p class="t">\ud83d\udc8c <span data-t="respNovios"></span></p><p class="c" id="resp-novios-txt"></p></section>' +
        '<div class="trampa" aria-hidden="true"><label>- <input type="text" id="web" tabindex="-1" autocomplete="off"></label></div>' +
        '<div class="enviar-fila"><button type="submit" class="btn-enviar" id="btn-enviar"></button></div>' +
        '<p class="estado" id="estado" role="status" aria-live="polite"></p><p class="meta" id="meta" hidden></p>' +
      '</form>' +
      '<div class="ver-tarjeta"><button type="button" class="enlace" id="btn-ver-tarjeta"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + I.giro + '</svg><span data-t="voltear"></span></button></div>' +
    '</div></section>' +
    '<section class="cara reverso" id="reverso" data-ta="reversoAria" inert aria-hidden="true"><div class="std">' +
      '<canvas id="tarjeta" width="1200" height="1680" role="img"></canvas>' +
      '<button type="button" class="btn-confirmar" id="btn-confirmar" data-t="confirmar" hidden></button>' +
      '<div class="iconos" role="toolbar" data-ta="accionesAria">' +
        ib('btn-volver', 'giro', 'volver', 'principal') + ib('btn-cal', 'cal', 'cal', '', ' aria-expanded="false"') +
        ib('btn-compartir', 'compartir', 'compartir', '', ' hidden') + ib('btn-copiar', 'copiar', 'copiar') + ib('btn-imprimir', 'imprimir', 'imprimir') + '</div>' +
      '<div class="menu-cal" id="menu-cal" hidden><button type="button" id="cal-ics" data-t="calIcs"></button><button type="button" id="cal-google">Google Calendar</button></div>' +
      '<p class="aviso-std" id="aviso-std" role="status" aria-live="polite"></p>' +
    '</div></section></div></div></div>';

  var RAIZ = HOST.shadowRoot || (HOST.attachShadow ? HOST.attachShadow({ mode: 'open' }) : HOST);
  RAIZ.innerHTML = HTML;
  if (!document.getElementById('rsvp-fuentes')) {
    var lf = document.createElement('link'); lf.id = 'rsvp-fuentes'; lf.rel = 'stylesheet';
    lf.href = 'https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&display=swap';
    (document.head || document.documentElement).appendChild(lf);
  }
  var $ = function (id) { return RAIZ.getElementById ? RAIZ.getElementById(id) : RAIZ.querySelector('#' + id); };
  var el = {};
  ['form', 'logo-rsvp', 'campo-nombre', 'nombre', 'asistencia', 'pases', 'mensaje', 'det-mensaje', 'contador', 'saludo', 'saludo-nombre', 'saludo-linea',
   'ayuda-nombre', 'candidatos', 'btn-buscar', 'btn-cambiar', 'btn-enviar', 'estado', 'meta', 'resp-novios', 'resp-novios-txt',
   'web', 'campo-pases', 'ayuda-pases', 'campo-acomp', 'acompanantes', 'ayuda-acomp', 'extras', 'plazo', 'aviso-cierre', 'caja',
   'escena', 'giro', 'frente', 'reverso', 'tarjeta', 'btn-ver-tarjeta', 'btn-volver', 'btn-cal', 'menu-cal', 'cal-ics',
   'cal-google', 'btn-compartir', 'btn-copiar', 'btn-imprimir', 'btn-confirmar', 'aviso-std']
    .forEach(function (id) { el[id.replace(/-(\w)/g, function (_, c) { return c.toUpperCase(); })] = $(id); });

  /* ================================================================ estado */
  var q = new URLSearchParams(location.search);
  var CODIGO_URL = (q.get('to') || q.get('codigo') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  var PASE_URL = q.get('pase') || q.get('pases');
  var LANG_URL = (q.get('lang') || '').toLowerCase().slice(0, 2);
  var cfg = { form: DEF_FORM, tarjeta: DEF_TARJETA, nombre: '', urlRsvp: '', urlInvitacion: '', pasesMax: 10, idiomas: ['es'] };
  var estado = { listo: false, modo: 'nuevo', codigo: '', pases: 1, existente: false, tratamiento: '', g: null,
                 abierto: true, fechaLimite: null, permitirNuevos: true };
  estado.pases = Math.max(1, Math.min(10, parseInt(PASE_URL, 10) || 1));

  /* ================================================================ utilidades */
  function fechaLarga(iso) { var d = iso ? new Date(iso) : null; return d && !isNaN(d) ? d.toLocaleString(T('loc'), { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: lang === 'en' ? 'h12' : 'h23' }) : ''; }
  function fechaCorta(iso) { var d = iso ? new Date(iso) : null; return d && !isNaN(d) ? d.toLocaleDateString(T('loc'), { day: 'numeric', month: 'long' }) : ''; }
  function conTrato(g) { var t = (g.tratamiento || '').trim(), n = g.nombre || ''; return t && n.toLowerCase().indexOf(t.toLowerCase()) !== 0 ? t + ' ' + n : n; }
  function mensajeEstado(txt, tipo) { el.estado.textContent = txt || ''; el.estado.className = 'estado' + (tipo ? ' ' + tipo : ''); }
  function ayuda(txt, error) { el.ayudaNombre.hidden = !txt; el.ayudaNombre.textContent = txt || ''; el.ayudaNombre.className = 'ayuda' + (error ? ' error' : ''); }
  var avisoT;
  function avisoStd(txt) { el.avisoStd.textContent = txt; clearTimeout(avisoT); avisoT = setTimeout(function () { el.avisoStd.textContent = ''; }, 4000); }
  function actualizarContador() { el.contador.textContent = el.mensaje.value.length; }
  function emitir(n, d) { try { window.dispatchEvent(new CustomEvent(n, { detail: d })); } catch (e) {} }
  function oscurecer(hex, f) { var m = /^#?([0-9a-f]{6})$/i.exec(hex || ''); if (!m) return hex; var n = parseInt(m[1], 16);
    var c = [n >> 16, (n >> 8) & 255, n & 255].map(function (v) { return Math.round(v * (1 - f)); }); return '#' + c.map(function (v) { return ('0' + v.toString(16)).slice(-2); }).join(''); }
  function conTo(base, cod) { var u; try { u = new URL(base || location.href, location.href); } catch (e) { u = new URL(location.href); }
    if (!base) { u.search = ''; } u.hash = ''; u.searchParams.delete('to'); if (cod) u.searchParams.set('to', cod); return u.toString(); }
  function nombres(t) { return String(t || '').split(/[,;\n]+/).map(function (s) { return s.trim(); }).filter(Boolean); }

  /* ================================================================ idioma */
  function aplicarTextos() {
    RAIZ.querySelectorAll('[data-t]').forEach(function (n) { n.textContent = T(n.dataset.t); });
    RAIZ.querySelectorAll('[data-tph]').forEach(function (n) { n.placeholder = T(n.dataset.tph); });
    RAIZ.querySelectorAll('[data-ta]').forEach(function (n) { n.setAttribute('aria-label', T(n.dataset.ta)); if (n.tagName === 'BUTTON') n.title = T(n.dataset.ta); });
    el.btnEnviar.textContent = estado.g && estado.g.primera ? T('actualizar') : T('enviar');
  }
  function elegirIdioma() {
    var disp = cfg.idiomas, guardado = '';
    try { guardado = sessionStorage.getItem('pyd.lang.' + PYD.slug) || ''; } catch (e) {}
    if (disp.indexOf(LANG_URL) >= 0) return LANG_URL;
    if (disp.indexOf(guardado) >= 0) return guardado;
    if (disp.length > 1) return /^en/i.test(navigator.language || '') ? 'en' : disp[0];
    return disp[0] || 'es';
  }
  function cambiarIdioma(l, recordar) {
    if (!TXT[l]) return;
    if (recordar) { try { sessionStorage.setItem('pyd.lang.' + PYD.slug, l); } catch (e) {} }
    var resp = estado.listo ? leerRespuestas() : null;
    lang = l; HOST.setAttribute('lang', l);
    aplicarTextos();
    if (estado.listo) {
      renderPreguntas(); if (resp) cargarRespuestas({ respuestas: resp, acompanantes: el.acompanantes.value });
      llenarPases(estado.pases, parseInt(el.pases.value, 10) || estado.pases);
      actualizarCondicionales(); pintarSaludo(); pintarMeta(estado.g); pintarCierre(); mensajeEstado('');
      pintarTarjeta();
    }
    ponerCredito();
    emitir('rsvp:idioma', l);
  }
  window.RSVP_IDIOMA = { actual: function () { return lang; }, disponibles: function () { return cfg.idiomas.slice(); }, cambiar: function (l) { cambiarIdioma(l, true); } };
  lang = TXT[LANG_URL] ? LANG_URL : 'es';
  aplicarTextos();

  /* ================================================================ configuración del proyecto */
  /* Crédito "Hecho con amor" (modo configurable por evento). La página anfitriona puede desactivarlo con window.PYD_SIN_CREDITO = true */
  function ponerCredito() { if (window.PYD_SIN_CREDITO || !PYD.credito || !cfg.credito) return; PYD.credito({ modo: cfg.credito, lang: lang, oscuro: !!window.PYD_CREDITO_OSCURO }); }
  function aplicarFondos() {
    var F = cfg.tarjeta.fondos, fo = F.formulario || {}, ft = F.tarjeta || {}, caja = el.caja;
    caja.style.backgroundColor = fo.tipo === 'transparente' ? 'transparent' : fo.tipo === 'imagen' ? '#fff' : (fo.color || '#fff');
    if (fo.tipo === 'imagen') resolverFondo('formulario').then(function (u) { caja.style.backgroundImage = 'url("' + u + '")'; }); else caja.style.backgroundImage = 'none';   /* cover · 50% 50% en el CSS */
    caja.style.boxShadow = fo.tipo === 'transparente' ? 'none' : '';
    el.tarjeta.style.background = ft.tipo === 'color' ? cfg.tarjeta.colores.papel : 'transparent';
    el.tarjeta.style.boxShadow = ft.tipo === 'transparente' ? 'none' : '';
    RAIZ.querySelector('.rsvp-raiz').style.setProperty('--campo', rgba(cfg.tarjeta.colores.campo || '#F9F5F2', cfg.tarjeta.campo_alfa));
    RAIZ.querySelector('.rsvp-raiz').style.setProperty('--fz', escala(cfg.form.escala_fuente));   /* tamaño de todas las letras del formulario (50–200 %) */
    var L = cfg.form.logo || {};
    el.logoRsvp.hidden = !L.mostrar;
    if (L.mostrar) {
      el.logoRsvp.style.width = Math.max(40, Math.min(360, parseInt(L.ancho, 10) || 140)) + 'px';
      el.logoRsvp.onerror = function () { el.logoRsvp.hidden = true; };
      if (el.logoRsvp.getAttribute('src') !== urlEvento('rsvp_logo.png')) el.logoRsvp.src = urlEvento('rsvp_logo.png');
    }
  }
  function aplicarProyecto(p) {
    if (!p) return;
    cfg.nombre = p.nombre || ''; cfg.urlRsvp = p.urlRsvp || ''; cfg.urlInvitacion = p.urlInvitacion || '';
    cfg.pasesMax = p.pasesMax || 10;
    cfg.idiomas = String(p.idioma || 'es').split(',').filter(function (x) { return TXT[x]; });
    if (!cfg.idiomas.length) cfg.idiomas = ['es'];
    cfg.form = fusionar(DEF_FORM, p.formulario || {});
    cfg.form.preguntas = Array.isArray((p.formulario || {}).preguntas) ? p.formulario.preguntas : [];
    cfg.tarjeta = fusionar(DEF_TARJETA, p.tarjeta || {});
    cfg.tarjeta.textos = (p.tarjeta || {}).textos || {};
    estado.fechaLimite = p.fechaLimite || null; estado.abierto = p.abierto !== false; estado.inactivo = p.activo === false; estado.permitirNuevos = p.permitirNuevos !== false;
    if (!estado.existente) estado.pases = Math.max(1, Math.min(cfg.pasesMax, parseInt(PASE_URL, 10) || 1));
    var raiz = RAIZ.querySelector('.rsvp-raiz'), ac = cfg.tarjeta.colores.acento;
    raiz.style.setProperty('--boton', ac); raiz.style.setProperty('--boton-osc', oscurecer(ac, .14));
    el.detMensaje.hidden = !cfg.form.permitir_mensaje;
    aplicarGiro();
    aplicarFondos();
    lang = elegirIdioma(); HOST.setAttribute('lang', lang); aplicarTextos();
    renderPreguntas();
    if (!estado.existente) llenarPases(estado.pases, estado.pases);
    estado.listo = true; el.btnEnviar.disabled = false;
    actualizarCondicionales(); pintarCierre(); pintarSaludo(); bloquearNombre(el.nombre.readOnly);
    if (estado.g) cargarRespuestas(estado.g);
    cfg.credito = p.credito || 'flotante'; ponerCredito();
    emitir('rsvp:proyecto', p); emitir('rsvp:idioma', lang);
    pintarTarjeta();
  }

  /* ================================================================ preguntas configurables */
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
          var lista = tipo === 'sino' ? [['si', T('siCorto')], ['no', T('noCorto')]] : ops.map(function (o) { return [o, o]; });
          var o0 = document.createElement('option'); o0.value = ''; o0.textContent = T('selOpcion'); inp.appendChild(o0);
          lista.forEach(function (o) { var op = document.createElement('option'); op.value = o[0]; op.textContent = o[1]; inp.appendChild(op); });
        } else { inp = document.createElement('input'); inp.type = 'text'; inp.maxLength = 300; }
        inp.id = id; d.appendChild(inp);
        inp.addEventListener('input', function () { inp.classList.remove('invalido'); });
      }
      if (pq.ayuda) { var a = document.createElement('p'); a.className = 'ayuda'; a.textContent = pq.ayuda; d.appendChild(a); }
      el.extras.appendChild(d);
    });
    if (!estado.abierto) el.extras.querySelectorAll('input,select,textarea').forEach(function (x) { x.disabled = true; });
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

  /* ================================================================ formulario */
  function llenarPases(asignados, valor) {
    el.pases.innerHTML = '';
    for (var i = 1; i <= asignados; i++) {
      var o = document.createElement('option'); o.value = i;
      o.textContent = i === 1 ? T('soloYo') : T('yoMas', { n: i, k: i - 1 });
      el.pases.appendChild(o);
    }
    el.pases.value = String(Math.max(1, Math.min(asignados, valor || asignados)));
    el.ayudaPases.textContent = T('tienes', { p: T('pasesRes', { n: asignados }) });
  }
  function pasesElegidos() { return cfg.form.preguntar_pases ? (parseInt(el.pases.value, 10) || estado.pases) : estado.pases; }
  function actualizarCondicionales() {
    var si = el.asistencia.value === 'si';
    el.campoPases.hidden = !(si && cfg.form.preguntar_pases && estado.pases > 1);
    var n = pasesElegidos() - 1;
    el.campoAcomp.hidden = !(si && cfg.form.pedir_acompanantes && n > 0);
    if (!el.campoAcomp.hidden) el.ayudaAcomp.textContent = (n === 1 ? T('acomp1') : T('acompN', { n: n })) + ' \u00b7 ' + T('deN', { k: nombres(el.acompanantes.value).length, n: n });
    el.extras.querySelectorAll('[data-pregunta]').forEach(function (d) { d.hidden = d.dataset.siAsiste === '1' && !si; });
  }
  function pintarSaludo() {
    if (!cfg.form.mostrar_saludo) { el.saludo.hidden = true; return; }
    var mesa = estado.g && estado.g.mesa ? ' \u00b7 ' + T('mesa') + ' ' + estado.g.mesa : '';
    if (!estado.existente) {
      el.saludo.hidden = !PASE_URL;
      el.saludoNombre.textContent = T('bienvenida');
      el.saludoLinea.textContent = T('pasesRes', { n: estado.pases });
      return;
    }
    el.saludo.hidden = false;
    el.saludoNombre.textContent = conTrato({ tratamiento: estado.tratamiento, nombre: el.nombre.value.trim() });
    el.saludoLinea.textContent = T('pasesRes', { n: estado.pases }) + mesa;
  }
  function pintarMeta(g) {
    if (!g || !g.primera || cfg.form.mostrar_fechas === false) { el.meta.hidden = true; return; }
    var partes = [T('primera') + ': ' + fechaLarga(g.primera)];
    if (g.ultima) partes.push(T('ultima') + ': ' + fechaLarga(g.ultima));
    partes.push(T('ediciones') + ': ' + (g.ediciones || 1));
    el.meta.textContent = '';
    partes.forEach(function (t, i) { if (i) el.meta.appendChild(document.createElement('br')); el.meta.appendChild(document.createTextNode(t)); });
    el.meta.hidden = false;
  }
  function pintarCierre() {
    var f = estado.fechaLimite;
    el.plazo.hidden = !f || !estado.abierto || estado.inactivo;
    if (f) el.plazo.textContent = T('plazo', { f: fechaLarga(f) });
    el.avisoCierre.hidden = estado.abierto;
    if (!estado.abierto) {
      el.avisoCierre.textContent = estado.inactivo || !f ? T('inactivo') : T('cerrado', { f: fechaLarga(f) });
      el.form.querySelectorAll('input,select,textarea').forEach(function (x) { x.disabled = true; });
      el.btnEnviar.hidden = true; el.btnBuscar.hidden = true; el.btnCambiar.hidden = true;
    }
  }
  function bloquearNombre(si) {
    el.nombre.readOnly = !!si;
    /* Opción: con link personal (?to=CÓDIGO) no mostrar el campo "Nombre completo" */
    el.campoNombre.hidden = !!si && estado.modo === 'codigo' && cfg.form.mostrar_nombre_codigo === false;
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
    el.btnEnviar.textContent = g.primera ? T('actualizar') : T('enviar');
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
    el.respNovios.hidden = true; el.meta.hidden = true; el.btnEnviar.textContent = T('enviar');
    el.candidatos.hidden = true; el.candidatos.innerHTML = '';
    actualizarCondicionales(); bloquearNombre(false); pintarSaludo(); mensajeEstado(''); pintarTarjeta();
  }

  function buscarPorNombre(nombre) {
    nombre = (nombre || el.nombre.value).trim();
    if (nombre.length < 3) { ayuda(T('min3'), true); return; }
    ayuda(T('buscando')); el.candidatos.hidden = true;
    API.leer({ action: 'buscar', q: nombre }).then(function (r) {
      if (r.encontrado) { cargarInvitado(r.invitado, 'editar'); mensajeEstado(T('encontrado'), 'ok'); return; }
      if (cfg.form.sugerir_nombres && r.candidatos && r.candidatos.length) {
        ayuda(T('candidatos'));
        el.candidatos.innerHTML = '';
        r.candidatos.forEach(function (n) {
          var b = document.createElement('button'); b.type = 'button'; b.textContent = n;
          b.addEventListener('click', function () { el.nombre.value = n; buscarPorNombre(n); });
          el.candidatos.appendChild(b);
        });
        el.candidatos.hidden = false; return;
      }
      ayuda(estado.permitirNuevos ? T('noNombreNuevo') + T('hintDup') : T('noNombre'));
    }).catch(function () { ayuda(T('errBuscar'), true); });
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
      mensajeEstado(primero === el.acompanantes ? el.ayudaAcomp.textContent.split(' \u00b7 ')[0] + '.' : T('obligatorios'), 'error');
      if (primero.focus) primero.focus(); else primero.scrollIntoView({ block: 'center' });
      return null;
    }
    return resp;
  }

  el.form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    if (el.web.value || !estado.abierto || !estado.listo) return;
    var resp = validar(); if (!resp) return;
    mensajeEstado(T('guardando')); el.btnEnviar.disabled = true;
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
        mensajeEstado(r.cambio === false ? T('yaGuardada') : yaTenia ? T('actualizada') : T('recibida'), 'ok');
        if (GIRO.autoGirar && puedeGirar()) setTimeout(function () { girarA('reverso'); }, 900);
        return;
      }
      var e = r.error;
      if (e === 'duplicado') { marcar(el.nombre); mensajeEstado(''); ayuda(T('dupNombre') + T('hintDup'), true); return; }
      if (e === 'no_encontrado') { mensajeEstado(T('noRegistro'), 'error'); reiniciarComoNuevo(false); return; }
      if (e === 'sin_registro') { mensajeEstado(T('sinRegistro'), 'error'); return; }
      if (e === 'pregunta') { var d = el.extras.querySelector('[data-pregunta="' + r.campo + '"]'); if (d) marcar(d.querySelector('.grupo,input,select,textarea')); mensajeEstado(T('obligatorios'), 'error'); return; }
      if (e === 'cerrado') { estado.abierto = false; pintarCierre(); mensajeEstado(''); return; }
      throw new Error(e || 'servidor');
    }).catch(function () {
      mensajeEstado(T('errGuardar'), 'error');
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

  /* ================================================================ tarjeta (canvas 1200×1680 = 5×7 in) */
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
  var imgFondo = { url: '', img: null, prom: null };
  function cargarFondoTarjeta() {
    if ((cfg.tarjeta.fondos.tarjeta || {}).tipo !== 'imagen') return Promise.resolve(null);
    if (imgFondo.prom) return imgFondo.prom;
    imgFondo.prom = resolverFondo('tarjeta').then(function (u) { return new Promise(function (ok) { var im = new Image(); im.onload = function () { ok(im); }; im.onerror = function () { ok(null); }; im.src = u; }); });
    return imgFondo.prom;
  }
  var pintando = null, repintar = false;
  function pintarTarjeta() {
    if (!puedeGirar()) return Promise.resolve();   /* giro bloqueado: la tarjeta ni se dibuja */
    if (pintando) { repintar = true; return pintando; }
    pintando = dibujarTarjeta().catch(function (e) { console.warn('[RSVP] tarjeta:', e); }).then(function () {
      pintando = null; if (repintar) { repintar = false; return pintarTarjeta(); }
    });
    return pintando;
  }
  function dibujarTarjeta() {
    var cv = el.tarjeta, ctx = cv.getContext('2d'), W = cv.width, H = cv.height, Tj = cfg.tarjeta, C = Tj.colores, s = situacion(), g = estado.g || {};
    var titulo = Tj.titulo || cfg.nombre || '', tipoF = (Tj.fondos.tarjeta || {}).tipo || 'color';
    var K = escala(Tj.escala_texto), KQ = escala((Tj.qr || {}).escala), f = function (v) { return Math.round(v * K); };   /* K: letras y separaciones · KQ: código QR */
    var fuentes = document.fonts ? Promise.all([document.fonts.load('100px ' + FUENTES.titulo, titulo || 'A'), document.fonts.load('40px ' + FUENTES.texto)]).catch(function () {}) : Promise.resolve();
    return Promise.all([fuentes, cargarFondoTarjeta()]).then(function (res) {
      var fondo = res[1];
      ctx.clearRect(0, 0, W, H);
      if (tipoF === 'imagen' && fondo) {
        var e = Math.max(W / fondo.naturalWidth, H / fondo.naturalHeight);
        ctx.drawImage(fondo, (W - fondo.naturalWidth * e) / 2, (H - fondo.naturalHeight * e) / 2, fondo.naturalWidth * e, fondo.naturalHeight * e);
      } else if (tipoF !== 'transparente') { ctx.fillStyle = C.papel; ctx.fillRect(0, 0, W, H); }
      if (tipoF !== 'imagen') {
        ctx.strokeStyle = C.acento; ctx.lineWidth = 4; ctx.strokeRect(48, 48, W - 96, H - 96);
        ctx.lineWidth = 1.5; ctx.strokeRect(64, 64, W - 128, H - 128);
      }
      var codigo = estado.codigo, linea = s === 'si' ? T('pasesConf', { n: g.pasesConfirmados || g.pases }) + (g.mesa ? '  \u00b7  ' + T('mesa') + ' ' + g.mesa : '')
                : s === 'pendiente' && g.nombre ? T('pasesRes', { n: g.pases }) : '';
      var msg;
      if (s === 'pendiente') {
        msg = textoTarjeta('mensaje_pendiente');
        if (/\{fecha_limite\}/.test(msg)) msg = estado.fechaLimite ? msg.replace(/\{fecha_limite\}/g, fechaCorta(estado.fechaLimite)) : T('msgEscanear');
      } else msg = g.respuestaNovios || textoTarjeta(s === 'si' ? 'mensaje_si' : 'mensaje_no');
      /* Texto de la tarjeta con el factor K (letras y separaciones). Devuelve la y donde termina. Se usa también como medición (en un lienzo aparte). */
      function trazar(c, K) {
        var f = function (v) { return Math.round(v * K); }, y = 200, etq = textoTarjeta({ pendiente: 'etiqueta_pendiente', si: 'etiqueta_si', no: 'etiqueta_no' }[s]);
        c.textAlign = 'center'; c.textBaseline = 'alphabetic';
        c.fillStyle = C.acento; c.font = '600 ' + f(36) + 'px ' + FUENTES.texto; espaciado(c, String(etq).toUpperCase(), W / 2, y, 12 * K);
        y += f(150); c.fillStyle = C.tinta; c.font = '400 ' + f(116) + 'px ' + FUENTES.titulo; y = envolver(c, titulo, W / 2, y, W - 240, f(120), K > 1.4 ? 3 : 2);
        y += f(56); c.strokeStyle = C.acento; c.lineWidth = 2;
        c.beginPath(); c.moveTo(W / 2 - 130, y); c.lineTo(W / 2 + 130, y); c.stroke();
        c.fillStyle = C.acento; c.beginPath(); c.arc(W / 2, y, 7, 0, Math.PI * 2); c.fill();
        if (Tj.fecha) { y += f(84); c.fillStyle = C.tinta; c.font = '500 ' + f(52) + 'px ' + FUENTES.texto; espaciado(c, Tj.fecha, W / 2, y, 6 * K); }
        if (Tj.lugar) { y += f(56); c.fillStyle = C.suave; c.font = f(34) + 'px ' + FUENTES.texto; y = envolver(c, Tj.lugar, W / 2, y, W - 240, f(40), K > 1.4 ? 3 : 2); }
        if (g.nombre) { y += f(92); c.fillStyle = C.tinta; c.font = 'italic ' + f(46) + 'px ' + FUENTES.texto; y = envolver(c, conTrato(g), W / 2, y, W - 260, f(54), 2); }
        if (linea) { y += f(64); c.fillStyle = C.acento; c.font = '600 ' + f(32) + 'px ' + FUENTES.texto; espaciado(c, linea.toUpperCase(), W / 2, y, 4 * K); }
        c.fillStyle = C.suave; c.font = 'italic ' + f(36) + 'px ' + FUENTES.texto;
        if (s === 'no') { y = Math.max(y + f(140), H / 2 + 40); return envolver(c, msg, W / 2, y, W - 300, f(50), 8); }
        y += f(74); return envolver(c, msg, W / 2, y, W - 280, f(46), K > 1.4 ? 5 : 3);
      }
      /* Si con el tamaño pedido (> 100 %) el texto no deja lugar para un QR legible, se reduce hasta que quepa */
      var Kf = K;
      if (K > 1 && s !== 'no') {
        var med = document.createElement('canvas'); med.width = W; med.height = H;
        var mc = med.getContext('2d'), limite = H - (codigo ? 98 + Math.round(26 * K) + 24 : 70) - 290;   /* deja siempre sitio para un QR legible (≈ 260 px) */
        while (Kf > 1 && trazar(mc, Kf) > limite) Kf = Math.round((Kf - .05) * 100) / 100;
      }
      f = function (v) { return Math.round(v * Kf); };
      var y = trazar(ctx, Kf);
      if (s === 'no') return;
      /* QR: al 100 % es lo más grande posible (máx. 600) y centrado en el espacio libre bajo el texto; la barra lo reduce o lo agranda (hasta donde cabe en la tarjeta) */
      var arriba = y + 50, abajo = H - (codigo ? 150 : 100), libre = abajo - arriba;
      var base = Math.round(Math.max(Kf > 1 ? 200 : 300, Math.min(600, libre - 24))), tope = Math.max(base, Math.min(W - 140, H - (codigo ? 98 + f(26) + 24 : 60) - arriba - 24));
      var qs = KQ <= 1 ? Math.max(120, Math.round(base * KQ)) : Math.min(Math.round(base * KQ), tope), qx = (W - qs) / 2, qy = Math.round(arriba + Math.max(12, (libre - qs) / 2));
      ctx.save(); ctx.fillStyle = '#FFFFFF'; ctx.shadowColor = 'rgba(0,0,0,.08)'; ctx.shadowBlur = 24; ctx.fillRect(qx - 12, qy - 12, qs + 24, qs + 24); ctx.restore();
      var logo = (Tj.logo_qr || '').trim(), Q = Tj.qr || {};
      return QR.dibujarEn(ctx, urlQR(), qx, qy, qs, { ecc: 'M', estilo: Q.estilo || 'redondeado', color: Q.color || C.tinta,
        logo: { activo: !!logo, tipo: 'texto', texto: logo, colorTexto: Q.logo_texto || '#FFFFFF', fondo: Q.logo_fondo || C.acento, forma: Q.logo_forma || 'circulo',
                fuente: 'italic 600 {px}px Georgia, serif', halo: .1, tamano: 'max', ladoMax: .3, ecc: 'H', reservaECC: .5 } }).then(function () {
        if (codigo) { ctx.fillStyle = C.suave; ctx.font = f(26) + 'px ' + FUENTES.texto; espaciado(ctx, codigo, W / 2, H - 98, 10 * Kf); }
      });
    }).then(function () { actualizarAcciones(); });
  }
  function actualizarAcciones() {
    var s = situacion(), titulo = cfg.tarjeta.titulo || cfg.nombre;
    el.tarjeta.setAttribute('aria-label', s === 'si' ? T('ariaSi', { t: titulo }) : s === 'no' ? T('ariaNo') : T('ariaPend', { t: titulo }));
    el.btnConfirmar.hidden = s !== 'pendiente' || !estado.abierto;
    el.btnCal.hidden = s === 'no' || !cfg.tarjeta.evento.inicio;
    el.btnCompartir.hidden = s === 'no' || !puedeCompartir;
    el.btnCopiar.hidden = s === 'no';
    el.btnImprimir.hidden = s === 'no';
    if (el.btnCal.hidden) el.menuCal.hidden = true;
  }

  /* ================================================================ acciones de la tarjeta */
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
    }).catch(function (e) { if (e.name !== 'AbortError') avisoStd(T('errCompartir')); });
  });
  el.btnCopiar.addEventListener('click', function () {
    var ok = navigator.clipboard && window.ClipboardItem && window.isSecureContext;
    (ok ? navigator.clipboard.write([new ClipboardItem({ 'image/png': blobTarjeta() })]).then(function () { avisoStd(T('copiada')); })
        : Promise.reject(new Error('sin portapapeles'))
    ).catch(function () { return blobTarjeta().then(function (b) { descargar(b, nombreArchivo()); avisoStd(T('descargada')); }); })
     .catch(function () { avisoStd(T('errImagen')); });
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
    }).catch(function () { avisoStd(T('errImprimir')); });
  });

  function utc(iso) { return new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''); }
  function escIcs(t) { return String(t).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n'); }
  function evento() { var E = cfg.tarjeta.evento, fin = E.fin || new Date(new Date(E.inicio).getTime() + 6 * 3600e3).toISOString();
    return { titulo: E.titulo || T('bodaDe', { t: cfg.tarjeta.titulo || cfg.nombre }), inicio: E.inicio, fin: fin, lugar: E.lugar || cfg.tarjeta.lugar || '', detalle: E.detalle || '' }; }
  function detalleEvento() {
    var g = estado.g || {}, s = situacion(), url = conTo(cfg.urlInvitacion || cfg.urlRsvp, estado.codigo), d = [evento().detalle];
    if (s === 'si') { d.push(T('pasesConf', { n: g.pasesConfirmados || g.pases }) + (g.mesa ? ' \u00b7 ' + T('mesa') + ' ' + g.mesa : '')); d.push(T('tuInv') + url); }
    else d.push(T('confirmaCal') + (estado.fechaLimite ? T('antesDel', { f: fechaCorta(estado.fechaLimite) }) : '') + ': ' + urlQR());
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

  /* Alto mínimo del formulario = alto de la tarjeta (5×7): al girar ambas caras se ven del mismo tamaño.
     Si hay muchas preguntas, el formulario crece normalmente. */
  function altoMinimo() { var w = el.caja.offsetWidth; if (w && puedeGirar()) el.caja.style.minHeight = Math.round(w * 7 / 5) + 'px'; else el.caja.style.minHeight = ''; }
  if (window.ResizeObserver) new ResizeObserver(altoMinimo).observe(el.caja); else window.addEventListener('resize', altoMinimo);
  altoMinimo();

  /* ================================================================ giro de la tarjeta */
  /* El giro se dibuja con JS (requestAnimationFrame), no con transiciones CSS: funciona igual en iPhone y Android y aunque el sistema pida «reducir movimiento».
       · La tarjeta es un objeto rígido que gira sobre su eje vertical y «ang» es ese ángulo (grados). Arrastrar el dedo hacia la DERECHA suma ángulo y hacia
         la IZQUIERDA lo resta, desde cualquier punto: la superficie sigue al dedo (la orilla derecha jalada hacia la izquierda se acerca a ti; la orilla
         izquierda jalada hacia la derecha también). Desde el reverso pasa lo mismo.
       · No usa backface-visibility (Safari la ignora dentro de contenedores con recortes): la cara se cambia justo a los 90°, así el contenido nunca se ve en espejo.
       · La altura de la sección cambia poco a poco junto con el giro (sin saltos). */
  var ang = 0, atras = false, ini = null, arrastrando = false, raf = 0, medidas = null;
  var PERSP = 'perspective(1600px) rotateY(';
  var norm = function (a) { return ((a % 360) + 540) % 360 - 180; };                  /* (-180, 180] */
  function puedeGirar() { return cfg.form.permitir_giro !== false; }
  function aplicarGiro() {
    var pg = puedeGirar();
    el.reverso.hidden = !pg;                                                        /* giro bloqueado: sin tarjeta */
    el.btnVerTarjeta.parentNode.hidden = !pg || cfg.form.mostrar_voltear === false;  /* botón "Voltear tarjeta" */
    el.escena.style.touchAction = pg ? '' : 'auto';
    altoMinimo();
  }
  function pintarAng(a) {
    var n = norm(a), abs = Math.abs(n), c2 = abs > 90, rad = a * Math.PI / 180, sh = (Math.abs(Math.sin(rad)) * .9).toFixed(3);
    el.frente.style.visibility = c2 ? 'hidden' : 'visible'; el.reverso.style.visibility = c2 ? 'visible' : 'hidden';
    el.frente.style.setProperty('--shade', sh); el.reverso.style.setProperty('--shade', sh);
    el.frente.style.transform = c2 || abs < .01 ? 'none' : PERSP + n + 'deg)';
    el.reverso.style.transform = !c2 ? 'none' : PERSP + (n - (n > 0 ? 180 : -180)) + 'deg)';
    if (medidas) el.escena.style.height = Math.round(medidas.f + (medidas.b - medidas.f) * (1 - Math.cos(rad)) / 2) + 'px';
  }
  /* Cada cara por separado ocupa su alto natural; el de la sección pasa del uno al otro mientras gira */
  function liberarAltura() { [el.frente, el.reverso].forEach(function (c) { c.style.maxHeight = ''; c.style.overflow = ''; }); }
  function ajustarAltura() {
    var vis = atras ? el.reverso : el.frente, oc = atras ? el.frente : el.reverso;
    vis.style.maxHeight = ''; vis.style.overflow = ''; oc.style.maxHeight = vis.offsetHeight + 'px'; oc.style.overflow = 'hidden';
  }
  function medir() { liberarAltura(); medidas = { f: el.frente.offsetHeight, b: el.reverso.offsetHeight }; }
  function fin(destino) {
    medidas = null; el.escena.style.height = '';
    ang = destino - 360 * Math.round(destino / 360); pintarAng(ang);                /* 0 (frente) o ±180 (reverso) */
    el.frente.inert = atras; el.reverso.inert = !atras;
    el.frente.setAttribute('aria-hidden', String(atras)); el.reverso.setAttribute('aria-hidden', String(!atras));
    ajustarAltura();
    if (!atras) el.menuCal.hidden = true;
  }
  function animar(destino) {                 /* destino: 0 · ±180 · ±360 (grados) */
    cancelAnimationFrame(raf);
    if (!medidas) medir();
    var desde = ang, dur = Math.max(280, GIRO.duracion * Math.abs(destino - desde) / 180) + Math.min(550, Math.abs(medidas.b - medidas.f) * .9), t0 = performance.now();   /* más lento si cambia mucho de altura */
    atras = Math.abs(norm(destino)) > 90;
    (function paso(ahora) {
      var p = Math.min(1, (ahora - t0) / dur), e = p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;   /* easeInOutCubic */
      ang = desde + (destino - desde) * e; pintarAng(ang);
      if (p < 1) raf = requestAnimationFrame(paso); else fin(destino);
    })(t0);
  }
  function girarA(destino) {
    if (!puedeGirar()) return;
    var quiere = destino === 'reverso';
    if (quiere === atras && !medidas) return;
    animar(quiere ? (ang > 1 ? 180 : -180) : 0);       /* al reverso con los botones: como pasar una hoja (la orilla derecha viene hacia ti) */
  }
  window.RSVP_TARJETA = { girar: girarA, repintar: pintarTarjeta };
  el.escena.addEventListener('pointerdown', function (e) {
    if (!puedeGirar() || (e.pointerType === 'mouse' && e.button !== 0) || e.target.closest('input,textarea,select,button,a,label,summary,.candidatos,.opciones,[data-no-giro]')) return;
    ini = { x: e.clientX, y: e.clientY, id: e.pointerId, w: el.escena.getBoundingClientRect().width || 1, base: 0, lx: e.clientX, lt: performance.now(), v: 0 };
  });
  el.escena.addEventListener('pointermove', function (e) {
    if (!ini || e.pointerId !== ini.id) return;
    var dx = e.clientX - ini.x, dy = e.clientY - ini.y, ahora = performance.now();
    if (!arrastrando) {
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
      if (Math.abs(dy) > Math.abs(dx)) { ini = null; return; }       /* movimiento vertical: es para desplazar la página */
      arrastrando = true; el.escena.classList.add('arrastrando');
      cancelAnimationFrame(raf); medir(); ini.x = e.clientX; ini.lx = e.clientX; ini.lt = ahora; ini.base = Math.round(ang / 180) * 180;
      try { el.escena.setPointerCapture(e.pointerId); } catch (x) {}
      return;
    }
    e.preventDefault();
    var d = Math.max(-180, Math.min(180, (e.clientX - ini.x) / ini.w * 180 * 1.1));
    ang = ini.base + d; pintarAng(ang);
    if (ahora - ini.lt > 16) { ini.v = (e.clientX - ini.lx) / (ahora - ini.lt); ini.lx = e.clientX; ini.lt = ahora; }
  });
  function soltar(e) {
    if (!ini || e.pointerId !== ini.id) return;
    var era = arrastrando, i = ini, delta = ang - i.base; ini = null; arrastrando = false; el.escena.classList.remove('arrastrando');
    if (!era) return;
    var rapido = Math.abs(i.v) > .5 && Math.abs(delta) > 18 && (i.v > 0) === (delta > 0);      /* un gesto rápido también completa el giro */
    animar(Math.abs(delta) > GIRO.umbral || rapido ? i.base + (delta > 0 ? 180 : -180) : i.base);
  }
  el.escena.addEventListener('pointerup', soltar);
  el.escena.addEventListener('pointercancel', soltar);
  /* OJO (celulares): al llamar setPointerCapture, el navegador dispara 'lostpointercapture' sobre el elemento que tenía la captura
     implícita del toque y el evento sube hasta aquí. Solo cuenta si la captura se pierde en la propia escena. */
  el.escena.addEventListener('lostpointercapture', function (e) { if (e.target === el.escena) soltar(e); });
  el.btnVerTarjeta.addEventListener('click', function () { girarA('reverso'); });
  el.btnVolver.addEventListener('click', function () { girarA('frente'); });
  el.btnConfirmar.addEventListener('click', function () { girarA('frente'); setTimeout(function () { (el.nombre.readOnly ? el.asistencia : el.nombre).focus({ preventScroll: true }); }, GIRO.duracion); });

  /* ================================================================ arranque */
  el.btnEnviar.disabled = true;
  llenarPases(estado.pases, estado.pases);
  /* Errores que impiden cargar el formulario: mensaje para el invitado + detalle técnico para quien instala */
  var DIAG = {
    proyecto: 'evento «' + (PYD.slug || '¿?') + '» no encontrado (revisa el nombre de la carpeta o usa ?p=identificador)',
    config: 'falta configurar SUPABASE_URL / SUPABASE_ANON en assets/pyd-config.js',
    llave: 'Supabase rechazó la llave (revisa la Publishable key en assets/pyd-config.js)',
    sql: 'no existe la función rsvp en Supabase (ejecuta supabase/01_esquema.sql)'
  };
  function errorProyecto(e) {
    var c = (e && e.codigo) || 'proyecto';
    mensajeEstado(T('noProyecto'), 'error');
    var d = document.createElement('small'); d.style.cssText = 'display:block;margin-top:6px;font-size:11px;opacity:.75';
    d.textContent = '(' + (DIAG[c] || (e && e.message) || c) + ')'; el.estado.appendChild(d);
    console.error('[RSVP] No se pudo cargar el evento:', DIAG[c] || e, '· slug:', PYD.slug, '· Supabase:', PYD.SUPABASE_URL);
    el.form.querySelectorAll('input,select,textarea,button').forEach(function (x) { x.disabled = true; });
  }
  var esGrave = function (e) { return e && /^(proyecto|config|llave|sql)$/.test(e.codigo); };
  function sinCodigo(clave) { reiniciarComoNuevo(true); ayuda(clave ? T(clave) + (clave === 'noCodigo' ? T('hintDup') : '') : ''); }
  if (!CODIGO_URL) {
    sinCodigo('intro');
    API.proyecto().then(function (p) { aplicarProyecto(p); sinCodigo('intro'); })
      .catch(function (e) { if (esGrave(e)) errorProyecto(e); else { mensajeEstado(T('errForm'), 'error'); console.error('[RSVP]', e); } });
  } else {
    mensajeEstado(T('cargando'));
    var alReintento = function (e) { mensajeEstado(T('cargando') + ' ' + T('reintento', { i: e.detail.i, n: e.detail.total })); };
    window.addEventListener('boda:reintento', alReintento);
    API.invitado(CODIGO_URL).then(function (r) {
      window.removeEventListener('boda:reintento', alReintento); mensajeEstado('');
      aplicarProyecto(r.proyecto);
      if (r.encontrado) cargarInvitado(r.invitado, 'codigo');
      else sinCodigo('noCodigo');
    }).catch(function (e) {
      window.removeEventListener('boda:reintento', alReintento); mensajeEstado('');
      if (esGrave(e)) return errorProyecto(e);
      sinCodigo('errDatos');
      API.proyecto().then(aplicarProyecto).catch(function () {});
    });
  }
})();
