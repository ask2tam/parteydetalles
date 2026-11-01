/* pyd-config.js — Configuración ÚNICA compartida por todas las páginas (invitaciones, rsvp, staff, panel).
 * Cargar primero, SIN defer.  */
window.PYD = Object.assign({
  SUPABASE_URL: 'https://gsfsnhhnwohaqvrvfola.supabase.co',   // Supabase > Project Settings > API > Project URL
  SUPABASE_ANON: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdzZnNuaGhud29oYXF2cnZmb2xhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM0ODU1NzEsImV4cCI6MjEwOTA2MTU3MX0.Jad5gYSmJBRjwseBJ7SkBLP6barjCSLQp8qjkoeZ0VU',                       // anon public (es pública: la protege RLS)
  STAFF_URL: '/staff.html',                           // modo recepción
  PANEL_URL: '/panel.html',
  INSTAGRAM: 'https://www.instagram.com/parteydetalles/',
  VERSION_PANEL: 'v1.00'
}, window.PYD || {});

/* Proyecto actual: ?p=slug  →  window.BODA_PROYECTO  →  primera carpeta de la ruta (/ignacioysuly/...) */
window.PYD.slug = (function () {
  var q = new URLSearchParams(location.search).get('p');
  var s = q || window.BODA_PROYECTO || '';
  if (!s) {
    var seg = location.pathname.split('/').filter(Boolean);
    if (seg.length && !/\.[a-z0-9]+$/i.test(seg[0])) s = seg[0];
  }
  return String(s).toLowerCase().replace(/[^a-z0-9-]/g, '');
})();

/* ¿Este navegador tiene una sesión del equipo? (no cuenta vistas ni respuestas como invitado) */
window.PYD.haySesion = function () {
  try { for (var i = 0; i < localStorage.length; i++) if (/^sb-.*-auth-token$/.test(localStorage.key(i))) return true; } catch (e) {}
  return false;
};

/* Redirección del rol STAFF: si este navegador tiene sesión de recepción para este proyecto,
 * va directo a staff.html sin descargar videos, música ni imágenes de la invitación.
 * El resto de roles (incluido admin) ve la invitación normal. Saltar con ?invitado=1 */
(function () {
  try {
    var P = window.PYD, q = new URLSearchParams(location.search);
    if (q.get('invitado') === '1' || !P.slug || /staff\.html$|panel\.html$/.test(location.pathname)) return;
    var s = JSON.parse(localStorage.getItem('pyd.staff') || 'null');
    if (!s || !s.proyectos || s.proyectos.indexOf(P.slug) < 0 || !P.haySesion()) return;
    var to = (q.get('to') || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    location.replace(P.STAFF_URL + '?p=' + encodeURIComponent(P.slug) + (to ? '&to=' + to : ''));
  } catch (e) {}
})();
