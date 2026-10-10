(function() {
    // ===================== CONFIGURACIÓN (lo único que cambia entre diseños) =====================
    const CONFIG = {
        selectorLienzo: '#root',            // contenedor raíz del diseño exportado de Canva
        anchoOriginal: 443,                 // ancho del diseño en Canva (px). Cambia en cada diseño
        anchoMaximo: 600,                   // ancho máximo en pantallas grandes
        colorFondo: '#FBF9F1',              // fondo de la página (null = no tocar)
        selectorPaginaCanva: 'div.ZRRuDw',  // contenedor de página de Canva: su clase CAMBIA en cada exportación (null = no tocar)
        selectoresDinamicos: ['.rsvp-fondo', '#rsvp', '#auto-height-iframe'],  // alto variable; si no existen, se ignoran
        holgura: 0                          // px extra bajo el último elemento dinámico
    };
    // ==============================================================================================

    const rootLienzo = document.querySelector(CONFIG.selectorLienzo);
    const anchoOriginal = CONFIG.anchoOriginal;
    const anchoMaximo = CONFIG.anchoMaximo;
    const iframe = document.getElementById('auto-height-iframe');
    const selectoresDinamicos = CONFIG.selectoresDinamicos;   // formulario RSVP, iframe con auto-altura, etc.
    const holgura = CONFIG.holgura;

    if (!rootLienzo) return;

    // 0. Ocultar el contenido inicialmente para evitar saltos visuales en crudo
    rootLienzo.style.opacity = '0';
    rootLienzo.style.transition = 'opacity 0.4s ease-in-out';

    // 1. Liberamos el overflow de Canva
    if (CONFIG.selectorPaginaCanva) {
        if (!document.querySelector(CONFIG.selectorPaginaCanva)) {
            console.warn('[responsive] No se encontró "' + CONFIG.selectorPaginaCanva + '". En este diseño la clase del contenedor de página es otra: ' +
                         'ajusta CONFIG.selectorPaginaCanva o el contenido podría verse recortado.');
        }
        let estiloFix = document.getElementById('canva-height-fix');
        if (!estiloFix) {
            estiloFix = document.createElement('style');
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

    rootLienzo.style.transform = 'none';
    rootLienzo.style.flex = 'none';   // dentro del wrapper flex el lienzo conserva su ancho original (no se encoge)

    // 2. Medición del alto real del lienzo
    // Se mide cada vez con height:auto, así el alto puede CRECER y también ENCOGER cuando el
    // formulario cambia (antes la altura solo subía y quedaba fija, por eso se cortaba).
    function alturaNatural() {
        const previa = rootLienzo.style.height;
        rootLienzo.style.height = 'auto';
        const natural = Math.max(rootLienzo.offsetHeight, rootLienzo.scrollHeight);
        rootLienzo.style.height = previa;   // se restablece en la misma tarea: no hay parpadeo
        return natural;
    }

    // Borde inferior (en unidades del lienzo, sin escala) del elemento dinámico más bajo
    function bordeInferiorDinamico(escala) {
        const top = rootLienzo.getBoundingClientRect().top;
        let max = 0;
        selectoresDinamicos.forEach(sel => {
            document.querySelectorAll(sel).forEach(el => {
                if (!rootLienzo.contains(el)) return;
                const r = el.getBoundingClientRect();
                if (!r.height) return;                       // oculto o aún sin renderizar
                max = Math.max(max, (r.bottom - top) / escala);
            });
        });
        return max;
    }

    // Con 'clip' el wrapper recorta solo en horizontal; si el navegador no lo soporta, se usa hidden
    const soportaClip = !!(window.CSS && CSS.supports && CSS.supports('overflow-x', 'clip'));

    function reajustarLienzo() {
        const anchoVentana = window.innerWidth;
        const anchoEfectivo = Math.min(anchoVentana, anchoMaximo);
        const escala = anchoEfectivo / anchoOriginal;

        rootLienzo.style.width = `${anchoOriginal}px`;
        rootLienzo.style.position = 'relative';
        rootLienzo.style.transformOrigin = 'top center';
        rootLienzo.style.transform = `scale(${escala})`;

        // El lienzo NO debe estirarse con el wrapper. Si se estirara, al medirlo con height:auto se leería
        // la altura del wrapper (alto × escala) y el alto se multiplicaría en cada ajuste (altura "a las nubes").
        wrapper.style.display = 'flex';
        wrapper.style.alignItems = 'flex-start';
        rootLienzo.style.alignSelf = 'flex-start';

        // Alto total = lo más bajo entre el contenido de Canva y el formulario/iframe
        const alto = Math.ceil(Math.max(alturaNatural(), bordeInferiorDinamico(escala) + holgura)) || 1200;
        rootLienzo.style.height = `${alto}px`;

        wrapper.style.width = '100%';
        wrapper.style.height = `${Math.ceil(alto * escala)}px`;
        wrapper.style.justifyContent = 'center';
        wrapper.style.position = 'relative';
        if (soportaClip) {
            wrapper.style.overflowX = 'clip';     // recorta los lados...
            wrapper.style.overflowY = 'visible';  // ...pero nunca corta el alto
        } else {
            wrapper.style.overflow = 'hidden';
        }

        // Revelamos el lienzo suavemente una vez calculado
        rootLienzo.style.opacity = '1';
    }

    window.addEventListener('resize', reajustarLienzo);

    // --- ESTRATEGIA DE ESTABILIZACIÓN ---

    // A. Observador del formulario / iframe: se dispara cada vez que cambia su alto
    //    (se observan ellos y no el lienzo, porque el alto del lienzo lo fijamos nosotros y nunca cambiaría solo)
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

    // B. Ejecución inmediata
    observarDinamicos();
    reajustarLienzo();

    // C. Al cargar fuentes (también las que se piden más tarde, como las del formulario)
    if (document.fonts) {
        document.fonts.ready.then(reajustarLienzo);
        if (document.fonts.addEventListener) {
            document.fonts.addEventListener('loadingdone', reajustarLienzo);
        }
    }

    // D. Al cargar la página completa e iframe si existe
    window.addEventListener('load', () => { observarDinamicos(); reajustarLienzo(); });
    if (iframe) {
        iframe.addEventListener('load', reajustarLienzo);
    }

    // E. Ráfaga inicial por seguridad temporal (también engancha elementos que aparecen tarde)
    let intentos = 0;
    const intervaloCarga = setInterval(() => {
        intentos++;
        observarDinamicos();
        reajustarLienzo();
        if (intentos >= 15) {
            clearInterval(intervaloCarga);
        }
    }, 100);

    // F. Respaldo para navegadores sin ResizeObserver
    if (!observer) {
        setInterval(reajustarLienzo, 500);
    }

})();
