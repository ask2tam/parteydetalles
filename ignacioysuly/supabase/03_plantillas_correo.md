# Plantillas de correo en español (Supabase › Authentication › Emails › Templates)

Pega cada asunto y cuerpo en su plantilla. `{{ .ConfirmationURL }}` es el enlace y `{{ .Token }}` el código
(sirve cuando un filtro de correo corporativo "consume" el enlace antes de que lo abras).

## Reset Password
**Asunto:** Restablece tu contraseña del panel de invitados

```html
<div style="font-family:Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#2b2622">
  <p style="font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#b08d57;margin:0">Panel de invitados</p>
  <h2 style="font-family:Georgia,serif;font-weight:400;margin:6px 0 16px">Restablecer contraseña</h2>
  <p>Recibimos una solicitud para cambiar tu contraseña. Pulsa el botón para crear una nueva:</p>
  <p style="text-align:center;margin:24px 0">
    <a href="{{ .ConfirmationURL }}" style="background:#b9966f;color:#fff;text-decoration:none;padding:12px 26px;border-radius:999px;font-weight:600">Crear nueva contraseña</a></p>
  <p>¿El enlace no funciona? En el panel elige “¿Olvidaste tu contraseña?” y escribe este código:</p>
  <p style="font-size:26px;letter-spacing:8px;font-weight:700;text-align:center;margin:12px 0">{{ .Token }}</p>
  <p style="font-size:12px;color:#9a8f85">El enlace y el código vencen en 1 hora y sirven una sola vez. Si no lo pediste, ignora este correo: tu contraseña no cambiará.</p>
</div>
```

## Magic Link
**Asunto:** Tu enlace de acceso al panel de invitados

```html
<div style="font-family:Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#2b2622">
  <p style="font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#b08d57;margin:0">Panel de invitados</p>
  <h2 style="font-family:Georgia,serif;font-weight:400;margin:6px 0 16px">Ingresa al panel</h2>
  <p style="text-align:center;margin:24px 0">
    <a href="{{ .ConfirmationURL }}" style="background:#b9966f;color:#fff;text-decoration:none;padding:12px 26px;border-radius:999px;font-weight:600">Ingresar</a></p>
  <p style="font-size:12px;color:#9a8f85">Ábrelo en el mismo dispositivo donde lo pediste. Vence en 1 hora y sirve una sola vez.</p>
</div>
```
