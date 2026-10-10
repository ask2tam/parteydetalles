/**
 * RSVP · Ylene & Jhonatan
 * Google Apps Script (script VINCULADO a la hoja de cálculo: Extensiones > Apps Script)
 *
 * Despliegue: Implementar > Nueva implementación > Aplicación web
 *   - Ejecutar como: Yo
 *   - Quién tiene acceso: Cualquier persona
 * Copia la URL que termina en /exec y pégala en rsvp.js (API_URL) y en landing.html (APPS_SCRIPT_URL).
 * Cada vez que cambies este código: Implementar > Administrar implementaciones > Editar > Nueva versión.
 *
 * Hoja "Invitados": UNA fila por invitado (las respuestas reemplazan los valores de esa fila).
 *   A Nombre del invitado | B Tratamiento | C Código | D Link | E Asistencia | F Pases
 *   G Mensaje a los novios | H Primera respuesta | I Última modificación | J N.º de ediciones
 *   K Respuesta de los novios (se muestra en la invitación)
 */

var CONFIG = {
  HOJA: 'Invitados',
  // Clave secreta del hash. Larga y privada. NO la cambies después de enviar los links (cambiaría los códigos nuevos).
  SECRETO: 'yleneyjhonatan-10102026-parteydetalles',
  URL_BASE: 'https://bodas.parteydetalles.com/yleneyjhonatan?to=',
  ZONA: 'America/Bogota',
  PASES_MAX: 10,
  // 31 caracteres sin 0/O/1/I/L para evitar confusiones al dictar o leer: 31^4 = 923 521 combinaciones
  ALFABETO: '23456789ABCDEFGHJKMNPQRSTUVWXYZ',
  ASISTENCIA: ['Sí, asistiré', 'No podré asistir'],
  TRATAMIENTOS: ['Señor', 'Señora', 'Señorita', 'Doctor', 'Doctora', 'Familia', 'Joven', 'Niño', 'Niña']
};

var COL = { NOMBRE: 1, TRATO: 2, CODIGO: 3, LINK: 4, ASISTE: 5, PASES: 6, MENSAJE: 7,
            PRIMERA: 8, ULTIMA: 9, EDICIONES: 10, RESP: 11 };
var ENCABEZADOS = ['Nombre del invitado', 'Tratamiento', 'Código', 'Link', 'Asistencia a la boda', 'Pases',
                   'Mensaje a los novios', 'Primera respuesta', 'Última modificación', 'N.º de ediciones',
                   'Respuesta de los novios (se muestra en la invitación)'];

/* ========================================================================== */
/* CÓDIGO DE 4 CARACTERES (determinístico, no secuencial)                      */
/* ========================================================================== */
/* HMAC-SHA256(clave secreta, nombre normalizado) -> primeros 4 bytes -> número -> base 31.
   - Mismo nombre => mismo código (se puede regenerar).
   - Sin la clave nadie puede deducirlo ni calcularlo desde el nombre (por eso se calcula SOLO aquí,
     nunca en el navegador: el JS recibe el código ya hecho).
   - Si dos nombres distintos dieran el mismo código, se reintenta con "#1", "#2"...; el código queda guardado en la hoja. */
function normalizar_(s) {
  return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/\s+/g, ' ').trim();
}

function codigoDe_(nombre, intento) {
  var msg = normalizar_(nombre) + (intento ? '#' + intento : '');
  var bytes = Utilities.computeHmacSha256Signature(msg, CONFIG.SECRETO);
  var n = 0;
  for (var i = 0; i < 4; i++) n = n * 256 + ((bytes[i] + 256) % 256);
  var base = CONFIG.ALFABETO.length, total = Math.pow(base, 4);
  n = n % total;
  var out = '';
  for (var j = 0; j < 4; j++) { out = CONFIG.ALFABETO.charAt(n % base) + out; n = Math.floor(n / base); }
  return out;
}

function codigoUnico_(nombre, usados) {
  for (var k = 0; k < 200; k++) {
    var c = codigoDe_(nombre, k);
    if (!usados[c]) return c;
  }
  throw new Error('No se pudo generar un código único');
}

/* ========================================================================== */
/* ACCESO A LA HOJA                                                            */
/* ========================================================================== */
function hoja_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(CONFIG.HOJA);
  if (!sh) { prepararHoja(); sh = ss.getSheetByName(CONFIG.HOJA); }
  return sh;
}

function leer_(sh) {
  var ult = sh.getLastRow();
  if (ult < 2) return [];
  return sh.getRange(2, 1, ult - 1, ENCABEZADOS.length).getValues();
}

function buscarFila_(datos, campoIdx, valor) {   // devuelve índice 0-based dentro de "datos" o -1
  for (var i = 0; i < datos.length; i++) {
    var v = datos[i][campoIdx];
    if (campoIdx === COL.NOMBRE - 1 ? normalizar_(v) === valor : String(v).toUpperCase() === valor) return i;
  }
  return -1;
}

function iso_(d) { return d instanceof Date ? d.toISOString() : ''; }

function aInvitado_(f) {
  return {
    nombre: String(f[COL.NOMBRE - 1]), tratamiento: String(f[COL.TRATO - 1] || ''), codigo: String(f[COL.CODIGO - 1] || ''),
    asistencia: String(f[COL.ASISTE - 1] || ''), pases: Number(f[COL.PASES - 1]) || 1,
    mensaje: String(f[COL.MENSAJE - 1] || ''), primera: iso_(f[COL.PRIMERA - 1]), ultima: iso_(f[COL.ULTIMA - 1]),
    ediciones: Number(f[COL.EDICIONES - 1]) || 0, respuestaNovios: String(f[COL.RESP - 1] || '')
  };
}

function limpiar_(t, max) {
  t = String(t == null ? '' : t).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, max);
  return /^[=+\-@]/.test(t) ? "'" + t : t;      // evita fórmulas inyectadas
}

/* Con ?callback=fn responde como JSONP (script): así la página puede leer los datos sin depender de CORS
   (útil al probar desde file:// y robusto en cualquier hosting). Sin callback responde JSON normal. */
function json_(obj, cb) {
  var txt = JSON.stringify(obj);
  if (cb && /^[A-Za-z_$][\w$]*$/.test(cb)) {
    return ContentService.createTextOutput(cb + '(' + txt + ');').setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(txt).setMimeType(ContentService.MimeType.JSON);
}

/* ========================================================================== */
/* API WEB                                                                     */
/* ========================================================================== */
/* GET  ?action=codigo&c=AB12           -> datos del invitado por código
   GET  ?action=buscar&q=Juan Perez     -> por nombre (exacto) o lista de coincidencias
   POST {action:'guardar', modo:'codigo'|'editar'|'nuevo', codigo, nombre, asistencia, mensaje, pases}
        (se envía como text/plain para evitar el preflight CORS) */
function doGet(e) {
  var p = (e && e.parameter) || {};
  var cb = String(p.callback || '');
  if (p.to && !p.action) { p.action = 'codigo'; p.c = p.to; }   // atajo compatible: ?to=CODIGO
  try {
    var datos = leer_(hoja_());
    if (p.action === 'codigo') {
      var c = String(p.c || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      var i = c.length === 4 ? buscarFila_(datos, COL.CODIGO - 1, c) : -1;
      return json_(i < 0 ? { ok: true, encontrado: false } : { ok: true, encontrado: true, invitado: aInvitado_(datos[i]) }, cb);
    }
    if (p.action === 'buscar') {
      var q = normalizar_(limpiar_(p.q, 80));
      if (q.length < 3) return json_({ ok: true, encontrado: false, candidatos: [] }, cb);
      var j = buscarFila_(datos, COL.NOMBRE - 1, q);
      if (j >= 0) return json_({ ok: true, encontrado: true, invitado: aInvitado_(datos[j]) }, cb);
      var cand = [];
      for (var k = 0; k < datos.length && cand.length < 5; k++) {
        if (normalizar_(datos[k][0]).indexOf(q) >= 0) cand.push(String(datos[k][0]));
      }
      return json_({ ok: true, encontrado: false, candidatos: cand }, cb);
    }
    return json_({ ok: true, servicio: 'RSVP Ylene & Jhonatan' }, cb);
  } catch (err) {
    return json_({ ok: false, error: 'servidor', detalle: String(err) }, cb);
  }
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    var p = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (p.action !== 'guardar') return json_({ ok: false, error: 'accion' });
    return json_(guardar_(p));
  } catch (err) {
    return json_({ ok: false, error: 'servidor', detalle: String(err) });
  } finally {
    try { lock.releaseLock(); } catch (x) {}
  }
}

function guardar_(p) {
  var sh = hoja_();
  var datos = leer_(sh);
  var asistencia = String(p.asistencia || '');
  if (CONFIG.ASISTENCIA.indexOf(asistencia) < 0) return { ok: false, error: 'asistencia' };
  var mensaje = limpiar_(p.mensaje, 1000);
  var ahora = new Date();
  var idx = -1;

  // 1) Por código válido
  var cod = String(p.codigo || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (cod.length === 4) idx = buscarFila_(datos, COL.CODIGO - 1, cod);

  // 2) Por nombre
  if (idx < 0) {
    var nombre = limpiar_(p.nombre, 80);
    if (nombre.length < 3) return { ok: false, error: 'nombre' };
    var clave = normalizar_(nombre);
    var ex = buscarFila_(datos, COL.NOMBRE - 1, clave);
    if (p.modo === 'nuevo' && ex >= 0) {
      return { ok: false, error: 'duplicado',
               mensaje: 'Ya existe un invitado con ese nombre. Agrega tu apellido o el parentesco entre paréntesis, por ejemplo: "Pérez (Padre)".' };
    }
    if (p.modo === 'editar' && ex < 0) return { ok: false, error: 'no_encontrado' };
    idx = ex;
    if (idx < 0) {
      // Registro nuevo (sin código previo): pases desde ?pase=N
      var pases = Math.max(1, Math.min(CONFIG.PASES_MAX, parseInt(p.pases, 10) || 1));
      var usados = {};
      datos.forEach(function (f) { usados[String(f[COL.CODIGO - 1]).toUpperCase()] = true; });
      var codigo = codigoUnico_(nombre, usados);
      var fila = sh.getLastRow() + 1;
      sh.getRange(fila, 1, 1, ENCABEZADOS.length).setValues([[nombre, '', codigo, '', asistencia, pases, mensaje, ahora, ahora, 1, '']]);
      aplicarLink_(sh, fila);
      sh.getRange(fila, COL.PRIMERA, 1, 2).setNumberFormat('dd/mm/yyyy hh:mm');
      return { ok: true, nuevo: true, invitado: aInvitado_(sh.getRange(fila, 1, 1, ENCABEZADOS.length).getValues()[0]) };
    }
  }

  // Actualización de la fila existente
  var fila2 = idx + 2, f = datos[idx];
  var primera = f[COL.PRIMERA - 1];
  var cambio = !(primera instanceof Date) || String(f[COL.ASISTE - 1]) !== asistencia || String(f[COL.MENSAJE - 1]) !== mensaje;
  if (cambio) {
    sh.getRange(fila2, COL.ASISTE).setValue(asistencia);
    sh.getRange(fila2, COL.MENSAJE).setValue(mensaje);
    sh.getRange(fila2, COL.ULTIMA).setValue(ahora).setNumberFormat('dd/mm/yyyy hh:mm');
    if (!(primera instanceof Date)) sh.getRange(fila2, COL.PRIMERA).setValue(ahora).setNumberFormat('dd/mm/yyyy hh:mm');
    sh.getRange(fila2, COL.EDICIONES).setValue((Number(f[COL.EDICIONES - 1]) || 0) + 1);
  }
  // Si la fila fue creada a mano y no tiene código/link, se completan ahora
  if (!String(f[COL.CODIGO - 1])) { completarCodigos_(sh); }
  return { ok: true, nuevo: false, cambio: cambio,
           invitado: aInvitado_(sh.getRange(fila2, 1, 1, ENCABEZADOS.length).getValues()[0]) };
}

/* ========================================================================== */
/* HOJA: preparación, códigos y links                                          */
/* ========================================================================== */
function aplicarLink_(sh, fila) {
  sh.getRange(fila, COL.LINK).setFormula('="' + CONFIG.URL_BASE + '"&C' + fila);
}

function prepararHoja() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(CONFIG.HOJA) || ss.insertSheet(CONFIG.HOJA);
  sh.getRange(1, 1, 1, ENCABEZADOS.length).setValues([ENCABEZADOS]).setFontWeight('bold')
    .setBackground('#8a7040').setFontColor('#ffffff').setWrap(true).setVerticalAlignment('middle');
  sh.setFrozenRows(1);
  sh.setColumnWidths(1, 1, 220); sh.setColumnWidth(COL.TRATO, 110); sh.setColumnWidth(COL.CODIGO, 80);
  sh.setColumnWidth(COL.LINK, 130); sh.setColumnWidth(COL.ASISTE, 150); sh.setColumnWidth(COL.PASES, 60);
  sh.setColumnWidth(COL.MENSAJE, 320); sh.setColumnWidths(COL.PRIMERA, 2, 140); sh.setColumnWidth(COL.EDICIONES, 80);
  sh.setColumnWidth(COL.RESP, 320);
  sh.getRange(2, COL.MENSAJE, 1000, 1).setWrap(true);
  sh.getRange(2, COL.RESP, 1000, 1).setWrap(true).setBackground('#fbf6ea');   // columna que editan los novios
  sh.getRange(2, COL.TRATO, 1000, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(CONFIG.TRATAMIENTOS, true).setAllowInvalid(true).build());
  sh.getRange(2, COL.PRIMERA, 1000, 2).setNumberFormat('dd/mm/yyyy hh:mm');
  sh.getRange(2, COL.CODIGO, 1000, 1).setFontFamily('Courier New').setFontWeight('bold');
}

/** Rellena código y link de las filas que tengan nombre pero no código. Avisa de nombres repetidos. */
function completarCodigos_(sh) {
  var datos = leer_(sh);
  var usados = {}, nombres = {}, repetidos = [];
  datos.forEach(function (f) { if (f[COL.CODIGO - 1]) usados[String(f[COL.CODIGO - 1]).toUpperCase()] = true; });
  var cont = 0;
  datos.forEach(function (f, i) {
    var nom = String(f[0] || '').trim();
    if (!nom) return;
    var k = normalizar_(nom);
    if (nombres[k]) repetidos.push(nom); else nombres[k] = true;
    var fila = i + 2;
    if (!f[COL.CODIGO - 1]) {
      var c = codigoUnico_(nom, usados); usados[c] = true;
      sh.getRange(fila, COL.CODIGO).setValue(c); cont++;
    }
    if (!f[COL.LINK - 1]) aplicarLink_(sh, fila);
    if (!f[COL.PASES - 1]) sh.getRange(fila, COL.PASES).setValue(1);
  });
  return { generados: cont, repetidos: repetidos };
}

function generarCodigosYLinks() {
  var r = completarCodigos_(hoja_());
  var msg = 'Códigos generados: ' + r.generados + '.';
  if (r.repetidos.length) msg += '\n\nNombres repetidos (deben ser únicos; agrega apellido o parentesco entre paréntesis):\n- ' + r.repetidos.join('\n- ');
  SpreadsheetApp.getUi().alert(msg);
}

function onOpen() {
  SpreadsheetApp.getUi().createMenu('💍 Boda')
    .addItem('Preparar hoja (encabezados y formato)', 'prepararHoja')
    .addItem('Generar códigos y links faltantes', 'generarCodigosYLinks')
    .addToUi();
}

/** Trigger simple: al escribir un nombre en la columna A se genera solo el código y el link. */
function onEdit(e) {
  try {
    var r = e.range, sh = r.getSheet();
    if (sh.getName() !== CONFIG.HOJA || r.getColumn() !== COL.NOMBRE || r.getRow() < 2) return;
    var nom = String(r.getValue() || '').trim();
    if (!nom) return;
    var res = completarCodigos_(sh);
    if (res.repetidos.length) e.source.toast('Nombre repetido: agrega apellido o parentesco entre paréntesis.', 'Boda', 8);
  } catch (err) {}
}

/** Prueba rápida desde el editor: muestra el código de un nombre en el registro. */
function probarCodigo() {
  Logger.log(codigoDe_('Juan Pérez', 0));
}
