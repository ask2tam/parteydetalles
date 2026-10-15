// =====================================================================
// 1. VIDEO DE BRILLOS: loop infinito y reanudación automática
// =====================================================================
(function () {
  const videos = Array.from(document.querySelectorAll('video'));
  if (!videos.length) return;

  function preparar(v) {
    v.loop = true;                 // repetición infinita
    v.muted = true;                // necesario para autoplay (la propiedad, no solo el atributo)
    v.defaultMuted = true;
    v.playsInline = true;
    v.autoplay = true;
    v.removeAttribute('controls');
    v.preload = 'auto';
  }

  function reproducir(v) {
    if (!v.isConnected) return;     // p. ej. el video de la portada, que se elimina al abrir
    if (!v.paused && !v.ended) return;
    const p = v.play();
    if (p && p.catch) p.catch(() => { /* autoplay bloqueado: se reintenta con la 1ª interacción */ });
  }

  videos.forEach(v => {
    preparar(v);
    reproducir(v);
    // Si el navegador lo pausa (pérdida de foco, ahorro de energía, etc.) o termina, se reanuda
    v.addEventListener('pause', () => { if (!document.hidden) setTimeout(() => reproducir(v), 50); });
    v.addEventListener('ended', () => { v.currentTime = 0; reproducir(v); });
    v.addEventListener('stalled', () => reproducir(v));
    v.addEventListener('canplay', () => reproducir(v));
  });

  const reanudarTodos = () => videos.forEach(reproducir);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) reanudarTodos(); });
  window.addEventListener('focus', reanudarTodos);
  window.addEventListener('pageshow', reanudarTodos);
  window.addEventListener('load', reanudarTodos);
  // Reproduce cuando el elemento entra en pantalla (los navegadores móviles pausan los que están fuera)
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) reproducir(e.target); }), { threshold: 0.01 });
    videos.forEach(v => io.observe(v));
  }
  // Primer toque/click: desbloquea el autoplay si el navegador lo había bloqueado
  ['touchstart', 'click', 'scroll'].forEach(ev => window.addEventListener(ev, reanudarTodos, { once: true, passive: true }));
  // Red de seguridad por si algún evento no se dispara
  setInterval(() => { if (!document.hidden) reanudarTodos(); }, 3000);
})();

// =====================================================================
// 2. MODAL "IDEAS": al hacer click en el enlace IDEAS se muestra una imagen
// =====================================================================
(function () {
  const CONFIG_MODAL = {
    imagen: 'assets/ideas.jpg',        // <- ruta de la imagen a mostrar
    alt: 'Ideas de regalos',
    textoEnlace: 'IDEAS'               // texto del enlace de Canva que abre el modal
  };

  const css = document.createElement('style');
  css.textContent = `
    #modal-ideas { position: fixed; inset: 0; z-index: 99999; display: none; align-items: center; justify-content: center;
      padding: 16px; background: rgba(0,0,0,.75); opacity: 0; transition: opacity .25s ease; }
    #modal-ideas.abierto { display: flex; }
    #modal-ideas.visible { opacity: 1; }
    #modal-ideas .modal-caja { position: relative; max-width: min(92vw, 560px); max-height: 90vh; display: flex;
      transform: scale(.94); transition: transform .25s ease; }
    #modal-ideas.visible .modal-caja { transform: scale(1); }
    #modal-ideas img { display: block; max-width: 100%; max-height: 90vh; width: auto; height: auto; object-fit: contain;
      border-radius: 12px; background: #fff; box-shadow: 0 10px 40px rgba(0,0,0,.45); }
    #modal-ideas .modal-cerrar { position: absolute; top: -14px; right: -14px; width: 38px; height: 38px; border: 0; border-radius: 50%;
      background: #fff; color: #333; font: 700 22px/38px Arial, sans-serif; text-align: center; cursor: pointer; padding: 0;
      box-shadow: 0 2px 10px rgba(0,0,0,.4); }
    #modal-ideas .modal-cerrar:hover { background: #ef89ac; color: #fff; }
    body.modal-abierto { overflow: hidden !important; }
  `;
  document.head.appendChild(css);

  const modal = document.createElement('div');
  modal.id = 'modal-ideas';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-label', CONFIG_MODAL.alt);
  modal.innerHTML = `
    <div class="modal-caja">
      <button type="button" class="modal-cerrar" aria-label="Cerrar">&times;</button>
      <img alt="${CONFIG_MODAL.alt}">
    </div>`;
  document.body.appendChild(modal);
  const img = modal.querySelector('img');
  let temporizador;

  function abrir() {
    if (!img.getAttribute('src')) img.src = CONFIG_MODAL.imagen;
    clearTimeout(temporizador);
    modal.classList.add('abierto');
    document.body.classList.add('modal-abierto');
    requestAnimationFrame(() => requestAnimationFrame(() => modal.classList.add('visible')));
    modal.querySelector('.modal-cerrar').focus();
  }
  function cerrar() {
    modal.classList.remove('visible');
    document.body.classList.remove('modal-abierto');
    temporizador = setTimeout(() => modal.classList.remove('abierto'), 250);
  }

  // Delegación en fase de captura: funciona aunque Canva/animaciones reemplacen los nodos del texto
  document.addEventListener('click', e => {
    const a = e.target.closest && e.target.closest('a');
    if (!a || modal.contains(a)) return;
    const esIdeas = a.textContent.trim().toUpperCase() === CONFIG_MODAL.textoEnlace.toUpperCase();
    if (!esIdeas) return;
    e.preventDefault();
    e.stopPropagation();
    abrir();
  }, true);

  modal.addEventListener('click', e => {
    if (e.target === modal || e.target.classList.contains('modal-cerrar')) cerrar();
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && modal.classList.contains('abierto')) cerrar(); });
})();
