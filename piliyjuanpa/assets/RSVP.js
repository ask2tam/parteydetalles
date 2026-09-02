  (function() {
    const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbzzSCNLr9wpej8qCJ4IDMBO0Qf0Dij_iyZXZQ0DZwdvEU3u1ey2Cg9pxce9Pn1fWXe0Pw/exec";
    
    const urlParams = new URLSearchParams(window.location.search);
    const invitado = urlParams.get('invitado');
	
	const nameTarget = document.getElementById('card-name-target');
    const seatsTarget = document.getElementById('card-seats-target');
	const seatsTarget2 = document.getElementById('card-seats-target2');

    function initRSVP() {
      const targetContainer = document.querySelector('#LBKyqLNsY6CPckHz');
      if (!targetContainer) {
        setTimeout(initRSVP, 300);
        return;
      }

      // Evitar duplicar el formulario si ya fue inyectado
      if (document.getElementById('rsvp-custom-form')) return;

      // Crear el formulario limpio sin alterar los elementos gráficos de Canva
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
      
      targetContainer.appendChild(formDiv);

      const selectEl = document.getElementById('asistencia-select');
      const mensajeEl = document.getElementById('mensaje-input');
      let pasesAsignados = 1;

      // Consultar Google Sheets para precargar datos y dejar constancia en consola
      if (invitado) {
        fetch(`${WEB_APP_URL}?invitado=${encodeURIComponent(invitado)}`)
          .then(res => res.json())
          .then(data => {
            if (data.found) {
              pasesAsignados = data.pases || 1;
              console.log(`[RSVP] Invitado reconocido: ${data.nombre} (Pases: ${pasesAsignados})`);
              if (data.asistencia) selectEl.value = data.asistencia;
              if (data.mensaje) mensajeEl.value = data.mensaje;
			  
			  // Reescribir
			  nameTarget.innerText = `${data.nombre}`;
			  if (pasesAsignados > 1) {
				seatsTarget.innerText = `Pase para ( ${pasesAsignados} ) personas`;
				seatsTarget2.innerText = `( ${pasesAsignados} ) personas`;
			  }
			  
            } else {
              console.log(`[RSVP] Invitado en URL no encontrado en la base de datos: ${invitado}`);
            }
          }).catch(err => {
            console.error("[RSVP] Error al consultar Google Sheets:", err);
          });
      } else {
        console.log("[RSVP] No se encontró parámetro 'invitado' en la URL.");
      }
	  
      // Vincular acción de envío con el nuevo botón de Canva
      const originalButton = document.querySelector('#LBRPjhJn7ZL4nDRs');
      if (originalButton) {
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
            invitado: invitado || "Invitado General",
            pases: pasesAsignados,
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

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      setTimeout(initRSVP, 400);
    } else {
      window.addEventListener('DOMContentLoaded', initRSVP);
    }
  })();