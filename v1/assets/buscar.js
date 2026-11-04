/* buscar.js — Búsqueda tolerante de invitados para el panel y recepción · Parte y Detalles · v1
 * La lógica de nombres es la misma de rsvp_buscar en la base de datos (supabase/01_esquema.sql).
 *
 *   PYD_BUSCAR.buscar(lista, consulta, campos) → { resultados: [{ item, puntaje, motivo }], parcial }
 *     campos(item) → [{ k, etiqueta, texto, peso, tipo, alias }]   tipo: 'nombre' | 'texto' | 'codigo' | 'mesa' | 'telefono'
 *     alias: texto que también encuentra el campo con menos peso (p. ej. la pregunta "¿Alergias…?" para su respuesta)
 *   PYD_BUSCAR.resaltar(texto, consulta) → HTML escapado con <mark> en las palabras encontradas
 *
 * Reglas
 *   · Sin tildes ni mayúsculas; ñ = n; apóstrofos, guiones y puntos se ignoran dentro de la palabra
 *     ("Ek-on" = ekon, y además ek / on; "O'Brien" = obrien; "J." = j).
 *   · Orden indistinto: cada palabra escrita debe aparecer en algún campo ("Martin Picasso" = "Picasso Martin").
 *   · Conectores y tratamientos (de, la, y, Sr., Sra., Familia…) no se exigen si hay otras palabras.
 *   · Por palabra se toma la mejor coincidencia: exacta 100 · inicio de palabra 80 · nombre sin espacios
 *     (Delacruz, Ekon) 60/40 · fonética (v/b, z/s/ce, ll/y, h muda, qu/k) 55/50 · error de tipeo 35/30.
 *     El valor se multiplica por el peso del campo (nombre 1 · acompañantes 0,7 · respuestas 0,5 · mensaje 0,35…).
 *   · Código exacto 150 · mesa exacta 90 ("mesa 5" busca solo en la mesa) · teléfono por sus dígitos (desde 4).
 *   · Orden: nombre idéntico, mismas palabras en otro orden, nombre que empieza igual, palabras en el mismo
 *     orden, todas en el nombre, primera palabra igual; luego puntaje, nombre más corto y orden alfabético.
 *   · Si ninguno tiene todas las palabras, se muestran los que tienen al menos la mitad (resultado "parcial").
 */
(function (g) {
  'use strict';
  const MAPA = { 'ß': 'ss', 'æ': 'ae', 'œ': 'oe', 'ø': 'o', 'ł': 'l', 'đ': 'd', 'ð': 'd', 'þ': 'th' };
  const UNIR = /['’‘´`ʼ.\-‐–]/g;
  const base = t => String(t ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[ßæœøłđðþ]/g, c => MAPA[c]);
  const palabras = t => base(t).replace(UNIR, '').split(/[^a-z0-9]+/).filter(Boolean);
  /* palabras + partes de las compuestas con guion/apóstrofo: "Ek-on" → ekon, ek, on */
  function palabrasYPartes(t) {
    const out = [];
    base(t).split(/[^a-z0-9'’‘´`ʼ.\-‐–]+/).forEach(trozo => {
      const w = trozo.replace(UNIR, ''); if (!w) return;
      out.push(w);
      const partes = trozo.split(UNIR).filter(Boolean);
      if (partes.length > 1) partes.forEach(x => out.push(x));
    });
    return out;
  }
  const CONECTORES = new Set(('de del la las los el y e da do dos das van von di sr sra srta sres srs senor senora senorita don dona ' +
    'dr dra doctor doctora ing lic familia fam flia joven mr mrs ms miss').split(' '));
  const fon = w => String(w || '').replace(/ch/g, 'X').replace(/h/g, '').replace(/ll/g, 'y')
    .replace(/qu([ei])/g, 'k$1').replace(/g([ei])/g, 'j$1').replace(/gu([ei])/g, 'g$1').replace(/c([ei])/g, 's$1')
    .replace(/q/g, 'k').replace(/c/g, 'k').replace(/z/g, 's').replace(/v/g, 'b').replace(/X/g, 'ch')
    .replace(/y$/, 'i').replace(/(.)\1+/g, '$1');

  /* Distancia de edición con transposición (Damerau, versión OSA) y tope: devuelve tope+1 si lo supera */
  function dist(a, b, tope) {
    if (a === b) return 0;
    const la = a.length, lb = b.length;
    if (Math.abs(la - lb) > tope) return tope + 1;
    let ant2 = null, ant = Array.from({ length: lb + 1 }, (_, j) => j);
    for (let i = 1; i <= la; i++) {
      const cur = [i]; let m = i;
      for (let j = 1; j <= lb; j++) {
        const c = a[i - 1] === b[j - 1] ? 0 : 1;
        let v = Math.min(ant[j] + 1, cur[j - 1] + 1, ant[j - 1] + c);
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, ant2[j - 2] + 1);
        cur[j] = v; if (v < m) m = v;
      }
      if (m > tope) return tope + 1;
      ant2 = ant; ant = cur;
    }
    return ant[lb];
  }

  /* Consulta → palabras exigidas (sin conectores si quedan otras) + restricción "mesa N" */
  function consulta(q) {
    const todas = palabras(q);
    let mesa = null; const resto = [];
    for (let i = 0; i < todas.length; i++) {
      if ((todas[i] === 'mesa' || todas[i] === 'table') && i + 1 < todas.length) { mesa = todas[++i]; continue; }
      resto.push(todas[i]);
    }
    const sin = resto.filter(w => !CONECTORES.has(w));
    const tokens = [...new Set(sin.length ? sin : resto)];
    return { tokens, mesa, todas, clave: todas.join('') };
  }

  /* --------------------------------------------------------------------------------- índice por elemento */
  const cache = new WeakMap();
  function indice(item, campos) {
    const cs = campos(item), firma = cs.map(c => c.k + '\u0001' + (c.texto ?? '')).join('\u0002');
    const prev = cache.get(item);
    if (prev && prev.firma === firma) return prev;
    const ix = { firma, campos: cs.filter(c => c.texto != null && String(c.texto).trim() !== '').map(c => {
      const texto = String(c.texto), tipo = c.tipo || 'texto';
      if (tipo === 'codigo') return { ...c, tipo, valor: texto.toUpperCase().replace(/[^A-Z0-9]/g, '') };
      if (tipo === 'mesa') return { ...c, tipo, valor: palabras(texto).join('') };
      if (tipo === 'telefono') return { ...c, tipo, valor: texto.replace(/\D/g, '') };
      const ws = palabrasYPartes(texto), lista = palabras(texto);
      const inicios = new Set(); let acc = 0; lista.forEach(w => { inicios.add(acc); acc += w.length; });
      const al = c.alias ? palabras(c.alias).filter(w => !CONECTORES.has(w)).map(w => ({ w, f: fon(w), alias: true })) : [];
      return { ...c, tipo, ws: [...ws.map(w => ({ w, f: fon(w) })), ...al], lista, clave: lista.join(''), inicios };
    }) };
    cache.set(item, ix);
    return ix;
  }

  /* Mejor coincidencia de una palabra de la consulta contra un campo de texto: [puntaje, índice de palabra] */
  function contra(tk, c) {
    let best = 0, idx = -1;
    const n = tk.length, tope = n >= 7 ? 2 : n >= 4 ? 1 : 0, ft = n >= 3 ? fon(tk) : '';
    c.ws.forEach((o, k) => {
      const w = o.w; let p = 0;
      if (w === tk) p = 100;
      else if (w.startsWith(tk)) p = n === 1 ? 60 : 80;
      else if (n >= 3 && o.f === ft) p = 55;
      else if (n >= 4 && o.f.startsWith(ft)) p = 50;
      else if (tope && dist(w, tk, tope) <= tope) p = 35;
      else if (n >= 5 && w.length > n && dist(w.slice(0, n), tk, 1) <= 1) p = 30;
      if (o.alias) p = Math.round(p * .6);
      if (p > best) { best = p; idx = o.alias ? -1 : k; }
    });
    if (best < 60 && n >= 3 && c.tipo === 'nombre') {
      const pos = c.clave.indexOf(tk);
      if (pos >= 0) { const p = c.inicios.has(pos) ? 60 : 40; if (p > best) { best = p; idx = -1; } }
    }
    return [best, idx];
  }
  function puntuar(tk, c, soloMesa) {
    if (soloMesa) return c.tipo === 'mesa' && c.valor === tk ? 90 : 0;
    if (c.tipo === 'codigo') { const T = tk.toUpperCase(); return c.valor === T ? 150 : T.length >= 2 && c.valor.startsWith(T) ? 45 : 0; }
    if (c.tipo === 'mesa') return c.valor === tk ? 90 : 0;
    if (c.tipo === 'telefono') return /^\d{4,}$/.test(tk) && c.valor.includes(tk) ? (c.valor.endsWith(tk) ? 95 : 90) : 0;
    return contra(tk, c)[0];
  }

  function fragmento(texto, tokens) {
    const t = String(texto).replace(/\s+/g, ' ').trim();
    if (t.length <= 70) return t;
    const b = base(t); let pos = -1;
    for (const tk of tokens) { const k = b.indexOf(tk); if (k >= 0 && (pos < 0 || k < pos)) pos = k; }
    if (pos < 0) return t.slice(0, 67) + '…';
    const ini = Math.max(0, pos - 25);
    return (ini ? '…' : '') + t.slice(ini, ini + 65) + (ini + 65 < t.length ? '…' : '');
  }

  /* --------------------------------------------------------------------------------- búsqueda */
  function buscar(lista, q, campos) {
    const Q = consulta(q);
    if (!Q.tokens.length && !Q.mesa) return { resultados: lista.map(item => ({ item, puntaje: 0, motivo: null })), parcial: false, vacia: true };
    const exigidas = Q.tokens.length + (Q.mesa ? 1 : 0), ordenadas = [...Q.todas].sort().join(' ');
    const filas = [];
    for (const item of lista) {
      const ix = indice(item, campos), nom = ix.campos.find(c => c.tipo === 'nombre' && c.k === 'nombre');
      let suma = 0, n = 0, enNombre = 0, debil = false, motivo = null, mejorOtro = 0;
      const posNombre = [];
      if (Q.mesa) { if (ix.campos.some(c => puntuar(Q.mesa, c, true))) { n++; suma += 90; } }
      for (const tk of Q.tokens) {
        let best = 0, campo = null;
        for (const c of ix.campos) { const p = puntuar(tk, c) * (c.peso ?? 1); if (p > best) { best = p; campo = c; } }
        if (!best) continue;
        n++; suma += best;
        if (campo === nom) { enNombre++; const [pn, k] = contra(tk, nom); posNombre.push(k); if (pn < 55) debil = true; }
        else if (campo && !['nombre', 'tratamiento', 'codigo'].includes(campo.k) && best > mejorOtro) { mejorOtro = best; motivo = campo; }
      }
      if (!n) continue;
      let extra = 0;
      if (nom) {
        if (Q.clave && nom.clave === Q.clave) extra += 400;
        else if (ordenadas && [...nom.lista].sort().join(' ') === ordenadas) extra += 300;
        else if (Q.clave.length >= 3 && nom.clave.startsWith(Q.clave)) extra += 120;
        if (enNombre === Q.tokens.length && Q.tokens.length && !debil) extra += 50;
        const p = posNombre.filter(k => k >= 0);
        if (p.length > 1 && p.every((k, i) => !i || k > p[i - 1])) extra += 30;
        if (Q.tokens[0] && nom.lista[0] && nom.lista[0].startsWith(Q.tokens[0])) extra += 25;
      }
      filas.push({ item, n, puntaje: suma + extra, largo: nom ? nom.clave.length : 99, nombre: nom ? nom.texto : '',
        motivo: motivo ? { k: motivo.k, etiqueta: motivo.etiqueta || motivo.k, texto: fragmento(motivo.texto, Q.tokens) } : null });
    }
    let res = filas.filter(f => f.n === exigidas), parcial = false;
    if (!res.length && exigidas >= 2) { res = filas.filter(f => f.n >= Math.ceil(exigidas / 2)); parcial = res.length > 0; }
    res.sort((a, b) => b.n - a.n || b.puntaje - a.puntaje || a.largo - b.largo || a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }));
    return { resultados: res.map(f => ({ item: f.item, puntaje: Math.round(f.puntaje), motivo: f.motivo })), parcial, vacia: false };
  }

  /* --------------------------------------------------------------------------------- resaltado */
  const esc = t => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function resaltar(texto, q, clase = '') {
    const Q = consulta(q);
    if (!Q.tokens.length) return esc(texto);
    return String(texto ?? '').split(/(\s+)/).map(trozo => {
      if (!trozo.trim()) return trozo;
      const ws = palabrasYPartes(trozo); if (!ws.length) return esc(trozo);
      const c = { tipo: 'texto', ws: ws.map(w => ({ w, f: fon(w) })) };
      const si = Q.tokens.some(tk => contra(tk, c)[0] > 0);
      return si ? `<mark${clase ? ` class="${clase}"` : ''}>${esc(trozo)}</mark>` : esc(trozo);
    }).join('');
  }

  g.PYD_BUSCAR = { base, palabras, fon, dist, consulta, buscar, resaltar };
  if (typeof module !== 'undefined') module.exports = g.PYD_BUSCAR;
})(typeof window !== 'undefined' ? window : globalThis);
