/**
 * RSVP de boda — Google Apps Script (Web App) vinculado a una hoja de cálculo.
 *
 * Uso:
 *  1) Abre la hoja > Extensiones > Apps Script y pega este archivo.
 *  2) Ejecuta configurarHoja() una vez (crea hojas, encabezados, validaciones y resumen).
 *  3) Ejecuta instalarResumen() una vez (programa los correos de las 8:00 y 20:00).
 *  4) Implementar > Nueva implementación > Aplicación web
 *     (Ejecutar como: Yo · Quién tiene acceso: Cualquier persona) y copia la URL /exec.
 *
 * Regla de identidad: 1 fila por invitado, identificado por su nombre normalizado
 * (sin tildes, sin mayúsculas, espacios colapsados). Guardar de nuevo REEMPLAZA la fila.
 * Los eventos previos se definen en el HTML (RSVP_CONFIG.eventos), no en la hoja.
 */

const HOJA = { RSVP: 'RSVP', CONFIG: 'Config', RESUMEN: 'Resumen' };

// Columnas de la hoja RSVP (A..J las escribe el script; K y L son de los novios)
const COL = { NOMBRE: 1, ASISTENCIA: 2, N_ACOMP: 3, ACOMP: 4, EVENTOS: 5, RESTR: 6,
              MENSAJE: 7, PRIMERA: 8, ULTIMA: 9, EDICIONES: 10, RESPUESTA: 11, NOTAS: 12 };
const N_COLS_SCRIPT = COL.EDICIONES;
const SEP = '\n';                                   // separador de listas dentro de una celda
const LIM = { nombre: 80, acomp: 80, evento: 80, restr: 300, mensaje: 1000 };
const MAX_EVENTOS = 10;
const HORAS_RESUMEN = [8, 20];                      // horas de envío (zona horaria de la hoja)
const MAX_NOVEDADES_EN_CORREO = 60;
const SI = 'Sí', NO = 'No';

/* ============================== Utilidades ============================== */

function normalizar_(s) {
  return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/\s+/g, ' ').trim();
}

function limpiar_(s, max, multilinea) {
  s = String(s == null ? '' : s);
  if (multilinea) {
    s = s.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0009\u000b\u000c\u000e-\u001f\u007f]/g, ' ');
  } else {
    s = s.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ');
  }
  return s.trim().slice(0, max);
}

// Evita que un texto del invitado se interprete como fórmula (=, +, -, @)
function paraHoja_(s) { return /^[=+\-@]/.test(s) ? "'" + s : s; }

function partir_(s) { return String(s || '').split(/\r?\n/).map(x => x.trim()).filter(Boolean); }

function iso_(d) {
  return d instanceof Date
    ? Utilities.formatDate(d, SpreadsheetApp.getActive().getSpreadsheetTimeZone(), "yyyy-MM-dd'T'HH:mm:ssXXX")
    : '';
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function err_(error, mensaje, extra) { return Object.assign({ ok: false, error: error, mensaje: mensaje }, extra); }

function hoja_(nombre) { return SpreadsheetApp.getActive().getSheetByName(nombre); }

function esc_(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* ============================ Lectura de datos ============================ */

// "a@x.com, b@y.com; c@z.com" -> lista válida, sin repetidos (máx. 50: límite de Google por mensaje)
function parsearEmails_(s) {
  const vistos = {};
  return String(s || '').split(/[\s,;]+/).map(e => e.trim())
    .filter(e => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e))
    .filter(e => { const k = e.toLowerCase(); if (vistos[k]) return false; vistos[k] = 1; return true; })
    .slice(0, 50);
}

function leerConfig_() {
  const cfg = {};
  hoja_(HOJA.CONFIG).getDataRange().getValues().slice(1)
    .forEach(r => { if (r[0]) cfg[String(r[0]).trim()] = r[1]; });
  const max = parseInt(cfg.max_acompanantes, 10);
  return {
    maxAcompanantes: isNaN(max) ? 1 : Math.max(0, Math.min(max, 10)),
    fechaLimite: cfg.fecha_limite instanceof Date ? cfg.fecha_limite : null,
    soloLista: normalizar_(cfg.solo_invitados_de_lista) === 'si',
    emails: parsearEmails_(cfg.emails_resumen),
    sinNovedades: normalizar_(cfg.resumen_sin_novedades) !== 'no'
  };
}

// El plazo vence al terminar el día indicado en fecha_limite
function cerrado_(cfg) { return !!cfg.fechaLimite && Date.now() >= cfg.fechaLimite.getTime() + 864e5; }

// Devuelve el n.º de fila del invitado (0 si no existe). Compara nombres normalizados,
// así que los novios pueden escribir/corregir nombres a mano en la hoja sin romper nada.
function buscarFila_(hoja, nombre) {
  const clave = normalizar_(nombre);
  const n = hoja.getLastRow() - 1;
  if (!clave || n < 1) return 0;
  const nombres = hoja.getRange(2, COL.NOMBRE, n, 1).getValues();
  for (let i = 0; i < n; i++) if (normalizar_(nombres[i][0]) === clave) return i + 2;
  return 0;
}

// Solo se leen columnas públicas: NUNCA se devuelven las notas internas (columna L)
function leerRegistro_(hoja, fila) {
  const v = hoja.getRange(fila, 1, 1, COL.RESPUESTA).getValues()[0];
  return {
    nombre: String(v[COL.NOMBRE - 1]),
    asistencia: String(v[COL.ASISTENCIA - 1] || ''),
    acompanantes: partir_(v[COL.ACOMP - 1]),
    eventos: partir_(v[COL.EVENTOS - 1]),
    restricciones: String(v[COL.RESTR - 1] || ''),
    mensaje: String(v[COL.MENSAJE - 1] || ''),
    primeraRespuesta: iso_(v[COL.PRIMERA - 1]),
    ultimaModificacion: iso_(v[COL.ULTIMA - 1]),
    ediciones: Number(v[COL.EDICIONES - 1]) || 0,
    respuestaNovios: String(v[COL.RESPUESTA - 1] || '')
  };
}

/* ================================ Endpoints ================================ */

function doGet(e) {
  const p = (e && e.parameter) || {};
  try {
    switch (p.action) {
      case 'config': return json_(accionConfig_());
      case 'buscar': return json_(accionBuscar_(p.nombre));
      case 'cargar': return json_(accionCargar_(p.nombre));
      default:       return json_(err_('ACCION_INVALIDA', 'Acción no válida.'));
    }
  } catch (ex) {
    console.error(ex);
    return json_(err_('ERROR', 'Ocurrió un error inesperado. Inténtalo de nuevo.'));
  }
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    if (body.action !== 'guardar') return json_(err_('ACCION_INVALIDA', 'Acción no válida.'));
    return json_(accionGuardar_(body));
  } catch (ex) {
    console.error(ex);
    return json_(err_('ERROR', 'Ocurrió un error inesperado. Inténtalo de nuevo.'));
  }
}

function accionConfig_() {
  const c = leerConfig_();
  return { ok: true, maxAcompanantes: c.maxAcompanantes, cerrado: cerrado_(c),
           fechaLimite: iso_(c.fechaLimite), soloLista: c.soloLista };
}

// Solo informa si existe y cuándo se guardó. No devuelve el contenido de la respuesta.
function accionBuscar_(nombre) {
  nombre = limpiar_(nombre, LIM.nombre);
  if (nombre.length < 3) return err_('NOMBRE_INVALIDO', 'Escribe tu nombre completo.');
  const hoja = hoja_(HOJA.RSVP), cfg = leerConfig_();
  const fila = buscarFila_(hoja, nombre);
  if (!fila) return { ok: true, existe: false, permitido: !cfg.soloLista };
  const r = leerRegistro_(hoja, fila);
  return { ok: true, existe: !!r.primeraRespuesta, permitido: true,
           primeraRespuesta: r.primeraRespuesta, ultimaModificacion: r.ultimaModificacion };
}

function accionCargar_(nombre) {
  nombre = limpiar_(nombre, LIM.nombre);
  const hoja = hoja_(HOJA.RSVP), fila = buscarFila_(hoja, nombre);
  if (!fila) return err_('NO_ENCONTRADO', 'No encontramos una respuesta con ese nombre.');
  const reg = leerRegistro_(hoja, fila);
  if (!reg.primeraRespuesta) return err_('NO_ENCONTRADO', 'Aún no hay una respuesta guardada con ese nombre.');
  return { ok: true, registro: reg };
}

function accionGuardar_(b) {
  const cfg = leerConfig_();
  if (cerrado_(cfg)) return err_('CERRADO', 'El plazo para confirmar terminó. Escríbenos si necesitas hacer un cambio.');

  // ---- Validación y limpieza ----
  const nombre = limpiar_(b.nombre, LIM.nombre);
  if (nombre.length < 3) return err_('NOMBRE_INVALIDO', 'Escribe tu nombre completo.');
  const asistencia = b.asistencia === SI ? SI : b.asistencia === NO ? NO : '';
  if (!asistencia) return err_('ASISTENCIA_INVALIDA', 'Indica si asistirás a la boda.');

  let acomp = [], eventos = [], restr = '';
  if (asistencia === SI) {
    acomp = (Array.isArray(b.acompanantes) ? b.acompanantes : [])
      .map(a => limpiar_(a, LIM.acomp)).filter(Boolean);
    if (acomp.length > cfg.maxAcompanantes) {
      return err_('MUCHOS_ACOMPANANTES', 'Puedes registrar hasta ' + cfg.maxAcompanantes + ' acompañante(s).');
    }
    // Los eventos vienen del HTML: se limpian y acotan, no se contrastan con una lista del servidor
    eventos = (Array.isArray(b.eventos) ? b.eventos : []).map(ev => limpiar_(ev, LIM.evento)).filter(Boolean)
      .filter((ev, i, arr) => arr.indexOf(ev) === i).slice(0, MAX_EVENTOS);
    restr = limpiar_(b.restricciones, LIM.restr, true);
  }
  const mensaje = limpiar_(b.mensaje, LIM.mensaje, true);
  const modo = b.modo === 'editar' ? 'editar' : 'nuevo';

  // ---- Escritura protegida contra envíos simultáneos ----
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return err_('OCUPADO', 'Hay muchas respuestas en este momento. Inténtalo de nuevo.');
  try {
    const hoja = hoja_(HOJA.RSVP);
    let fila = buscarFila_(hoja, nombre);
    const previo = fila ? leerRegistro_(hoja, fila) : null;
    const yaRespondio = !!(previo && previo.primeraRespuesta);

    if (modo === 'nuevo' && yaRespondio) {
      return err_('DUPLICADO', 'Ya existe una respuesta con ese nombre. Agrega tu segundo apellido o el parentesco entre paréntesis, por ejemplo: Juan Pérez (Hijo).');
    }
    if (modo === 'editar' && !fila) return err_('NO_ENCONTRADO', 'No encontramos tu respuesta para editarla.');
    if (!fila && cfg.soloLista) return err_('NO_EN_LISTA', 'No encontramos ese nombre en la lista de invitados. Escríbelo como aparece en tu invitación.');

    const ahora = new Date();
    const nombreFinal = previo ? previo.nombre : nombre;   // respeta el nombre escrito por los novios
    const valores = [[
      paraHoja_(nombreFinal), asistencia, acomp.length, paraHoja_(acomp.join(SEP)), paraHoja_(eventos.join(SEP)),
      paraHoja_(restr), paraHoja_(mensaje),
      yaRespondio ? new Date(previo.primeraRespuesta) : ahora,
      ahora,
      yaRespondio ? previo.ediciones + 1 : 0
    ]];
    if (!fila) fila = hoja.getLastRow() + 1;
    hoja.getRange(fila, 1, 1, N_COLS_SCRIPT).setValues(valores);   // K y L (novios) no se tocan
    SpreadsheetApp.flush();
    return { ok: true, esNuevo: !yaRespondio, registro: leerRegistro_(hoja, fila) };
  } finally {
    lock.releaseLock();
  }
}

/* ============== Resumen por correo (8:00 y 20:00 hasta fecha_limite) ============== */

// Ejecútala una vez. Crea 2 activadores diarios; Google los lanza dentro de ±15 min de la hora indicada.
function instalarResumen() {
  desinstalarResumen();
  const tz = SpreadsheetApp.getActive().getSpreadsheetTimeZone();
  HORAS_RESUMEN.forEach(h =>
    ScriptApp.newTrigger('enviarResumen').timeBased().everyDays(1).atHour(h).inTimezone(tz).create());
  SpreadsheetApp.getActive().toast('Resumen programado a las ' + HORAS_RESUMEN.join(':00 y ') + ':00.', 'RSVP', 8);
}

function desinstalarResumen() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'enviarResumen')
    .forEach(t => ScriptApp.deleteTrigger(t));
}

// Útil para saber cuánta cuota de correo queda hoy en TODA la cuenta
function verCuota() { console.log('Destinatarios de correo restantes hoy: ' + MailApp.getRemainingDailyQuota()); }

function enviarResumen() {
  const cfg = leerConfig_();
  const final = cerrado_(cfg);                       // 1.ª ejecución tras fecha_limite: resumen final y se apaga
  if (!cfg.emails.length) {
    console.warn('Resumen: no hay correos válidos en Config > emails_resumen.');
    if (final) desinstalarResumen();
    return;
  }
  const props = PropertiesService.getScriptProperties();
  const desde = Number(props.getProperty('ultimoResumen')) || 0;
  const inicio = Date.now();
  const filas = leerTodo_();
  const novedades = filas.filter(f => f.ultima && f.ultima.getTime() > desde)
    .sort((a, b) => a.ultima.getTime() - b.ultima.getTime());

  if (!novedades.length && !cfg.sinNovedades && !final) return;      // ahorra cuota si no hay nada nuevo
  if (MailApp.getRemainingDailyQuota() < cfg.emails.length) {
    console.warn('Resumen: cuota de correo insuficiente hoy; se reintenta en el próximo horario.');
    return;
  }
  const m = armarResumen_(filas, novedades, final);
  MailApp.sendEmail({ to: cfg.emails.join(','), subject: m.asunto, body: m.texto, htmlBody: m.html, name: 'RSVP Boda' });
  props.setProperty('ultimoResumen', String(inicio));
  if (final) desinstalarResumen();
}

function leerTodo_() {
  const hoja = hoja_(HOJA.RSVP), n = hoja.getLastRow() - 1;
  if (n < 1) return [];
  return hoja.getRange(2, 1, n, COL.EDICIONES).getValues()
    .filter(v => String(v[COL.NOMBRE - 1]).trim())
    .map(v => {
      const acomp = partir_(v[COL.ACOMP - 1]);
      return {
        nombre: String(v[COL.NOMBRE - 1]).trim(),
        asistencia: String(v[COL.ASISTENCIA - 1] || ''),
        nAcomp: Number(v[COL.N_ACOMP - 1]) || acomp.length,
        acomp: acomp,
        eventos: partir_(v[COL.EVENTOS - 1]),
        restr: String(v[COL.RESTR - 1] || ''),
        mensaje: String(v[COL.MENSAJE - 1] || ''),
        ultima: v[COL.ULTIMA - 1] instanceof Date ? v[COL.ULTIMA - 1] : null,
        ediciones: Number(v[COL.EDICIONES - 1]) || 0
      };
    });
}

function estadisticas_(filas) {
  const e = { lista: filas.length, respondidas: 0, asisten: 0, noAsisten: 0, acomp: 0, eventos: {} };
  filas.forEach(f => {
    if (f.asistencia === SI) {
      e.respondidas++; e.asisten++; e.acomp += f.nAcomp;
      f.eventos.forEach(ev => { e.eventos[ev] = (e.eventos[ev] || 0) + 1; });
    } else if (f.asistencia === NO) { e.respondidas++; e.noAsisten++; }
  });
  e.pendientes = e.lista - e.respondidas;
  e.total = e.asisten + e.acomp;
  return e;
}

function detalle_(f) {
  const p = [];
  if (f.asistencia === SI) {
    p.push('Asiste' + (f.nAcomp ? ' con ' + f.nAcomp + ' acompañante(s)' + (f.acomp.length ? ': ' + f.acomp.join(', ') : '') : ' solo/a'));
    if (f.eventos.length) p.push('Eventos previos: ' + f.eventos.join(', '));
    if (f.restr) p.push('Restricciones: ' + f.restr.replace(/\n/g, ' '));
  } else if (f.asistencia === NO) { p.push('No asiste'); }
  else { p.push('Sin respuesta'); }
  if (f.mensaje) p.push('Mensaje: ' + f.mensaje.replace(/\n/g, ' '));
  return p;
}

function armarResumen_(filas, novedades, final) {
  const e = estadisticas_(filas);
  const tz = SpreadsheetApp.getActive().getSpreadsheetTimeZone();
  const cuando = Utilities.formatDate(new Date(), tz, 'dd/MM/yyyy HH:mm');
  const url = SpreadsheetApp.getActive().getUrl();
  const titulo = final ? 'Resumen FINAL de RSVP (el plazo cerró)' : 'Resumen de RSVP';

  const general = [
    ['Invitados en la lista', e.lista], ['Con respuesta', e.respondidas], ['Pendientes', e.pendientes],
    ['Asisten (invitados)', e.asisten], ['No asisten', e.noAsisten], ['Acompañantes confirmados', e.acomp],
    ['TOTAL DE PERSONAS', e.total]
  ];
  Object.keys(e.eventos).forEach(k => general.push(['Evento previo: ' + k, e.eventos[k]]));

  const lista = novedades.slice(0, MAX_NOVEDADES_EN_CORREO);
  const resto = novedades.length - lista.length;

  const texto = [titulo + ' · ' + cuando, '', 'RESUMEN GENERAL']
    .concat(general.map(g => '  ' + g[0] + ': ' + g[1]))
    .concat(['', 'NOVEDADES DESDE EL ÚLTIMO RESUMEN (' + novedades.length + ')'])
    .concat(novedades.length ? [] : ['  Sin novedades.'])
    .concat(lista.map(f => '- ' + f.nombre + ' [' + (f.ediciones ? 'editada' : 'nueva') + ']\n    ' + detalle_(f).join('\n    ')))
    .concat(resto > 0 ? ['… y ' + resto + ' más (ver la hoja).'] : [])
    .concat(['', 'Hoja: ' + url]).join('\n');

  const filasHtml = general.map(g =>
    '<tr><td style="padding:3px 14px 3px 0">' + esc_(g[0]) + '</td><td style="padding:3px 0;font-weight:bold">' + esc_(g[1]) + '</td></tr>').join('');
  const novHtml = novedades.length
    ? '<ul style="padding-left:18px">' + lista.map(f =>
        '<li style="margin-bottom:10px"><b>' + esc_(f.nombre) + '</b> <span style="color:#607fa9">(' + (f.ediciones ? 'editada' : 'nueva') + ')</span><br>' +
        detalle_(f).map(esc_).join('<br>') + '</li>').join('') + '</ul>' +
      (resto > 0 ? '<p>… y ' + resto + ' más (ver la hoja).</p>' : '')
    : '<p style="color:#777">Sin novedades.</p>';
  const html = '<div style="font-family:Arial,sans-serif;color:#2d3e57;max-width:560px">' +
    '<h2 style="margin:0 0 4px;color:#607fa9">' + esc_(titulo) + '</h2><p style="margin:0 0 16px;color:#777">' + esc_(cuando) + '</p>' +
    '<h3 style="margin:0 0 6px">Resumen general</h3><table style="border-collapse:collapse">' + filasHtml + '</table>' +
    '<h3 style="margin:20px 0 6px">Novedades desde el último resumen (' + novedades.length + ')</h3>' + novHtml +
    '<p><a href="' + esc_(url) + '">Abrir la hoja</a></p></div>';

  return { asunto: (final ? 'RSVP FINAL: ' : 'RSVP: ') + e.asisten + ' asisten · ' + e.total + ' personas · ' + novedades.length + ' novedad(es)',
           texto: texto, html: html };
}

/* ===================== Configuración inicial (ejecutar 1 vez) ===================== */

function configurarHoja() {
  const ss = SpreadsheetApp.getActive();
  const obtener = n => ss.getSheetByName(n) || ss.insertSheet(n);
  const AZUL = '#607fa9', DORADO = '#b8863f';
  const lista = (vals) => SpreadsheetApp.newDataValidation().requireValueInList(vals, true).setAllowInvalid(false).build();

  // --- RSVP ---
  const h = obtener(HOJA.RSVP);
  const enc = ['Nombre del invitado', 'Asistencia a la boda', 'N.º acompañantes', 'Acompañantes',
    'Eventos previos', 'Restricciones alimentarias', 'Mensaje a los novios', 'Primera respuesta',
    'Última modificación', 'N.º de ediciones', 'Respuesta de los novios (se muestra en la invitación)',
    'Notas internas (privado, no se muestra)'];
  h.getRange(1, 1, 1, enc.length).setValues([enc]).setFontWeight('bold').setFontColor('#ffffff')
    .setBackground(AZUL).setWrap(true).setVerticalAlignment('middle');
  h.getRange(1, COL.RESPUESTA, 1, 2).setBackground(DORADO);          // zona editable por los novios
  h.setFrozenRows(1); h.setFrozenColumns(1);
  h.getRange('H2:I').setNumberFormat('dd/mm/yyyy hh:mm');
  h.getRange('B2:B').setDataValidation(lista([SI, NO]));
  h.getRange('A2:L').setVerticalAlignment('top').setWrap(true);
  [220, 110, 90, 220, 240, 220, 300, 140, 140, 90, 320, 240].forEach((w, i) => h.setColumnWidth(i + 1, w));

  // --- Config (agrega las claves que falten sin tocar las existentes) ---
  const cf = obtener(HOJA.CONFIG);
  if (cf.getLastRow() < 1) cf.getRange(1, 1, 1, 3).setValues([['Clave', 'Valor', 'Qué hace']]);
  const defaults = [
    ['max_acompanantes', 2, 'Máximo de acompañantes por invitado (0 = sin acompañantes).'],
    ['fecha_limite', '', 'Último día para confirmar/editar Y último día de correos de resumen (vacío = sin límite). Al día siguiente se envía un resumen final y se apagan los envíos.'],
    ['solo_invitados_de_lista', 'NO', 'SÍ = solo responden los nombres ya cargados en la hoja RSVP.'],
    ['emails_resumen', '', 'Uno o varios correos separados por coma, punto y coma o salto de línea. Reciben el resumen de las 8:00 y 20:00 (vacío = sin correos).'],
    ['resumen_sin_novedades', 'SÍ', 'NO = no enviar el correo si desde el último resumen nadie respondió ni editó (ahorra cuota).']];
  const existentes = cf.getDataRange().getValues().map(r => String(r[0]).trim());
  defaults.forEach(d => { if (existentes.indexOf(d[0]) < 0) cf.appendRow(d); });
  cf.getRange(1, 1, 1, 3).setFontWeight('bold').setFontColor('#ffffff').setBackground(AZUL);
  const filaDe = k => cf.getDataRange().getValues().findIndex(r => String(r[0]).trim() === k) + 1;
  cf.getRange(filaDe('fecha_limite'), 2).setNumberFormat('dd/mm/yyyy');
  cf.getRange(filaDe('solo_invitados_de_lista'), 2).setDataValidation(lista(['SÍ', 'NO']));
  cf.getRange(filaDe('resumen_sin_novedades'), 2).setDataValidation(lista(['SÍ', 'NO']));
  cf.getRange(filaDe('emails_resumen'), 2).setWrap(true);
  cf.getRange('C2:C').setWrap(true);
  cf.setColumnWidth(1, 220); cf.setColumnWidth(2, 260); cf.setColumnWidth(3, 560);

  // --- Resumen (solo fórmulas, no editar). Los eventos se detectan solos desde la hoja RSVP ---
  const rs = obtener(HOJA.RESUMEN);
  rs.clear();
  rs.getRange(1, 1, 8, 2).setFormulas([
    ['Concepto', 'Valor'],
    ['Invitados en la lista', '=COUNTA(RSVP!A2:A)'],
    ['Con respuesta', '=COUNTA(RSVP!B2:B)'],
    ['Pendientes', '=B2-B3'],
    ['Asisten (invitados)', '=COUNTIF(RSVP!B2:B,"Sí")'],
    ['No asisten', '=COUNTIF(RSVP!B2:B,"No")'],
    ['Acompañantes confirmados', '=SUMIF(RSVP!B2:B,"Sí",RSVP!C2:C)'],
    ['Total de personas', '=B5+B7']]);
  rs.getRange('A10:B10').setValues([['Eventos previos (invitados)', 'Asisten']]);
  rs.getRange('A11').setFormula('=IFERROR(UNIQUE(TRANSPOSE(SPLIT(TEXTJOIN(CHAR(10),TRUE,RSVP!E2:E),CHAR(10)))),"")');
  const cuentas = [];
  for (let r = 11; r <= 20; r++) cuentas.push(['=IF(A' + r + '="","",COUNTIF(RSVP!E2:E,"*"&A' + r + '&"*"))']);
  rs.getRange(11, 2, 10, 1).setFormulas(cuentas);
  rs.getRangeList(['A1:B1', 'A10:B10']).setFontWeight('bold').setFontColor('#ffffff').setBackground(AZUL);
  rs.getRange('A8:B8').setFontWeight('bold');
  rs.setColumnWidth(1, 300); rs.setColumnWidth(2, 110);

  ss.toast('Hojas listas. Ahora ejecuta instalarResumen() e implementa como Aplicación web.', 'RSVP', 8);
}
