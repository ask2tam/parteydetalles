
window.datosInvitadoGlobal = {
  nombre: "Invitado Especial",
  pases: 1,
  asistencia: "",
  mensaje: "",
  encontrado: false
};

let googleFetchFinished = false; // 👈 Bandera para saber cuándo terminó Google

const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbypGQ60_GGUYqKSxLgrTwy_pVmVPC_jl7dPyx3_YRvoJxbKTTrsasmJJ6HWjiNYqSA2dA/exec";
const urlParams = new URLSearchParams(window.location.search);
const codigoInvitado = urlParams.get('to') || urlParams.get('invitado');

// Promesa para el fetch de Google Sheets
const promesaDatosGoogle = new Promise((resolve) => {
  if (!codigoInvitado) {
	console.log("[RSVP] No hay código de invitado en la URL. Saltando fetch.");
	googleFetchFinished = true;
	resolve();
	return;
  }
  const urlFinal = `${WEB_APP_URL}?to=${encodeURIComponent(codigoInvitado)}`;
  fetch(urlFinal)
	.then(res => {
	  console.log("[RSVP] Respuesta recibida del servidor. Status:", res.status);
	  return res.json();
	})
	.then(data => {
	  console.log("[RSVP] Datos JSON procesados con éxito:", data);
	  if (data.found) {
		window.datosInvitadoGlobal = {
		  nombre: data.nombre,
		  pases: data.pases || 1,
		  asistencia: data.asistencia || "",
		  mensaje: data.mensaje || "",
		  encontrado: true
		};
	  } else {
		console.log("[RSVP] El servidor respondió pero el invitado no fue encontrado.");
	  }
	  googleFetchFinished = true;
	  resolve();
	})
	.catch(err => {
	  console.error("[RSVP] ❌ Error crítico en el fetch o parseo JSON:", err);
	  googleFetchFinished = true;
	  resolve(); 
	});
});

// Promesa estricta SOLO para los elementos obligatorios de la tarjeta de portada
const promesaElementosCriticos = new Promise((resolve) => {
  const intervalCriticos = setInterval(() => {
	const cardTarget = document.getElementById('card-name-target');
	const seatsTarget = document.getElementById('card-seats-target');
	if (cardTarget && seatsTarget) {
	  clearInterval(intervalCriticos);
	  resolve();
	}
  }, 200);
});

// Bucle independiente y externo para el formulario
const intervalFormulario = setInterval(() => {
  const seatsTarget2 = document.getElementById('card-seats-target2');
  const formContainer = document.querySelector('#LBKyqLNsY6CPckHz');
  const originalButton = document.querySelector('#LBRPjhJn7ZL4nDRs');

  if (seatsTarget2 && formContainer && originalButton && googleFetchFinished) {
	clearInterval(intervalFormulario); 

	// Tarjeta de pases
	const pasesFinal = parseInt(window.datosInvitadoGlobal.pases, 10) || 1;
	const textoPases = pasesFinal > 1 ? `( ${pasesFinal} ) PERSONAS` : `( 1 ) PERSONA`;
	if (seatsTarget2) seatsTarget2.innerText = textoPases;
  
	// Creamos el formulario si aún no existe
	if (!document.getElementById('rsvp-custom-form')) {
	  const formDiv = document.createElement('div');
	  formDiv.id = 'rsvp-custom-form';
	  formDiv.innerHTML = `
		<select id="asistencia-select" required>
		  <option value="" disabled selected>Selecciona una opción</option>
		  <option value="SI">Sí, con mucha alegría</option>
		  <option value="NO">Lamentablemente no podré asistir</option>
		</select>
		<textarea id="mensaje-input" placeholder="Déjanos un mensajito (opcional)..."></textarea>
	  `;
	  formContainer.appendChild(formDiv);
	}

	// Rellenamos los datos (como Google ya respondió, se pintarán correctamente)
	const selectEl = document.getElementById('asistencia-select');
	const mensajeEl = document.getElementById('mensaje-input');

	if (selectEl && window.datosInvitadoGlobal.asistencia) {
	  selectEl.value = window.datosInvitadoGlobal.asistencia;
	}
	if (mensajeEl && window.datosInvitadoGlobal.mensaje) {
	  mensajeEl.value = window.datosInvitadoGlobal.mensaje;
	}

	// Vinculamos el botón de envío
	if (!originalButton.dataset.listenerAttached) {
	  originalButton.dataset.listenerAttached = "true";
	  
	  const textSpan = originalButton.querySelector('span.a_GcMg') || originalButton.querySelector('span, p, div') || originalButton;
	  const textoOriginal = textSpan.textContent;

	  originalButton.addEventListener('click', (e) => {
		e.preventDefault();

		if (!selectEl.value) {
		  alert("Por favor selecciona una opción de asistencia.");
		  return;
		}

		textSpan.textContent = "Guardando...";

		const payload = {
		  to: codigoInvitado || "general",
		  pases: window.datosInvitadoGlobal.pases,
		  asistencia: selectEl.value,
		  mensaje: mensajeEl.value
		};

		fetch(WEB_APP_URL, {
		  method: 'POST',
		  body: JSON.stringify(payload)
		})
		.then(res => res.json())
		.then(data => {
		  if (data.status === 'success') {
			textSpan.textContent = "¡Guardado!";
			setTimeout(() => { textSpan.textContent = textoOriginal; }, 3000);
		  } else {
			textSpan.textContent = "Error";
			setTimeout(() => { textSpan.textContent = textoOriginal; }, 3000);
		  }
		})
		.catch(() => {
		  textSpan.textContent = "Error";
		  setTimeout(() => { textSpan.textContent = textoOriginal; }, 3000);
		});
	  });
	}
  }
}, 200);

