(function() {
  const el = document.getElementById("LBRPQJSSGVqsD3wn");
  const buttonEl = document.getElementById("LBmbbGlv8syvyl1d");

  if (!el || !buttonEl) {
    console.error("No se encontró la tarjeta o el botón.");
    return;
  }

  // 1. Aseguramos visibilidad y estilos base directos para el botón de detalles
  buttonEl.style.cssText += `
    opacity: 1 !important;
    visibility: visible !important;
    display: block !important;
    pointer-events: auto !important;
    cursor: pointer !important;
    z-index: 9999 !important;
  `;

  // 2. Inyectamos los estilos de animación
  if (!document.getElementById("smooth-flip-style-full")) {
    const styleSheet = document.createElement("style");
    styleSheet.id = "smooth-flip-style-full";
    styleSheet.innerHTML = `
      @keyframes smoothFlipOut {
        0% { transform: rotateY(0deg) scale(1); opacity: 1; }
        100% { transform: rotateY(-90deg) scale(0.95); opacity: 0; }
      }
      @keyframes smoothFlipIn {
        0% { transform: rotateY(-90deg) scale(0.95); opacity: 0; }
        100% { transform: rotateY(0deg) scale(1); opacity: 1; }
      }
      .animar-giro-revelar {
        animation: smoothFlipOut 1.2s cubic-bezier(0.4, 0, 0.2, 1) forwards !important;
      }
      .animar-giro-regresar {
        animation: smoothFlipIn 1.2s cubic-bezier(0.4, 0, 0.2, 1) forwards !important;
      }
    `;
    document.head.appendChild(styleSheet);
  }

  // 3. Preparamos el contenedor 3D de la tarjeta
  const currentTransform = el.style.transform || "";
  const translateMatch = currentTransform.match(/translate\([^)]+\)/);
  const baseTranslate = translateMatch ? translateMatch[0] : "";
  const parentContainer = el.parentElement;
  if (!parentContainer) return;

  let wrapper = parentContainer.querySelector(".canva-smooth-flip-wrapper");
  if (!wrapper) {
    wrapper = document.createElement("div");
    wrapper.className = "canva-smooth-flip-wrapper";
    wrapper.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: ${el.style.width || '266px'};
      height: ${el.style.height || '400px'};
      transform: ${baseTranslate};
      perspective: 1500px;
      transform-style: preserve-3d;
      pointer-events: none;
      z-index: 10;
    `;
    parentContainer.insertBefore(wrapper, el);
    el.style.transform = el.style.transform.replace(/translate\([^)]+\)/, '');
    wrapper.appendChild(el);
  }

  el.style.transformOrigin = "center center";
  el.style.transformStyle = "preserve-3d";
  el.style.backfaceVisibility = "hidden";
  el.style.pointerEvents = "auto";

  // 4. Círculo más pequeño (20x20) con un icono SVG proporcionado (16px)
  let closeBtn = wrapper.querySelector(".canva-close-btn");
  if (!closeBtn) {
    closeBtn = document.createElement("button");
    closeBtn.className = "canva-close-btn";
    closeBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="#595144" style="display: block;">
        <path d="M10 4L3 11L10 18V13C15 13 18.5 14.5 21 18C20 13 17 8 10 7V4Z"/>
      </svg>
    `;
    closeBtn.style.cssText = `
      position: absolute;
      top: 10px;
      right: 12px;
      width: 20px;
      height: 20px;
      background: #d4ccbd;
      border: 1.2px solid #c2b8a7;
      border-radius: 50%;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 100;
      opacity: 0;
      pointer-events: none;
      transform: scale(0.9);
      transition: opacity 0.4s ease, transform 0.4s ease, background 0.2s ease;
      box-shadow: 0 2px 4px rgba(0,0,0,0.15);
      padding: 0;
    `;
    wrapper.appendChild(closeBtn);
  }

  // 5. Delegación de eventos global
  document.addEventListener("click", function(e) {
    const targetBtn = e.target.closest('#LBmbbGlv8syvyl1d');
    const targetClose = e.target.closest('.canva-close-btn');

    // Clic en "VER DETALLES"
    if (targetBtn) {
      e.preventDefault();
      
      buttonEl.style.opacity = "0";
      buttonEl.style.visibility = "hidden";
      buttonEl.style.pointerEvents = "none";

      el.classList.remove("animar-giro-regresar");
      el.classList.remove("animar-giro-revelar");
      void el.offsetWidth;
      el.classList.add("animar-giro-revelar");

      setTimeout(() => {
        closeBtn.style.opacity = "1";
        closeBtn.style.pointerEvents = "auto";
        closeBtn.style.transform = "scale(1)";
      }, 900);
    }

    // Clic en el botón con la flecha curva
    if (targetClose) {
      e.preventDefault();
      e.stopPropagation();

      closeBtn.style.opacity = "0";
      closeBtn.style.pointerEvents = "none";
      closeBtn.style.transform = "scale(0.9)";

      el.classList.remove("animar-giro-revelar");
      el.classList.remove("animar-giro-regresar");
      void el.offsetWidth;
      el.classList.add("animar-giro-regresar");

      setTimeout(() => {
        buttonEl.style.visibility = "visible";
        buttonEl.style.opacity = "1";
        buttonEl.style.pointerEvents = "auto";
      }, 900);
    }
  });

  console.log("¡Círculo reducido a 20px con icono destacado de 16px!");
})();


(function() {
  const photoEl = document.getElementById("LBMgFd5KhqbPS9dQ");

  if (!photoEl) {
    console.error("No se encontró el elemento de la foto: LBMgFd5KhqbPS9dQ");
    return;
  }

  // 1. Capturamos el transform y la posición actual de Canva
  const originalTransform = photoEl.style.transform || "";

  // 2. Inyectamos la regla CSS con el doble de duración (2.8s)
  const styleId = "envelope-photo-anim-final";
  
  // Reemplazamos el estilo anterior si ya existía para actualizar la velocidad
  const existingStyle = document.getElementById(styleId);
  if (existingStyle) {
    existingStyle.remove();
  }

  const styleSheet = document.createElement("style");
  styleSheet.id = styleId;
  styleSheet.innerHTML = `
    @keyframes emergeFromEnvelope {
      0% {
        transform: ${originalTransform} translateY(160px) scale(0.95);
        opacity: 0;
      }
      100% {
        transform: ${originalTransform} translateY(0px) scale(1);
        opacity: 1;
      }
    }
    .clase-animar-emergencia {
      animation: emergeFromEnvelope 5.6s cubic-bezier(0.16, 1, 0.3, 1) forwards !important;
    }
  `;
  document.head.appendChild(styleSheet);

  // 3. Forzamos reinicio y aplicamos la animación
  photoEl.classList.remove("clase-animar-emergencia");
  void photoEl.offsetWidth; // Forzamos reflow
  photoEl.classList.add("clase-animar-emergencia");

  console.log("¡Animación ralentizada x2 aplicada con éxito!");
})();