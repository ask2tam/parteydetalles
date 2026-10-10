/**
 * RSVP · lógica del formulario. Se comunica con la Web App de Apps Script (ver Code.gs).
 * Requiere window.RSVP_CONFIG = { url: '.../exec', eventos: ['...', '...'] } y el marcado de rsvp.html.
 * Todo texto que viene del servidor se inserta con textContent (nunca innerHTML).
 */
(() => {
  'use strict';

  const CFG = window.RSVP_CONFIG || {};
  const ENDPOINT = CFG.url;
  const EVENTOS = Array.isArray(CFG.eventos) ? CFG.eventos : [];   // eventos previos: se definen en el HTML
  const LS_KEY = 'rsvp_nombre';

  // Búsqueda automática de reingresos mientras se escribe el nombre (cuida la cuota de Apps Script):
  const ESPERA_MS = 1200;        // pausa sin teclear antes de consultar
  const MIN_CARACTERES = 6;      // no consulta con menos letras que esto
  const cache = new Map();       // nombre normalizado -> respuesta (misma consulta no se repite)
  const PARENTESCOS = ['Padre', 'Madre', 'Hijo', 'Hija', 'Hermano', 'Hermana', 'Esposo', 'Esposa'];

  const $ = (id) => document.getElementById(id);
  const el = {};
  const S = { modo: 'nuevo', nombreCargado: '', max: 0, cerrado: false, acomp: [], token: 0, timer: 0, revisado: '' };

  /* ---------- Utilidades ---------- */
  const norm = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/\s+/g, ' ').trim();   // misma regla que el servidor

  const fmt = (iso) => {
    if (!iso) return '';
    try {
      return new Intl.DateTimeFormat('es-PE', { dateStyle: 'long', timeStyle: 'short', timeZone: 'America/Lima' })
        .format(new Date(iso));
    } catch { return iso; }
  };

  const ls = {
    get() { try { return localStorage.getItem(LS_KEY) || ''; } catch { return ''; } },
    set(v) { try { v ? localStorage.setItem(LS_KEY, v) : localStorage.removeItem(LS_KEY); } catch { /* sin storage */ } }
  };

  function h(tag, props, ...kids) {
    const n = document.createElement(tag);
    for (const k in (props || {})) {
      if (k.startsWith('on')) n.addEventListener(k.slice(2), props[k]);
      else if (k === 'class') n.className = props[k];
      else n.setAttribute(k, props[k]);
    }
    kids.forEach((c) => n.append(c));
    return n;
  }

  /* ---------- Comunicación con Apps Script ---------- */
  async function pedir(url, opts) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 25000);
    try {
      const r = await fetch(url, { ...opts, signal: ctl.signal, redirect: 'follow' });
      return await r.json();
    } catch {
      return { ok: false, error: 'RED', mensaje: 'No pudimos conectar. Revisa tu conexión e inténtalo de nuevo.' };
    } finally { clearTimeout(t); }
  }
  const get = (params) => {
    const u = new URL(ENDPOINT);
    for (const k in params) u.searchParams.set(k, params[k]);
    return pedir(u.toString());
  };
  // text/plain evita el preflight CORS, que Apps Script no admite
  const post = (body) => pedir(ENDPOINT, {
    method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body)
  });

  /* ---------- Mensajes ---------- */
  function mostrarError(msg, foco) {
    el.error.textContent = msg || '';
    el.error.hidden = !msg;
    if (msg && foco) foco.focus();
  }
  function aviso(...nodos) { el.aviso.replaceChildren(...nodos); el.aviso.hidden = nodos.length === 0; }
  function mostrarNovios(txt) { el.noviosTxt.textContent = txt || ''; el.novios.hidden = !txt; }
  function setOcupado(ocupado, etiqueta) {
    el.enviar.disabled = ocupado || S.cerrado;
    el.enviar.textContent = ocupado ? (etiqueta || 'Guardando…') : (S.modo === 'editar' ? 'Actualizar confirmación' : 'Enviar confirmación');
  }

  function bannerEdicion(reg) {
    if (!reg) { el.estado.hidden = true; return; }
    el.estado.replaceChildren(
      h('p', {}, `Estás editando tu respuesta, guardada el ${fmt(reg.primeraRespuesta)}` +
        (reg.ediciones ? `. Última modificación: ${fmt(reg.ultimaModificacion)}.` : '.')),
      h('button', { type: 'button', class: 'rsvp-link', onclick: () => salirEdicion(false) }, 'No soy yo / cambiar de invitado')
    );
    el.estado.hidden = false;
  }

  /* ---------- Acompañantes (interruptor + selector − / +) ---------- */
  function pintarAcomp() {
    const n = S.acomp.length;
    el.conAcomp.checked = n > 0;
    el.acompBox.hidden = n === 0;
    el.cuenta.textContent = n;
    el.mas.disabled = n >= S.max;
    el.acompNombres.replaceChildren(...S.acomp.map((val, i) => {
      const id = 'r-acomp-' + i;
      const inp = h('input', { id, class: 'rsvp-input', type: 'text', maxlength: '80', autocomplete: 'off' });
      inp.value = val;
      inp.addEventListener('input', () => { S.acomp[i] = inp.value; });
      return h('div', {},
        h('label', { class: 'rsvp-label rsvp-label--sub', for: id }, n === 1 ? 'Nombre del acompañante:' : `Acompañante ${i + 1}:`),
        inp);
    }));
  }
  function setAcomp(n) {
    n = Math.max(0, Math.min(S.max, n));
    while (S.acomp.length < n) S.acomp.push('');
    S.acomp.length = n;
    pintarAcomp();
  }

  /* ---------- Formulario ---------- */
  function pintarEventos(lista) {
    el.eventos.hidden = lista.length === 0;
    el.eventosLista.replaceChildren(...lista.map((nombre) =>
      h('label', { class: 'rsvp-check' }, h('input', { type: 'checkbox', name: 'evento', value: nombre }), h('span', {}, nombre))));
  }
  function setAsistencia() {
    const marcado = document.querySelector('input[name="asistencia"]:checked');
    el.detalle.hidden = !(marcado && marcado.value === 'Sí');
  }
  function leerFormulario() {
    const m = document.querySelector('input[name="asistencia"]:checked');
    const asistencia = m ? m.value : '';
    const si = asistencia === 'Sí';
    return {
      nombre: el.nombre.value.trim(),
      asistencia,
      acompanantes: si ? S.acomp.map((a) => a.trim()) : [],
      eventos: si ? [...document.querySelectorAll('input[name="evento"]:checked')].map((i) => i.value) : [],
      restricciones: si ? el.restr.value.trim() : '',
      mensaje: el.mensaje.value.trim()
    };
  }
  function llenar(reg) {
    el.nombre.value = reg.nombre;
    document.querySelectorAll('input[name="asistencia"]').forEach((i) => { i.checked = i.value === reg.asistencia; });
    setAsistencia();
    S.acomp = reg.acompanantes.slice(0, S.max);
    pintarAcomp();
    document.querySelectorAll('input[name="evento"]').forEach((i) => { i.checked = reg.eventos.includes(i.value); });
    el.restr.value = reg.restricciones;
    el.mensaje.value = reg.mensaje;
    el.msgDet.open = !!reg.mensaje;                    // si dejó un mensaje, el desplegable se abre solo
    mostrarNovios(reg.respuestaNovios);
  }
  function vaciar(conservarNombre) {
    const nombre = el.nombre.value;
    el.form.reset();
    if (conservarNombre) el.nombre.value = nombre;
    S.acomp = [];
    pintarAcomp(); setAsistencia();
    el.msgDet.open = false;
    mostrarNovios(''); mostrarError(''); aviso(); el.ok.hidden = true;
  }

  /* ---------- Modo edición ---------- */
  function aplicarRegistro(reg) {
    llenar(reg);
    S.modo = 'editar'; S.nombreCargado = reg.nombre;
    bannerEdicion(reg); aviso(); ls.set(reg.nombre);
    setOcupado(false);
  }
  function salirEdicion(conservarNombre) {
    S.modo = 'nuevo'; S.nombreCargado = ''; S.revisado = '';
    vaciar(conservarNombre);
    bannerEdicion(null); ls.set('');
    setOcupado(false);
    if (!conservarNombre) el.nombre.focus();
  }
  async function cargar(nombre, silencioso) {
    setOcupado(true, 'Cargando tu respuesta…');
    const r = await get({ action: 'cargar', nombre });
    if (!r.ok || !r.registro) {
      setOcupado(false);
      if (silencioso) ls.set(''); else mostrarError(r.mensaje || 'No pudimos cargar tu respuesta.');
      return;
    }
    aplicarRegistro(r.registro);
  }

  /* ---------- Control de nombres duplicados ---------- */
  function avisoCoincidencia(info) {
    aviso(
      h('p', {}, `Ya hay una respuesta guardada con este nombre (${fmt(info.ultimaModificacion || info.primeraRespuesta)}). ¿Eres tú?`),
      h('div', { class: 'rsvp-actions' },
        h('button', { type: 'button', class: 'rsvp-mini', onclick: () => cargar(el.nombre.value.trim()) }, 'Sí, cargar mi respuesta'),
        h('button', { type: 'button', class: 'rsvp-mini rsvp-mini--sec', onclick: avisoDiferenciar }, 'No, soy otra persona'))
    );
  }
  function avisoDiferenciar() {
    aviso(
      h('p', {}, 'Cada invitado necesita un nombre único. Agrega tu segundo apellido o el parentesco entre paréntesis, por ejemplo: Juan Pérez (Hijo).'),
      h('div', { class: 'rsvp-chips' }, ...PARENTESCOS.map((p) =>
        h('button', { type: 'button', class: 'rsvp-chip', onclick: () => {
          el.nombre.value = el.nombre.value.replace(/\s*\([^)]*\)\s*$/, '').trim() + ` (${p})`;
          revisarNombre();
        } }, `(${p})`)))
    );
    el.nombre.focus();
  }
  // Una misma consulta se hace una sola vez por visita (si falla, se reintenta)
  function buscarConCache(nombre) {
    const k = norm(nombre);
    if (!cache.has(k)) {
      cache.set(k, get({ action: 'buscar', nombre }).then((r) => { if (!r.ok) cache.delete(k); return r; }));
    }
    return cache.get(k);
  }
  async function revisarNombre(auto) {
    const nombre = el.nombre.value.trim();
    const k = norm(nombre);
    // Si había una respuesta cargada y el nombre cambió, se sale del modo edición y se busca el nuevo nombre
    if (S.modo === 'editar' && k !== norm(S.nombreCargado)) salirEdicion(true);
    if (S.modo === 'editar') return;                    // mismo nombre que el cargado: nada que buscar
    // Nombre ya revisado: no se toca el aviso. Si se redibujara justo al hacer clic en "Sí, cargar mi respuesta"
    // (el clic quita el foco y dispara esta función), el botón desaparecería y el clic se perdería.
    if (k === S.revisado) return;
    aviso(); mostrarError('');
    if (nombre.length < 3) return;
    // Mientras escribe solo se busca si el nombre ya parece completo (varias letras y al menos 2 palabras)
    if (auto === true && (k.length < MIN_CARACTERES || !k.includes(' '))) return;
    S.revisado = k;
    const t = ++S.token;                                // descarta respuestas de búsquedas antiguas
    const r = await buscarConCache(nombre);
    if (t !== S.token) return;
    if (!r.ok) { S.revisado = ''; aviso(h('p', {}, r.mensaje || 'No pudimos verificar tu nombre.')); return; }
    if (!r.permitido) { aviso(h('p', {}, 'No encontramos ese nombre en la lista de invitados. Escríbelo como aparece en tu invitación.')); return; }
    if (r.existe) avisoCoincidencia(r);
  }

  /* ---------- Envío ---------- */
  async function enviar(ev) {
    ev.preventDefault();
    mostrarError(''); el.ok.hidden = true;
    const d = leerFormulario();
    if (d.nombre.length < 3) return mostrarError('Escribe tu nombre completo.', el.nombre);
    if (!d.asistencia) return mostrarError('Indica si asistirás a la boda.');
    if (d.acompanantes.some((a) => !a)) return mostrarError('Escribe el nombre de cada acompañante o quita al que no vaya.');

    setOcupado(true);
    const r = await post({ action: 'guardar', modo: S.modo, ...d });
    if (r.ok) {
      cache.clear(); S.revisado = '';                   // el estado cambió: las consultas previas ya no valen
      aplicarRegistro(r.registro);
      el.ok.textContent = r.esNuevo
        ? '¡Gracias! Guardamos tu confirmación. Puedes volver a esta página y escribir tu nombre para revisarla o cambiarla.'
        : 'Listo, actualizamos tu respuesta.';
      el.ok.hidden = false;
      el.ok.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setOcupado(false);
    mostrarError(r.mensaje || 'No pudimos guardar tu respuesta. Inténtalo de nuevo.');
    if (r.error === 'DUPLICADO') { cache.clear(); S.revisado = ''; revisarNombre(false); }
  }

  /* ---------- Inicio ---------- */
  async function init() {
    if (!ENDPOINT) { console.error('RSVP: falta window.RSVP_CONFIG.url'); return; }
    Object.assign(el, {
      form: $('rsvp-form'), estado: $('rsvp-estado'), cerrado: $('rsvp-cerrado'), nombre: $('r-nombre'), aviso: $('rsvp-aviso'),
      detalle: $('rsvp-detalle'), acompSeccion: $('rsvp-acomp-seccion'), conAcomp: $('r-con-acomp'), acompBox: $('rsvp-acomp'),
      menos: $('r-menos'), mas: $('r-mas'), cuenta: $('r-cuenta'), acompNombres: $('rsvp-acomp-nombres'),
      eventos: $('rsvp-eventos'), eventosLista: $('rsvp-eventos-lista'), restr: $('r-restr'), msgDet: $('rsvp-msg-det'),
      mensaje: $('r-mensaje'), novios: $('rsvp-novios'), noviosTxt: $('rsvp-novios-txt'), error: $('rsvp-error'),
      ok: $('rsvp-ok'), enviar: $('r-enviar')
    });

    pintarEventos(EVENTOS);
    el.nombre.addEventListener('input', () => {
      clearTimeout(S.timer);
      aviso(); S.revisado = '';                         // también en modo edición: al cambiar el nombre se vuelve a buscar
      S.timer = setTimeout(() => revisarNombre(true), ESPERA_MS);
    });
    el.nombre.addEventListener('change', () => { clearTimeout(S.timer); revisarNombre(false); });   // desenfoque: respaldo
    el.nombre.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); el.nombre.blur(); } });
    document.querySelectorAll('input[name="asistencia"]').forEach((i) => i.addEventListener('change', setAsistencia));
    el.conAcomp.addEventListener('change', () => { setAcomp(el.conAcomp.checked ? 1 : 0); if (el.conAcomp.checked) $('r-acomp-0').focus(); });
    el.menos.addEventListener('click', () => setAcomp(S.acomp.length - 1));   // en 1 → apaga el interruptor
    el.mas.addEventListener('click', () => { setAcomp(S.acomp.length + 1); $('r-acomp-' + (S.acomp.length - 1)).focus(); });
    el.form.addEventListener('submit', enviar);

    const cfg = await get({ action: 'config' });
    if (!cfg.ok) { mostrarError(cfg.mensaje || 'No pudimos cargar el formulario. Recarga la página.'); return; }
    S.max = cfg.maxAcompanantes;
    S.cerrado = cfg.cerrado;
    el.acompSeccion.hidden = S.max < 1;
    el.cerrado.hidden = !S.cerrado;
    setOcupado(false);

    const guardado = ls.get();                           // mismo dispositivo: carga su última respuesta sola
    if (guardado) { el.nombre.value = guardado; await cargar(guardado, true); }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
