/* RSVP - Ylene & Jhonatan
 * Habla con el Web App de Google Apps Script (code.gs).
 *
 * Entradas por URL:
 *   rsvp.html?to=AB12      -> invitado con codigo: se cargan tratamiento, nombre, pases y respuestas guardadas
 *   rsvp.html?pase=2       -> invitado nuevo (sin codigo) con 2 pases
 * Si el codigo no existe, el nombre queda habilitado para buscar un registro por nombre o crear uno nuevo.
 */
(function () {
  'use strict';

  /* ------------------------------------------------------------------ */
  /* CONFIGURACION                                                       */
  /* ------------------------------------------------------------------ */
  /* La URL del Web App y la logica de red viven SOLO en assets/boda-api.js (window.BODA). */
  var PASES_MAX = 10;

  /* Raiz de busqueda: integrado en la invitacion -> Shadow DOM de #rsvp; rsvp.html por separado -> documento. */
  if (window.__rsvpIniciado) return;   // evita doble arranque si el script se incluye dos veces
  var HOST = document.getElementById('rsvp');
  var RAIZ = (HOST && HOST.shadowRoot) || document;
  var $ = function (id) { return RAIZ.getElementById ? RAIZ.getElementById(id) : RAIZ.querySelector('#' + id); };
  var API = window.BODA;
  if (!API) { console.warn('[RSVP] Falta assets/boda-api.js (cargarlo antes que rsvp.js).'); return; }
  if (!$('form')) { console.warn('[RSVP] No se encontro #form. Pega el bloque RSVP antes de cargar rsvp.js.'); return; }
  window.__rsvpIniciado = true;
  var q = new URLSearchParams(location.search);
  var CODIGO_URL = (q.get('to') || q.get('codigo') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  var PASES_URL = Math.max(1, Math.min(PASES_MAX, parseInt(q.get('pase') || q.get('pases'), 10) || 1));

  var el = {
    form: $('form'), nombre: $('nombre'), asistencia: $('asistencia'), mensaje: $('mensaje'), det: $('det-mensaje'),
    contador: $('contador'), saludo: $('saludo'), saludoNombre: $('saludo-nombre'), saludoLinea: $('saludo-linea'),
    ayuda: $('ayuda-nombre'), candidatos: $('candidatos'), btnBuscar: $('btn-buscar'), btnCambiar: $('btn-cambiar'),
    btnEnviar: $('btn-enviar'), estado: $('estado'), meta: $('meta'), resp: $('resp-novios'), respTxt: $('resp-novios-txt'),
    web: $('web')
  };

  /* modo:  'nuevo'  -> se creara un registro (nombre editable)
            'editar' -> se encontro por nombre (nombre bloqueado)
            'codigo' -> se encontro por codigo (nombre bloqueado) */
  var estado = { modo: 'nuevo', codigo: '', pases: PASES_URL, existente: false };

  /* ------------------------------------------------------------------ */
  /* RED                                                                 */
  /* ------------------------------------------------------------------ */
  function esperar(ms) { return API.esperar(ms); }
  /* Lecturas: action 'codigo' en el ARRANQUE reutiliza la peticion de la portada (BODA.invitado);
     opc.fresco = true fuerza una lectura nueva (verificacion despues de guardar). */
  function apiGet(params, opc) {
    opc = opc || {};
    if (params.action === 'codigo') return opc.fresco ? API.leer({ to: params.c }, opc) : API.invitado(params.c, opc);
    return API.leer(params, opc);
  }
  /* ------------------------------------------------------------------ */
  /* UI                                                                  */
  /* ------------------------------------------------------------------ */
  function mensajeEstado(txt, tipo) {
    el.estado.textContent = txt || '';
    el.estado.className = 'estado' + (tipo ? ' ' + tipo : '');
  }
  function ayuda(txt, error) {
    el.ayuda.hidden = !txt; el.ayuda.textContent = txt || '';
    el.ayuda.className = 'ayuda' + (error ? ' error' : '');
  }
  function fechaLarga(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleString('es-PE', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
  function textoPases(n) { n = parseInt(n, 10) || 1; return n + (n > 1 ? ' pases reservados' : ' pase reservado'); }

  function actualizarContador() { el.contador.textContent = el.mensaje.value.length; }

  function pintarMeta(g) {
    if (!g || !g.primera) { el.meta.hidden = true; return; }
    var partes = ['Primera respuesta: ' + fechaLarga(g.primera)];
    if (g.ultima) partes.push('\u00daltima modificaci\u00f3n: ' + fechaLarga(g.ultima));
    partes.push('Ediciones: ' + (g.ediciones || 1));
    el.meta.innerHTML = '';
    partes.forEach(function (t, i) { if (i) el.meta.appendChild(document.createElement('br')); el.meta.appendChild(document.createTextNode(t)); });
    el.meta.hidden = false;
  }

  function pintarSaludo() {
    var nombre = el.nombre.value.trim();
    if (estado.modo === 'nuevo' && !estado.existente) {
      // Invitado nuevo: solo mostramos los pases si vienen por URL
      if (q.get('pase') || q.get('pases')) {
        el.saludo.hidden = false; el.saludoNombre.textContent = '\u00a1Nos har\u00e1 felices contar contigo!';
        el.saludoLinea.textContent = textoPases(estado.pases);
      } else { el.saludo.hidden = true; }
      return;
    }
    el.saludo.hidden = false;
    el.saludoNombre.textContent = (estado.tratamiento ? estado.tratamiento + ' ' : '') + nombre;
    el.saludoLinea.textContent = textoPases(estado.pases);
  }

  function bloquearNombre(si) {
    el.nombre.readOnly = !!si;
    el.btnCambiar.hidden = !(si && estado.modo === 'editar');   // con codigo no se puede cambiar el nombre
    el.btnBuscar.hidden = !!si;
  }

  function cargarInvitado(g, modo) {
    estado.modo = modo; estado.existente = true; estado.codigo = g.codigo || ''; estado.tratamiento = g.tratamiento || '';
    estado.pases = g.pases || 1;
    el.nombre.value = g.nombre; el.nombre.classList.remove('invalido');
    el.asistencia.value = g.asistencia || '';
    el.mensaje.value = g.mensaje || ''; actualizarContador();
    el.det.open = !!g.mensaje;
    if (g.respuestaNovios) { el.respTxt.textContent = g.respuestaNovios; el.resp.hidden = false; } else { el.resp.hidden = true; }
    el.btnEnviar.textContent = g.primera ? 'Actualizar' : 'Enviar';
    ayuda('');
    el.candidatos.hidden = true; el.candidatos.innerHTML = '';
    bloquearNombre(true);
    pintarSaludo(); pintarMeta(g);
  }

  function reiniciarComoNuevo(limpiarNombre) {
    estado.modo = 'nuevo'; estado.existente = false; estado.codigo = ''; estado.tratamiento = ''; estado.pases = PASES_URL;
    if (limpiarNombre) el.nombre.value = '';
    el.asistencia.value = ''; el.mensaje.value = ''; actualizarContador(); el.det.open = false;
    el.resp.hidden = true; el.meta.hidden = true; el.btnEnviar.textContent = 'Enviar';
    el.candidatos.hidden = true; el.candidatos.innerHTML = '';
    bloquearNombre(false); pintarSaludo(); mensajeEstado('');
  }

  /* ------------------------------------------------------------------ */
  /* BUSQUEDA POR NOMBRE                                                 */
  /* ------------------------------------------------------------------ */
  var HINT_DUP = 'Si hay otra persona con tu mismo nombre, agrega tu apellido o el parentesco entre par\u00e9ntesis, por ejemplo: P\u00e9rez (Padre).';

  function buscarPorNombre(nombre) {
    nombre = (nombre || el.nombre.value).trim();
    if (nombre.length < 3) { ayuda('Escribe al menos 3 letras de tu nombre.', true); return; }
    ayuda('Buscando\u2026'); el.candidatos.hidden = true;
    apiGet({ action: 'buscar', q: nombre }).then(function (r) {
      if (!r || !r.ok) throw new Error('servidor');
      if (r.encontrado) { cargarInvitado(r.invitado, 'editar'); mensajeEstado('Encontramos tu registro. Puedes revisarlo y actualizarlo.', 'ok'); return; }
      if (r.candidatos && r.candidatos.length) {
        ayuda('No hay un registro exacto. \u00bfEres alguno de estos?');
        el.candidatos.innerHTML = '';
        r.candidatos.forEach(function (n) {
          var b = document.createElement('button'); b.type = 'button'; b.textContent = n;
          b.addEventListener('click', function () { el.nombre.value = n; buscarPorNombre(n); });
          el.candidatos.appendChild(b);
        });
        el.candidatos.hidden = false;
        return;
      }
      ayuda('No encontramos ese nombre. Si es tu primera vez, completa el formulario y crearemos tu registro. ' + HINT_DUP);
    }).catch(function () { ayuda('No pudimos buscar en este momento. Intenta de nuevo en unos segundos.', true); });
  }

  /* ------------------------------------------------------------------ */
  /* ENVIO                                                               */
  /* ------------------------------------------------------------------ */
  function validar() {
    var ok = true;
    el.nombre.classList.remove('invalido'); el.asistencia.classList.remove('invalido');
    if (el.nombre.value.trim().length < 3) { el.nombre.classList.add('invalido'); ok = false; }
    if (!el.asistencia.value) { el.asistencia.classList.add('invalido'); ok = false; }
    if (!ok) {
      mensajeEstado('Por favor completa los campos obligatorios (*).', 'error');
      (el.nombre.classList.contains('invalido') ? el.nombre : el.asistencia).focus();
    }
    return ok;
  }

  /* Guardado robusto:
     1) POST normal (se lee la respuesta).
     2) Si falla (CORS / red / arranque en frio): se reenvia en modo "no-cors" (no se puede leer la respuesta)
        y se VERIFICA leyendo el registro con reintentos hasta que coincida con lo enviado. */
  function igual_(g, c) {
    var n = function (t) { return String(t || '').replace(/^'/, '').replace(/\s+/g, ' ').trim(); };
    return g.asistencia === c.asistencia && n(g.mensaje) === n(c.mensaje);
  }
  function verificarGuardado(c, restantes) {
    var params = c.codigo ? { action: 'codigo', c: c.codigo } : { action: 'buscar', q: c.nombre };
    return apiGet(params, { intentos: 1, fresco: true }).then(function (r) {
      var hallado = r && r.ok && r.encontrado;
      if (hallado && igual_(r.invitado, c)) return { ok: true, nuevo: c.modo === 'nuevo', invitado: r.invitado };
      if (restantes > 0) return esperar(2000).then(function () { return verificarGuardado(c, restantes - 1); });
      if (hallado && c.modo === 'nuevo') return { ok: false, error: 'duplicado' };
      return { ok: false, error: 'no_verificado' };
    });
  }
  function guardarServidor(cuerpo) {
    return API.post(cuerpo, 25000).then(function (r) {
      if (r && r.ok === false && r.error === 'servidor') throw new Error('servidor');
      return r;
    }).catch(function (err) {
      console.warn('[RSVP] POST normal fall\u00f3:', err.message, '-> verifico antes de reenviar');
      /* IDEMPOTENCIA: el POST pudo llegar aunque no se leyo la respuesta (timeout en frio, CORS).
         Primero se verifica; solo si NO esta guardado se reenvia (evita registros duplicados). */
      var reenviar = function () {
        return API.postCiego(cuerpo).then(function () { return esperar(1500); })
          .then(function () { return verificarGuardado(cuerpo, 4); });
      };
      return verificarGuardado(cuerpo, 1).then(function (v) {
        return (v.ok || v.error === 'duplicado') ? v : reenviar();
      }, reenviar);
    });
  }
  el.form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    if (el.web.value) return;                 // honeypot
    if (!validar()) return;
    mensajeEstado('Guardando\u2026');
    el.btnEnviar.disabled = true;

    guardarServidor({
      action: 'guardar', modo: estado.modo, codigo: estado.codigo,
      nombre: el.nombre.value.trim(), asistencia: el.asistencia.value, mensaje: el.mensaje.value.trim(),
      pases: estado.pases
    }).then(function (r) {
      if (r && r.ok) {
        var yaTenia = estado.existente;
        cargarInvitado(r.invitado, estado.modo === 'codigo' ? 'codigo' : 'editar');
        if (r.invitado.codigo && history.replaceState && estado.modo !== 'codigo') {
          history.replaceState(null, '', location.pathname + '?to=' + encodeURIComponent(r.invitado.codigo));
        }
        mensajeEstado(yaTenia ? '\u00a1Listo! Actualizamos tu respuesta. \ud83d\udc9b' : '\u00a1Gracias! Recibimos tu respuesta. \ud83d\udc9b', 'ok');
        return;
      }
      if (r && r.error === 'duplicado') {
        el.nombre.classList.add('invalido'); el.nombre.focus();
        mensajeEstado('', ''); ayuda(r.mensaje || ('Ese nombre ya est\u00e1 registrado. ' + HINT_DUP), true);
        return;
      }
      if (r && r.error === 'no_encontrado') { mensajeEstado('No encontramos tu registro. Vuelve a buscarlo por nombre.', 'error'); reiniciarComoNuevo(false); return; }
      throw new Error((r && r.error) || 'servidor');
    }).catch(function () {
      mensajeEstado('No pudimos confirmar el guardado. Revisa tu conexi\u00f3n e int\u00e9ntalo de nuevo.', 'error');
    }).then(function () { el.btnEnviar.disabled = false; });
  });

  /* ------------------------------------------------------------------ */
  /* EVENTOS                                                             */
  /* ------------------------------------------------------------------ */
  el.mensaje.addEventListener('input', actualizarContador);
  el.btnBuscar.addEventListener('click', function () { buscarPorNombre(); });
  el.btnCambiar.addEventListener('click', function () { reiniciarComoNuevo(true); el.nombre.focus(); });
  el.nombre.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !el.nombre.readOnly) { e.preventDefault(); buscarPorNombre(); }
  });
  el.nombre.addEventListener('input', function () {
    el.nombre.classList.remove('invalido');
    if (!el.nombre.readOnly) { ayuda(''); el.candidatos.hidden = true; }
  });

  /* ------------------------------------------------------------------ */
  /* ARRANQUE                                                            */
  /* ------------------------------------------------------------------ */
  function arrancarSinCodigo(aviso) {
    reiniciarComoNuevo(true);
    ayuda(aviso || '');
  }

  if (!CODIGO_URL) {
    arrancarSinCodigo('Escribe tu nombre completo. Si ya respondiste antes, pulsa "Buscar mi registro" para ver o cambiar tu respuesta.');
  } else {
    mensajeEstado('Cargando tu invitaci\u00f3n\u2026');
    /* La peticion es compartida con la portada: los reintentos llegan por evento, no por callback */
    var alReintento = function (e) { mensajeEstado('Cargando tu invitaci\u00f3n\u2026 (reintento ' + e.detail.i + ' de ' + e.detail.total + ')'); };
    window.addEventListener('boda:reintento', alReintento);
    apiGet({ action: 'codigo', c: CODIGO_URL }).then(function (r) {
      window.removeEventListener('boda:reintento', alReintento);
      mensajeEstado('');
      if (r && r.ok && r.encontrado) { cargarInvitado(r.invitado, 'codigo'); return; }
      arrancarSinCodigo('No encontramos tu c\u00f3digo. Escribe tu nombre para buscar tu registro o crear uno nuevo. ' + HINT_DUP);
    }).catch(function () {
      window.removeEventListener('boda:reintento', alReintento);
      mensajeEstado('');
      arrancarSinCodigo('No pudimos cargar tus datos. Escribe tu nombre para continuar.');
    });
  }
})();
