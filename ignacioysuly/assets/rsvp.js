/* rsvp.js — RSVP + Tarjeta (Save the Date / Pase) · Ignacio & Suly
 * Datos: assets/boda-api.js (Supabase). QR: assets/qr.js.
 *
 * Entradas por URL:
 *   ?to=AB12   → invitado con código: tratamiento, nombre (bloqueado), pases y últimas respuestas
 *   ?pase=2    → invitado nuevo (sin código) con 2 pases
 * Código erróneo o inexistente → el nombre queda libre para buscar el registro o crear uno nuevo.
 */
(function () {
  'use strict';

  /* ==================================================================================
     CONFIGURACIÓN DEL PROYECTO (textos y diseño de la tarjeta: editar por proyecto)
     ================================================================================== */
  var CFG = {
    novios: 'Ignacio & Suly',
    urlBase: null,          // null = esta misma página (…?to=CODIGO). Para pruebas locales: 'https://bodas.parteydetalles.com/ignacioysuly'
    evento: {               // para "Agregar al calendario"            ← EDITAR
      titulo: 'Boda de Ignacio & Suly',
      inicio: '2027-05-15T16:00:00-05:00',
      fin: '2027-05-16T02:00:00-05:00',
      lugar: 'Lima, Perú',
      detalle: 'Ceremonia y recepción.'
    },
    tarjeta: {              // diseño del Save the Date (canvas 1200×1680 → 5×7 in)   ← EDITAR
      fecha: '15 · 05 · 2027',
      lugar: 'Sábado · Lima, Perú',
      foto: '',             // opcional: 'assets/novios.jpg' (mismo dominio) → círculo bajo el título
      papel: '#FBF8F3', tinta: '#2B2622', acento: '#B08D57', suave: '#8A7F75',
      titulo: '"Titulo Boda", "Snell Roundhand", Georgia, serif',
      texto: 'Georgia, "Times New Roman", serif'
    },
    qr: { ecc: 'M', estilo: 'redondeado', color: '#2B2622',
          logo: { activo: true, tipo: 'texto', texto: 'I&S', colorTexto: '#FFFFFF', fondo: '#B08D57', forma: 'circulo',
                  fuente: 'italic 600 {px}px Georgia, serif', halo: .1, tamano: 'max', ladoMax: .3, ecc: 'H', reservaECC: .5 } },
    textos: {
      etiqueta: { pendiente: 'Save the date', si: 'Te esperamos', no: 'Gracias' },
      graciasSi: '¡Gracias por confirmar! Nos hace muy felices celebrar este día contigo.',
      graciasNo: 'Gracias por avisarnos. Te tendremos presente en nuestro día.',
      pendiente: 'Confirma tu asistencia escaneando el código'
    },
    giro: { umbral: 90, duracion: 650, autoGirar: true },
    pasesMax: 10
  };
  /* ================================================================================== */

  if (window.__rsvpIniciado) return;
  var HOST = document.getElementById('rsvp');
  var RAIZ = (HOST && HOST.shadowRoot) || document;
  var $ = function (id) { return RAIZ.getElementById ? RAIZ.getElementById(id) : RAIZ.querySelector('#' + id); };
  var API = window.BODA;
  if (!API) { console.warn('[RSVP] Falta assets/boda-api.js'); return; }
  if (!$('form')) { console.warn('[RSVP] No se encontró el bloque RSVP'); return; }
  window.__rsvpIniciado = true;

  var q = new URLSearchParams(location.search);
  var CODIGO_URL = (q.get('to') || q.get('codigo') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  var PASE_URL = q.get('pase') || q.get('pases');
  var PASES_URL = Math.max(1, Math.min(CFG.pasesMax, parseInt(PASE_URL, 10) || 1));

  var el = {};
  ['form', 'nombre', 'asistencia', 'pases', 'mensaje', 'det-mensaje', 'contador', 'saludo', 'saludo-nombre', 'saludo-linea',
   'ayuda-nombre', 'candidatos', 'btn-buscar', 'btn-cambiar', 'btn-enviar', 'estado', 'meta', 'resp-novios', 'resp-novios-txt',
   'web', 'campo-pases', 'ayuda-pases', 'plazo', 'aviso-cierre', 'escena', 'giro', 'frente', 'reverso', 'tarjeta', 'pista',
   'btn-ver-tarjeta', 'btn-volver', 'btn-cal', 'menu-cal', 'cal-ics', 'cal-google', 'btn-compartir', 'btn-copiar', 'btn-imprimir',
   'btn-confirmar', 'aviso-std'].forEach(function (id) { el[id.replace(/-(\w)/g, function (_, c) { return c.toUpperCase(); })] = $(id); });

  /* modo: 'nuevo' (crea registro) | 'editar' (hallado por nombre) | 'codigo' (hallado por código) */
  var estado = { modo: 'nuevo', codigo: '', pases: PASES_URL, existente: false, tratamiento: '', g: null,
                 abierto: true, fechaLimite: null, permitirNuevos: true };

  /* ------------------------------------------------------------------ utilidades */
  function fechaLarga(iso) {
    var d = iso ? new Date(iso) : null;
    return d && !isNaN(d) ? d.toLocaleString('es-PE', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }) : '';
  }
  function fechaCorta(iso) {
    var d = iso ? new Date(iso) : null;
    return d && !isNaN(d) ? d.toLocaleDateString('es-PE', { day: 'numeric', month: 'long' }) : '';
  }
  function conTrato(g) { var t = (g.tratamiento || '').trim(), n = g.nombre || ''; return t && n.toLowerCase().indexOf(t.toLowerCase()) !== 0 ? t + ' ' + n : n; }
  function plural(n, s, p) { n = parseInt(n, 10) || 0; return n + ' ' + (n === 1 ? s : p); }
  function mensajeEstado(txt, tipo) { el.estado.textContent = txt || ''; el.estado.className = 'estado' + (tipo ? ' ' + tipo : ''); }
  function ayuda(txt, error) { el.ayudaNombre.hidden = !txt; el.ayudaNombre.textContent = txt || ''; el.ayudaNombre.className = 'ayuda' + (error ? ' error' : ''); }
  var avisoT;
  function avisoStd(txt) { el.avisoStd.textContent = txt; clearTimeout(avisoT); avisoT = setTimeout(function () { el.avisoStd.textContent = ''; }, 4000); }
  function actualizarContador() { el.contador.textContent = el.mensaje.value.length; }
  var HINT_DUP = 'Si hay otra persona con tu mismo nombre, agrega tu apellido o el parentesco entre par\u00e9ntesis, por ejemplo: P\u00e9rez (Padre).';

  /* ------------------------------------------------------------------ formulario */
  function llenarPases(asignados, valor) {
    el.pases.innerHTML = '';
    for (var i = 1; i <= asignados; i++) {
      var o = document.createElement('option');
      o.value = i;
      o.textContent = i === 1 ? '1 \u00b7 solo yo' : i + ' \u00b7 yo + ' + plural(i - 1, 'acompa\u00f1ante', 'acompa\u00f1antes');
      el.pases.appendChild(o);
    }
    el.pases.value = String(Math.max(1, Math.min(asignados, valor || asignados)));
    el.ayudaPases.textContent = 'Tienes ' + plural(asignados, 'pase reservado', 'pases reservados') + '.';
  }
  function actualizarPasesUI() { el.campoPases.hidden = !(el.asistencia.value === 'si' && estado.pases > 1); }

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
      ['nombre', 'asistencia', 'pases', 'mensaje'].forEach(function (k) { el[k].disabled = true; });
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
    llenarPases(estado.pases, g.pasesConfirmados || estado.pases); actualizarPasesUI();
    el.mensaje.value = g.mensaje || ''; actualizarContador(); el.detMensaje.open = !!g.mensaje;
    el.respNovios.hidden = !g.respuestaNovios; el.respNoviosTxt.textContent = g.respuestaNovios || '';
    el.btnEnviar.textContent = g.primera ? 'Actualizar' : 'Enviar';
    ayuda(''); el.candidatos.hidden = true; el.candidatos.innerHTML = '';
    bloquearNombre(true); pintarSaludo(); pintarMeta(g); pintarTarjeta();
  }
  function reiniciarComoNuevo(limpiarNombre) {
    estado.modo = 'nuevo'; estado.existente = false; estado.codigo = ''; estado.tratamiento = ''; estado.pases = PASES_URL; estado.g = null;
    if (limpiarNombre) el.nombre.value = '';
    el.asistencia.value = ''; llenarPases(estado.pases, estado.pases); actualizarPasesUI();
    el.mensaje.value = ''; actualizarContador(); el.detMensaje.open = false;
    el.respNovios.hidden = true; el.meta.hidden = true; el.btnEnviar.textContent = 'Enviar';
    el.candidatos.hidden = true; el.candidatos.innerHTML = '';
    bloquearNombre(false); pintarSaludo(); mensajeEstado(''); pintarTarjeta();
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

  function validar() {
    var ok = true;
    el.nombre.classList.remove('invalido'); el.asistencia.classList.remove('invalido');
    if (el.nombre.value.trim().length < 3) { el.nombre.classList.add('invalido'); ok = false; }
    if (!el.asistencia.value) { el.asistencia.classList.add('invalido'); ok = false; }
    if (!ok) { mensajeEstado('Por favor completa los campos obligatorios (*).', 'error'); (el.nombre.classList.contains('invalido') ? el.nombre : el.asistencia).focus(); }
    return ok;
  }

  el.form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    if (el.web.value || !estado.abierto) return;
    if (!validar()) return;
    mensajeEstado('Guardando\u2026'); el.btnEnviar.disabled = true;
    var asis = el.asistencia.value;
    API.post({
      action: 'guardar', modo: estado.modo, codigo: estado.codigo, nombre: el.nombre.value.trim(), asistencia: asis,
      pasesConfirmados: asis === 'si' ? parseInt(el.pases.value, 10) || estado.pases : 0,
      mensaje: el.mensaje.value.trim(), pases: estado.pases
    }).then(function (r) {
      if (r.ok) {
        var yaTenia = !!(estado.g && estado.g.primera);
        cargarInvitado(r.invitado, estado.modo === 'codigo' ? 'codigo' : 'editar');
        if (r.invitado.codigo && history.replaceState && !CODIGO_URL) history.replaceState(null, '', location.pathname + '?to=' + encodeURIComponent(r.invitado.codigo));
        mensajeEstado(r.cambio === false ? 'Tu respuesta ya estaba guardada.' : yaTenia ? '\u00a1Listo! Actualizamos tu respuesta. \ud83d\udc9b' : '\u00a1Gracias! Recibimos tu respuesta. \ud83d\udc9b', 'ok');
        if (CFG.giro.autoGirar) setTimeout(function () { girarA('reverso'); }, 900);
        return;
      }
      var e = r.error;
      if (e === 'duplicado') { el.nombre.classList.add('invalido'); el.nombre.focus(); mensajeEstado(''); ayuda('Ese nombre ya est\u00e1 registrado. ' + HINT_DUP, true); return; }
      if (e === 'no_encontrado') { mensajeEstado('No encontramos tu registro. Vuelve a buscarlo por nombre.', 'error'); reiniciarComoNuevo(false); return; }
      if (e === 'sin_registro') { mensajeEstado('No encontramos tu nombre en la lista de invitados. Revisa c\u00f3mo est\u00e1 escrito o escr\u00edbenos.', 'error'); return; }
      if (e === 'cerrado') { estado.abierto = false; pintarCierre(); mensajeEstado(''); return; }
      throw new Error(e || 'servidor');
    }).catch(function () {
      mensajeEstado('No pudimos guardar. Revisa tu conexi\u00f3n e int\u00e9ntalo de nuevo.', 'error');
    }).then(function () { el.btnEnviar.disabled = false; });
  });

  el.mensaje.addEventListener('input', actualizarContador);
  el.asistencia.addEventListener('change', function () { el.asistencia.classList.remove('invalido'); actualizarPasesUI(); });
  el.btnBuscar.addEventListener('click', function () { buscarPorNombre(); });
  el.btnCambiar.addEventListener('click', function () { reiniciarComoNuevo(true); el.nombre.focus(); });
  el.nombre.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !el.nombre.readOnly) { e.preventDefault(); buscarPorNombre(); } });
  el.nombre.addEventListener('input', function () { el.nombre.classList.remove('invalido'); if (!el.nombre.readOnly) { ayuda(''); el.candidatos.hidden = true; } });

  /* ------------------------------------------------------------------ tarjeta (canvas) */
  function situacion() { var a = estado.g && estado.g.asistenciaCodigo; return a === 'si' || a === 'no' ? a : 'pendiente'; }
  function urlInvitacion(codigo) {
    var u = new URL(CFG.urlBase || location.href); u.search = ''; u.hash = '';
    if (codigo) u.searchParams.set('to', codigo);
    return u.toString();
  }
  var fotoImg = null;
  function cargarFoto() {
    if (!CFG.tarjeta.foto || fotoImg) return Promise.resolve(fotoImg);
    return new Promise(function (ok) { var im = new Image(); im.onload = function () { fotoImg = im; ok(im); }; im.onerror = function () { ok(null); }; im.src = CFG.tarjeta.foto; });
  }
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
    var cv = el.tarjeta, ctx = cv.getContext('2d'), W = cv.width, H = cv.height, T = CFG.tarjeta, s = situacion(), g = estado.g || {};
    var fuentes = document.fonts ? Promise.all([document.fonts.load('100px ' + T.titulo, CFG.novios), document.fonts.load('40px ' + T.texto)]).catch(function () {}) : Promise.resolve();
    return Promise.all([fuentes, cargarFoto()]).then(function () {
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = T.papel; ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = T.acento; ctx.lineWidth = 4; ctx.strokeRect(48, 48, W - 96, H - 96);
      ctx.lineWidth = 1.5; ctx.strokeRect(64, 64, W - 128, H - 128);
      ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      var y = 200;
      ctx.fillStyle = T.acento; ctx.font = '600 36px ' + T.texto; espaciado(ctx, CFG.textos.etiqueta[s].toUpperCase(), W / 2, y, 12);
      if (fotoImg) {
        var r = 140, cy = y + 60 + r;
        ctx.save(); ctx.beginPath(); ctx.arc(W / 2, cy, r, 0, Math.PI * 2); ctx.clip();
        var e = Math.max(2 * r / fotoImg.naturalWidth, 2 * r / fotoImg.naturalHeight);
        ctx.drawImage(fotoImg, W / 2 - fotoImg.naturalWidth * e / 2, cy - fotoImg.naturalHeight * e / 2, fotoImg.naturalWidth * e, fotoImg.naturalHeight * e);
        ctx.restore(); ctx.strokeStyle = T.acento; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(W / 2, cy, r, 0, Math.PI * 2); ctx.stroke();
        y = cy + r;
      }
      y += 150; ctx.fillStyle = T.tinta; ctx.font = '400 116px ' + T.titulo; y = envolver(ctx, CFG.novios, W / 2, y, W - 240, 120, 2);
      y += 56; ctx.strokeStyle = T.acento; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(W / 2 - 130, y); ctx.lineTo(W / 2 + 130, y); ctx.stroke();
      ctx.fillStyle = T.acento; ctx.beginPath(); ctx.arc(W / 2, y, 7, 0, Math.PI * 2); ctx.fill();
      y += 84; ctx.fillStyle = T.tinta; ctx.font = '500 52px ' + T.texto; espaciado(ctx, T.fecha, W / 2, y, 6);
      y += 56; ctx.fillStyle = T.suave; ctx.font = '34px ' + T.texto; ctx.fillText(T.lugar, W / 2, y);
      if (g.nombre) { y += 92; ctx.fillStyle = T.tinta; ctx.font = 'italic 46px ' + T.texto; y = envolver(ctx, conTrato(g), W / 2, y, W - 260, 54, 2); }
      var linea = s === 'si' ? plural(g.pasesConfirmados || g.pases, 'pase confirmado', 'pases confirmados') + (g.mesa ? '  \u00b7  Mesa ' + g.mesa : '')
                : s === 'pendiente' && g.nombre ? plural(g.pases, 'pase reservado', 'pases reservados') : '';
      if (linea) { y += 64; ctx.fillStyle = T.acento; ctx.font = '600 32px ' + T.texto; espaciado(ctx, linea.toUpperCase(), W / 2, y, 4); }
      var msg = s === 'pendiente' ? (estado.fechaLimite ? 'Confirma tu asistencia antes del ' + fechaCorta(estado.fechaLimite) : CFG.textos.pendiente)
                                  : (g.respuestaNovios || (s === 'si' ? CFG.textos.graciasSi : CFG.textos.graciasNo));
      ctx.fillStyle = T.suave; ctx.font = 'italic 36px ' + T.texto;
      if (s === 'no') { y = Math.max(y + 140, H / 2 + 40); envolver(ctx, msg, W / 2, y, W - 300, 50, 8); return; }
      y += 74; y = envolver(ctx, msg, W / 2, y, W - 280, 46, 3);
      var codigo = estado.codigo, abajo = H - (codigo ? 150 : 110), qs = Math.max(320, Math.min(520, abajo - y - 50)), qx = (W - qs) / 2, qy = abajo - qs;
      ctx.save(); ctx.fillStyle = '#FFFFFF'; ctx.shadowColor = 'rgba(0,0,0,.08)'; ctx.shadowBlur = 24; ctx.fillRect(qx - 12, qy - 12, qs + 24, qs + 24); ctx.restore();
      return QR.dibujarEn(ctx, urlInvitacion(codigo), qx, qy, qs, CFG.qr).then(function () {
        if (codigo) { ctx.fillStyle = T.suave; ctx.font = '26px ' + T.texto; espaciado(ctx, codigo, W / 2, H - 98, 10); }
      });
    }).then(function () { actualizarAcciones(); });
  }
  function actualizarAcciones() {
    var s = situacion();
    el.tarjeta.setAttribute('aria-label', s === 'si' ? 'Tu pase para la boda de ' + CFG.novios : s === 'no' ? 'Mensaje de agradecimiento' : 'Save the Date de ' + CFG.novios);
    el.btnConfirmar.hidden = s !== 'pendiente' || !estado.abierto;
    el.btnCal.hidden = s === 'no';
    el.btnCompartir.hidden = s === 'no' || !puedeCompartir;
    el.btnCopiar.hidden = s === 'no';
    el.btnImprimir.hidden = s === 'no';
    if (s === 'no') el.menuCal.hidden = true;
  }

  /* ------------------------------------------------------------------ acciones de la tarjeta */
  var puedeCompartir = !!(navigator.share && navigator.canShare && navigator.canShare({ files: [new File([''], 'x.png', { type: 'image/png' })] }));
  function nombreArchivo() { return 'save_the_date_' + (estado.codigo || 'invitacion') + '.png'; }
  function blobTarjeta() { return pintarTarjeta().then(function () { return new Promise(function (ok, ko) { el.tarjeta.toBlob(function (b) { b ? ok(b) : ko(new Error('png')); }, 'image/png'); }); }); }
  function descargar(blob, nombre) {
    var u = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = u; a.download = nombre; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(u); }, 5000);
  }
  function compartir() {
    return blobTarjeta().then(function (b) {
      return navigator.share({ files: [new File([b], nombreArchivo(), { type: 'image/png' })], title: CFG.evento.titulo, text: urlInvitacion(estado.codigo) });
    });
  }
  el.btnCompartir.addEventListener('click', function () { compartir().catch(function (e) { if (e.name !== 'AbortError') avisoStd('No se pudo compartir.'); }); });
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

  /* Calendario: .ics (iPhone, Mac, Outlook…) y enlace de Google Calendar */
  function utc(iso) { return new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''); }
  function escIcs(t) { return String(t).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n'); }
  function detalleEvento() {
    var g = estado.g || {}, s = situacion(), url = urlInvitacion(estado.codigo), d = [CFG.evento.detalle];
    if (s === 'si') { d.push(plural(g.pasesConfirmados || g.pases, 'pase confirmado', 'pases confirmados') + (g.mesa ? ' \u00b7 Mesa ' + g.mesa : '')); d.push('Tu invitaci\u00f3n: ' + url); }
    else d.push('Confirma tu asistencia' + (estado.fechaLimite ? ' antes del ' + fechaCorta(estado.fechaLimite) : '') + ': ' + url);
    return d.filter(Boolean).join('\n');
  }
  el.btnCal.addEventListener('click', function () { el.menuCal.hidden = !el.menuCal.hidden; el.btnCal.setAttribute('aria-expanded', String(!el.menuCal.hidden)); });
  el.calIcs.addEventListener('click', function () {
    var E = CFG.evento, uid = (estado.codigo || 'general') + '-' + utc(E.inicio) + '@parteydetalles.com';
    var ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//parteydetalles//boda//ES', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'BEGIN:VEVENT',
      'UID:' + uid, 'DTSTAMP:' + utc(new Date().toISOString()), 'DTSTART:' + utc(E.inicio), 'DTEND:' + utc(E.fin),
      'SUMMARY:' + escIcs(E.titulo), 'LOCATION:' + escIcs(E.lugar), 'DESCRIPTION:' + escIcs(detalleEvento()), 'URL:' + urlInvitacion(estado.codigo),
      'BEGIN:VALARM', 'TRIGGER:-P7D', 'ACTION:DISPLAY', 'DESCRIPTION:' + escIcs(E.titulo), 'END:VALARM',
      'BEGIN:VALARM', 'TRIGGER:-P1D', 'ACTION:DISPLAY', 'DESCRIPTION:' + escIcs(E.titulo), 'END:VALARM',
      'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    descargar(new Blob([ics], { type: 'text/calendar;charset=utf-8' }), 'boda.ics');
    el.menuCal.hidden = true;
  });
  el.calGoogle.addEventListener('click', function () {
    var E = CFG.evento, p = new URLSearchParams({ action: 'TEMPLATE', text: E.titulo, dates: utc(E.inicio) + '/' + utc(E.fin), details: detalleEvento(), location: E.lugar });
    window.open('https://calendar.google.com/calendar/render?' + p.toString(), '_blank', 'noopener');
    el.menuCal.hidden = true;
  });

  /* ------------------------------------------------------------------ giro controlado por el dedo */
  var reducido = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var rot = 0, actual = 0, ini = null, arrastrando = false;
  function aplicar(ang, dur) {
    el.giro.style.setProperty('--dur', (reducido ? Math.min(dur, 150) : dur) + 'ms');
    el.giro.style.transform = 'rotateY(' + ang + 'deg)';
    el.giro.style.setProperty('--shade', (Math.abs(Math.sin(ang * Math.PI / 180)) * .9).toFixed(3));
    actual = ang;
  }
  function asentar(destino) {
    var dur = Math.max(180, CFG.giro.duracion * Math.abs(destino - actual) / 180);
    rot = destino; aplicar(destino, dur);
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
    if (e.button !== 0 || e.target.closest('input,textarea,select,button,a,label,summary,.candidatos,[data-no-giro]')) return;
    ini = { x: e.clientX, y: e.clientY, id: e.pointerId, w: el.escena.getBoundingClientRect().width || 1 };
  });
  el.escena.addEventListener('pointermove', function (e) {
    if (!ini || e.pointerId !== ini.id) return;
    var dx = e.clientX - ini.x, dy = e.clientY - ini.y;
    if (!arrastrando) {
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
      if (Math.abs(dy) > Math.abs(dx)) { ini = null; return; }      // gesto vertical: scroll normal
      arrastrando = true; el.escena.classList.add('arrastrando'); el.escena.setPointerCapture(e.pointerId);
    }
    e.preventDefault();
    aplicar(rot + Math.max(-180, Math.min(180, dx / ini.w * 180)), 0);
  });
  function soltar(e) {
    if (!ini || e.pointerId !== ini.id) return;
    ini = null; if (!arrastrando) return;
    arrastrando = false; el.escena.classList.remove('arrastrando');
    var delta = actual - rot;
    asentar(Math.abs(delta) > CFG.giro.umbral ? rot + Math.sign(delta) * 180 : rot);
  }
  el.escena.addEventListener('pointerup', soltar);
  el.escena.addEventListener('pointercancel', soltar);
  el.escena.addEventListener('lostpointercapture', soltar);
  el.btnVerTarjeta.addEventListener('click', function () { girarA('reverso'); });
  el.btnVolver.addEventListener('click', function () { girarA('frente'); });
  el.btnConfirmar.addEventListener('click', function () { girarA('frente'); setTimeout(function () { (el.nombre.readOnly ? el.asistencia : el.nombre).focus({ preventScroll: true }); }, CFG.giro.duracion); });

  /* ------------------------------------------------------------------ arranque */
  function aplicarRsvp(r) {
    if (!r) return;
    estado.fechaLimite = r.fechaLimite || null; estado.abierto = r.abierto !== false; estado.permitirNuevos = r.permitirNuevos !== false;
    if (r.pasesMax) CFG.pasesMax = r.pasesMax;
    pintarCierre(); bloquearNombre(el.nombre.readOnly); pintarTarjeta();
  }
  function arrancarSinCodigo(aviso) { reiniciarComoNuevo(true); ayuda(aviso || ''); }
  llenarPases(estado.pases, estado.pases);
  pintarTarjeta();
  if (!CODIGO_URL) {
    arrancarSinCodigo('Escribe tu nombre completo. Si ya respondiste antes, pulsa "Buscar mi registro" para ver o cambiar tu respuesta.');
    API.rsvp().then(aplicarRsvp).catch(function () {});
  } else {
    mensajeEstado('Cargando tu invitaci\u00f3n\u2026');
    var alReintento = function (e) { mensajeEstado('Cargando tu invitaci\u00f3n\u2026 (reintento ' + e.detail.i + ' de ' + e.detail.total + ')'); };
    window.addEventListener('boda:reintento', alReintento);
    API.invitado(CODIGO_URL).then(function (r) {
      window.removeEventListener('boda:reintento', alReintento); mensajeEstado('');
      if (r.encontrado) cargarInvitado(r.invitado, 'codigo');
      else arrancarSinCodigo('No encontramos tu c\u00f3digo. Escribe tu nombre para buscar tu registro o crear uno nuevo. ' + HINT_DUP);
      aplicarRsvp(r.rsvp);
    }).catch(function () {
      window.removeEventListener('boda:reintento', alReintento); mensajeEstado('');
      arrancarSinCodigo('No pudimos cargar tus datos. Escribe tu nombre para continuar.');
      API.rsvp().then(aplicarRsvp).catch(function () {});
    });
  }
})();
