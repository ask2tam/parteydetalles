

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
  { id: "LBdWTvtJxZXRVz8Z", tipo: "letras", velocidad: 200 }  // Te esperamos
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
	"LBL9QYVcshLmQsmX", // el gran dia
	"countdown", // counter
	"LBMDWdYk4NbfydB6", "LB6RlyM8x9FhgdJ5", "LBFbhMM2bgM6YXmT", "LBGJpg9jXCvkyGJ3", "LB4nyGggFQLCp7zm", "LBzH7ctht18QDZmh",  // ceremonia
	"LBSWT3dXBfJqgSQJ", "LBmHcxCyKNCv2cqc", "LB8lt0JMdK4jXBr2", "LBxyntrFXF4bwWTt",// Itinerario iconos
	"LBZlm1CLVJLTsnM5", "LBSpdCQPJzr4NB1T", "LBDbGszR3Vht1SgT", "LBbD6njNMzCqYN7W", "LBZM31Tp5B3N70JM", "LBMz6wbQ57gvJc92",  // Dress code
	"LB840CqlStz5s3xM", "LBY1vT2w8CGr9bVk", "LBZLBlPTC0q6FJSy", "rsvp",  // confirmacion
	"LBhYqXnvtsDThz9H"  // te esperamos
];
izquierdaADerecha.forEach(id => activarConScroll(id, 'izquierda'));

const derechaAIzquierda = [
	"LBbWDsVz67q7WNW1", "LBJnbxJmLjyKQ0nY", "LBD370ygbM5r7Y86", "LBNNlnTNBRHcy5Fr", "LBVScz7KQ28QLNB8", "LBBQnx1Z3wpQywWW", // recepción
	"LBttT8lQSnqb8X0G", "LBbSsC7L300zxjJB", "LBfYr2TtFjZsfGMt", "LBT232x77JP64F9N", // Itinerario letras
	"LB3ktCby576MpDTb", "LBFqMMbyW0DBm1QR", "LBfJjytjBb3Sp0Fy", "LBKpydbP7pk3bXpk", "LBXPs610JXLwcSqN", "LBfb9k4Km3WsNYmn" // Regalos
];
derechaAIzquierda.forEach(id => activarConScroll(id, 'derecha'));

const arribaAbajo = [
	"LB52R7tHFJwbl8W1", "LBWrqkr0wYWY0nhd", "LBqSqZWyZVgP0Qkj", // sobre
	"LBkz6zB1Qx29QtkL", // Itinerario titulo
	"LBLLMZ7NhXph5yjP", "LB5Vj34XGbYHlkQs" // solo adultos
];
arribaAbajo.forEach(id => activarConScroll(id, 'arriba'));

console.log("🚀 Motor de animaciones seguras por scroll inicializado correctamente.");