(function() {
    const rootLienzo = document.querySelector('#root');
    const anchoOriginal = 416; 
    const anchoMaximo = 650;
    const iframe = document.getElementById('auto-height-iframe');

    if (!rootLienzo) return;

    // 0. Ocultar el contenido inicialmente para evitar saltos visuales en crudo
    rootLienzo.style.opacity = '0';
    rootLienzo.style.transition = 'opacity 0.4s ease-in-out';

    // 1. Liberamos el overflow de Canva
    let estiloFix = document.getElementById('canva-height-fix');
    if (!estiloFix) {
        estiloFix = document.createElement('style');
        estiloFix.id = 'canva-height-fix';
        estiloFix.innerHTML = `
            div.ZRRuDw {
                overflow: visible !important;
                height: auto !important;
                max-height: none !important;
            }
        `;
        document.head.appendChild(estiloFix);
    }

    let wrapper = document.querySelector('#canva-responsive-wrapper');
    if (!wrapper) {
        wrapper = document.createElement('div');
        wrapper.id = 'canva-responsive-wrapper';
        rootLienzo.parentNode.insertBefore(wrapper, rootLienzo);
        wrapper.appendChild(rootLienzo);
    }

    document.documentElement.style.backgroundColor = '#FBF9F1'; 
    document.body.style.backgroundColor = '#FBF9F1';
    document.documentElement.style.overflowX = 'hidden'; 
    document.body.style.overflowX = 'hidden';
    document.body.style.margin = '0';
    document.body.style.padding = '0';

    // 2. Altura base robusta (si el offsetHeight es muy bajo al inicio, usamos un estimador de proporción seguro)
    rootLienzo.style.transform = 'none';
    rootLienzo.style.height = 'auto';
    
    let altoCanvaBase = rootLienzo.offsetHeight || 1200;

    function reajustarLienzo() {
        // Actualizamos la altura base si el contenido interno creció por carga de imágenes
        const currentHeight = rootLienzo.scrollHeight || rootLienzo.offsetHeight;
        if (currentHeight > altoCanvaBase) {
            altoCanvaBase = currentHeight;
        }

        const anchoVentana = window.innerWidth;
        const anchoEfectivo = Math.min(anchoVentana, anchoMaximo);
        const escala = anchoEfectivo / anchoOriginal;

        rootLienzo.style.width = `${anchoOriginal}px`;
        rootLienzo.style.height = `${altoCanvaBase}px`;
        rootLienzo.style.position = 'relative';
        rootLienzo.style.transformOrigin = 'top center';
        rootLienzo.style.transform = `scale(${escala})`;

        wrapper.style.width = '100%';
        wrapper.style.height = `${Math.ceil(altoCanvaBase * escala)}px`;
        wrapper.style.display = 'flex';
        wrapper.style.justifyContent = 'center';
        wrapper.style.overflow = 'hidden';
        wrapper.style.position = 'relative';

        // Revelamos el lienzo suavemente una vez calculado
        rootLienzo.style.opacity = '1';
    }

    window.addEventListener('resize', reajustarLienzo);

    // --- ESTRATEGIA DE ESTABILIZACIÓN AVANZADA ---

    // A. Ejecución inmediata
    reajustarLienzo();

    // B. Observador de cambios internos (Detecta cuando las imágenes de Canva terminan de alterar el DOM)
    if (window.ResizeObserver) {
        const observer = new ResizeObserver(() => {
            reajustarLienzo();
        });
        observer.observe(rootLienzo);
    }

    // C. Al cargar fuentes
    if (document.fonts) {
        document.fonts.ready.then(reajustarLienzo);
    }

    // D. Al cargar iframe si existe
    if (iframe) {
        iframe.addEventListener('load', reajustarLienzo);
    }

    // E. Control de ráfaga inicial por seguridad temporal
    let intentos = 0;
    const intervaloCarga = setInterval(() => {
        intentos++;
        reajustarLienzo();
        if (intentos >= 15) {
            clearInterval(intervaloCarga);
        }
    }, 100);

})();