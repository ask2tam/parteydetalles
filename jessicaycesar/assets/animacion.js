(function() {
    // Motor central de activación por Scroll usando IntersectionObserver
    function activarConScroll(elementId, callback) {
        const el = document.getElementById(elementId);
        if (!el) {
            console.warn(`⚠️ Elemento #${elementId} no encontrado en el DOM.`);
            return;
        }

        const observer = new IntersectionObserver((entries, observerInstance) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    callback(el);
                    observerInstance.unobserve(entry.target); // Se ejecuta una sola vez al hacer scroll
                }
            });
        }, { 
            threshold: 0.15 // Se dispara cuando al menos el 15% del elemento es visible en pantalla
        });

        observer.observe(el);
    }

    /* 1. Animación Slide-Up Vertical Parametrizable
    activarConScroll('LBg2Sz7y58w59hxw', (el) => {
        el.getAnimations().forEach(anim => anim.cancel());
        el.animate([
            { opacity: 0, transform: 'translate(84.26px, 188.225px) scale(1, 1)' },
            { opacity: 1, transform: 'translate(84.26px, 128.225px) scale(1, 1)' }
        ], {
            duration: 4800,
            easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
            fill: 'forwards'
        });
        console.log("✨ Slide-up activado por scroll en #LBg2Sz7y58w59hxw");
    }); */

    // 2. Animación Izquierda a Derecha (con rotación) Parametrizable
    activarConScroll('LBSRQ0LydKKMqKNz', (el) => {
        el.getAnimations().forEach(anim => anim.cancel());
        el.animate([
            { opacity: 0, transform: 'translate(-33.9848px, 42.8423px) rotate(6.10665deg) scale(1, 1)' },
            { opacity: 1, transform: 'translate(16.0152px, 42.8423px) rotate(6.10665deg) scale(1, 1)' }
        ], {
            duration: 4800,
            easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
            fill: 'forwards'
        });
        console.log("✨ Izquierda-Derecha activado por scroll en #LBSRQ0LydKKMqKNz");
    });

    // 3. Animación Derecha a Izquierda (con rotación) Parametrizable
    activarConScroll('LB3TnNms65ThYVHH', (el) => {
        el.getAnimations().forEach(anim => anim.cancel());
        el.animate([
            { opacity: 0, transform: 'translate(69.3386px, 115.399px) rotate(-7.19012deg)' },
            { opacity: 1, transform: 'translate(19.3386px, 115.399px) rotate(-7.19012deg)' }
        ], {
            duration: 4800,
            easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
            fill: 'forwards'
        });
        console.log("✨ Derecha-Izquierda activado por scroll en #LB3TnNms65ThYVHH");
    });

    // 4. Animación de Tipeo de Texto Parametrizable
    activarConScroll('LBr72Hb0JSCPS7tR', (container) => {
        const letters = container.querySelectorAll('span.a_GcMg');
        if (letters.length === 0) {
            console.warn("⚠️ No se encontraron caracteres tipográficos internos para el tipeo.");
            return;
        }

        letters.forEach(letter => {
            letter.style.opacity = '0';
            letter.style.transition = 'opacity 0.4s ease';
        });

        let index = 0;
        const speed = 200; // Milisegundos entre cada letra
        const typingInterval = setInterval(() => {
            if (index < letters.length) {
                letters[index].style.opacity = '1';
                index++;
            } else {
                clearInterval(typingInterval);
                console.log("✨ Efecto de tipeo completado por scroll en #LBr72Hb0JSCPS7tR");
            }
        }, speed);
    });

    console.log("🚀 Sistema de animaciones por scroll inicializado y listo.");
})();