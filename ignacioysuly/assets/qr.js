/* qr.js — Generador QR sin dependencias (byte mode, versiones 1–40, ECC L/M/Q/H)
 * QR.encode(texto, ecc)            → matriz
 * QR.dibujar(canvas, texto, opc)    → Promise<info>  (estilos + logo central con hueco seguro)
 * Compartido por la invitación (rsvp.js) y el Panel.
 */
(function (global) {
  'use strict';
  if (global.QR) return;
  const ECL = { L: [0, 1], M: [1, 0], Q: [2, 3], H: [3, 2] };
  const ECC = [
    [-1,7,10,15,20,26,18,20,24,30,18,20,24,26,30,22,24,28,30,28,28,28,28,30,30,26,28,30,30,30,30,30,30,30,30,30,30,30,30,30,30],
    [-1,10,16,26,18,24,16,18,22,22,26,30,22,22,24,24,28,28,26,26,26,26,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28],
    [-1,13,22,18,26,18,24,18,22,20,24,28,26,24,20,30,24,28,28,26,30,28,30,30,30,30,28,30,30,30,30,30,30,30,30,30,30,30,30,30,30],
    [-1,17,28,22,16,22,28,26,26,24,28,24,28,22,24,24,30,28,28,26,28,30,24,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30]];
  const NB = [
    [-1,1,1,1,1,1,2,2,2,2,4,4,4,4,4,6,6,6,6,7,8,8,9,9,10,12,12,12,13,14,15,16,17,18,19,19,20,21,22,24,25],
    [-1,1,1,1,2,2,4,4,4,5,5,5,8,9,9,10,10,11,13,14,16,17,17,18,20,21,23,25,26,28,29,31,33,35,37,38,40,43,45,47,49],
    [-1,1,1,2,2,4,4,6,6,8,8,8,10,12,16,12,17,16,18,21,20,23,23,25,27,29,34,34,35,38,40,43,45,48,51,53,56,59,62,65,68],
    [-1,1,1,2,4,4,4,5,6,8,8,11,11,16,16,18,16,19,21,25,25,25,34,30,32,35,37,40,42,45,48,51,54,57,60,63,66,70,74,77,81]];
  const rawMods = v => { let r = (16*v+128)*v+64; if (v >= 2) { const a = Math.floor(v/7)+2; r -= (25*a-10)*a-55; if (v >= 7) r -= 36; } return r; };
  const dataCW = (v, e) => Math.floor(rawMods(v)/8) - ECC[e][v]*NB[e][v];
  const mul = (x, y) => { let z = 0; for (let i = 7; i >= 0; i--) { z = (z<<1) ^ ((z>>>7)*0x11D); z ^= ((y>>>i)&1)*x; } return z; };
  const rsDiv = d => { const r = new Array(d-1).fill(0); r.push(1); let root = 1;
    for (let i = 0; i < d; i++) { for (let j = 0; j < r.length; j++) { r[j] = mul(r[j], root); if (j+1 < r.length) r[j] ^= r[j+1]; } root = mul(root, 2); } return r; };
  const rsRem = (data, div) => { const r = div.map(() => 0);
    for (const b of data) { const f = b ^ r.shift(); r.push(0); div.forEach((c, i) => r[i] ^= mul(c, f)); } return r; };
  const alignPos = v => { if (v === 1) return []; const n = Math.floor(v/7)+2, size = v*4+17;
    const step = v === 32 ? 26 : Math.ceil((v*4+4)/(n*2-2))*2; const r = [6];
    for (let p = size-7; r.length < n; p -= step) r.splice(1, 0, p); return r; };
  const MASKS = [(x,y)=>(x+y)%2===0,(x,y)=>y%2===0,(x,y)=>x%3===0,(x,y)=>(x+y)%3===0,
    (x,y)=>(Math.floor(x/3)+Math.floor(y/2))%2===0,(x,y)=>x*y%2+x*y%3===0,
    (x,y)=>(x*y%2+x*y%3)%2===0,(x,y)=>((x+y)%2+x*y%3)%2===0];
  function penalty(M, n) {
    let p = 0;
    const line = get => { let s = 0, run = 1, str = get(0) ? "1" : "0";
      for (let i = 1; i < n; i++) { str += get(i) ? "1" : "0"; if (get(i) === get(i-1)) run++; else { if (run >= 5) s += run-2; run = 1; } }
      if (run >= 5) s += run-2;
      const pad = "0000" + str + "0000";
      for (const pat of ["10111010000", "00001011101"]) { let k = pad.indexOf(pat); while (k !== -1) { s += 40; k = pad.indexOf(pat, k+1); } }
      return s; };
    for (let y = 0; y < n; y++) p += line(i => M[y][i]);
    for (let x = 0; x < n; x++) p += line(i => M[i][x]);
    for (let y = 0; y < n-1; y++) for (let x = 0; x < n-1; x++) { const c = M[y][x]; if (c === M[y][x+1] && c === M[y+1][x] && c === M[y+1][x+1]) p += 3; }
    let dark = 0; M.forEach(r => r.forEach(c => { if (c) dark++; }));
    return p + Math.max(0, Math.ceil(Math.abs(dark*20 - n*n*10)/(n*n)) - 1)*10;
  }
  function encode(text, eclName = "M", forceMask = -1) {
    const [e, fbits] = ECL[eclName] || ECL.M;
    const bytes = Array.from(new TextEncoder().encode(text));
    let v = 1;
    for (;; v++) { if (v > 40) throw new Error("Texto demasiado largo para un QR");
      if (4 + (v <= 9 ? 8 : 16) + bytes.length*8 <= dataCW(v, e)*8) break; }
    const bits = [], put = (val, len) => { for (let i = len-1; i >= 0; i--) bits.push((val>>>i)&1); };
    const cap = dataCW(v, e)*8;
    put(4, 4); put(bytes.length, v <= 9 ? 8 : 16); bytes.forEach(b => put(b, 8));
    put(0, Math.min(4, cap - bits.length)); put(0, (8 - bits.length%8)%8);
    for (let p = 0xEC; bits.length < cap; p ^= 0xEC ^ 0x11) put(p, 8);
    const data = []; for (let i = 0; i < bits.length; i += 8) { let b = 0; for (let j = 0; j < 8; j++) b = (b<<1)|bits[i+j]; data.push(b); }
    const nb = NB[e][v], el = ECC[e][v], raw = Math.floor(rawMods(v)/8), nShort = nb - raw%nb, shortLen = Math.floor(raw/nb);
    const div = rsDiv(el), blocks = [];
    for (let i = 0, k = 0; i < nb; i++) { const dat = data.slice(k, k + shortLen - el + (i < nShort ? 0 : 1)); k += dat.length;
      const ecc = rsRem(dat, div); if (i < nShort) dat.push(0); blocks.push(dat.concat(ecc)); }
    const cw = [], cwBlk = [];
    for (let i = 0; i < blocks[0].length; i++) blocks.forEach((b, j) => { if (i !== shortLen - el || j >= nShort) { cw.push(b[i]); cwBlk.push(j); } });
    const size = v*4+17, grid = f => [...Array(size)].map(() => Array(size).fill(f));
    const M = grid(false), F = grid(false), A = grid(false), C = grid(-1);
    const set = (x, y, d) => { M[y][x] = d; F[y][x] = true; };
    for (let i = 0; i < size; i++) { set(6, i, i%2 === 0); set(i, 6, i%2 === 0); }
    for (const [cx, cy] of [[3,3],[size-4,3],[3,size-4]]) for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const d = Math.max(Math.abs(dx), Math.abs(dy)), x = cx+dx, y = cy+dy;
      if (x >= 0 && x < size && y >= 0 && y < size) set(x, y, d !== 2 && d !== 4); }
    const ap = alignPos(v), na = ap.length;
    for (let i = 0; i < na; i++) for (let j = 0; j < na; j++) {
      if ((i === 0 && j === 0) || (i === 0 && j === na-1) || (i === na-1 && j === 0)) continue;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { set(ap[i]+dx, ap[j]+dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1); A[ap[j]+dy][ap[i]+dx] = true; } }
    const drawFormat = mask => { const d = fbits<<3 | mask; let r = d; for (let i = 0; i < 10; i++) r = (r<<1) ^ ((r>>>9)*0x537);
      const b = (d<<10 | r) ^ 0x5412, g = i => ((b>>>i)&1) === 1;
      for (let i = 0; i <= 5; i++) set(8, i, g(i)); set(8, 7, g(6)); set(8, 8, g(7)); set(7, 8, g(8));
      for (let i = 9; i < 15; i++) set(14-i, 8, g(i));
      for (let i = 0; i < 8; i++) set(size-1-i, 8, g(i));
      for (let i = 8; i < 15; i++) set(8, size-15+i, g(i)); set(8, size-8, true); };
    drawFormat(0);
    if (v >= 7) { let r = v; for (let i = 0; i < 12; i++) r = (r<<1) ^ ((r>>>11)*0x1F25); const b = v<<12 | r;
      for (let i = 0; i < 18; i++) { const bit = ((b>>>i)&1) === 1, a = size-11+i%3, c = Math.floor(i/3); set(a, c, bit); set(c, a, bit); } }
    let i = 0;
    for (let right = size-1; right >= 1; right -= 2) { if (right === 6) right = 5;
      for (let vert = 0; vert < size; vert++) for (let j = 0; j < 2; j++) {
        const x = right-j, y = ((right+1)&2) === 0 ? size-1-vert : vert;
        if (!F[y][x] && i < cw.length*8) { M[y][x] = ((cw[i>>>3] >>> (7-(i&7)))&1) === 1; C[y][x] = i>>>3; i++; } } }
    const apply = m => { for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!F[y][x] && MASKS[m](x, y)) M[y][x] = !M[y][x]; };
    let best = forceMask;
    if (best < 0) { let bestP = Infinity;
      for (let m = 0; m < 8; m++) { apply(m); drawFormat(m); const p = penalty(M, size); if (p < bestP) { bestP = p; best = m; } apply(m); } }
    apply(best); drawFormat(best);
    return { size, modules: M, funcion: F, alineacion: A, codeword: C, bloqueDe: cwBlk, bloques: nb, eccPorBloque: el, ecc: eclName, version: v, mask: best };
  }

  /* Hueco del logo: el mayor que la corrección de errores tolera (criterio conservador por bloque RS) */
  function zonaLogo(q, L) {
    const n = q.size, cx = n / 2;
    const cubre = (lado, r, k) => {
      const h = lado / 2;
      if (L.forma === "circulo") {
        const dx = Math.max(Math.abs(k + .5 - cx) - .5, 0), dy = Math.max(Math.abs(r + .5 - cx) - .5, 0);
        return dx * dx + dy * dy < h * h - 1e-9;
      }
      return Math.abs(k + .5 - cx) - .5 < h - 1e-9 && Math.abs(r + .5 - cx) - .5 < h - 1e-9;
    };
    const limite = Math.floor((L.reservaECC ?? .5) * Math.floor(q.eccPorBloque / 2));
    const evaluar = lado => {
      const danados = Array.from({ length: q.bloques }, () => new Set()), celdas = [];
      for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) {
        if (!cubre(lado, r, k)) continue;
        if (q.funcion[r][k] && !q.alineacion[r][k]) return null;
        celdas.push([r, k]);
        const c = q.codeword[r][k]; if (c >= 0) danados[q.bloqueDe[c]].add(c);
      }
      const peor = Math.max(...danados.map(s => s.size));
      return peor <= limite ? { lado, celdas, peor } : null;
    };
    const tope = Math.min(L.ladoMax ?? .3, typeof L.tamano === "number" ? L.tamano : 1) * n;
    let mejor = null;
    for (let lado = 3; lado <= tope; lado += 0.5) { const z = evaluar(lado); if (z) mejor = z; else if (mejor) break; }
    return mejor;
  }
  const cargarImagen = src => new Promise((res, rej) => { const im = new Image();
    if (!src.startsWith("data:")) im.crossOrigin = "anonymous";
    im.onload = () => res(im); im.onerror = () => rej(new Error("logo")); im.src = src; });

  /* Dibuja en ctx dentro del cuadrado (x, y, S). opc: {ecc, estilo: clasico|redondeado|circular, color, fondo, zonaSilencio, logo} */
  async function dibujarEn(ctx, texto, x0, y0, S, opc) {
    opc = Object.assign({ ecc: "M", estilo: "redondeado", color: "#111111", fondo: "#FFFFFF", zonaSilencio: 4 }, opc || {});
    const L = opc.logo || {}, conLogo = !!L.activo && (L.tipo === "imagen" ? !!L.src : !!L.texto);
    const q = encode(texto, conLogo ? (L.ecc || "H") : opc.ecc);
    const zona = conLogo ? zonaLogo(q, L) : null;
    const n = q.size, c = S / (n + 2 * opc.zonaSilencio), o = opc.zonaSilencio * c;
    const rr = (x, y, w, h, r) => { ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h); };
    const libre = new Set((zona ? zona.celdas : []).map(([r, k]) => r * n + k));
    ctx.save();
    ctx.fillStyle = opc.fondo; ctx.fillRect(x0, y0, S, S); ctx.fillStyle = opc.color;
    const ojo = (r, k) => r >= 0 && r < 7 && k >= 0 && k < 7;
    for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) {
      if (!q.modules[r][k] || libre.has(r * n + k) || ojo(r, k) || ojo(r, k - (n - 7)) || ojo(r - (n - 7), k)) continue;
      const x = x0 + o + k * c, y = y0 + o + r * c;
      if (opc.estilo === "circular") { ctx.beginPath(); ctx.arc(x + c / 2, y + c / 2, c * .46, 0, Math.PI * 2); ctx.fill(); }
      else if (opc.estilo === "redondeado") { rr(x + .04 * c, y + .04 * c, c * .92, c * .92, c * .35); ctx.fill(); }
      else ctx.fillRect(Math.floor(x), Math.floor(y), Math.ceil(c), Math.ceil(c));
    }
    const f = opc.estilo === "clasico" ? 0 : 1;   // esquinas apenas redondeadas: radios grandes confunden a algunos lectores
    for (const [r0, k0] of [[0, 0], [0, n - 7], [n - 7, 0]]) {
      const x = x0 + o + k0 * c, y = y0 + o + r0 * c;
      ctx.fillStyle = opc.color; rr(x, y, 7 * c, 7 * c, f * .6 * c); ctx.fill();
      ctx.fillStyle = opc.fondo; rr(x + c, y + c, 5 * c, 5 * c, f * .4 * c); ctx.fill();
      ctx.fillStyle = opc.color; rr(x + 2 * c, y + 2 * c, 3 * c, 3 * c, f * .3 * c); ctx.fill();
    }
    const info = { version: q.version, ecc: q.ecc, modulos: n, logo: null };
    if (zona) {
      const C0x = x0 + S / 2, C0y = y0 + S / 2, interior = zona.lado * c * (1 - 2 * (L.halo ?? .1)), xi = C0x - interior / 2, yi = C0y - interior / 2;
      ctx.beginPath();
      if (L.forma === "circulo") ctx.arc(C0x, C0y, interior / 2, 0, Math.PI * 2);
      else if (L.forma === "redondeado" && ctx.roundRect) ctx.roundRect(xi, yi, interior, interior, interior * .22);
      else ctx.rect(xi, yi, interior, interior);
      ctx.clip();
      if (L.fondo) { ctx.fillStyle = L.fondo; ctx.fillRect(xi, yi, interior, interior); }
      if (L.tipo === "imagen") {
        try {
          const im = await cargarImagen(L.src), pad = L.fondo ? interior * .14 : 0, caja = interior - 2 * pad;
          const e = Math.min(caja / im.naturalWidth, caja / im.naturalHeight);
          ctx.drawImage(im, C0x - im.naturalWidth * e / 2, C0y - im.naturalHeight * e / 2, im.naturalWidth * e, im.naturalHeight * e);
        } catch (err) { info.aviso = "No se pudo cargar la imagen del logo."; }
      } else {
        const fuente = L.fuente || 'italic 600 {px}px Georgia, serif', fnt = p => fuente.replace("{px}", p.toFixed(1));
        let px = interior * .42; ctx.font = fnt(px);
        const w = ctx.measureText(L.texto).width; if (w > interior * .74) { px *= interior * .74 / w; ctx.font = fnt(px); }
        ctx.fillStyle = L.colorTexto || "#FFFFFF"; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
        const m = ctx.measureText(L.texto);
        ctx.fillText(L.texto, C0x, C0y + (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2);
      }
      info.logo = { lado: +(zona.lado / n * 100).toFixed(1), peor: zona.peor };
    } else if (conLogo) info.aviso = "El QR no admite logo con esta configuración; se omitió.";
    ctx.restore();
    return info;
  }
  function dibujar(canvas, texto, opc) { return dibujarEn(canvas.getContext("2d"), texto, 0, 0, canvas.width, opc); }

  global.QR = { encode, dibujar, dibujarEn };
})(typeof window !== 'undefined' ? window : globalThis);
// Node (pruebas): module.exports
if (typeof module !== 'undefined') module.exports = globalThis.QR;
