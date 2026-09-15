
function animaciondeentrada() {
	const photoEl = document.getElementById("LB1CCVpSkRQXgV93");
	const originalTransform = photoEl.dataset.originalTransform || photoEl.style.transform || "";
	const hideStyle = document.getElementById("console-hide-style");
	if (hideStyle) hideStyle.remove();
	const styleId = "envelope-photo-anim-final";
	let styleSheet = document.getElementById(styleId);
	if (!styleSheet) {
	  styleSheet = document.createElement("style");
	  styleSheet.id = styleId;
	  document.head.appendChild(styleSheet);
	}
	styleSheet.innerHTML = `
	  @keyframes emergeFromEnvelope {
		0% {
		  transform: ${originalTransform} translateY(160px) scale(0.95);
		  opacity: 0 !important;
		}
		100% {
		  transform: ${originalTransform} translateY(0px) scale(1);
		  opacity: 1 !important;
		}
	  }
	  .clase-animar-emergencia {
		animation: emergeFromEnvelope 12.6s cubic-bezier(0.16, 1, 0.3, 1) forwards !important;
	  }
	`;
	photoEl.classList.remove("clase-animar-emergencia");
	void photoEl.offsetWidth; 
	photoEl.classList.add("clase-animar-emergencia");
				


	const styleIdMulti = "canva-multi-anim-style-v2";
	let style = document.getElementById(styleIdMulti);
	if (!style) {
	style = document.createElement('style');
	style.id = styleIdMulti;
	document.head.appendChild(style);
	}

	style.innerHTML = `
	.canva-anim-item {
	  opacity: 0 !important;
	  transform: translateY(-32px) !important;
	  transition: opacity 1.1s cubic-bezier(0.16, 1, 0.3, 1), transform 1.1s cubic-bezier(0.16, 1, 0.3, 1) !important;
	}
	.canva-anim-item.visible {
	  opacity: 1 !important;
	  transform: translateY(0) !important;
	}
	`;

function aplicarEfectoPalabras(containerId, velocidad = 40) {
	const el = document.getElementById(containerId);
	if (!el) return;
	const parrafos = el.querySelectorAll('p._28USrA');
	const elementos = [];

	parrafos.forEach(p => {
	  p.querySelectorAll(':scope > span').forEach(item => {
		if (item.textContent.trim() !== '') {
		  // Aseguramos que arranquen ocultos de forma inmediata y explícita
		  item.style.opacity = '0';
		  item.style.visibility = 'hidden';
		  item.classList.remove('visible');
		  item.classList.add('canva-anim-item');
		  elementos.push(item);
		}
	  });
	});

	// Pequeño respiro técnico para que el navegador procese el estado oculto antes de animar
	requestAnimationFrame(() => {
	  elementos.forEach((item, index) => {
		setTimeout(() => {
		  item.style.visibility = 'visible'; // Restauramos la visibilidad al iniciar su animación
		  item.classList.add('visible');
		}, index * velocidad);
	  });
	});
	}

	function aplicarEfectoLetras(containerId, velocidad = 15) {
	const el = document.getElementById(containerId);
	if (!el) return;
	const parrafos = el.querySelectorAll('p._28USrA');
	const elementos = [];

	parrafos.forEach(p => {
	  p.querySelectorAll('span.a_GcMg').forEach(item => {
		if (item.textContent.trim() !== '') {
		  // Aseguramos que arranquen ocultos de forma inmediata y explícita
		  item.style.opacity = '0';
		  item.style.visibility = 'hidden';
		  item.classList.remove('visible');
		  item.classList.add('canva-anim-item');
		  elementos.push(item);
		}
	  });
	});

	// Pequeño respiro técnico para que el navegador procese el estado oculto antes de animar
	requestAnimationFrame(() => {
	  elementos.forEach((item, index) => {
		setTimeout(() => {
		  item.style.visibility = 'visible'; // Restauramos la visibilidad al iniciar su animación
		  item.classList.add('visible');
		}, index * velocidad);
	  });
	});
	}

	// Palabra por palabra
	aplicarEfectoPalabras("LBQgLDqzkbnQxf9f", 100);

	// Letra por letra
	aplicarEfectoLetras("LBhCv4LHX4984Rsz", 200);
	aplicarEfectoLetras("LBPmNSPVYsh81ZLx", 300);
	aplicarEfectoLetras("LBG2pTbzZpTkQfLc", 200);

	console.log("Animaciones actualizadas correctamente.");
}


// 1. Motor central de activación por Scroll respetando las transformaciones originales de Canva
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
		threshold: 0.10,
		rootMargin: "0px 0px -50px 0px"
	});

	observer.observe(el);
}

// --- APLICACIÓN DE LISTAS ---

const izquierdaADerecha = [
	"LBB0DqQFFbRMdzSH", "LBDKvzJ7J3sHSyV9", "LBYC15rByHX1vsnc", "LBXznNdYMXVQGHZT", "LBZSjj864n99Fcct",
	"PBsPhd7wSTXVyQgl", "PBwbCgwRXtYG2fh0",
	"LBkj7yyY16Q4l8WY", "LBqyBKVYc6rBqmWX", "LBdvYJpg2QR03hrx",
	"PBg4LnQ6hNNRDDJF",
	"LB1fJkqnnQXl8FNK", "LB8sw2zKvJ7SYXyv", "LBQqVlK5bT6DB6HQ", "LBFLy4RHb04FbddD", "LBKNKCYxhJtkN1BV", "LBcbhqZRgnKDyjmn"
];
izquierdaADerecha.forEach(id => activarConScroll(id, 'izquierda'));

const derechaAIzquierda = [
	"LBJrv3vms2yrSyDm",
	"PB7WYvg48nxKnTNB",
	"LBmL9HZRXHrNNjh1", "LBYl6DvpvwRypQKq", "LBCF6m4YJqy76J3x", "LBqkrClvhb4Ftcnk", "LBY6PTbk57G02hTC", 
	"LBnW2WS4RMN4SKt9", "LBnl9fgjv94XlMWm", "LBBlVLfxZhwTqdFn",
	"PBKpbbFLm5KXqD8g",
	"PBrh0JPr7P0hwF7p", 
	"LBN8HRcwLw19JRpQ", "LBlyFgHfn5hh9170", "LBw2R2jQYdKCrpWY", "LB9cchSPYXTBLg9V", "LBzknLT3g4ts1Fkl", 
	"LBH6J9GdP8y33h40", "LB36yB2CTYZ7BGj4"
];
derechaAIzquierda.forEach(id => activarConScroll(id, 'derecha'));

const arribaAbajo = [
	"PBRkSSfbv6BVWxMs", "LBRNrtJXvQWycHWD", "LBGl2cnb83QDx0J6"
];
arribaAbajo.forEach(id => activarConScroll(id, 'arriba'));

const abajoArriba = [
	"LBmCFzBQDQ7lQtsY"
];
abajoArriba.forEach(id => activarConScroll(id, 'abajo'));

console.log("🚀 Motor de animaciones seguras por scroll inicializado correctamente.");