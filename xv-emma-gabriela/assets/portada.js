// =====================================================================
// PORTADA (Shadow DOM): carga (Promise.all) + click en el sobre → música + zoom + revelado
// Contrato con animacion.js: el host tiene id="gate" y al revelar la invitación
// se dispara el evento "invitacion:visible".
// La portada vive en un Shadow DOM para que  * { animation:none !important; transition:none !important }
// de canva.css no le afecte. No se usa prefers-reduced-motion: la animación se muestra siempre.
// =====================================================================
(function () {
  const host     = document.getElementById('gate');
  const plantilla = document.getElementById('gate-template');
  if (!host || !plantilla) return;

  // ---------- Shadow DOM ----------
  const sr = host.attachShadow({ mode: 'open' });
  sr.appendChild(plantilla.content.cloneNode(true));
  // El fondo crema del host solo cubre el instante previo a crear el Shadow DOM.
  // Desde ahora el fondo lo pone .gate (interno), que es el que hace el fundido.
  host.style.background = 'transparent';

  const gate      = sr.querySelector('.gate');
  const envelope  = sr.querySelector('.gate-envelope');
  const envImg    = envelope.querySelector('img');
  const bgImg     = sr.querySelector('.gate-bg');
  const hint      = sr.querySelector('.gate-hint');
  const gateVideo = sr.querySelector('.gate-video');

  // Elementos de la página (fuera del Shadow DOM)
  const musica    = document.getElementById('musica-fondo');
  const btnMusica = document.getElementById('btn-musica');
  const iconOn    = document.getElementById('icon-sound-on');
  const iconOff   = document.getElementById('icon-sound-off');

  const TIEMPO_MAX_CARGA = 10000;   // nunca se queda cargando para siempre
  const T_FADE_INICIO    = 1500;    // ms tras el click en que la portada empieza a disolverse
  const T_QUITAR         = 3800;    // ms tras el click en que se elimina la portada

  // ---------- video de brillos: loop infinito y reanudación ----------
  // (video-modal.js busca <video> en el documento y no entra al Shadow DOM, por eso se cuida aquí)
  if (gateVideo) {
    gateVideo.loop = true; gateVideo.muted = true; gateVideo.defaultMuted = true; gateVideo.playsInline = true;
    const reproducir = () => {
      if (!gateVideo.isConnected || !gateVideo.paused) return;
      const p = gateVideo.play(); if (p && p.catch) p.catch(() => {});
    };
    reproducir();
    gateVideo.addEventListener('canplay', reproducir);
    gateVideo.addEventListener('pause',   () => { if (!document.hidden) setTimeout(reproducir, 50); });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) reproducir(); });
    window.addEventListener('focus', reproducir);
    ['touchstart', 'click'].forEach(ev => window.addEventListener(ev, reproducir, { once: true, passive: true }));
  }

  // ---------- utilidades de precarga ----------
  const conLimite = (promesa, ms) =>
    Promise.race([promesa, new Promise(r => setTimeout(r, ms))]);

  function imagenLista(img) {
    return new Promise(resolve => {
      if (img.complete && img.naturalWidth) return resolve();
      img.addEventListener('load',  resolve, { once: true });
      img.addEventListener('error', resolve, { once: true });
    }).then(() => (img.decode ? img.decode().catch(() => {}) : null));
  }

  function precargarAudio(audio) {
    return new Promise(resolve => {
      if (!audio || audio.readyState >= 1) return resolve();
      audio.addEventListener('loadedmetadata', resolve, { once: true });
      audio.addEventListener('error', resolve, { once: true });
      audio.load();
    });
  }

  function videoListo(video) {
    return new Promise(resolve => {
      if (!video || video.readyState >= 3) return resolve();
      video.addEventListener('canplay', resolve, { once: true });
      video.addEventListener('error',   resolve, { once: true });
    });
  }

  // Fuentes: se piden explícitamente porque el texto está en un Shadow DOM
  // y document.fonts.ready podría resolverse antes de que empiecen a descargarse.
  function fuentesListas() {
    if (!document.fonts) return Promise.resolve();
    return Promise.all([
      document.fonts.load('40px YAHOz13BGw0_0'),
      document.fonts.load('20px YAFdJvwa-l0_0'),
      document.fonts.load('italic 20px YAFdJvwa-l0_0'),
      document.fonts.ready
    ]).catch(() => {});
  }

  // DOM de la invitación cargado (DOM + recursos) y ya medido/escalado por responsive.js
  function invitacionLista() {
    const cargada = new Promise(resolve => {
      if (document.readyState === 'complete') return resolve();
      window.addEventListener('load', resolve, { once: true });
    });
    const escalada = new Promise(resolve => {
      const root = document.getElementById('root');
      if (!root) return resolve();
      const t0 = Date.now();
      (function revisar() {
        if (root.style.opacity === '1' || Date.now() - t0 > 4000) return resolve();
        setTimeout(revisar, 60);
      })();
    });
    return Promise.all([cargada, escalada]);
  }

  const domListo = new Promise(resolve => {
    if (document.readyState !== 'loading') return resolve();
    document.addEventListener('DOMContentLoaded', resolve, { once: true });
  });

  // Etapa 1: lo mínimo para mostrar la portada con su tipografía y sobre
  domListo.then(() =>
    conLimite(Promise.all([fuentesListas(), imagenLista(bgImg), imagenLista(envImg)]), 5000)
  ).then(() => gate.classList.add('loaded'));

  // Etapa 2: todo listo (audio, fuentes, DOM de la invitación, imágenes y video) → se habilita el sobre
  domListo.then(() =>
    conLimite(Promise.all([
      precargarAudio(musica),
      fuentesListas(),
      invitacionLista(),
      imagenLista(bgImg),
      imagenLista(envImg),
      videoListo(gateVideo)
    ]), TIEMPO_MAX_CARGA)
  ).then(() => {
    gate.classList.add('loaded');
    setTimeout(() => {
      hint.textContent = 'Dale click para empezar';
      hint.classList.add('ready');
      envelope.classList.add('ready');
      envelope.setAttribute('aria-disabled', 'false');
    }, 500);
  });

  // ---------- música ----------
  function actualizarIconos(pausado) {
    iconOn.style.display  = pausado ? 'none'  : 'block';
    iconOff.style.display = pausado ? 'block' : 'none';
  }

  btnMusica.addEventListener('click', () => {
    if (musica.paused) { musica.play().catch(() => {}); actualizarIconos(false); }
    else               { musica.pause();               actualizarIconos(true);  }
  });

  // ---------- apertura ----------
  let abierta = false;
  function abrirInvitacion() {
    if (abierta || !envelope.classList.contains('ready')) return;
    abierta = true;

    // 1) Música (debe llamarse dentro del click para que el navegador la permita)
    btnMusica.style.display = 'flex';
    const p = musica.play();
    if (p && p.then) p.then(() => actualizarIconos(false)).catch(() => actualizarIconos(true));
    else actualizarIconos(false);

    // 2) El sobre se agranda lentamente y los textos se desvanecen
    gate.classList.add('opening');
    envelope.classList.remove('ready');
    envelope.classList.add('zoom-envelope');
    hint.classList.remove('ready');

    // 3) La portada se disuelve y la invitación empieza a animarse
    setTimeout(() => {
      gate.classList.add('fade-out');
      window.__invitacionVisible = true;
      window.dispatchEvent(new CustomEvent('invitacion:visible'));
      if (typeof window.iniciarEfectosTexto === 'function') window.iniciarEfectosTexto();
    }, T_FADE_INICIO);

    // 4) Se libera la página
    setTimeout(() => {
      if (gateVideo) { try { gateVideo.pause(); } catch (e) {} }
      host.remove();
      document.documentElement.classList.remove('overlay-active');
      window.scrollTo(0, 0);
    }, T_QUITAR);
  }

  envelope.addEventListener('click', abrirInvitacion);
  hint.addEventListener('click', abrirInvitacion);
  envelope.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrirInvitacion(); }
  });
})();
