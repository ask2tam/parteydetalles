/* responsive.js — versión Shadow DOM (3 diseños independientes).
   Uso:  const r = Responsive.montar(shadowRoot, { anchoOriginal: 435, modo: 'ancho' });  →  r.reajustar()
   modo 'ancho'    : escala por ancho (tope anchoMaximo) y la altura de la página = suma de las secciones de Canva (invitación, tips).
   modo 'contener' : el diseño entra COMPLETO en la pantalla (portada), centrado y con colorFondo en los bordes.
   modo 'cubrir'   : llena SIEMPRE la pantalla (vertical y horizontal), sin achicar el contenido: escala por ancho (tope anchoMaximo)
                     y, si sobra altura, se recorta arriba y abajo (anclaY: 0.5 = parejo; 0 = solo recorta abajo; 1 = solo recorta arriba).
                     Si la pantalla es más alta que el diseño, escala por altura y recorta a los lados. */
(function () {
window.Responsive = {
  montar: function (raiz, opciones) {
    const CONFIG = Object.assign({
      selectorLienzo: '#root',            // contenedor raíz del diseño exportado de Canva
      anchoOriginal: 435,                 // ancho del diseño en Canva (px)
      anchoMaximo: 700,                   // ancho máximo en pantallas grandes
      colorFondo: null,                   // fondo detrás del diseño (null = transparente)
      selectorPaginaCanva: 'div.ZRRuDw',  // contenedor de página de Canva (su clase cambia en cada exportación)
      selectorSecciones: 'section',       // cada "página" de Canva; el alto total es la suma de sus alturas fijas
      modo: 'ancho',                      // 'ancho' | 'contener' | 'cubrir'
      anclaY: 0.5,                        // solo 'cubrir': qué parte vertical se conserva (0 arriba, 0.5 centro, 1 abajo)
      holgura: 0                          // px extra al final
    }, opciones || {});

    const rootLienzo = raiz.querySelector(CONFIG.selectorLienzo);
    if (!rootLienzo) { console.warn('[responsive] No existe', CONFIG.selectorLienzo); return null; }
    const anchoOriginal = CONFIG.anchoOriginal;

    rootLienzo.style.opacity = '0';
    rootLienzo.style.transition = 'opacity 0.4s ease-in-out';

    // Libera el overflow/alto de Canva (dentro del shadow root)
    if (CONFIG.selectorPaginaCanva) {
      if (!raiz.querySelector(CONFIG.selectorPaginaCanva)) console.warn('[responsive] No se encontró "' + CONFIG.selectorPaginaCanva + '".');
      const fix = document.createElement('style');
      fix.textContent = CONFIG.selectorPaginaCanva + ' { overflow: visible !important; height: auto !important; max-height: none !important; }';
      raiz.appendChild(fix);
    }

    let wrapper = raiz.querySelector('#canva-responsive-wrapper');
    if (!wrapper) {
      wrapper = document.createElement('div');
      wrapper.id = 'canva-responsive-wrapper';
      rootLienzo.parentNode.insertBefore(wrapper, rootLienzo);
      wrapper.appendChild(rootLienzo);
    }
    if (CONFIG.colorFondo) wrapper.style.backgroundColor = CONFIG.colorFondo;
    rootLienzo.style.flex = 'none';

    // Alto del diseño = suma de las alturas fijas que Canva escribe en cada sección (layout, no afectado por scale)
    let altoCache = 0;
    function altoDiseno() {
      if (altoCache) return altoCache;
      let h = 0, n = 0;
      rootLienzo.querySelectorAll(CONFIG.selectorSecciones).forEach(sec => {
        const e = sec.querySelector('[style*="height"]');
        const v = e && parseFloat(e.style.height);
        if (v > 0) { h += v; n++; }
      });
      if (n > 1) h -= (n - 1);          // Canva solapa 1px entre secciones (margin-top:-1px)
      if (h > 0) altoCache = h;
      return h;
    }

    const soportaClip = !!(window.CSS && CSS.supports && CSS.supports('overflow', 'clip'));

    function reajustar() {
      const vw = (raiz.host && raiz.host.clientWidth) || document.documentElement.clientWidth || window.innerWidth, vh = window.innerHeight;   // ancho real disponible del host (descuenta barra de scroll)
      const alto = Math.ceil(altoDiseno() + CONFIG.holgura) || 1200;
      let escala = Math.min(vw, CONFIG.anchoMaximo) / anchoOriginal;
      if (CONFIG.modo === 'contener') escala = Math.min(escala, vh / alto);
      else if (CONFIG.modo === 'cubrir') escala = Math.max(escala, vh / alto);

      rootLienzo.style.width = anchoOriginal + 'px';
      rootLienzo.style.height = alto + 'px';
      rootLienzo.style.position = 'relative';
      rootLienzo.style.transformOrigin = 'top center';
      rootLienzo.style.transform = 'scale(' + escala + ')';
      rootLienzo.style.alignSelf = 'flex-start';

      Object.assign(wrapper.style, { display: 'flex', alignItems: 'flex-start', justifyContent: 'center', position: 'relative', width: '100%' });
      if (CONFIG.modo === 'contener') {
        wrapper.style.height = vh + 'px';
        rootLienzo.style.marginTop = Math.max(0, (vh - alto * escala) / 2) + 'px';
      } else if (CONFIG.modo === 'cubrir') {
        wrapper.style.height = vh + 'px';
        rootLienzo.style.marginTop = ((vh - alto * escala) * CONFIG.anclaY) + 'px';   // negativo = recorte arriba/abajo
      } else {
        wrapper.style.height = Math.ceil(alto * escala) + 'px';
        rootLienzo.style.marginTop = '0';
      }
      wrapper.style.overflow = soportaClip ? 'clip' : 'hidden';
      rootLienzo.style.opacity = '1';
    }

    window.addEventListener('resize', reajustar);
    window.addEventListener('orientationchange', () => setTimeout(reajustar, 150));
    if (document.fonts) document.fonts.ready.then(reajustar);
    reajustar();
    return { reajustar: reajustar };
  }
};
})();
