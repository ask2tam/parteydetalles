const rootLienzo = document.querySelector('#root'); // O tu elemento raíz
const anchoOriginal = 814; 

// Inyectamos la regla exacta para eliminar la barra interna de div.ZRRuDw
let estiloZRRuDw = document.createElement('style');
estiloZRRuDw.id = 'canva-zrrudw-fix';
estiloZRRuDw.innerHTML = `
	div.ZRRuDw {
		overflow: visible !important;
		height: auto !important;
		max-height: none !important;
	}
`;
document.head.appendChild(estiloZRRuDw);

// Detectar o crear el wrapper protector
let wrapper = document.querySelector('#canva-responsive-wrapper');
if (!wrapper) {
	wrapper = document.createElement('div');
	wrapper.id = 'canva-responsive-wrapper';
	rootLienzo.parentNode.insertBefore(wrapper, rootLienzo);
	wrapper.appendChild(rootLienzo);
}

// Pintamos el fondo del body y del html del mismo color crema de Canva
document.documentElement.style.backgroundColor = '#FBF9F1'; 
document.body.style.backgroundColor = '#FBF9F1';
document.documentElement.style.overflowX = 'hidden'; 
document.body.style.overflowX = 'hidden';
document.body.style.margin = '0';
document.body.style.padding = '0';
document.body.style.display = 'flex';
document.body.style.flexDirection = 'column';
document.body.style.alignItems = 'center';

const altoOriginal = rootLienzo.offsetHeight || 1200; 

function ajustarResponsividad() {
	const anchoVentana = window.innerWidth;

	if (anchoVentana < anchoOriginal) {
		// --- MÓVILES ---
		const escala = anchoVentana / anchoOriginal;
		
		wrapper.style.width = '100%';
		wrapper.style.maxWidth = `${anchoOriginal}px`;
		wrapper.style.margin = '0 auto'; 
		wrapper.style.aspectRatio = `${anchoOriginal} / ${altoOriginal}`;
		wrapper.style.height = 'auto'; 
		wrapper.style.position = 'relative';
		wrapper.style.overflow = 'hidden';

		rootLienzo.style.width = `${anchoOriginal}px`;
		rootLienzo.style.height = `${altoOriginal}px`;
		rootLienzo.style.position = 'absolute';
		rootLienzo.style.top = '0';
		rootLienzo.style.left = '0';
		rootLienzo.style.overflow = 'hidden'; 
		rootLienzo.style.transformOrigin = 'top left';
		rootLienzo.style.transform = `scale(${escala})`;
	} else {
		// --- ESCRITORIO ---
		wrapper.style.width = `${anchoOriginal}px`;
		wrapper.style.height = `${altoOriginal}px`;
		wrapper.style.aspectRatio = 'unset';
		wrapper.style.position = 'relative';
		wrapper.style.overflow = 'visible';
		wrapper.style.margin = '0 auto'; 

		rootLienzo.style.width = `${anchoOriginal}px`;
		rootLienzo.style.height = `${altoOriginal}px`;
		rootLienzo.style.position = 'relative';
		rootLienzo.style.top = 'unset';
		rootLienzo.style.left = 'unset';
		rootLienzo.style.overflow = 'visible'; 
		rootLienzo.style.transform = 'none';
		rootLienzo.style.transformOrigin = 'unset';
	}
}

window.addEventListener('resize', ajustarResponsividad);
ajustarResponsividad();