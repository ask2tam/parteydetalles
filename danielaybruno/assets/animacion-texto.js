
const ordenTextosConIndice = [
  { texto: "NOS CASAMOS", ocurrencia: 1 },
  { texto: "DANIELA", ocurrencia: 1 },
  { texto: "&", ocurrencia: 1 },
  { texto: "BRUNO", ocurrencia: 1 },
  { texto: "07 de noviembre", ocurrencia: 1 },
  { texto: "FALTAN", ocurrencia: 1 },
  { texto: "CEREMONIA", ocurrencia: 1 },
  { texto: "RECEPCIÓN", ocurrencia: 1 }, // Si hay varias, puedes especificar ocurrencia: 2, etc.
  { texto: "PROGRAMA", ocurrencia: 1 },
  { texto: "DRESS CODE", ocurrencia: 1 },
  { texto: "REGALOS", ocurrencia: 1 },
  { texto: "DESCUBRE", ocurrencia: 1 },
  { texto: "TARAPOTO", ocurrencia: 2 },
  { texto: "¡ TE ESPERAMOS !", ocurrencia: 1 }
];

function encontrarElementoConIndice(buscado, ocurrenciaDeseada = 1) {
  const todosLosSpans = document.querySelectorAll('span, div, p');
  let encontrados = 0;

  for (let el of todosLosSpans) {
    if (el.children.length === 0 || el.tagName === 'SPAN') {
      const texto = el.textContent.trim().replace(/\s+/g, ' ');
      if (texto.toUpperCase() === buscado.toUpperCase()) {
        encontrados++;
        if (encontrados === ocurrenciaDeseada) {
          return el;
        }
      }
    }
  }
  return null;
}

// Al mapear, pasamos tanto el texto como el número de ocurrencia
const elementosValidos = ordenTextosConIndice
  .map(item => encontrarElementoConIndice(item.texto, item.ocurrencia))
  .filter(el => el !== null);

window.addEventListener('DOMContentLoaded', () => {
	const elementosValidos = ordenTextosConIndice
	  .map(item => encontrarElementoConIndice(item.texto, item.ocurrencia))
	  .filter(el => el !== null);

  if (elementosValidos.length > 0) {
    const observer = new IntersectionObserver((entries, observerInstance) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const elementoActual = entry.target;

          if (elementoActual.classList.contains('global-typing-target')) return;

          const textoOriginal = elementoActual.textContent.trim();
          if (!textoOriginal) return;

          elementoActual.textContent = '';
          elementoActual.classList.add('global-typing-target');
          elementoActual.style.opacity = '1';
          let i = 0;
          
          function escribir() {
            if (i < textoOriginal.length) {
              elementoActual.textContent += textoOriginal.charAt(i);
              i++;
              setTimeout(escribir, 100); 
            }
          }
          
          const retrasoInicial = textoOriginal.length < 2 ? 1000 : 200;
          setTimeout(() => {
            escribir();
          }, retrasoInicial);
          observerInstance.unobserve(elementoActual);
        }
      });
    }, { threshold: 0.15 });

    elementosValidos.forEach(el => observer.observe(el));
    console.log(`¡Efecto cronológico inicializado! Se encontraron ${elementosValidos.length} elementos.`);
  } else {
    console.warn("Esperando elementos de texto para la animación...");
  }
});


// --- LIBRERÍA DE ANIMACIONES Y EFECTOS SCROLL-DRIVEN ---
const ScrollDrivenAnimations = {
	// Registro de efectos con sus keyframes y opciones base
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
		// --- NUEVO EFECTO HEARTBEAT ---
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
		'rompecabezas': {
			esRompecabezas: true
		}
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

		if (!elemento) {
			console.error(`[ScrollDrivenAnimations] Elemento con ID '${selectorId}' no encontrado.`);
			return;
		}

		const claveEfecto = this.mapaEfectos[nombreEfecto];
		if (!claveEfecto) {
			console.error(`[ScrollDrivenAnimations] Efecto '${nombreEfecto}' no reconocido.`);
			return;
		}

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
		if (getComputedStyle(padre).position === 'static') {
			padre.style.position = 'relative';
		}

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

		const cols = 8;
		const rows = 16;
		const anchoPieza = rect.width / cols;
		const altoPieza = rect.height / rows;
		const PORCENTAJE_DESCUBIERTO = 0.85;
		
		let piezasRestantes = cols * rows;

		const indicesDescubrirAutomaticamente = new Set();
		while (indicesDescubrirAutomaticamente.size < Math.floor(piezasRestantes * PORCENTAJE_DESCUBIERTO)) {
			indicesDescubrirAutomaticamente.add(Math.floor(Math.random() * piezasRestantes));
		}

		const estiloCss = document.createElement('style');
		estiloCss.innerHTML = `
			@font-face {
				font-family: 'FuenteEsperamos';
				src: url('assets/d14b5ffc49cff7b227fa97a90f871d2c.woff') format('woff');
			}
			@font-face {
				font-family: 'FuenteConfirmar';
				src: url('assets/f94697db11ec97f0a0e16cc96a3dc28d.woff') format('woff');
			}
			.pieza-tapa {
				position: absolute;
				background-color: #2c3e50;
				border: 1px solid rgba(255, 255, 255, 0.15);
				pointer-events: auto;
				cursor: pointer;
				z-index: 2;
				box-sizing: border-box;
				transition: background-color 0.15s ease;
			}
			.pieza-tapa:hover {
				background-color: #34495e;
			}
			.mensaje-completado {
				position: absolute;
				top: 0; left: 0; width: 100%; height: 100%;
				display: flex;
				flex-direction: column;
				align-items: center;
				justify-content: center;
				background-color: rgba(0, 0, 0, 0.75);
				color: #ffffff;
				text-align: center;
				z-index: 10;
				opacity: 0;
				transition: opacity 0.8s ease-in-out;
				pointer-events: none;
				padding: 25px;
				box-sizing: border-box;
			}
			.texto-esperamos {
				font-family: 'FuenteEsperamos', sans-serif;
				font-size: clamp(2.5rem, 5vw, 4rem);
				margin: 0 0 20px 0;
				text-shadow: 2px 2px 8px rgba(0,0,0,0.9);
			}
			.texto-asistencia {
				font-family: 'FuenteConfirmar', sans-serif;
				font-size: clamp(1.4rem, 3vw, 2.2rem);
				margin: 0;
				font-weight: normal;
				text-shadow: 2px 2px 6px rgba(0,0,0,0.9);
			}
		`;
		document.head.appendChild(estiloCss);

		const backgroundSource = targetEl.cloneNode(true);
		backgroundSource.style.position = 'absolute';
		backgroundSource.style.top = '0';
		backgroundSource.style.left = '0';
		backgroundSource.style.width = '100%';
		backgroundSource.style.height = '100%';
		backgroundSource.style.visibility = 'visible';
		piezasContainer.appendChild(backgroundSource);
		backgroundSource.style.zIndex = '1';

		const verificarSiTermino = () => {
			if (piezasRestantes === 0) {
				const mensaje = document.createElement('div');
				mensaje.className = 'mensaje-completado';
				mensaje.innerHTML = `
					<h2 class="texto-esperamos">¡ Te esperamos !</h2>
					<p class="texto-asistencia">No olvides confirmar tu asistencia</p>
				`;
				piezasContainer.appendChild(mensaje);
				
				void mensaje.offsetWidth; 
				mensaje.style.opacity = '1';
			}
		};

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
				piezaEl.title = 'Haz clic para descubrir esta pieza';

				elementosPieza.push(piezaEl);
				piezasContainer.appendChild(piezaEl);

				piezaEl.addEventListener('click', function() {
					if (indicesDescubrirAutomaticamente.has(i)) return;
					this.remove();
					piezasRestantes--;
					verificarSiTermino();
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

			const indicePiezaActual = colaDescubrir[indiceCola];
			const piezaDomActual = elementosPieza[indicePiezaActual];

			if (piezaDomActual && piezaDomActual.parentNode) {
				piezaDomActual.remove();
				piezasRestantes--;
			}

			indiceCola++;
		}, 45);
	}
};


ScrollDrivenAnimations.init('PBBmg7trDty216Vq', 'Zoom Dinámico con Rebote');
ScrollDrivenAnimations.init('PBQR5W6T7ZkLvJTK', 'Latido de Corazón (Heartbeat)');
ScrollDrivenAnimations.init('PBFchTC9pXQ9hr7F', 'Desenfoque de Profundidad (Blur)');
ScrollDrivenAnimations.init('PBcDcWd57Clb82Xc', 'Rotación 3D en Eje Y (Giro Completo)');
ScrollDrivenAnimations.init('PB9QTSSVmqmQnxp7', 'Caída Vertical con Inercia (Slide Down)');
ScrollDrivenAnimations.init('PBQ1xw0sPkbq4xZD', 'Desenfoque de Profundidad (Blur)');
ScrollDrivenAnimations.init('PBQ0bvgJj4s5KGnS', 'Desvanecimiento Suave (Fade In Clásico)');
//ScrollDrivenAnimations.init('PBLXd7SGjtC4b5gJ', 'Rompecabezas');

window.ScrollDrivenAnimations = ScrollDrivenAnimations;


