/* sw-recepcion.js — Permite abrir staff.html sin señal · Parte y Detalles · v3.4
 * Se registra desde staff.html con alcance "./staff.html": no afecta al panel ni a las invitaciones.
 *   · staff.html y assets propios: primero la red (siempre la versión publicada); sin señal, la copia guardada.
 *   · Librerías del CDN (Supabase, lector QR): la copia guardada al instante y se actualiza en segundo plano.
 *   · Las llamadas a Supabase (datos) no pasan por aquí: los datos sin señal los maneja staff.html.
 * Si cambias esta lista, sube VERSION para que los celulares descarguen la nueva. */
const VERSION = 'recepcion-v3.4.0';
const PROPIOS = ['staff.html', 'assets/pyd-config.js', 'assets/buscar.js', 'assets/logo_parteydetalles.png'].map(u => new URL(u, self.location).href);
const CDN = ['https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2', 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => Promise.all([...PROPIOS, ...CDN].map(u => c.add(new Request(u, { cache: 'reload' })).catch(() => {}))))
    .then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('recepcion-') && k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

const sinQuery = u => { const x = new URL(u); x.search = ''; x.hash = ''; return x.href; };
async function redPrimero(req, clave) {
  const c = await caches.open(VERSION);
  try {
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 4000);
    const r = await fetch(req, { signal: ctl.signal }); clearTimeout(t);
    if (r.ok) c.put(clave, r.clone());
    return r;
  } catch (err) {
    const g = await c.match(clave);
    if (g) return g;
    throw err;
  }
}
async function guardadoPrimero(req, clave, ev) {
  const c = await caches.open(VERSION), g = await c.match(clave);
  const red = fetch(req).then(r => { if (r.ok) c.put(clave, r.clone()); return r; }).catch(() => null);
  if (g) { ev.waitUntil(red); return g; }
  return (await red) || Response.error();
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const limpio = sinQuery(req.url);
  if (PROPIOS.includes(limpio)) e.respondWith(redPrimero(req, limpio));
  else if (CDN.includes(req.url)) e.respondWith(guardadoPrimero(req, req.url, e));
});
