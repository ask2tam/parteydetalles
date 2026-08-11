(function() {
    const rootLienzo = document.querySelector('#root');
    const anchoOriginal = 385; 
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

    // 2. Medida estática inicial con colchón de seguridad
    rootLienzo.style.transform = 'none';
    rootLienzo.style.height = 'auto';
    const altoCanvaBase = (rootLienzo.offsetHeight || 1200) + 500; 
    
    let altoFormularioIframe = 450;

    function reajustarLienzo() {
        const anchoVentana = window.innerWidth;
        const anchoEfectivo = Math.min(anchoVentana, anchoMaximo);
        const escala = anchoEfectivo / anchoOriginal;

        // CÁLCULO MATEMÁTICO AL 80%:
        const altoFormularioVisual = Math.ceil(altoFormularioIframe * 0.8);
        const altoBaseEstimadoVisual = Math.ceil(400 * 0.8); // 320px

        const altoBaseTotalUnscaled = altoCanvaBase + (altoFormularioVisual - altoBaseEstimadoVisual);

        rootLienzo.style.width = `${anchoOriginal}px`;
        rootLienzo.style.height = `${altoBaseTotalUnscaled}px`;
        rootLienzo.style.position = 'relative';
        rootLienzo.style.transformOrigin = 'top center';
        rootLienzo.style.transform = `scale(${escala})`;

        wrapper.style.width = '100%';
        wrapper.style.height = `${Math.ceil(altoBaseTotalUnscaled * escala)}px`;
        wrapper.style.display = 'flex';
        wrapper.style.justifyContent = 'center';
        wrapper.style.overflow = 'hidden';
        wrapper.style.position = 'relative';
    }

    // Escuchamos el evento de cambio de tamaño desde el RSVP
    window.addEventListener('message', function(event) {
        if (event.data && event.data.type === 'RESIZE_FORM') {
            const newHeight = event.data.height;
            if (newHeight && iframe) {
                // Buffer de 40px extras para sombras y padding de inputs
                altoFormularioIframe = newHeight + 20; 
                iframe.style.height = altoFormularioIframe + 'px';
                
                reajustarLienzo();
            }
        }
    });

    window.addEventListener('resize', reajustarLienzo);

    // --- ESTRATEGIA DE CARGA ASÍNCRONA ROBUSTA ---

    // A. Ejecución inmediata
    reajustarLienzo();

    // B. Al cargar fuentes del sistema/Google Fonts
    if (document.fonts) {
        document.fonts.ready.then(reajustarLienzo);
    }

    // C. Al terminar de cargar completamente el iframe
    if (iframe) {
        iframe.addEventListener('load', function() {
            reajustarLienzo();
            // Solicitamos activamente una re-medición al iframe por si acaso
            if (iframe.contentWindow) {
                iframe.contentWindow.postMessage({ type: 'GET_HEIGHT' }, '*');
            }
        });
    }

    // D. Polling de ráfaga: Re-evalúa cada 150ms durante los primeros 2 segundos
    let intentos = 0;
    const intervaloCarga = setInterval(() => {
        intentos++;
        reajustarLienzo();
        if (intentos >= 13) { // 13 * 150ms ~= 2 segundos
            clearInterval(intervaloCarga);
        }
    }, 150);

})();