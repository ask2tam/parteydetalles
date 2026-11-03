# Parte y Detalles · Invitaciones + RSVP + Panel · v3.9 (versión completa)

Esta carpeta reemplaza **todo** lo anterior. No hace falta ningún archivo previo.

```
/panel.html  /staff.html                Panel de invitados y modo recepción (raíz del sitio)
/sw-recepcion.js                        permite abrir staff.html sin señal (raíz del sitio, junto a staff.html)
/assets/                                COMPARTIDO por todos los eventos
    pyd-config.js   ← ÚNICO archivo a editar: URL y llave de Supabase
    boda-api.js  rsvp.js  qr.js  panel-i18n.js  buscar.js  telefono.js
    logo_parteydetalles.png             ← súbelo tú
/ignacioysuly/                          una carpeta por evento (nombre de carpeta = identificador)
    index.html                          invitación con el RSVP integrado
    rsvp.html                           RSVP directo (destino del QR) · genérico: cópialo igual en cada evento
    assets/                             archivos del diseño + fondos opcionales rsvp_fondo_*.png
/supabase/                              NO se sube al hosting
    00_reiniciar.sql  01_esquema.sql  02_reporte_diario.sql  03_plantillas_correo.md
    functions/generar-mensaje/index.ts
/respaldo-github/                       NO se sube al hosting: va a un repositorio PRIVADO de GitHub (respaldo diario)
```
Funciona en un dominio propio o en una subcarpeta (p. ej. `usuario.github.io/repo/`): las rutas se calculan solas.

## Novedades v3.9 y cómo actualizar desde v3.8
No hay cambios de SQL ni de panel. **Sube** (reemplazando): `assets/rsvp.js` (compartido) y, en la carpeta del evento, `index.html`, `invitacion.html`, `rsvp.html` y **toda la carpeta `assets/`** (trae los archivos ya optimizados; `logo_portada_hd.png` y `rsvp_logo.png` son los tuyos, sin tocar). Luego **borra** del hosting los archivos viejos que ya no se usan (los `.png` que ahora son `.webp`/`.jpg`, y los `.woff`).

| Cambio | Dónde |
|---|---|
| **Carga rápida: solo lo indispensable bloquea el sobre.** El anillo de carga ahora espera únicamente: las imágenes del sobre, las 2 tipografías de la portada y los datos del invitado (con tope de 2.5 s). La invitación de Canva, las imágenes, `qr.js` y `rsvp.js` se cargan **después**, en segundo plano, mientras el invitado ve el sobre. Si toca «Ver invitación» antes de que termine, el botón parpadea y entra apenas está lista (si no carga, dice «Reintentar»). | `index.html` (`PESO`, `iniciarInvitacion`) |
| **Menos bytes al abrir:** solo las 2 primeras secciones bajan de inmediato (el resto con `loading="lazy"`); las tipografías de Canva se declaraban una vez por peso y el navegador bajaba el mismo archivo hasta 11 veces: ahora una regla por archivo; las imágenes de Canva ya no se bajan dos veces (se quitó `crossorigin`); `rsvp.js` va al final. | `index.html` |
| **Imágenes y tipografías más livianas** (carpeta assets del evento: 12.0 MB → 2.6 MB, −78 %) con `optimizar_assets.py`: fotos y papeles opacos PNG → JPG; PNG con transparencia y textura (papel, sello, piezas del sobre) → WebP de alta calidad; iconos de línea → PNG de 256 colores **sin pérdida**; imágenes más grandes de lo que se llega a ver → a su escala; tipografías → woff2 solo con letras latinas (de ~280 KB a ~42 KB). Cada conversión se midió (PSNR/SSIM) y, si no cumple, el archivo se deja igual. | `optimizar_assets.py` |
| **Cuenta regresiva propia** (sin la «T» de tickcounter): se quitó el iframe de `invitacion.html`; `index.html` dibuja los números en la fuente serif predeterminada, con «:» y etiquetas DÍAS · HORAS · MINUTOS · SEGUNDOS (DAYS · HOURS… en inglés) en el mismo recuadro. La fecha está en `CONFIG.contador.fecha`. | `index.html`, `invitacion.html` |
| **«TOCA PARA ABRIR» y el círculo pulsante en negro** (`#1E1B18`, el de la paleta). | `index.html` |
| **Fondos del RSVP** (`rsvp_fondo_background/formulario/tarjeta`): ahora pueden ser `.jpg` (recomendado, ~10× más livianos) o `.png`; se usa el que exista. | `rsvp.js`, `rsvp.html` |
| El idioma de la portada se decide con los datos del invitado (antes lo fijaba `rsvp.js`, que ahora carga después). | `index.html` |

#### Medición (Chromium, red simulada; servidor con gzip)
| | v3.8 | v3.9 |
|---|---|---|
| Sobre visible · 4G (~9 Mbps) | 12.1 s · 12.1 MB | **2.3 s · 0.39 MB** |
| Sobre visible · 3G (1.6 Mbps) | 26.8 s (llegó al tope de 25 s) | **3.5 s** |
| Invitación visible tras tocar «Ver invitación» (desde que se abre el enlace) · 4G | 16.7 s | **7.0 s** |
| Ídem · 3G | 31.5 s | **9.6 s** (espera ~1.6 s si toca de inmediato) |

#### Cómo usar `optimizar_assets.py`
`pip install pillow numpy scipy fonttools brotli beautifulsoup4 lxml` y luego `python optimizar_assets.py ignacioysuly` (tarda ~1.5 min). Hace una copia en `ignacioysuly_originales/`, convierte lo que corresponda, **corrige las referencias** en `invitacion.html`, `index.html` y `rsvp.html`, y escribe en `index.html` las tipografías de la portada (entre `@@FUENTES-PORTADA@@`). Es repetible: **ejecútalo cada vez que vuelvas a exportar el Canva o regeneres el sobre con `generar_sobre.py`**. No toca `logo_portada*` ni `rsvp_logo*`.
- Las piezas del sobre pasan de PNG a **WebP** (PSNR 45–52 dB: no se distingue a simple vista; pesan ~15–50 KB en vez de ~400 KB). Requiere Safari/iOS 14 o más nuevo (2020). Si prefieres PNG para el sobre, no ejecutes el optimizador sobre esas piezas (o cambia las extensiones en `index.html`): el sobre vuelve a pesar ~2.4 MB.
- Umbrales (arriba del script): `PSNR_WEBP`, `SSIM_PNG_A_JPG`, `ESCALERA_JPG`, `Q_WEBP`. Para ver el aspecto sin riesgo, compara con tu copia `_originales`.

## Novedades v3.8 y cómo actualizar desde v3.7
No hay cambios de SQL ni de panel. **Sube** (reemplazando): `assets/rsvp.js` (compartido) y, en la carpeta del evento, `index.html` y `assets/logo_portada_hd.png`. `generar_sobre.py` es opcional (solo cambia la función del título).
**Puedes borrar** de `ignacioysuly/assets/`: `sobre.m4a` (el sobre ya no tiene sonido) y `file_795346059.svg` si aún está (el ícono de regalos ahora es `file_1842718777.svg`, que ya viene en tu Canva nuevo).

| Cambio | Dónde |
|---|---|
| **Sin sonido** en el sobre: se quitó el audio, su precarga y el ajuste `CONFIG.sobre.sonido`. | `index.html` |
| **Gesto «DESLIZA»** (con flechas que bajan) al abrirse la invitación por primera vez. Aparece a los ~2 s, se apoya en la parte baja de la foto (no tapa «¡NOS CASAMOS!») y se va cuando el invitado empieza a desplazarse (o a los 16 s). No vuelve a aparecer. Funciona aunque el iPhone tenga «Reducir movimiento». | `pistaScroll()`, `#pista-scroll` |
| **Cuenta regresiva**: vuelve la de Canva (el iframe de `invitacion.html`); se retiró el contador propio. | `index.html` |
| **Canva nuevo**: se retiraron de las animaciones los ids que ya no existen (dress code anterior, íconos vestido/traje sueltos, adorno de los nombres y todo lo de la playlist: texto, tarjeta, ícono y botón) y se incorporaron los nuevos: imagen **SULY** (`LBJwzxTQBllZYLfm`), círculo del dress code (`LBwj3JQxmZNyCnKg`) y el grupo vestido + traje (`LB9252XSfyRKyW88`). Los fondos de papel (`71f2bd…`) no se animan. | `CONFIG.anim` |
| **Sentido del giro** de las tarjetas (RSVP y UN DETALLE): la tarjeta es un objeto rígido y la superficie sigue al dedo, venga de la orilla derecha o de la izquierda, y también desde el reverso. Antes el signo estaba invertido y, desde el reverso, ambos lados giraban igual. Con los botones, la tarjeta gira como una hoja (la orilla derecha viene hacia ti) y «Volver» deshace el giro. Un gesto rápido también completa el giro. | `rsvp.js`, `index.html` |
| **«UN DETALLE» ya no queda estampado** al girar: `animacion.js` deja `visibility:visible` en cada letra animada y esas letras seguían viéndose aunque la cara estuviera oculta. Ahora la cara oculta se esconde con opacidad. | `index.html` |
| **Título de la portada**: el «&» se sustituye por el de Canva (nítido, con más cuerpo) y se ajusta el contraste del texto. | `logo_portada_hd.png`, `generar_sobre.py` |

## Novedades v3.7 (portada) y cómo actualizar desde v3.6
Solo cambia la portada del sobre (`index.html` de cada evento y sus imágenes). **No hay cambios de SQL, panel, RSVP ni librerías compartidas.**

1. **Sube** `ignacioysuly/index.html` y, en `ignacioysuly/assets/`, estas 7 imágenes: `sobre_fondo.png`, `sobre_adelante.png`, `solapa_frontal.png`, `solapa_reverso.png`, `tarjeta.png`, `sello.png`, `logo_portada_hd.png`.
2. **Puedes borrar**: `sobre_fondo.webp`, `sobre_adelante.webp`, `solapa_frontal.webp`, `solapa_reverso.webp`, `tarjeta.webp`, `sello.webp`, `sobre.mp4`, `LEEME_index2.md` y `generar_sobre.py` anterior (ya no se usan). `logo_portada.png` (tu archivo original) se conserva: de él sale `logo_portada_hd.png`.

| Cambio | Dónde |
|---|---|
| **WebP → PNG** y mayor calidad: piezas de 1200 px de ancho (nítidas en pantallas 3×) con grano de papel nacarado, bordes biselados y sombras suaves. El sobre cerrado es un «euro flap» de punta redondeada, tomado de `288633…png` (colores medidos sobre esa imagen). | `assets/*.png`, `generar_sobre.py` |
| **Título** = `logo_portada.png` (se le quitó el fondo crema y se amplió ×4 con bordes nítidos: `logo_portada_hd.png`). Aparece de izquierda a derecha con una máscara que se desliza. | `.cab-logo`, `CONFIG.sobre.tiempos` (`d-titulo`, `t-titulo`) |
| **Tarjeta** nueva: papel de algodón con doble marco en relieve, como las tarjetas de la invitación (`3137f8…png`), en lugar de la hoja rasgada. Aspecto 1.30. | `tarjeta.png`, `.tarjeta` |
| Solapa al 73 % del cuerpo con punta redondeada y sombra que cae abajo a la derecha. | `.solapa`, `.solapa-rev` |

### Peso
Las 7 imágenes suman unos 2.5 MB (antes ~0.1 MB). Se descargan mientras corre el anillo de carga, antes de mostrar la portada. Para aligerarlas: en `generar_sobre.py` baja `S` (1.5 → 1.25) o reduce el grano (`fino` en `papel()`).

### Cambiar el título, los colores o la forma del sobre
- **Título**: reemplaza `logo_portada.png` (tinta oscura sobre fondo liso) y ejecuta `python generar_sobre.py logo_portada`. El texto alternativo sale de `CONFIG.sobre.nombres` y de `TXT.cab`.
- **Colores / forma / tarjeta**: `PALETA` y la geometría al inicio de `generar_sobre.py`. Requiere `pip install numpy pillow scipy`. Sin argumentos genera todo en `./salida/`; con nombres (`fondo`, `frente`, `solapa_frontal`, `solapa_reverso`, `tarjeta`, `sello`, `logo_portada`) genera solo esas piezas. Tarda ~1 minuto.
- Si cambias la altura de la solapa (`FH`), cambia también `top` y `height` de `.solapa` y `.solapa-rev` (FH / 556 = 73 %). Si cambias la tarjeta (`CARD_W`, `CARD_H`), mantén su aspecto en `.tarjeta` (`width` / `height`).

## Novedades v3.6 y cómo actualizar desde v3.5
1. **SQL**: no cambia nada (las opciones nuevas se guardan dentro de la columna `formulario`).
2. **Sitio** (sube estos archivos): `panel.html`, `assets/rsvp.js`, `assets/panel-i18n.js`, `assets/pyd-config.js` (ya trae tus llaves; solo cambia `VERSION_PANEL` y quita el bloque de «reducir movimiento» del crédito) y, en cada evento, `index.html`, `rsvp.html` y `assets/animacion.js`.
3. `assets/flip.min.js` y `assets/flip.min.css` del evento ya no se usan: puedes borrarlos.

| Cambio | Dónde |
|---|---|
| **Giro con el dedo en celulares**: en el RSVP el navegador avisaba «se perdió la captura» al empezar a arrastrar y cancelaba el giro; en la tarjeta de regalos faltaba el CSS del giro (un selector quedaba pegado al anterior). Ya se verificó con toques reales. | `rsvp.js`, `index.html` |
| **Giro sin efecto espejo (iPhone)**: ya no se usa `backface-visibility`; la cara se cambia a los 90° y sigue girando hasta 180° con el contenido nuevo. Vale para la tarjeta de regalos y para el RSVP. | `rsvp.js`, `index.html` |
| **Altura suave al girar el RSVP**: la sección pasa del alto del formulario al de la tarjeta (y al revés) junto con el giro, más despacio cuanto mayor sea la diferencia. | `rsvp.js` |
| **Animaciones siempre activas**, aunque el iPhone tenga «Reducir movimiento»: también en `rsvp.html` y en el crédito. | `rsvp.js`, `pyd-config.js` |
| **Sin «Desliza la tarjeta para girarla»** (queda «Voltear tarjeta»). | `rsvp.js` |
| **Opciones nuevas** en Configuración › Formulario RSVP: mostrar «Primera respuesta / Última modificación / Ediciones», mostrar el botón «Voltear tarjeta» y **permitir que se voltee la tarjeta** (si se desactiva, la tarjeta y el QR no se muestran ni se dibujan). | `panel.html`, `rsvp.js` |
| **rsvp.html** abre directo con el formulario/tarjeta: sin título ni fecha arriba (solo el selector ES/EN si el evento es bilingüe). | `rsvp.html` |
| **«Ceremonia & Recepción»**: `animacion.js` forzaba la opacidad final a 1 y el velo (54 %) tapaba la foto. Ahora cada elemento termina en su opacidad original de Canva. | `animacion.js` |
| **Contador propio** (tarjetas con bisagra, sin librería ni marca). | `index.html` |
| **Cámara que se aleja lentamente** (`alejar`): nueva animación de `animacion.js`, usada en la foto inicial y en la final. Parámetros: `alejarZoom`, `alejarDuracion`, `alejarUmbral`. | `animacion.js`, `index.html` |

## Novedades v3.5 y cómo actualizar desde v3.4
1. **SQL**: no cambia nada. Los tamaños se guardan dentro de las columnas `formulario` y `tarjeta` que ya existen.
2. **Sitio**: sube `panel.html`, `assets/rsvp.js` y `assets/panel-i18n.js`. **No reemplaces tu `assets/pyd-config.js`** (si quieres, cambia solo `VERSION_PANEL: 'v1.05'`).
3. **Un solo `boda-api.js`**: el de `/assets/` lo usan todos los eventos. Si hay una copia dentro de `/<evento>/assets/` (idéntica), bórrala: ninguna página la carga.

| Cambio | Dónde |
|---|---|
| **Elegir el mensaje al enviar por WhatsApp**: al pulsar el icono de WhatsApp de un invitado se abre una ventana con el mensaje a usar (*Predeterminado*, una *sugerida* o una de *Mis plantillas*), la vista previa para ese invitado y el aviso si falta `{link}`. Recuerda la última elección. | Panel › lista de invitados |
| **Tamaño de las letras del formulario**: una sola barra (50 %–200 %, por defecto 100 %) mueve todos los textos, casillas y botón a la vez. | Configuración › Formulario RSVP |
| **Tamaño de las letras de la tarjeta**: una sola barra (50 %–200 %) mueve etiqueta, nombres, fecha, lugar, mensaje y código. Si el texto no deja sitio para un QR legible, se limita solo. | Configuración › Tarjeta |
| **Tamaño del código QR**: barra 50 %–200 %. 100 % = el más grande que cabe; para agrandarlo más, reduce antes las letras. | Configuración › Tarjeta › Código QR |
| **Respaldo** retirado de Configuración. El respaldo diario con GitHub Actions y `admin_respaldo` (SQL) siguen disponibles para el administrador. | Configuración › General |

### Punto de restauración con Excel (exportar todo → importar)
Sirve para recuperar los **datos de los invitados**, no es una restauración completa:
- **Se restaura**: nombre, tratamiento, código (los links siguen funcionando), categoría, asistencia, pases asignados y confirmados, acompañantes, respuesta de los novios, mesa y WhatsApp.
- **No se restaura** (el Excel los exporta, pero la importación los ignora): respuestas de las preguntas adicionales (menú, alergias…), mensaje a los novios, marca de WhatsApp enviado, ingresos de recepción, vistas, fechas y ediciones, e historial.
- **Invitados creados después** del Excel no se borran al importar. Para volver exactamente a esa lista: *Borrar todo* y luego importar.
- **Para volver a «pendiente»** a quien ya respondió, marca *Las celdas vacías borran el valor actual* al importar; si no, las celdas vacías se ignoran y se conserva lo que había.

## Novedades v3.4 y cómo actualizar desde v3.3
1. **SQL**: vuelve a ejecutar `01_esquema.sql` completo. Es idempotente: agrega columnas y funciones nuevas y **no borra datos**. (`02_reporte_diario.sql` no cambia.)
2. **Sitio**: sube `panel.html`, `staff.html`, `sw-recepcion.js`, `assets/buscar.js`, `assets/telefono.js` y `assets/panel-i18n.js`. **No reemplaces tu `assets/pyd-config.js`** (tiene tus llaves): si quieres, cambia solo `VERSION_PANEL: 'v1.04'`.
3. **Respaldo diario**: sigue `respaldo-github/LEEME.md` (unos 10 minutos, una sola vez).

| Cambio | Dónde |
|---|---|
| **Búsqueda tolerante** en panel, recepción y RSVP: orden indistinto (Martin Picasso = Picasso Martin), sin tildes, ignora guiones y apóstrofos (Ekon = Ek-on, obrien = O'Brien), conectores y tratamientos (de, la, y, Sr., Familia), errores de tipeo y variantes fonéticas (Jonatan = Jhonatan, Picaso = Picasso). Ordena por relevancia y resalta lo encontrado | `assets/buscar.js`, `rsvp_buscar` |
| **Categoría** del invitado (etiquetas internas, varias separadas por comas): columna en Excel, filtro, búsqueda, chips en la tabla y una fila compacta de totales por categoría bajo los indicadores | Panel |
| **Teléfonos**: país por defecto en *Configuración › General*. Al importar, editar y enviar, los números sin código reciben el del país (945 709 988 → +51 945 709 988); se limpian el ´ de Excel, paréntesis y espacios. Botón *Revisar teléfonos guardados* y filtro *WhatsApp por revisar* | `assets/telefono.js` |
| **Recepción sin señal**: abre con la última lista guardada, los ingresos sin señal quedan en cola con su hora real y se envían solos; si dos celulares registran al mismo invitado, gana el registro más reciente. La lista guardada se borra al cerrar sesión | `staff.html`, `sw-recepcion.js`, `staff_ingreso` |
| **Respaldo**: descarga manual (.json) desde *Configuración › General* y respaldo diario automático con GitHub Actions, con script para restaurar | `admin_respaldo`, `respaldo-github/` |

### Reglas de búsqueda (orden de los resultados)
1. Cada palabra escrita debe aparecer en algún campo, en cualquier orden. Si ningún invitado las tiene todas, se muestran los que tienen al menos la mitad y se avisa "coincidencias parciales".
2. Por palabra vale la mejor coincidencia: exacta › inicio de palabra › nombre sin espacios (Delacruz, Ekon) › fonética (v/b, z/s/ce, ll/y, h muda, qu/k) › error de tipeo (1 letra desde 4 letras, 2 desde 7).
3. Peso del campo: nombre › acompañantes › categoría › respuestas del formulario (también por su pregunta: "alergias" lista a quienes la respondieron) › mensajes. Código exacto y mesa exacta ("mesa 5") van primero; el teléfono se busca por sus dígitos (desde 4).
4. A igualdad: nombre idéntico › mismas palabras en otro orden › nombre que empieza igual › palabras en el mismo orden › todas en el nombre › nombre más corto › alfabético.
5. Si la coincidencia no está en el nombre, la fila muestra dónde se encontró (p. ej. *Acompañantes: Ana Ruiz*, *¿Alergias…?: maní*).
6. En el RSVP del invitado se aplica la misma lógica solo sobre el nombre: si escribe sus palabras en otro orden o sin guion y hay un único invitado así, se le reconoce directamente; si no, se sugieren hasta 5 nombres (si el evento permite sugerencias).

## Instalación desde cero

1. **Base de datos** (SQL Editor):
   - Si reutilizas el proyecto donde instalaste la v3: ejecuta primero `00_reiniciar.sql` (borra todo lo nuestro).
   - Ejecuta `01_esquema.sql`. Prueba: `select public._codigo_de((select id from proyectos where slug='ignacioysuly'), 'Juan Pérez', 0);` → **YZCD**.
   - *Integrations → Cron* → **Enable**. Ejecuta `02_reporte_diario.sql`.
2. **Llaves** → `assets/pyd-config.js`:
   - `SUPABASE_URL` = Project URL.
   - `SUPABASE_ANON` = **Publishable key** (`sb_publishable_…`), en *Project Settings → API Keys*. También sirve la "anon" antigua (`eyJ…`).
   - En cada `index.html`, el `<link rel="preconnect">` con tu Project URL.
3. **Correo (Resend)**: verifica `parteydetalles.com`, crea una API key y:
   - *Authentication → Emails → SMTP Settings*: host `smtp.resend.com`, puerto `465` (o `587`), usuario `resend`, contraseña = **API key**, remitente `no-reply@parteydetalles.com`.
   - SQL: `select vault.create_secret('re_TU_API_KEY', 'resend_api_key');`
   - Pega las plantillas de `03_plantillas_correo.md`.
   - Si un correo falla: *Logs → Auth* muestra el error exacto.
4. *Authentication → URL Configuration*: Site URL y Redirect URLs = URL de tu `panel.html`. *Sign In / Providers*: **activa Allow new users to sign up** (lo usan los enlaces de registro; una cuenta sin enlace no obtiene ningún permiso). Opcional: desactiva *Confirm email* para que la cuenta quede lista al instante; si lo dejas activo, pega también la plantilla *Confirm signup*.
5. **Tu admin**: *Authentication → Users → Add user* (Auto Confirm) y
   `insert into public.miembros (email, proyecto_id, rol) values ('tu-correo@parteydetalles.com', null, 'admin');`
6. **IA (opcional)**: API key de Google AI Studio → *Edge Functions → Deploy new function → Via Editor* `generar-mensaje` (pega `index.ts`) → *Secrets*: `AI_API_KEY`. Opcional `AI_MODELS` (lista en orden).

## Si el RSVP no carga
Debajo del aviso aparece el motivo técnico entre paréntesis y en la consola del navegador:

| Mensaje | Causa |
|---|---|
| falta configurar … pyd-config.js | No editaste `SUPABASE_URL` / `SUPABASE_ANON` |
| Supabase rechazó la llave | La llave no es la Publishable key del proyecto |
| no existe la función rsvp | Falta ejecutar `01_esquema.sql` |
| evento «x» no encontrado | La carpeta no coincide con el identificador del evento. Usa `?p=identificador` o `window.BODA_PROYECTO` |

## Nuevo evento
Panel → selector de evento → **＋ Nuevo evento** → Configuración › Accesos › **Enlaces de registro**: crea un enlace *Novios* y envíaselo (cada uno crea su cuenta; los novios pueden crear enlaces *Staff* para su recepción) → sube la carpeta `/<identificador>/` con su `index.html` (cambia `window.BODA_PROYECTO` y el id de la sección de Canva) y una copia de `rsvp.html`.

## Crédito "Hecho con amor ♥ por Parte y Detalles"
Panel → Configuración → General (solo el administrador):

| Modo | Comportamiento |
|---|---|
| **Flotante** (por defecto) | Píldora de una línea abajo: se ve 4 s al entrar, se oculta al desplazarse hacia abajo y reaparece al subir o al llegar al final |
| **Discreto** | Solo un corazón pequeño en la esquina; al tocarlo muestra el crédito y se cierra solo |
| **Al final de la página** | Línea estática después del contenido |
| **No mostrar** | Sin crédito |

Una página anfitriona puede desactivarlo con `window.PYD_SIN_CREDITO = true`. En el panel y en recepción siempre va al final.

## Mis plantillas (WhatsApp)
5 espacios fijos. En cada uno: **guardar** el mensaje actual, **usar** (lo carga en el editor) y **vaciar**. El nombre se edita en el mismo espacio. Se guardan al instante; para que un mensaje sea el que se envía, cárgalo y pulsa **Guardar**.

## Imágenes propias de cada evento (carpeta `/<evento>/assets/`)
| Archivo | Uso | Recomendación |
|---|---|---|
| `rsvp_logo.png` | Logo arriba del formulario (Configuración › Formulario) | PNG transparente, ~600 px de ancho |
| `rsvp_fondo_background.png` | Fondo de la página rsvp.html | Vertical, 1080×1920 |
| `rsvp_fondo_formulario.png` | Fondo del formulario | Proporción 5×7 (1000×1400) |
| `rsvp_fondo_tarjeta.png` | Fondo de la tarjeta | 1200×1680 (5×7) |

Los fondos siempre cubren el 100 % y se centran (50 % / 50 %).

## Recepción sin señal (staff.html)
- La primera vez debe abrirse **con señal** (descarga la página, las librerías y la lista). Después abre aunque no haya internet.
- Arriba se ve el estado: *En línea*, *Sin conexión · datos de las 19:42* o *N ingresos por enviar*. Los ingresos guardados muestran ⏳.
- Si la sesión venció sin señal, el acceso ofrece **Usar la lista guardada**; los ingresos se envían al volver a iniciar sesión.
- Cerrar sesión borra la lista y la cola del celular (avisa si quedan ingresos sin enviar). La lista guardada vence a los 4 días.

## Evento desactivado
Configuración › General › *Evento activo* (solo admin). Desactivado, el RSVP sigue mostrando nombres, datos del invitado y su tarjeta, pero queda en solo lectura con el aviso "Las confirmaciones para este evento ya están cerradas".
