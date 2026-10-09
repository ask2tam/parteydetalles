# RSVP con Google Sheets + Apps Script

Archivos: `Code.gs` (backend), `rsvp.html` (marcado + CSS), `rsvp.js` (lógica).

## 1. Estructura del Google Sheets

Se crean 4 hojas al ejecutar `configurarHoja()`.

### Hoja `RSVP` (1 fila por invitado)

| Col | Encabezado | Quién la escribe | Contenido |
|---|---|---|---|
| A | Nombre del invitado | Script o novios | Nombre único. Es la identidad (se compara sin tildes ni mayúsculas) |
| B | Asistencia a la boda | Script | `Sí` / `No` |
| C | N.º acompañantes | Script | Número (0 si va solo) |
| D | Acompañantes | Script | Nombres separados por ` \| ` |
| E | Eventos previos | Script | Etiquetas separadas por ` \| ` |
| F | Restricciones alimentarias | Script | Texto libre |
| G | Mensaje a los novios | Script | Texto libre |
| H | Primera respuesta | Script | Fecha y hora, no cambia al editar |
| I | Última modificación | Script | Fecha y hora, se actualiza en cada guardado |
| J | N.º de ediciones | Script | 0 en la primera respuesta, +1 en cada cambio |
| **K** | **Respuesta de los novios** | **Novios** | Lo que escribas aquí se muestra al invitado en la invitación |
| **L** | **Notas internas** | **Novios** | Privado: el script nunca lo devuelve |

- **Los novios pueden precargar la lista de invitados:** escribe solo la columna A. La fila queda "pendiente" hasta que el invitado responda, y su respuesta rellena esa misma fila.
- El script solo escribe A–J, así que K y L nunca se pisan.
- Puedes filtrar, ordenar y corregir datos a mano. No borres filas con respuestas en curso.

### Hoja `Eventos`
| A: Evento previo (texto que ve el invitado) | B: Activo |
|---|---|
| 18 SEP. WELCOME COCKTAIL | SÍ |
| 19 SEP. BEACH DAY | SÍ |

Agrega o apaga eventos con `SÍ`/`NO`. **No cambies el texto de un evento** una vez que haya respuestas: se guarda el texto tal cual.

### Hoja `Config` (Clave | Valor | Qué hace)
| Clave | Valor inicial | Efecto |
|---|---|---|
| `max_acompanantes` | 2 | Tope del selector − / +. `0` oculta la sección |
| `fecha_limite` | vacío | Pasado ese día no se puede guardar, pero sí consultar |
| `solo_invitados_de_lista` | NO | `SÍ` = solo responden los nombres ya cargados en `RSVP` |
| `email_aviso` | vacío | Correo que recibe un aviso por cada respuesta (~100/día) |

### Hoja `Resumen` (solo fórmulas)
Invitados en lista, con respuesta, pendientes, asisten, no asisten, acompañantes, total de personas y conteo por evento previo (cuenta invitados, no acompañantes).

## 2. Despliegue

1. Crea la hoja de Google, ve a **Extensiones > Apps Script** y pega `Code.gs`.
2. En **Configuración del proyecto**, marca "Mostrar archivo de manifiesto" y confirma `"timeZone": "America/Lima"`.
3. Ejecuta `configurarHoja()` y acepta los permisos (hojas y correo).
4. **Implementar > Nueva implementación > Aplicación web**: *Ejecutar como* **Yo**, *Acceso* **Cualquier persona**. Copia la URL que termina en `/exec`.
5. En `rsvp.html` pega la URL en `window.RSVP_CONFIG.url`.
6. Para integrarlo en la invitación de Canva, copia el `<style>`, el `<section id="rsvp">`, el bloque `RSVP_CONFIG` y `<script src="rsvp.js">`.
7. Si cambias `Code.gs` luego, crea una **nueva versión** de la implementación (la URL se mantiene).

## 3. Reglas de negocio

- **Unicidad:** `María Pérez`, `maria perez` y ` MARÍA  PÉREZ ` son el mismo invitado.
- **Reingreso:** al escribir un nombre con respuesta guardada, aparece "¿Eres tú?". Si confirma, se carga todo (asistencia, acompañantes, eventos, restricciones, mensaje, fechas y la respuesta de los novios) y el botón pasa a "Actualizar confirmación".
- **Mismo dispositivo:** tras guardar, el navegador recuerda el nombre y carga la respuesta solo al volver.
- **Nombre repetido:** si es otra persona, el formulario propone agregar apellido o parentesco con botones `(Padre)`, `(Hijo)`, etc. El servidor rechaza igualmente un duplicado (`DUPLICADO`).
- **Acompañantes:** interruptor "¿Vendrás acompañado/a?" y selector − / + hasta el máximo. Pulsar − en 1 apaga el interruptor.
- **Mensaje a los novios:** desplegable; se abre solo si ya había mensaje.
- **Si responde "No":** se limpian acompañantes, eventos y restricciones, pero el mensaje se conserva.

## 4. API (Web App)

| Método | Parámetros | Devuelve |
|---|---|---|
| GET | `action=config` | eventos activos, máximo de acompañantes, `cerrado` |
| GET | `action=buscar&nombre=` | `existe`, `permitido`, fechas (sin contenido) |
| GET | `action=cargar&nombre=` | `registro` completo (sin notas internas) |
| POST `text/plain` | `{action:'guardar', modo:'nuevo'\|'editar', nombre, asistencia, acompanantes[], eventos[], restricciones, mensaje}` | `registro`, `esNuevo` |

Errores: `DUPLICADO`, `NO_ENCONTRADO`, `NO_EN_LISTA`, `CERRADO`, `MUCHOS_ACOMPANANTES`, `OCUPADO`, `RED`.

## 5. Límites y seguridad

- **La identidad es el nombre.** Cualquiera que conozca el nombre exacto de un invitado puede cargar y editar su respuesta. Para una boda es suficiente, pero si quieres más control puedo agregar una clave de 4 dígitos por invitado.
- Los textos se validan en el servidor (largos, eventos válidos, máximo de acompañantes) y se neutralizan fórmulas (`=`, `+`, `-`, `@`).
- Las escrituras usan `LockService`, así que dos envíos simultáneos no se pisan.
- La primera llamada tras un rato inactivo puede tardar 1–3 s (arranque en frío de Apps Script).
