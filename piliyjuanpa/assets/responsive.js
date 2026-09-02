(function() {
    const rootLienzo = document.querySelector('#root');
    const anchoOriginal = 414; 
    const anchoMaximo = 650;
    const iframe = document.getElementById('auto-height-iframe');

    // 1. Liberamos el overflow de Canva
    let estiloFix = document.createElement('style');
    estiloFix.id = 'canva-height-fix';
    estiloFix.innerHTML = `
        div.ZRRuDw {
            overflow: visible !important;
            height: auto !important;
            max-height: none !important;
        }
    `;
    document.head.appendChild(estiloFix);

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

    // 2. Medida estática inicial
    rootLienzo.style.transform = 'none';
    rootLienzo.style.height = 'auto';
    const altoCanvaBase = (rootLienzo.offsetHeight || 1200); 

    function reajustarLienzo() {
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
    }

    window.addEventListener('resize', reajustarLienzo);

    // --- ESTRATEGIA DE CARGA ASÍNCRONA ---

    // A. Ejecución inmediata
    reajustarLienzo();

    // B. Al cargar fuentes del sistema/Google Fonts
    if (document.fonts) {
        document.fonts.ready.then(reajustarLienzo);
    }

    // C. Al terminar de cargar completamente el iframe
    if (iframe) {
        iframe.addEventListener('load', reajustarLienzo);
    }

    // D. Polling de ráfaga para asegurar estabilidad al cargar
    let intentos = 0;
    const intervaloCarga = setInterval(() => {
        intentos++;
        reajustarLienzo();
        if (intentos >= 13) {
            clearInterval(intervaloCarga);
        }
    }, 150);

})();