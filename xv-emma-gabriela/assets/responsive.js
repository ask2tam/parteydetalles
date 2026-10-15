(function() {
    // ===================== CONFIGURACIÓN (lo único que cambia entre diseños) =====================
    const CONFIG = {
        selectorLienzo: '#root',            // contenedor raíz del diseño exportado de Canva
        anchoOriginal: 425,                 // ancho del diseño en Canva (px). Cambia en cada diseño
        anchoMaximo: 600,                   // ancho máximo en pantallas grandes
        colorFondo: '#FBF9F1',              // fondo de la página (null = no tocar)
        selectorPaginaCanva: 'div.ZRRuDw',  // contenedor de página de Canva: su clase CAMBIA en cada exportación (null = no tocar)
        selectorAltoDiseno: '.onhyOQ',      // elemento de Canva con el alto fijo del diseño (su clase también cambia). Si no existe, se autodetecta
        selectoresDinamicos: ['.rsvp-fondo', '#rsvp', '#auto-height-iframe'],  // alto variable; si no existen, se ignoran
        holgura: 0                          // px extra bajo el último elemento dinámico
    };
    // ==============================================================================================

    const rootLienzo = document.querySelector(CONFIG.selectorLienzo);
    const anchoOriginal = CONFIG.anchoOriginal;
    const anchoMaximo = CONFIG.anchoMaximo;
    const iframe = document.getElementById('auto-height-iframe');
    const selectoresDinamicos = CONFIG.selectoresDinamicos;
    const holgura = CONFIG.holgura;

    if (!rootLienzo) return;

    // 0. Ocultar el contenido hasta tener el cálculo correcto
    rootLienzo.style.opacity = '0';
    rootLienzo.style.transition = 'opacity 0.4s ease-in-out';

    // 1. Liberamos el overflow de Canva
    if (CONFIG.selectorPaginaCanva) {
        if (!document.querySelector(CONFIG.selectorPaginaCanva)) {
            console.warn('[responsive] No se encontró "' + CONFIG.selectorPaginaCanva + '". Ajusta CONFIG.selectorPaginaCanva o el contenido podría verse recortado.');
        }
        if (!document.getElementById('canva-height-fix')) {
            const estiloFix = document.createElement('style');
            estiloFix.id = 'canva-height-fix';
            estiloFix.innerHTML = `
                ${CONFIG.selectorPaginaCanva} {
                    overflow: visible !important;
                    height: auto !important;
                    max-height: none !important;
                }
            `;
            document.head.appendChild(estiloFix);
        }
    }

    let wrapper = document.querySelector('#canva-responsive-wrapper');
    if (!wrapper) {
        wrapper = document.createElement('div');
        wrapper.id = 'canva-responsive-wrapper';
        rootLienzo.parentNode.insertBefore(wrapper, rootLienzo);
        wrapper.appendChild(rootLienzo);
    }

    if (CONFIG.colorFondo) {
        document.documentElement.style.backgroundColor = CONFIG.colorFondo;
        document.body.style.backgroundColor = CONFIG.colorFondo;
    }
    document.documentElement.style.overflowX = 'hidden';
    document.body.style.overflowX = 'hidden';
    document.body.style.margin = '0';
    document.body.style.padding = '0';

    rootLienzo.style.flex = 'none';

    // 2. Alto del diseño
    // Antes se medía #root con height:auto, pero los contenedores de Canva tienen height:100% y overflow:hidden,
    // así que la medición salía mal (muy corta, o se multiplicaba en cada ajuste).
    // Ahora se lee el alto FIJO que Canva escribe en el diseño (layout, no afectado por transform/scale).
    let altoDisenoCache = 0;
    function altoDiseno() {
        if (altoDisenoCache) return altoDisenoCache;
        let h = 0;
        const base = CONFIG.selectorAltoDiseno && rootLienzo.querySelector(CONFIG.selectorAltoDiseno);
        if (base) {
            h = parseFloat(base.style.height) || base.offsetHeight;
        } else {
            // Autodetección: el bloque más alto cuyo ancho inline es el ancho original del diseño
            rootLienzo.querySelectorAll('div[style*="height"]').forEach(el => {
                const w = parseFloat(el.style.width), alto = parseFloat(el.style.height);
                if (Math.abs(w - anchoOriginal) < 1 && alto > h) h = alto;
            });
        }
        if (h > 0) altoDisenoCache = h;
        return h;
    }

    // Borde inferior (en unidades del lienzo, sin escala) del elemento dinámico más bajo
    function bordeInferiorDinamico(escala) {
        const top = rootLienzo.getBoundingClientRect().top;
        let max = 0;
        selectoresDinamicos.forEach(sel => {
            document.querySelectorAll(sel).forEach(el => {
                if (!rootLienzo.contains(el)) return;
                const r = el.getBoundingClientRect();
                if (!r.height) return;
                max = Math.max(max, (r.bottom - top) / escala);
            });
        });
        return max;
    }

    const soportaClip = !!(window.CSS && CSS.supports && CSS.supports('overflow', 'clip'));

    function reajustarLienzo() {
        const anchoEfectivo = Math.min(window.innerWidth, anchoMaximo);
        const escala = anchoEfectivo / anchoOriginal;

        rootLienzo.style.width = `${anchoOriginal}px`;
        rootLienzo.style.position = 'relative';
        rootLienzo.style.transformOrigin = 'top center';
        rootLienzo.style.transform = `scale(${escala})`;

        wrapper.style.display = 'flex';
        wrapper.style.alignItems = 'flex-start';
        wrapper.style.justifyContent = 'center';
        wrapper.style.position = 'relative';
        wrapper.style.width = '100%';
        rootLienzo.style.alignSelf = 'flex-start';

        const alto = Math.ceil(Math.max(altoDiseno(), bordeInferiorDinamico(escala) + holgura)) || 1200;
        rootLienzo.style.height = `${alto}px`;

        // El layout de #root sigue midiendo "alto" aunque se vea a escala. El wrapper mide lo visible
        // y recorta el sobrante, para que el scroll de la página coincida con el contenido real.
        wrapper.style.height = `${Math.ceil(alto * escala)}px`;
        wrapper.style.overflow = soportaClip ? 'clip' : 'hidden';

        rootLienzo.style.opacity = '1';
    }

    window.addEventListener('resize', reajustarLienzo);
    window.addEventListener('orientationchange', () => setTimeout(reajustarLienzo, 150));

    // --- ESTABILIZACIÓN ---
    const vigilados = new WeakSet();
    const observer = window.ResizeObserver ? new ResizeObserver(() => reajustarLienzo()) : null;

    function observarDinamicos() {
        if (!observer) return;
        selectoresDinamicos.forEach(sel => {
            document.querySelectorAll(sel).forEach(el => {
                if (vigilados.has(el) || !rootLienzo.contains(el)) return;
                vigilados.add(el);
                observer.observe(el);
            });
        });
    }

    observarDinamicos();
    reajustarLienzo();

    if (document.fonts) {
        document.fonts.ready.then(reajustarLienzo);
    }
    window.addEventListener('load', () => { observarDinamicos(); reajustarLienzo(); });
    if (iframe) iframe.addEventListener('load', reajustarLienzo);

    let intentos = 0;
    const intervaloCarga = setInterval(() => {
        intentos++;
        observarDinamicos();
        reajustarLienzo();
        if (intentos >= 15) clearInterval(intervaloCarga);
    }, 100);

    if (!observer) setInterval(reajustarLienzo, 500);
})();
