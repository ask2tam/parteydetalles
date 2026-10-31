# Invitación + RSVP + Panel de invitados (Supabase + Resend)

```
supabase/01_esquema.sql           Tablas, reglas, funciones RPC, seguridad (RLS) y realtime
supabase/02_reporte_diario.sql    Historial de cambios + reporte diario por correo (pg_cron + pg_net → Resend)
supabase/03_plantillas_correo.md  Correos de "restablecer contraseña" y "enlace de acceso" en español
index.html                        Tu index con el bloque RSVP nuevo y los scripts nuevos
rsvp.html                         Solo el bloque RSVP + tarjeta (por si lo pegas en otro diseño)
assets/boda-api.js · rsvp.js · qr.js · boda-staff.js
panel/index.html                  Panel de gestión (Tailwind)
```
Los demás archivos (animacion.js, responsive.js, flip.min.js, canva.css, imágenes) no cambian. `code.gs` ya no se usa.

---

## A. Una sola vez (sirve para todos tus proyectos): Resend

1. Crea una cuenta en resend.com → **Domains → Add domain** → `parteydetalles.com`.
2. Copia los registros DNS que te muestra (SPF/DKIM) en el administrador de tu dominio. Espera a que diga **Verified**.
3. **API Keys → Create API key** (permiso *Sending access*). Guárdala: se usa en B4 y B6.

## B. Por cada proyecto (boda)

1. **Supabase**: crea el proyecto → *SQL Editor* → ejecuta `01_esquema.sql`.
   Prueba: `select public._codigo_de('Juan Pérez', 0);` debe devolver **YZCD**.
2. *Integrations → Cron* → **Enable**. Luego ejecuta `02_reporte_diario.sql`.
3. **Usuarios del panel** (sin correos): *Authentication → Users → Add user → Create new user*
   con correo, contraseña temporal y **Auto Confirm User**. Luego:
   ```sql
   insert into public.miembros (email, rol) values
     ('novia@correo.com','admin'), ('novio@correo.com','admin'), ('recepcion@correo.com','seguridad');
   ```
   Pásales la contraseña temporal; la cambian desde el panel (ícono de llave).
   En *Authentication → Sign In / Providers* desactiva **Allow new users to sign up**.
4. **Correo de autenticación** (*Authentication → Emails → SMTP Settings*, activar *Custom SMTP*):
   | Campo | Valor |
   |---|---|
   | Host | `smtp.resend.com` |
   | Port | `465` |
   | Username | `resend` |
   | Password | tu API key de Resend |
   | Sender email | `no-reply@parteydetalles.com` |
   | Sender name | `Parte y Detalles` |

   Confirma los valores en la sección SMTP de Resend.
   Después sube el límite en *Authentication → Rate Limits* (p. ej. 30 correos/hora).
5. *Authentication → URL Configuration*: **Site URL** y **Redirect URLs** =
   `https://bodas.parteydetalles.com/ignacioysuly/panel/`. Pega las plantillas de `03_plantillas_correo.md`.
6. **API key para el reporte** (SQL Editor, una vez por proyecto):
   ```sql
   select vault.create_secret('re_TU_API_KEY', 'resend_api_key');
   ```
7. **Claves públicas**: *Project Settings → API* → copia **Project URL** y **anon public** en
   `assets/boda-api.js`, `panel/index.html` (CONFIG) y el `preconnect` de `index.html`.
8. **Hosting**: invitación en `…/ignacioysuly/` y panel en `…/ignacioysuly/panel/` (**mismo dominio**:
   así el modo recepción reconoce la sesión).
9. En el panel → ⚙ Configuración: fecha límite, mensaje de WhatsApp y **Reporte diario**
   (destinatarios, hora, remitente). Usa **Guardar y enviar prueba** para verificar.

## Cómo funciona el reporte diario
- Cada hora, `pg_cron` revisa; a la hora configurada (hora de Lima) arma el resumen **una vez por día**.
- **Solo se envía si algún invitado respondió, cambió su respuesta, cambió pases, dejó un mensaje o se registró solo.**
  Los cambios que hacen los novios desde el panel, las vistas, los WhatsApp y los ingresos no cuentan.
- Incluye totales con la variación desde el reporte anterior y el detalle "antes → ahora" de cada invitado.
- La prueba se envía aunque no haya cambios y **no** mueve la marca del siguiente reporte.
- Diagnóstico: Configuración muestra el último envío y la respuesta de Resend. En SQL:
  `select * from net._http_response order by id desc limit 5;`
- Si un envío falla, esos cambios no se repiten al día siguiente (sí aparecen en el panel y en los totales).

## Contraseñas
- **Cambiar**: ícono de llave en el panel (no necesita correo).
- **Olvidé mi contraseña**: llega un correo con enlace y código de 6 dígitos (el código sirve si un filtro
  corporativo "consume" el enlace). Ambos vencen en 1 hora.
- Respaldo: siempre puedes fijar una contraseña desde *Authentication → Users*.

## Reglas clave
- Una fila por invitado; cada respuesta reemplaza la anterior (el historial guarda cada cambio).
- Nombre único (sin tildes ni mayúsculas): si se repite → apellido o parentesco, `Pérez (Padre)`.
- `Pases confirmados ≤ Pases asignados` (lo valida la base de datos).
- Código: HMAC-SHA256(secreto, nombre) → 4 caracteres sin 0/O/1/I/L, calculado en la base de datos.
- Migrar desde Google Sheets: importa el Excel **con la columna Código** para conservar los links enviados.
