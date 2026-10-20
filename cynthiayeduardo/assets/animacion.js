/* animacion.js — versión Shadow DOM.
   Uso:  Animacion.montar(shadowRoot, { cuandoVisible: fn => ... })
   - Todos los estilos y búsquedas por id ocurren DENTRO del shadow root recibido (ya no en document).
   - cuandoVisible(fn): ejecuta fn cuando la invitación ya es visible (lo provee index.html).
   - Cada diseño recibe sus propias listas en opts: izquierdaADerecha, derechaAIzquierda, arribaAbajo, abajoArriba, textos,
     más duracion (s) y umbral (0-1).
   - Animacion.listarIds(raiz) imprime en consola cada id con su texto para ayudarte a elegirlos. */
(function () {
window.Animacion = {
  montar: function (raiz, opts) {
    opts = opts || {};
    const cuandoVisible = opts.cuandoVisible || (fn => fn());
    const DURACION = opts.duracion != null ? opts.duracion : 9.5;   // segundos de cada animación
    const UMBRAL = opts.umbral != null ? opts.umbral : 0.5;         // fracción visible del elemento para dispararla
// 1. Inyección de estilos universales con soporte para display inline-block y translateY
const styleIdMulti = "canva-multi-anim-style-v2";
let style = raiz.getElementById(styleIdMulti);
if (!style) {
  style = document.createElement('style');
  style.id = styleIdMulti;
  raiz.appendChild(style);
}

style.innerHTML = `
.canva-anim-item {
  display: inline-block !important;
  opacity: 0 !important;
  transform: translateY(-32px) !important;
  transition: opacity 1.1s cubic-bezier(0.16, 1, 0.3, 1), transform 1.1s cubic-bezier(0.16, 1, 0.3, 1) !important;
  will-change: opacity, transform;
}
.canva-anim-item.visible {
  opacity: 1 !important;
  transform: translateY(0) !important;
}
`;

// Revela un elemento animado y los fragmentos que forman parte de su misma palabra
function revelar(item) {
  [item, ...(item._extra || [])].forEach(s => {
    s.style.visibility = 'visible';
    s.classList.add('visible');
  });
}

// Procesa el texto conservando la estructura original de Canva (estilos intactos)
// y agrupa los fragmentos que pertenecen a la misma palabra.
function procesarEstructuraCanva(contenedor, tipoAnimacion, elementos) {
  // Recolecta nodos de texto y marcadores de corte (br / bloques) en orden
  const walker = document.createTreeWalker(contenedor, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  const nodos = [];
  while (walker.nextNode()) {
    const n = walker.currentNode;
    if (n.nodeType === Node.TEXT_NODE) {
      nodos.push(n);
    } else if (/^(BR|P|DIV|LI|H[1-6])$/.test(n.tagName)) {
      nodos.push({ corte: true });
    }
  }

  const crearSpan = (texto) => {
    const span = document.createElement('span');
    span.textContent = texto;
    span.style.opacity = '0';
    span.style.visibility = 'hidden';
    span.classList.add('canva-anim-item');
    return span;
  };

  let palabraActual = null; // primer span de la palabra en curso (solo modo 'palabras')

  nodos.forEach(nodo => {
    if (nodo.corte) { palabraActual = null; return; }

    // Evita reprocesar texto ya animado
    if (nodo.parentElement && nodo.parentElement.classList.contains('canva-anim-item')) return;

    const texto = nodo.nodeValue;
    if (!texto) return;
    if (!texto.trim()) { palabraActual = null; return; } // solo espacios: se deja igual

    const frag = document.createDocumentFragment();

    if (tipoAnimacion === 'palabras') {
      texto.split(/(\s+)/).forEach(token => {
        if (token === '') return;
        if (/^\s+$/.test(token)) {
          frag.appendChild(document.createTextNode(token));
          palabraActual = null; // el espacio cierra la palabra
        } else {
          const span = crearSpan(token);
          if (palabraActual) {
            // Continúa una palabra partida entre varios nodos: se anima junto con el primer fragmento
            (palabraActual._extra = palabraActual._extra || []).push(span);
          } else {
            palabraActual = span;
            elementos.push(span);
          }
          frag.appendChild(span);
        }
      });
    } else { // 'letras'
      Array.from(texto).forEach(char => {
        if (/\s/.test(char)) {
          frag.appendChild(document.createTextNode(char));
        } else {
          const span = crearSpan(char);
          elementos.push(span);
          frag.appendChild(span);
        }
      });
    }

    nodo.parentNode.replaceChild(frag, nodo);
  });
}

// 2. Función robusta PALABRA por PALABRA
const aplicarEfectoPalabras = function(containerId, velocidad = 40) {
  const el = raiz.getElementById(containerId);
  if (!el) {
    console.warn("No se encontró el contenedor:", containerId);
    return;
  }

  const contenedoresTexto = el.querySelectorAll('._28USrA');
  const elementos = [];

  contenedoresTexto.forEach(contenedor => {
    procesarEstructuraCanva(contenedor, 'palabras', elementos);
  });

  requestAnimationFrame(() => {
    elementos.forEach((item, index) => {
      setTimeout(() => revelar(item), index * velocidad);
    });
  });
};

// 3. Función robusta LETRA por LETRA
const aplicarEfectoLetras = function(containerId, velocidad = 15) {
  const el = raiz.getElementById(containerId);
  if (!el) {
    console.warn("No se encontró el contenedor:", containerId);
    return;
  }

  const contenedoresTexto = el.querySelectorAll('._28USrA');
  const elementos = [];

  contenedoresTexto.forEach(contenedor => {
    procesarEstructuraCanva(contenedor, 'letras', elementos);
  });

  requestAnimationFrame(() => {
    elementos.forEach((item, index) => {
      setTimeout(() => revelar(item), index * velocidad);
    });
  });
};

// =========================================================================
// 4. CONTROLADOR DE SCROLL OBSERVER
// =========================================================================

const faltantes = [];
const timeoutsTexto = [];      // para poder cancelar un efecto de letras/palabras en curso al reiniciar
const rearmables = [];         // funciones que vuelven a dejar listas las animaciones por scroll
const tareasAnimacion = opts.textos || [];   // [{ id, tipo: 'letras'|'palabras', velocidad(ms) }]

const observerOptions = { root: null, rootMargin: "0px 0px 5% 0px", threshold: 0.1 };

// Los textos se dividen y se dejan ocultos desde ya (la portada los tapa); solo se "disparan" al revelar la invitación.
const textosPreparados = new Map();
tareasAnimacion.forEach(t => {
  const el = raiz.getElementById(t.id);
  if (!el) { faltantes.push(t.id); return; }
  const items = [];
  el.querySelectorAll('._28USrA').forEach(c => procesarEstructuraCanva(c, t.tipo === 'letras' ? 'letras' : 'palabras', items));
  textosPreparados.set(t.id, items);
});

const observer = new IntersectionObserver((entries, obs) => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    const tarea = tareasAnimacion.find(t => t.id === entry.target.id);
    const items = textosPreparados.get(entry.target.id) || [];
    if (tarea) items.forEach((item, i) => timeoutsTexto.push(setTimeout(() => revelar(item), i * tarea.velocidad)));
    obs.unobserve(entry.target);
  });
}, observerOptions);

cuandoVisible(() => tareasAnimacion.forEach(t => {
  const el = raiz.getElementById(t.id);
  if (el) observer.observe(el);
}));



function activarConScroll(elementId, tipoDesplazamiento = 'izquierda') {
	const el = raiz.getElementById(elementId);
	if (!el) { faltantes.push(elementId); return; }

	if (!el.dataset.originalTransform) {
		const computedTransform = window.getComputedStyle(el).transform;
		el.dataset.originalTransform = (computedTransform && computedTransform !== 'none') ? computedTransform : '';
	}
	const originalTransform = el.dataset.originalTransform;

	el.style.opacity = '0';

	const styleId = `anim-safe-${elementId}`;
	let styleSheet = raiz.getElementById(styleId);
	if (!styleSheet) {
		styleSheet = document.createElement("style");
		styleSheet.id = styleId;
		raiz.appendChild(styleSheet);
	}

	let desdeTransform = '';
	let hastaTransform = originalTransform ? `${originalTransform}` : 'none';

	if (tipoDesplazamiento === 'izquierda') {
		desdeTransform = originalTransform ? `${originalTransform} translateX(-40px)` : 'translateX(-40px)';
	} else if (tipoDesplazamiento === 'derecha') {
		desdeTransform = originalTransform ? `${originalTransform} translateX(40px)` : 'translateX(40px)';
	} else if (tipoDesplazamiento === 'arriba') {
		desdeTransform = originalTransform ? `${originalTransform} translateY(-30px)` : 'translateY(-30px)';
	} else if (tipoDesplazamiento === 'abajo') {
		desdeTransform = originalTransform ? `${originalTransform} translateY(30px)` : 'translateY(30px)';
	}

	styleSheet.innerHTML = `
		@keyframes anim_${elementId} {
			0% {
				transform: ${desdeTransform};
				opacity: 0;
			}
			100% {
				transform: ${hastaTransform};
				opacity: 1;
			}
		}
		.clase_anim_${elementId} {
			animation: anim_${elementId} ${DURACION}s cubic-bezier(0.16, 1, 0.3, 1) forwards !important;
		}
	`;

	const claseAnim = `clase_anim_${elementId}`;
	function armar() {
		el.classList.remove(claseAnim);
		el.style.opacity = '0';
		cuandoVisible(() => {
			const obs = new IntersectionObserver((entries, observerInstance) => {
				entries.forEach(entry => {
					if (entry.isIntersecting) {
						el.classList.remove(claseAnim);
						void el.offsetWidth;
						el.classList.add(claseAnim);
						observerInstance.unobserve(entry.target);
					}
				});
			}, {
				threshold: UMBRAL,
				rootMargin: "0px 0px -2% 0px"
			});
			obs.observe(el);
		});
	}
	rearmables.push(armar);
	armar();
}

// --- APLICACIÓN DE LISTAS (vienen de opts, por diseño) ---
(opts.izquierdaADerecha || []).forEach(id => activarConScroll(id, 'izquierda'));
(opts.derechaAIzquierda || []).forEach(id => activarConScroll(id, 'derecha'));
(opts.arribaAbajo || []).forEach(id => activarConScroll(id, 'arriba'));
(opts.abajoArriba || []).forEach(id => activarConScroll(id, 'abajo'));

if (faltantes.length) console.warn(`[animacion] ${faltantes.length} id(s) no existen en este diseño (revisa las listas). Usa Animacion.listarIds(raiz) para ver los ids disponibles:`, faltantes);
  // Vuelve a dejar TODAS las animaciones de este diseño como al inicio y las dispara de nuevo (útil al reabrir el modal de tips)
  function reiniciar() {
    timeoutsTexto.splice(0).forEach(clearTimeout);
    textosPreparados.forEach((items, id) => {
      items.forEach(it => [it, ...(it._extra || [])].forEach(s => {
        s.style.transition = 'none';            // sin fundido de salida: se oculta al instante
        s.classList.remove('visible');
        s.style.visibility = 'hidden';
      }));
      const el = raiz.getElementById(id);
      if (el) { observer.unobserve(el); observer.observe(el); }
    });
    void raiz.host.offsetWidth;
    textosPreparados.forEach(items => items.forEach(it => [it, ...(it._extra || [])].forEach(s => { s.style.transition = ''; })));
    rearmables.forEach(f => f());
  }
  return { aplicarEfectoPalabras, aplicarEfectoLetras, activarConScroll, reiniciar };
  },
  listarIds: function (raiz) {
    const filas = [];
    raiz.querySelectorAll('[id^="LB"]').forEach(e => {
      const t = (e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40);
      filas.push({ id: e.id, texto: t || '(imagen/forma)' });
    });
    console.table(filas);
    return filas;
  }
};
})();
