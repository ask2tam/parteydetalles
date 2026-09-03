(function() {
    const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbypGQ60_GGUYqKSxLgrTwy_pVmVPC_jl7dPyx3_YRvoJxbKTTrsasmJJ6HWjiNYqSA2dA/exec";
    
    const urlParams = new URLSearchParams(window.location.search);
    const codigoInvitado = urlParams.get('to') || urlParams.get('invitado'); // Compatible con ambos por seguridad
	
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

      // Consultar Google Sheets usando el código corto de la URL (?to=...)
      if (codigoInvitado) {
        fetch(`${WEB_APP_URL}?to=${encodeURIComponent(codigoInvitado)}`)
          .then(res => res.json())
          .then(data => {
            if (data.found) {
              pasesAsignados = data.pases || 1;
              console.log(`[RSVP] Invitado reconocido: ${data.nombre} (Pases: ${pasesAsignados})`);
              if (data.asistencia) selectEl.value = data.asistencia;
              if (data.mensaje) mensajeEl.value = data.mensaje;
			  
              // Reescribir elementos en el diseño
              if (nameTarget) nameTarget.innerText = `${data.nombre}`;
              if (pasesAsignados > 1) {
                if (seatsTarget) seatsTarget.innerText = `Pase para ( ${pasesAsignados} ) personas`;
                if (seatsTarget2) seatsTarget2.innerText = `( ${pasesAsignados} ) personas`;
              }
			  
            } else {
              console.log(`[RSVP] Código en URL no encontrado en la base de datos: ${codigoInvitado}`);
            }
          }).catch(err => {
            console.error("[RSVP] Error al consultar Google Sheets:", err);
          });
      } else {
        console.log("[RSVP] No se encontró parámetro 'to' en la URL.");
      }
	  
      // Vincular acción de envío con el botón de Canva
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
            to: codigoInvitado || "general",
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