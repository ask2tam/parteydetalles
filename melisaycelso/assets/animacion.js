window.addEventListener('DOMContentLoaded', () => {
  const style = document.createElement('style');
  style.innerHTML = `
    .canva-fade-element {
      opacity: 0 !important;
      transform: translateX(-20px) !important;
      pointer-events: none !important;
      transition: opacity 1.8s cubic-bezier(0.16, 1, 0.3, 1), transform 1.8s cubic-bezier(0.16, 1, 0.3, 1) !important;
    }
    .canva-fade-element.canva-fade-visible {
      opacity: 1 !important;
      transform: translate(0, 0) !important;
      pointer-events: auto !important;
    }

    #LB4kzRntXlY6nwYW, #LB4kzRntXlY6nwYW p,
    #LBdJDfSJjnp7dWHM, #LBdJDfSJjnp7dWHM p, #LBdJDfSJjnp7dWHM div,
    #LBl3PJS5KzvVrxPR, #LBl3PJS5KzvVrxPR p,
    #LBB76xmSRSB7S1R5, #LBB76xmSRSB7S1R5 p,
    #LBy6vgh0HGnmJgTG, #LBy6vgh0HGnmJgTG p,
    #LBj5RbQT05n3zwQ2, #LBj5RbQT05n3zwQ2 p,
    #LB8fc1jRXWTVxbWN, #LB8fc1jRXWTVxbWN p {
      visibility: visible !important;
      white-space: pre-wrap !important;
    }

    .word-fade {
      opacity: 0 !important;
      transform: translateY(6px);
      transition: opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1), transform 0.8s cubic-bezier(0.16, 1, 0.3, 1) !important;
      display: inline-block;
    }
    .word-fade.word-visible {
      opacity: 1 !important;
      transform: translateY(0) !important;
    }

    .char-fade {
      opacity: 0 !important;
      transition: opacity 0.4s ease !important;
      display: inline-block;
    }
    .char-fade.char-visible {
      opacity: 1 !important;
    }
  `;
  document.head.appendChild(style);

  // Función palabra por palabra
  function aplicarEfectoPalabras(selector, velocidadPalabra = 70) {
    const contenedor = document.querySelector(selector);
    if (!contenedor) return;

    const parrafosInternos = contenedor.querySelectorAll('p');
    const objetivos = parrafosInternos.length > 0 ? Array.from(parrafosInternos) : [contenedor];
    const todasLasSpans = [];

    objetivos.forEach(p => {
      const texto = p.textContent;
      p.textContent = '';
      const partes = texto.split(/(\s+)/);

      partes.forEach(parte => {
        if (parte.trim() === '') {
          p.appendChild(document.createTextNode(parte));
        } else {
          const span = document.createElement('span');
          span.textContent = parte;
          span.className = 'word-fade';
          p.appendChild(span);
          todasLasSpans.push(span);
        }
      });
    });

    contenedor._animarPalabras = function() {
      let index = 0;
      function mostrarSiguiente() {
        if (index < todasLasSpans.length) {
          todasLasSpans[index].classList.add('word-visible');
          index++;
          setTimeout(mostrarSiguiente, velocidadPalabra);
        }
      }
      mostrarSiguiente();
    };
  }

  // Función letra por letra
  function aplicarEfectoLetras(selector, velocidadLetra = 25) {
    const contenedor = document.querySelector(selector);
    if (!contenedor) return;

    const parrafosInternos = contenedor.querySelectorAll('p');
    const objetivos = parrafosInternos.length > 0 ? Array.from(parrafosInternos) : [contenedor];
    const todasLasChars = [];

    objetivos.forEach(el => {
      const htmlOriginal = el.innerHTML;
      const htmlConToken = htmlOriginal.replace(/<br\s*[\/]?>/gi, '___BREAK___');
      
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = htmlConToken;
      const textoPlano = tempDiv.textContent;

      el.textContent = '';
      const fragmentos = textoPlano.split(/(___BREAK___|\s+)/);

      fragmentos.forEach(frag => {
        if (frag === '___BREAK___') {
          el.appendChild(document.createElement('br'));
        } else if (frag === '' ) {
          // Vacíos
        } else if (/^\s+$/.test(frag)) {
          el.appendChild(document.createTextNode(frag));
        } else {
          for (let i = 0; i < frag.length; i++) {
            const span = document.createElement('span');
            span.textContent = frag[i];
            span.className = 'char-fade';
            el.appendChild(span);
            todasLasChars.push(span);
          }
        }
      });
    });

    contenedor._animarLetras = function() {
      let index = 0;
      function mostrarSiguienteLetra() {
        if (index < todasLasChars.length) {
          todasLasChars[index].classList.add('char-visible');
          index++;
          setTimeout(mostrarSiguienteLetra, velocidadLetra);
        }
      }
      mostrarSiguienteLetra();
    };
  }

  // 1. PREPARAR EFECTOS
  aplicarEfectoLetras('#LB4kzRntXlY6nwYW',  100);
  aplicarEfectoLetras('#LBdJDfSJjnp7dWHM',  100);
  aplicarEfectoPalabras('#LBl3PJS5KzvVrxPR',200);
  
  aplicarEfectoLetras('#LBB76xmSRSB7S1R5', 200);
  aplicarEfectoLetras('#LBy6vgh0HGnmJgTG', 100);
  aplicarEfectoLetras('#LBj5RbQT05n3zwQ2', 200);
  aplicarEfectoLetras('#LB8fc1jRXWTVxbWN', 100);

  // 2. FUNCIÓN GLOBAL PARA DISPARAR SOLO LA PORTADA AL ABRIR EL SOBRE
  window.iniciarEfectosTexto = function() {
    const idsPortada = [
      '#LB4kzRntXlY6nwYW', 
      '#LBdJDfSJjnp7dWHM', 
      '#LBl3PJS5KzvVrxPR'
    ];
    
    idsPortada.forEach(selector => {
      const el = document.querySelector(selector);
      if (el) {
        if (typeof el._animarLetras === 'function') el._animarLetras();
        if (typeof el._animarPalabras === 'function') el._animarPalabras();
      }
    });
  };

  // 3. OBSERVADOR DE SCROLL PARA LOS TEXTOS INFERIORES
  const idsScroll = ['#LBB76xmSRSB7S1R5', '#LBy6vgh0HGnmJgTG', '#LBj5RbQT05n3zwQ2', '#LB8fc1jRXWTVxbWN'];
  
  const observerScrollTextos = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el = entry.target;
        if (typeof el._animarLetras === 'function') el._animarLetras();
        if (typeof el._animarPalabras === 'function') el._animarPalabras();
        obs.unobserve(el);
      }
    });
  }, { threshold: 0.1 });

  idsScroll.forEach(selector => {
    const el = document.querySelector(selector);
    if (el) observerScrollTextos.observe(el);
  });

  // 4. Lógica unificada para el resto de elementos
  const excluidos = [
    'LB4kzRntXlY6nwYW', 'LBdJDfSJjnp7dWHM', 'LBl3PJS5KzvVrxPR', 
    'LBB76xmSRSB7S1R5', 'LBy6vgh0HGnmJgTG', 'LBj5RbQT05n3zwQ2', 'LB8fc1jRXWTVxbWN',
    'hero-screen-overlay', 'btn-abrir-text-overlay', 'envelope-wrapper-overlay'
  ];
  
  const candidatos = document.querySelectorAll('span, div, p, h1, h2, h3, h4, h5, h6');
  const elementosUnicos = new Set();

  candidatos.forEach(el => {
    if (excluidos.some(id => el.id === id || el.closest('#' + id))) return;
    const texto = el.innerText ? el.innerText.trim() : '';
    if (texto.length > 0) {
      const tieneHijosBloque = Array.from(el.children).some(child => 
        ['DIV', 'P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes(child.tagName)
      );
      if (!tieneHijosBloque) elementosUnicos.add(el);
    }
  });

  const listaElementos = Array.from(elementosUnicos);
  if (listaElementos.length > 0) {
    listaElementos.forEach(el => el.classList.add('canva-fade-element'));
    const observer = new IntersectionObserver((entries, observerInstance) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('canva-fade-visible');
          observerInstance.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });
    listaElementos.forEach(el => observer.observe(el));
  }
});

// --- LIBRERÍA DE ANIMACIONES Y EFECTOS SCROLL-DRIVEN ---
const ScrollDrivenAnimations = {
	efectos: {
		'zoom-rebote': {
			keyframes: [
				{ transform: 'scale(0)', opacity: 0 },
				{ transform: 'scale(1.1)', opacity: 1, offset: 0.7 },
				{ transform: 'scale(0.95)', opacity: 1, offset: 0.85 },
				{ transform: 'scale(1)', opacity: 1 }
			],
			opciones: { duration: 900, easing: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)', fill: 'forwards' }
		},
		'rotacion-y': {
			keyframes: [
				{ transform: 'perspective(1000px) rotateY(90deg)', opacity: 0 },
				{ transform: 'perspective(1000px) rotateY(0deg)', opacity: 1 }
			],
			opciones: { duration: 1000, easing: 'ease-out', fill: 'forwards' }
		},
		'volteo-x': {
			keyframes: [
				{ transform: 'perspective(1000px) rotateX(-90deg)', opacity: 0 },
				{ transform: 'perspective(1000px) rotateX(0deg)', opacity: 1 }
			],
			opciones: { duration: 1000, easing: 'ease-out', fill: 'forwards' }
		},
		'slide-izquierda': {
			keyframes: [
				{ transform: 'translateX(-100px)', opacity: 0 },
				{ transform: 'translateX(0px)', opacity: 1 }
			],
			opciones: { duration: 800, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', fill: 'forwards' }
		},
		'caida-inercia': {
			keyframes: [
				{ transform: 'translateY(-80px)', opacity: 0 },
				{ transform: 'translateY(15px)', opacity: 1, offset: 0.7 },
				{ transform: 'translateY(0px)', opacity: 1 }
			],
			opciones: { duration: 850, easing: 'ease-out', fill: 'forwards' }
		},
		'glitch-skew': {
			keyframes: [
				{ transform: 'skewX(-30deg) scale(0.8)', opacity: 0 },
				{ transform: 'skewX(15deg) scale(1.02)', opacity: 0.8, offset: 0.7 },
				{ transform: 'skewX(-5deg) scale(0.98)', opacity: 1, offset: 0.85 },
				{ transform: 'skewX(0deg) scale(1)', opacity: 1 }
			],
			opciones: { duration: 700, easing: 'ease-out', fill: 'forwards' }
		},
		'fade-in': {
			keyframes: [
				{ opacity: 0, transform: 'scale(0.97)' },
				{ opacity: 1, transform: 'scale(1)' }
			],
			opciones: { duration: 1000, easing: 'ease-in', fill: 'forwards' }
		},
		'giro-espiral': {
			keyframes: [
				{ transform: 'scale(0) rotate(-360deg)', opacity: 0 },
				{ transform: 'scale(1.05) rotate(15deg)', opacity: 0.8, offset: 0.8 },
				{ transform: 'scale(1) rotate(0deg)', opacity: 1 }
			],
			opciones: { duration: 1100, easing: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)', fill: 'forwards' }
		},
		'vibracion': {
			keyframes: [
				{ transform: 'translateX(0)', opacity: 1 },
				{ transform: 'translateX(-12px) rotate(-3deg)' },
				{ transform: 'translateX(12px) rotate(3deg)' },
				{ transform: 'translateX(-10px) rotate(-2deg)' },
				{ transform: 'translateX(10px) rotate(2deg)' },
				{ transform: 'translateX(-5px) rotate(-1deg)' },
				{ transform: 'translateX(5px) rotate(1deg)' },
				{ transform: 'translateX(0) rotate(0)' }
			],
			opciones: { duration: 800, easing: 'ease-in-out', fill: 'forwards' }
		},
		'desenfoque': {
			keyframes: [
				{ filter: 'blur(15px)', opacity: 0, transform: 'scale(1.05)' },
				{ filter: 'blur(0px)', opacity: 1, transform: 'scale(1)' }
			],
			opciones: { duration: 1000, easing: 'ease-out', fill: 'forwards' }
		},
		'latido-heartbeat': {
			keyframes: [
				{ transform: 'scale(0.8)', opacity: 0 },
				{ transform: 'scale(1.05)', opacity: 1, offset: 0.3 },
				{ transform: 'scale(0.92)', opacity: 1, offset: 0.5 },
				{ transform: 'scale(1.08)', opacity: 1, offset: 0.7 },
				{ transform: 'scale(1)', opacity: 1, offset: 1 }
			],
			opciones: { duration: 900, easing: 'ease-in-out', fill: 'forwards' }
		},
		'rompecabezas': { esRompecabezas: true }
	},

	mapaEfectos: {
		'Zoom Dinámico con Rebote': 'zoom-rebote',
		'Rotación 3D en Eje Y (Giro Completo)': 'rotacion-y',
		'Volteo 3D en Eje X (Flip Vertical)': 'volteo-x',
		'Deslizamiento Lateral (Slide desde la Izquierda)': 'slide-izquierda',
		'Caída Vertical con Inercia (Slide Down)': 'caida-inercia',
		'Efecto Glitch / Inclinación (Skew)': 'glitch-skew',
		'Desvanecimiento Suave (Fade In Clásico)': 'fade-in',
		'Giro Espiral (Rotate + Scale)': 'giro-espiral',
		'Vibración Intensa (Shake)': 'vibracion',
		'Desenfoque de Profundidad (Blur)': 'desenfoque',
		'Latido de Corazón (Heartbeat)': 'latido-heartbeat',
		'Rompecabezas': 'rompecabezas',
	},

	init: function(selectorId, nombreEfecto) {
		const elemento = document.getElementById(selectorId);
		if (!elemento) return;
		const claveEfecto = this.mapaEfectos[nombreEfecto];
		if (!claveEfecto) return;
		const config = this.efectos[claveEfecto];

		if (config.esRompecabezas) {
			this.iniciarRompecabezasScroll(elemento);
			return;
		}

		elemento.style.opacity = '0';
		const observer = new IntersectionObserver((entries, obs) => {
			entries.forEach(entry => {
				if (entry.isIntersecting) {
					obs.unobserve(entry.target);
					elemento.animate(config.keyframes, config.opciones);
				}
			});
		}, { threshold: 0.2 });
		observer.observe(elemento);
	},

	iniciarRompecabezasScroll: function(targetEl) {
		const padre = targetEl.parentElement;
		if (getComputedStyle(padre).position === 'static') padre.style.position = 'relative';
		const observer = new IntersectionObserver((entries, obs) => {
			entries.forEach(entry => {
				if (entry.isIntersecting) {
					obs.unobserve(entry.target);
					this.renderizarRompecabezas(targetEl, padre);
				}
			});
		}, { threshold: 0.3 });
		observer.observe(targetEl);
	},

	renderizarRompecabezas: function(targetEl, padre) {
		const rect = targetEl.getBoundingClientRect();
		const piezasContainer = document.createElement('div');
		piezasContainer.id = 'puzzle-pieces-container';
		piezasContainer.style.position = 'absolute';
		piezasContainer.style.top = targetEl.offsetTop + 'px';
		piezasContainer.style.left = targetEl.offsetLeft + 'px';
		piezasContainer.style.width = rect.width + 'px';
		piezasContainer.style.height = rect.height + 'px';
		piezasContainer.style.pointerEvents = 'none'; 
		piezasContainer.style.zIndex = '100';
		piezasContainer.style.overflow = 'hidden';
		padre.appendChild(piezasContainer);
		targetEl.style.visibility = 'hidden';

		const cols = 8, rows = 16;
		const anchoPieza = rect.width / cols, altoPieza = rect.height / rows;
		let piezasRestantes = cols * rows;

		const indicesDescubrirAutomaticamente = new Set();
		while (indicesDescubrirAutomaticamente.size < Math.floor(piezasRestantes * 0.85)) {
			indicesDescubrirAutomaticamente.add(Math.floor(Math.random() * piezasRestantes));
		}

		const backgroundSource = targetEl.cloneNode(true);
		backgroundSource.style.position = 'absolute';
		backgroundSource.style.top = '0'; backgroundSource.style.left = '0';
		backgroundSource.style.width = '100%'; backgroundSource.style.height = '100%';
		backgroundSource.style.visibility = 'visible';
		backgroundSource.style.zIndex = '1';
		piezasContainer.appendChild(backgroundSource);

		const elementosPieza = [];
		for (let r = 0; r < rows; r++) {
			for (let c = 0; c < cols; c++) {
				const i = elementosPieza.length;
				const piezaEl = document.createElement('div');
				piezaEl.className = 'pieza-tapa';
				piezaEl.style.width = anchoPieza + 'px';
				piezaEl.style.height = altoPieza + 'px';
				piezaEl.style.top = (r * altoPieza) + 'px';
				piezaEl.style.left = (c * anchoPieza) + 'px';

				elementosPieza.push(piezaEl);
				piezasContainer.appendChild(piezaEl);

				piezaEl.addEventListener('click', function() {
					if (indicesDescubrirAutomaticamente.has(i)) return;
					this.remove();
					piezasRestantes--;
				});
			}
		}

		let colaDescubrir = Array.from(indicesDescubrirAutomaticamente);
		let indiceCola = 0;
		const intervaloSecuencia = setInterval(() => {
			if (indiceCola >= colaDescubrir.length) {
				clearInterval(intervaloSecuencia);
				return;
			}
			const piezaDomActual = elementosPieza[colaDescubrir[indiceCola]];
			if (piezaDomActual && piezaDomActual.parentNode) {
				piezaDomActual.remove();
				piezasRestantes--;
			}
			indiceCola++;
		}, 45);
	}
};

ScrollDrivenAnimations.init('PBxkPKzC9z7WNs5B', 'Desvanecimiento Suave (Fade In Clásico)');
ScrollDrivenAnimations.init('PBV1cltrSlxxDfkR', 'Desenfoque de Profundidad (Blur)');
ScrollDrivenAnimations.init('PBnGcMT8VJhKK6Ws', 'Desenfoque de Profundidad (Blur)');

window.ScrollDrivenAnimations = ScrollDrivenAnimations;