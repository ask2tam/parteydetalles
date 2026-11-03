# Parte y Detalles · Invitaciones + RSVP + Panel · v3.4 (versión completa)

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
