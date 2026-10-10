

// 0. Las animaciones esperan a que la portada revele la invitación (evento "invitacion:visible" que dispara index.html).
//    Sin esto corrían al cargar la página, ocultas detrás del video, y al revelarse ya habían terminado.
let invitacionVisible = window.__invitacionVisible === true || !document.getElementById('gate');
const _colaVisible = [];
function cuandoVisible(fn) { invitacionVisible ? fn() : _colaVisible.push(fn); }
window.addEventListener('invitacion:visible', () => {
  invitacionVisible = true;
  _colaVisible.splice(0).forEach(f => f());
}, { once: true });

// 1. Inyección de estilos universales con soporte para display inline-block y translateY
const styleIdMulti = "canva-multi-anim-style-v2";
let style = document.getElementById(styleIdMulti);
if (!style) {
  style = document.createElement('style');
  style.id = styleIdMulti;
  document.head.appendChild(style);
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
window.aplicarEfectoPalabras = function(containerId, velocidad = 40) {
  const el = document.getElementById(containerId);
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
window.aplicarEfectoLetras = function(containerId, velocidad = 15) {
  const el = document.getElementById(containerId);
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

const tareasAnimacion = [
  { id: "LBdwV1dQkYxB1KXF", tipo: "palabras", velocidad: 300 }, // Cada
  { id: "LBjgy3CkKr9btYWt", tipo: "palabras", velocidad: 50 },  // Preparen
  { id: "LB806sLYPNWT08nv", tipo: "palabras", velocidad: 300 },  // Todos
  { id: "LBjPskjpxJmZ44y6", tipo: "palabras", velocidad: 300 },  // Hotel
  { id: "LBPhWxtcNQHpzzlC", tipo: "palabras", velocidad: 300 },  // Zorritos
  { id: "LB9M5mFXyRCc03Dl", tipo: "palabras", velocidad: 500 },  // Dress
  { id: "LByXDkP57QkkBpKF", tipo: "palabras", velocidad: 300 },  // Sunset
  { id: "LBMY07ntzC23T0TB", tipo: "palabras", velocidad: 70 },  // Los
  { id: "LB81WsDR1z35fcSH", tipo: "palabras", velocidad: 500 },  // Wedding
  { id: "LBV1RmSP9jZqtkyK", tipo: "palabras", velocidad: 70 },  // Para ellas
  { id: "LBBYM4Tb3x1nYhz6", tipo: "palabras", velocidad: 70 },  // Para ellos
  { id: "LBWnQl28TFMlH5V6", tipo: "palabras", velocidad: 70 },  // Para parejas
  { id: "LBmTcwwcQrRNQWPV", tipo: "letras", velocidad: 200 },  // Regalos
  { id: "LBdbqSHPN18jMcDp", tipo: "palabras", velocidad: 300 },  // Tu presencia
  { id: "LBDMK984nClVTCbw", tipo: "palabras", velocidad: 300 },  // Si
  { id: "LB9Z8wbrGwlsLcxj", tipo: "palabras", velocidad: 100 },  // O ingresando
  { id: "LBFxlw4f9k7WgNH7", tipo: "palabras", velocidad: 300 },  // Información
  { id: "LB4tpMqSYWSWhcJJ", tipo: "palabras", velocidad: 70 },  // Queremos
  { id: "LBPNtKv7QMR9fn0K", tipo: "palabras", velocidad: 300 },  // Donde
  { id: "LBJqcdDLggss0Tzb", tipo: "palabras", velocidad: 70 },  // Hemos
  { id: "LBKst6Q1vZjYsnwj", tipo: "palabras", velocidad: 300 },  // Hair
  { id: "LB37nbqQMcRsbQ2h", tipo: "palabras", velocidad: 70 },  // También
  { id: "LBvxLhV9bDFM3xMX", tipo: "palabras", velocidad: 300 },  // Confirmación
  { id: "LBDRf5tVbnTFZM1l", tipo: "palabras", velocidad: 70 },  // Queremos
  { id: "LBMk0mD40M5xzVTc", tipo: "palabras", velocidad: 300 },  // Estamos
  { id: "LBm5624Mt1623KFb", tipo: "palabras", velocidad: 300 }  // Kathy
];

const observerOptions = { root: null, rootMargin: "0px 0px 5% 0px", threshold: 0.1 };

// Los textos se dividen y se dejan ocultos desde ya (la portada los tapa); solo se "disparan" al revelar la invitación.
const textosPreparados = new Map();
tareasAnimacion.forEach(t => {
  const el = document.getElementById(t.id);
  if (!el) return;
  const items = [];
  el.querySelectorAll('._28USrA').forEach(c => procesarEstructuraCanva(c, t.tipo === 'letras' ? 'letras' : 'palabras', items));
  textosPreparados.set(t.id, items);
});

const observer = new IntersectionObserver((entries, obs) => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    const tarea = tareasAnimacion.find(t => t.id === entry.target.id);
    const items = textosPreparados.get(entry.target.id) || [];
    if (tarea) items.forEach((item, i) => setTimeout(() => revelar(item), i * tarea.velocidad));
    obs.unobserve(entry.target);
  });
}, observerOptions);

cuandoVisible(() => tareasAnimacion.forEach(t => {
  const el = document.getElementById(t.id);
  if (el) observer.observe(el);
}));



function activarConScroll(elementId, tipoDesplazamiento = 'izquierda') {
	const el = document.getElementById(elementId);
	if (!el) {
		console.warn(`⚠️ Elemento #${elementId} no encontrado en el DOM.`);
		return;
	}

	if (!el.dataset.originalTransform) {
		const computedTransform = window.getComputedStyle(el).transform;
		el.dataset.originalTransform = (computedTransform && computedTransform !== 'none') ? computedTransform : '';
	}
	const originalTransform = el.dataset.originalTransform;

	el.style.opacity = '0';

	const styleId = `anim-safe-${elementId}`;
	let styleSheet = document.getElementById(styleId);
	if (!styleSheet) {
		styleSheet = document.createElement("style");
		styleSheet.id = styleId;
		document.head.appendChild(styleSheet);
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
			animation: anim_${elementId} 9.5s cubic-bezier(0.16, 1, 0.3, 1) forwards !important;
		}
	`;

	cuandoVisible(() => {
	const observer = new IntersectionObserver((entries, observerInstance) => {
		entries.forEach(entry => {
			if (entry.isIntersecting) {
				el.classList.remove(`clase_anim_${elementId}`);
				void el.offsetWidth; 
				el.classList.add(`clase_anim_${elementId}`);
				observerInstance.unobserve(entry.target);
			}
		});
	}, { 
		threshold: 0.5,
		rootMargin: "0px 0px -2% 0px"
	});

	observer.observe(el);
	});
}

// --- APLICACIÓN DE LISTAS ---

const izquierdaADerecha = [
	"LBJNYPdl1ffZJrN7", // countdown
	"LB5vzHCSnX2mDMNV", "LBfpDhBhSQ9LtpQJ", // Itinerario1
	"LBfWtddz1p0S6RJY", "LBTjv5JQ5VMb84g7", // Itinerario2
	"LBS7LX9YXx1Hr86v", "LBm81tHZSKqkQj38", // Itinerario3
	"LBRnx4H9SvjPc9mG", "LBHbDXW6fzpSHxjj", "LB0RMLZ9tVqYCvfF", // separadores
	"LBjdLjCWwkST0cgV", "LBYMrYFffZh7xB8p", "LBJy8ddBMCzYlgKm", "LBZNjCRNrtvrzthS", "LB268VllFtgppWQZ", "LBD3zrWQ5nSy0S18", "LBffMpCQX0BXJB27", "LBbfQ6n88c2D2sZW", // Lugares1
	"LBtbWglyjL0z0vnZ", "LB2kwLD0JTrm9hpR", "LBytMvrLTr2Ls3Z3", "LBBvDpQx3TwlSwhh", "LBdNCK0NJTTJDp3g", "LBdndKlHyrKmzlNS", "LBxt7f6G0WN0Bxwy", "LB4hTGsvTwj3PXGT"  // Lugares3
];
izquierdaADerecha.forEach(id => activarConScroll(id, 'izquierda'));

const derechaAIzquierda = [
	"LBfWrVHrtKM1f9fr", "LBHD2kspmKTgbXb2", // Itinerario1
	"LB5vRPHzbCJlhsSM", "LBxHvf0r5sfW2gxM", // Itinerario2
	"LBz7lp6lJmCssmDr", "LB1zX2s1W2wh6kJr", // Itinerario3
	"LBPqj3B1nZpSkJKJ", "LBr45BRLyxFhv1vX", "LBRRK58y6dMW7C32", "LBvllFL3YjT8jZMs", "LBVfBmm5yNPYLWWH", "LBb1M8LHyy4sgG26", "LBVx3Y37hWZSCtYn", "LBsZrTgwbmxmp7q1" // Lugares2
];
derechaAIzquierda.forEach(id => activarConScroll(id, 'derecha'));

const arribaAbajo = [
	"LBHYXg2cdDhhBGff", // Itinerario
	"LBlKcnF6rZWfk0xk", "LBb3zHYShrM6m72N", "LB3X93CTFNdjJ9xF", "LBWcY15GsyFndBTq", "LBZdrnGdVW85KT4g", // corazones
	"LBplh3p82M13GnW3", // Mapa
	"LBPW3k08ZxXJz89F", "LBJ3Z7jYxRcR3jrh", // ver ubicacion
	"LBYZFWjJ1ZhW4YTC", // Regalo
	"LBhfXSH8gdgNR1V2", "LBcJTwbxrPlCCyBG", // lista de regalos
	"LBt084lBMCc04QYR", "LB38MsbJ6F5dKsH0", // Importante
	"LBwP9jrvh7N1M7fh", // Makeup
	"LBjP32RPpYhRstCG", "LBVkcSNpXMGy7C7S", // Karen
	"LBxp2hP0h3CtBm5L", "LBZD4Nc7xLVFCQfz", // Cynthia
	"LBKw4l1x3qYwrbpW", "LBGWf7YcB42ySbNn", // RSVP
	"LByhZmPHPqhj7Thv"  // final
];
arribaAbajo.forEach(id => activarConScroll(id, 'arriba'));

const abajoArriba = [
	"LB6TbbDPvH5vS53f", "LBY5VpY7lgrc2C27", "LBLpVPQfk9wycZnt", "LBSb2HxdBqyNYWZm", "LBB8ZBL3Kg7gNnWx",
	"LB8C8RK3Q37zCZ6c", "LBWd626pj7BTdVDC" // Sobre
];
abajoArriba.forEach(id => activarConScroll(id, 'abajo'));

console.log("🚀 Motor de animaciones seguras por scroll inicializado correctamente.");