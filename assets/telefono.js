/* telefono.js — Teléfonos para WhatsApp · Parte y Detalles · v3.4
 *   PYD_TEL.normalizar(texto, 'PE') → { numero, texto, estado, nota }
 *     numero: solo dígitos con código de país (para wa.me / api.whatsapp.com) · texto: "+51 945 709 988"
 *     estado: 'ok' (ya tenía código) · 'agregado' (se agregó el código del país por defecto) · 'dudoso' · 'vacio'
 *   PYD_TEL.PAISES: [iso, nombre, código, longitudes nacionales, prefijo de celular]
 *
 * Reglas
 *   · Se quitan el apóstrofo o acento que Excel pone delante (´+1…, '945…), espacios, guiones, puntos y paréntesis.
 *   · Con "+" o "00" delante: se respeta el código que trae (si el país es conocido, se valida su longitud).
 *   · Sin código: si la longitud es la de un celular del país por defecto (quitando el 0 de larga distancia),
 *     se le agrega el código. Si no, y empieza con el código de un país conocido con la longitud correcta, se acepta.
 *   · Argentina: WhatsApp exige el 9 después del 54 (+54 9 11 …): se agrega si falta.
 *   · Varios números en una celda ("945… / 987…"): se usa el primero y se avisa.
 *   · Lo que no encaja queda "dudoso": se conserva tal cual para que los novios lo revisen.
 */
(function (g) {
  'use strict';
  const PAISES = [
    ['PE', 'Perú', '51', [9], /^9/], ['AR', 'Argentina', '54', [10], null], ['BO', 'Bolivia', '591', [8], /^[67]/],
    ['BR', 'Brasil', '55', [10, 11], null], ['CL', 'Chile', '56', [9], /^9/], ['CO', 'Colombia', '57', [10], /^3/],
    ['CR', 'Costa Rica', '506', [8], null], ['EC', 'Ecuador', '593', [9], /^9/], ['SV', 'El Salvador', '503', [8], null],
    ['ES', 'España', '34', [9], /^[67]/], ['US', 'EE. UU. / Canadá', '1', [10], null], ['GT', 'Guatemala', '502', [8], null],
    ['HN', 'Honduras', '504', [8], null], ['MX', 'México', '52', [10], null], ['NI', 'Nicaragua', '505', [8], null],
    ['PA', 'Panamá', '507', [8], /^6/], ['PY', 'Paraguay', '595', [9], /^9/], ['DO', 'Rep. Dominicana', '1', [10], /^8[024]9/],
    ['UY', 'Uruguay', '598', [8], /^9/], ['VE', 'Venezuela', '58', [10], /^4/], ['DE', 'Alemania', '49', [10, 11], /^1/],
    ['AU', 'Australia', '61', [9], /^4/], ['CN', 'China', '86', [11], /^1/], ['FR', 'Francia', '33', [9], /^[67]/],
    ['IN', 'India', '91', [10], /^[6-9]/], ['IT', 'Italia', '39', [9, 10], /^3/], ['JP', 'Japón', '81', [10], null],
    ['NL', 'Países Bajos', '31', [9], /^6/], ['PT', 'Portugal', '351', [9], /^9/], ['GB', 'Reino Unido', '44', [10], /^7/],
    ['CH', 'Suiza', '41', [9], /^7/]
  ];
  const porIso = iso => PAISES.find(p => p[0] === iso) || PAISES[0];
  const porCodigo = dig => PAISES.filter(p => dig.startsWith(p[2])).sort((a, b) => b[2].length - a[2].length);
  function agrupar(n) {
    if (n.length === 8) return n.replace(/(\d{4})(\d{4})/, '$1 $2');
    if (n.length === 9) return n.replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3');
    if (n.length === 10) return n.replace(/(\d{3})(\d{3})(\d{4})/, '$1 $2 $3');
    if (n.length === 11) return n.replace(/(\d{2})(\d{5})(\d{4})/, '$1 $2 $3');
    return n.replace(/(\d{3})(?=\d)/g, '$1 ');
  }
  function formato(cc, nacional) {
    if (cc === '54' && nacional.length === 11 && nacional[0] === '9') return `+54 9 ${agrupar(nacional.slice(1))}`;
    return `+${cc} ${agrupar(nacional)}`;
  }
  const res = (numero, texto, estado, nota = '') => ({ numero, texto, estado, nota });

  function normalizar(entrada, iso = 'PE') {
    let s = String(entrada ?? '').trim();
    if (!s) return res('', '', 'vacio');
    let nota = '';
    const partes = s.split(/\s*(?:\/|;|,|\||\s+o\s+|\s+y\s+|\s+or\s+)\s*/i).filter(x => (x.match(/\d/g) || []).length >= 6);
    if (partes.length > 1) { s = partes[0]; nota = 'Tenía varios números: se usó el primero.'; }
    s = s.replace(/^[\s'´`’‘"]+/, '').replace(/\s*(ext|anexo|x)\.?\s*\d+\s*$/i, '').replace(/^(\d+)\.0+$/, '$1');
    if (/e\+?\d+$/i.test(s)) return res('', s, 'dudoso', 'Excel lo guardó en notación científica: escribe el número completo.');
    const intl = /^\s*(\+|00)/.test(s);
    let d = s.replace(/\D/g, '');
    if (intl && s.trim().startsWith('00')) d = d.slice(2);
    if (!d) return res('', s, 'dudoso', 'No tiene dígitos.');
    const P = porIso(iso);

    if (intl) {
      const c = porCodigo(d)[0];
      if (!c) return d.length >= 8 && d.length <= 15 ? res(d, '+' + agrupar(d), 'ok', nota) : res(d, '+' + d, 'dudoso', 'Longitud no válida.');
      let nac = d.slice(c[2].length);
      if (c[2] === '54' && nac.length === 10) { nac = '9' + nac; nota = (nota ? nota + ' ' : '') + 'Se agregó el 9 de celular de Argentina.'; }
      const largoOk = c[2] === '54' ? nac.length === 11 : porCodigo(d).some(x => x[2] === c[2] && x[3].includes(nac.length));
      return res(c[2] + nac, formato(c[2], nac), largoOk ? 'ok' : 'dudoso', largoOk ? nota : (nota + ' Longitud inusual para ' + c[1] + '.').trim());
    }

    /* sin código de país */
    let nac = d;
    if (nac.length - 1 && nac[0] === '0' && P[3].includes(nac.length - 1)) nac = nac.slice(1);
    if (P[2] === '54' && nac.length === 12 && nac.slice(2, 4) === '15') nac = nac.slice(0, 2) + nac.slice(4);
    if (P[3].includes(nac.length)) {
      const nn = P[2] === '54' ? '9' + nac : nac, movilOk = !P[4] || P[4].test(nac);
      return res(P[2] + nn, formato(P[2], nn), movilOk ? 'agregado' : 'dudoso',
        movilOk ? nota : (nota + ` No parece un celular de ${P[1]}.`).trim());
    }
    for (const c of porCodigo(d)) {
      const resto = d.slice(c[2].length);
      if (c[3].includes(resto.length) || (c[2] === '54' && resto.length === 11)) return res(d, formato(c[2], resto), 'ok', (nota + ` Se asumió +${c[2]} (${c[1]}).`).trim());
    }
    return res(d, s, 'dudoso', (nota + ` No coincide con un celular de ${P[1]} ni trae código de país.`).trim());
  }

  g.PYD_TEL = { PAISES, normalizar, porIso };
  if (typeof module !== 'undefined') module.exports = g.PYD_TEL;
})(typeof window !== 'undefined' ? window : globalThis);
