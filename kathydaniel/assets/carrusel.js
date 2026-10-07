/*!
 * carrusel.js — carrusel de fotos con física de resorte, arrastre, flechas, teclado y autoplay.
 *
 * USO (en el HTML, sin <section> ni estilos):
 *   <div data-carrusel data-bg="rgb(154,175,181)" aria-label="Fotos del hotel">
 *     <img src="assets/hotel01.jpg" alt="">
 *     <img src="assets/hotel02.jpg" alt="">
 *   </div>
 *   <script src="assets/carrusel.js"></script>
 *
 * El script inyecta sus propios estilos (una sola vez) y convierte cada [data-carrusel] en un carrusel.
 *
 * CONFIGURACIÓN (atributos data-* en cada contenedor, todos opcionales):
 *   data-bg="rgb(154,175,181)"   color de fondo sólido (cualquier color CSS)
 *   data-trama="assets/trama.png" imagen repetida como fondo (trama)
 *   data-trama-opacity="0.47"    transparencia de la trama: 0 (invisible) a 1 (opaca). Por defecto 0.47
 *   data-alto="550"              alto de las fotos en px (o cualquier valor CSS, ej. "60vh"). Por defecto 550
 *   data-padding="50"            relleno vertical (arriba y abajo) alrededor de las fotos, en px o valor CSS. Por defecto 50
 *   data-autoplay="2500"        ms entre fotos; 0 = sin autoplay. Por defecto 2500
 *   data-idle="3500"             ms de inactividad tras interactuar antes de reanudar el autoplay. Por defecto 3500
 *
 * MODO FLOTANTE (el div no ocupa espacio y no empuja lo que hay debajo):
 *   data-flotante                activa el modo (el div pasa a ser un punto ancla de altura 0)
 *   data-top="40"                desplazamiento vertical desde el ancla (px o valor CSS; admite negativos). Por defecto 0
 *   data-left="0"                desplazamiento horizontal desde el ancla; "center" lo centra. Por defecto 0
 *   data-ancho="900"             ancho del carrusel (px o valor CSS). Por defecto 100% del ancla, máx. 1000px
 *   data-z="10"                  z-index. Por defecto 10
 *
 * Para carruseles añadidos después de cargar la página: window.Carruseles.init()
 */
(() => {
  "use strict";

  /* Si el script se carga dos veces, solo se vuelven a buscar carruseles nuevos */
  if (window.Carruseles) { window.Carruseles.init(); return; }

  /* ====== Estilos (se inyectan una sola vez) ====== */
  const CSS = `
    .galeria, .galeria * { box-sizing: border-box; }
    .galeria { --btn-bg: rgba(255,255,255,.55); --btn-fg: #111; position: relative; max-width: 1000px; margin: 0 auto;
               overflow: hidden; padding: var(--gal-padding, 50px) 0; background: var(--gal-bg, transparent); }
    .galeria.gal-trama::before { content: ""; position: absolute; inset: 0; z-index: 0; pointer-events: none;
               background: var(--gal-trama-img) repeat; opacity: var(--gal-trama-opacity, .47); }
    .galeria > * { position: relative; z-index: 1; }

    /* Modo flotante: el contenedor [data-carrusel] es solo un punto ancla sin altura y el carrusel se superpone */
    [data-carrusel][data-flotante] { position: relative; height: 0; overflow: visible; }
    .galeria.gal-flotante { position: absolute; top: var(--gal-top, 0); left: var(--gal-left, 0); margin: 0;
               width: var(--gal-ancho, 100%); max-width: var(--gal-ancho, 1000px); z-index: var(--gal-z, 10); }
    .galeria.gal-centrado { left: 50%; transform: translateX(-50%); }
    .gal-viewport { overflow: hidden; touch-action: pan-y; cursor: grab; user-select: none; -webkit-user-select: none;
                    border-radius: 14px; outline-offset: 4px; background: transparent; }
    .gal-viewport.dragging { cursor: grabbing; }
    .gal-viewport:focus-visible { outline: 3px solid #33424d; }

    .gal-track { position: relative; display: flex; gap: 1rem; width: 100%; will-change: transform; background: transparent; }
    .gal-track > figure { flex: 0 0 min(72%, 320px); margin: 0; border-radius: 14px; overflow: hidden; background: transparent; }
    .gal-track img { display: block; width: 100%; height: var(--gal-alto, 550px); object-fit: cover;
                     pointer-events: none; -webkit-user-drag: none; }

    /* Flechas sutiles en los extremos */
    .gal-nav { position: absolute; top: 50%; transform: translateY(-50%); z-index: 2; width: 40px; height: 40px;
               display: grid; place-items: center; padding: 0; border: 0; border-radius: 50%;
               background: var(--btn-bg); color: var(--btn-fg); -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px);
               cursor: pointer; opacity: 0; transition: opacity .25s ease, background .2s ease; }
    .gal-nav.prev { left: 10px; }
    .gal-nav.next { right: 10px; }
    .gal-nav svg { width: 18px; height: 18px; }
    .galeria:hover .gal-nav:not(:disabled), .galeria:focus-within .gal-nav:not(:disabled) { opacity: .75; }
    .gal-nav:not(:disabled):hover { opacity: 1; }
    .gal-nav:focus-visible { opacity: 1; outline: 2px solid var(--btn-fg); outline-offset: 2px; }
    .gal-nav:disabled { opacity: 0 !important; pointer-events: none; }
    @media (hover: none) { .gal-nav:not(:disabled) { opacity: .5; } }   /* en táctil: visibles pero muy tenues */
  `;

  function injectStyles() {
    if (document.getElementById("gal-styles")) return;
    const st = document.createElement("style");
    st.id = "gal-styles";
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  /* ====== Ajustes de la física (iguales para todos los carruseles) ====== */
  const STIFFNESS    = 170;   // rigidez del resorte (más alto = más rápido)
  const DAMPING      = 22;    // amortiguación (más bajo = más rebote)
  const INERTIA      = 0.22;  // cuánto "lanza" el gesto (segundos de proyección)
  const RUBBER_RANGE = 160;   // máximo estiramiento elástico en los bordes (px)

  const ARROW = {
    prev: '<path d="M15 5l-7 7 7 7"/>',
    next: '<path d="M9 5l7 7-7 7"/>'
  };

  const num = (v, d) => { const n = parseFloat(v); return isNaN(n) ? d : n; };

  /* ====== Construye la estructura a partir de las <img> y los data-* ====== */
  function build(root) {
    const imgs = Array.from(root.querySelectorAll("img"));
    const label = root.getAttribute("aria-label") || "Galería de fotos";

    // El carrusel real (.galeria) vive dentro del contenedor [data-carrusel], que actúa como punto ancla
    const gal = document.createElement("div");
    gal.className = "galeria";
    const px = (v) => /^-?\d+(\.\d+)?$/.test(v) ? v + "px" : v;   // "40" -> "40px"; "10%" / "2rem" se respetan

    // Configuración visual
    const d = root.dataset;
    if (d.bg) gal.style.setProperty("--gal-bg", d.bg);
    if (d.trama) {
      gal.classList.add("gal-trama");
      gal.style.setProperty("--gal-trama-img", 'url("' + d.trama.replace(/"/g, "%22") + '")');
      if (d.tramaOpacity !== undefined) gal.style.setProperty("--gal-trama-opacity", d.tramaOpacity);
    }
    if (d.alto) gal.style.setProperty("--gal-alto", px(d.alto));
    if (d.padding !== undefined && d.padding !== "") gal.style.setProperty("--gal-padding", px(d.padding));

    // Modo flotante: el contenedor no ocupa espacio y el carrusel se posiciona desde el ancla
    if (d.flotante !== undefined) {
      gal.classList.add("gal-flotante");
      if (d.left === "center" || d.left === "centro") gal.classList.add("gal-centrado");
      else if (d.left) gal.style.setProperty("--gal-left", px(d.left));
      if (d.top) gal.style.setProperty("--gal-top", px(d.top));
      if (d.ancho) gal.style.setProperty("--gal-ancho", px(d.ancho));
      if (d.z) gal.style.setProperty("--gal-z", d.z);
    }

    // Estructura
    const viewport = document.createElement("div");
    viewport.className = "gal-viewport";
    viewport.tabIndex = 0;
    viewport.setAttribute("role", "region");
    viewport.setAttribute("aria-roledescription", "carrusel");
    viewport.setAttribute("aria-label", label);

    const track = document.createElement("div");
    track.className = "gal-track";
    imgs.forEach(img => {
      img.draggable = false;
      const fig = document.createElement("figure");
      fig.appendChild(img);
      track.appendChild(fig);
    });
    viewport.appendChild(track);

    const mkBtn = (dir, text) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "gal-nav " + dir;
      b.setAttribute("aria-label", text);
      b.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ARROW[dir] + "</svg>";
      return b;
    };

    gal.append(viewport, mkBtn("prev", "Foto anterior"), mkBtn("next", "Foto siguiente"));
    root.textContent = "";
    root.appendChild(gal);
  }

  /* ====== Comportamiento de un carrusel (estado propio por instancia) ====== */
  function setup(root) {
    if (root.dataset.galReady) return;          // ya inicializado
    root.dataset.galReady = "1";

    const AUTOPLAY_MS = num(root.dataset.autoplay, 2500);   // 0 = sin autoplay
    const IDLE_MS     = num(root.dataset.idle, 3500);
    build(root);

    const viewport = root.querySelector(".gal-viewport");
    const track    = root.querySelector(".gal-track");
    const prevBtn  = root.querySelector(".gal-nav.prev");
    const nextBtn  = root.querySelector(".gal-nav.next");
    const slides   = Array.from(track.children);
    const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

    /* ====== Estado ====== */
    let x = 0, v = 0, target = 0;           // posición, velocidad (px/s), destino
    let minX = 0;                            // límite izquierdo (negativo); el derecho es 0
    let snaps = [0];                         // posiciones donde se encaja cada foto
    let dragging = false, wheeling = false;
    let raf = 0, lastT = 0;

    /* ====== Medidas ====== */
    function measure() {
      const vw = viewport.clientWidth;
      minX = Math.min(0, -(track.scrollWidth - vw));
      const pts = slides.map(s => {
        const p = -(s.offsetLeft + s.offsetWidth / 2 - vw / 2);   // centrada
        return Math.max(minX, Math.min(0, p));
      });
      snaps = pts.filter((p, i) => i === 0 || Math.abs(p - pts[i - 1]) > 1);
    }
    const nearestIdx = (pos) => {
      let best = 0, bd = Infinity;
      snaps.forEach((s, i) => { const dd = Math.abs(s - pos); if (dd < bd) { bd = dd; best = i; } });
      return best;
    };

    /* ====== Render ====== */
    let prevOff = null, nextOff = null;
    function render() {
      track.style.transform = `translate3d(${x}px,0,0)`;
      const atStart = x > snaps[0] - 2;
      const atEnd   = x < snaps[snaps.length - 1] + 2;
      if (atStart !== prevOff) { setDisabled(prevBtn, atStart); prevOff = atStart; }
      if (atEnd   !== nextOff) { setDisabled(nextBtn, atEnd);   nextOff = atEnd; }
    }
    function setDisabled(btn, off) {
      if (off && document.activeElement === btn) viewport.focus();
      btn.disabled = off;
    }

    /* ====== Bucle de física (resorte amortiguado) ====== */
    function tick(t) {
      const dt = Math.min((t - lastT) / 1000, 1 / 30);
      lastT = t;
      if (!dragging && !wheeling) {
        const a = -STIFFNESS * (x - target) - DAMPING * v;
        v += a * dt;
        x += v * dt;
        if (Math.abs(v) < 0.3 && Math.abs(x - target) < 0.3) { x = target; v = 0; render(); raf = 0; return; }
      }
      render();
      raf = requestAnimationFrame(tick);
    }
    function kick() { if (!raf) { lastT = performance.now(); raf = requestAnimationFrame(tick); } }
    function stop() { cancelAnimationFrame(raf); raf = 0; }

    /* ====== Navegación ====== */
    function goTo(i) { target = snaps[Math.max(0, Math.min(snaps.length - 1, i))]; kick(); }
    const next = (wrap) => { const i = nearestIdx(target); if (i < snaps.length - 1) goTo(i + 1); else if (wrap) goTo(0); };
    const prev = () => goTo(nearestIdx(target) - 1);

    // Tras usar las flechas: se quita el foco del botón y el autoplay se reanuda tras IDLE_MS de inactividad
    prevBtn.addEventListener("click", () => { prev(); prevBtn.blur(); schedule(IDLE_MS); });
    nextBtn.addEventListener("click", () => { next(false); nextBtn.blur(); schedule(IDLE_MS); });
    viewport.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight") { e.preventDefault(); next(false); schedule(IDLE_MS); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); prev(); schedule(IDLE_MS); }
      else if (e.key === "Home") { e.preventDefault(); goTo(0); schedule(IDLE_MS); }
      else if (e.key === "End") { e.preventDefault(); goTo(snaps.length - 1); schedule(IDLE_MS); }
    });

    /* ====== Elasticidad ====== */
    const rubber = (dd) => RUBBER_RANGE * (1 - 1 / (dd * 0.5 / RUBBER_RANGE + 1));
    function resist(raw) {
      if (raw > 0) return rubber(raw);
      if (raw < minX) return minX - rubber(minX - raw);
      return raw;
    }

    /* ====== Arrastre (mouse, táctil y lápiz) ====== */
    let pid = null, downX = 0, startClientX = 0, startPos = 0, startIdx = 0, moved = false, samples = [];

    viewport.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      pid = e.pointerId; downX = e.clientX; moved = false; startIdx = nearestIdx(target); samples = [];
    });
    viewport.addEventListener("pointermove", (e) => {
      if (e.pointerId !== pid) return;
      if (!moved) {
        if (Math.abs(e.clientX - downX) < 5) return;
        moved = true; dragging = true;
        stop();                                  // "agarra" el carrusel aunque estuviera en movimiento
        viewport.setPointerCapture(pid);
        viewport.classList.add("dragging");
        startClientX = e.clientX; startPos = x;
        schedule(IDLE_MS);
      }
      x = resist(startPos + (e.clientX - startClientX));
      const now = performance.now();
      samples.push({ t: now, x });
      while (samples.length > 2 && now - samples[0].t > 100) samples.shift();
      render();
    });
    function release(e) {
      if (e.pointerId !== pid) return;
      pid = null;
      if (!moved) return;
      dragging = false;
      viewport.classList.remove("dragging");
      v = 0;
      if (samples.length >= 2) {
        const a = samples[0], b = samples[samples.length - 1], dt = (b.t - a.t) / 1000;
        if (dt > 0 && performance.now() - b.t < 80) v = (b.x - a.x) / dt;
      }
      let idx = nearestIdx(x + v * INERTIA);     // foto más cercana a donde "llegaría" con la inercia
      if (idx === startIdx && Math.abs(v) > 350) idx += v < 0 ? 1 : -1;   // un flick corto cambia de foto
      target = snaps[Math.max(0, Math.min(snaps.length - 1, idx))];
      kick(); schedule(IDLE_MS);
    }
    viewport.addEventListener("pointerup", release);
    viewport.addEventListener("pointercancel", release);
    viewport.addEventListener("click", (e) => { if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; } }, true);
    viewport.addEventListener("dragstart", (e) => e.preventDefault());

    /* ====== Rueda / trackpad horizontal ====== */
    let wheelTimer = 0;
    viewport.addEventListener("wheel", (e) => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;   // el scroll vertical sigue siendo de la página
      e.preventDefault();
      stop(); wheeling = true; v = 0;
      x = Math.max(minX, Math.min(0, x - e.deltaX));
      render();
      clearTimeout(wheelTimer);
      wheelTimer = setTimeout(() => { wheeling = false; target = snaps[nearestIdx(x)]; kick(); }, 140);
      schedule(IDLE_MS);
    }, { passive: false });

    /* ====== Autoplay (se pausa al arrastrar o con la pestaña oculta; tras cualquier interacción
       se reanuda después de IDLE_MS de inactividad) ====== */
    let timer = 0;
    const canPlay = () => AUTOPLAY_MS > 0 && !reduceMotion && !dragging && !document.hidden;
    function schedule(delay = AUTOPLAY_MS) {
      clearTimeout(timer);
      if (!canPlay()) return;
      timer = setTimeout(() => { next(true); schedule(); }, delay);
    }
    document.addEventListener("visibilitychange", () => schedule());

    /* ====== Inicio y redimensionado ====== */
    function layout() {
      const idx = nearestIdx(target);
      measure();
      x = target = snaps[Math.min(idx, snaps.length - 1)];
      v = 0; render();
    }
    new ResizeObserver(layout).observe(viewport);
    measure(); render(); schedule();
  }

  /* ====== Arranque ====== */
  function init() {
    injectStyles();
    document.querySelectorAll("[data-carrusel]").forEach(setup);
  }
  window.Carruseles = { init };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
