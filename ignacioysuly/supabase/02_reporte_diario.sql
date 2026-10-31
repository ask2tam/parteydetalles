-- =====================================================================================
-- Historial de cambios + Reporte diario por correo (solo si hubo cambios)
-- Requisitos: 01_esquema.sql ya ejecutado. Ejecutar completo en el SQL Editor.
-- El correo sale directo desde la base de datos hacia la API de Resend (pg_net):
-- no hay Edge Function que desplegar. Idempotente.
--
-- ANTES de activarlo, guarda tu API key de Resend en Vault (una sola vez):
--   select vault.create_secret('re_XXXXXXXXXXXX', 'resend_api_key');
-- Para cambiarla:
--   select vault.update_secret((select id from vault.secrets where name = 'resend_api_key'), 're_NUEVA');
-- =====================================================================================

create extension if not exists pg_net with schema extensions;   -- sus funciones quedan en el esquema "net"
create extension if not exists pg_cron with schema pg_catalog;  -- si falla: Integrations > Cron > Enable, y vuelve a ejecutar

-- -------------------------------------------------------------------------------------
-- 1. CONFIGURACIÓN DEL REPORTE (se edita desde Panel > Configuración)
-- -------------------------------------------------------------------------------------
alter table public.config
  add column if not exists reporte_activo           boolean not null default false,
  add column if not exists reporte_destinatarios    text    not null default '',     -- correos separados por coma
  add column if not exists reporte_hora             int     not null default 8 check (reporte_hora between 0 and 23),
  add column if not exists zona_horaria             text    not null default 'America/Lima',
  add column if not exists reporte_remitente        text    not null default 'Parte y Detalles <no-reply@parteydetalles.com>',
  add column if not exists url_panel                text    not null default 'https://bodas.parteydetalles.com/ignacioysuly/panel/',
  add column if not exists reporte_ultimo_envio     timestamptz,   -- marca "desde" del siguiente reporte
  add column if not exists reporte_ultima_revision  date,          -- evita revisar dos veces el mismo día
  add column if not exists reporte_ultimos_kpis     jsonb,         -- para mostrar variación (+3, −1)
  add column if not exists reporte_ultimo_resultado jsonb;         -- id de la petición HTTP y resumen

-- -------------------------------------------------------------------------------------
-- 2. HISTORIAL: una fila por cada cambio relevante de un invitado
--    (no registra vistas, envíos de WhatsApp ni ingresos)
-- -------------------------------------------------------------------------------------
create table if not exists public.historial (
  id          bigint generated always as identity primary key,
  invitado_id bigint,
  codigo      text,
  nombre      text,
  evento      text not null check (evento in ('nuevo', 'cambio', 'eliminado')),
  origen      text not null check (origen in ('invitado', 'panel')),
  usuario     text,                                  -- correo de quien editó desde el panel
  antes       jsonb,
  despues     jsonb,
  creado      timestamptz not null default now()
);
create index if not exists historial_creado_idx on public.historial (creado);
create index if not exists historial_invitado_idx on public.historial (invitado_id);

create or replace function public._estado_rsvp(i public.invitados) returns jsonb
language sql stable as $$
  select jsonb_build_object(
    'nombre', i.nombre, 'tratamiento', i.tratamiento, 'asistencia', i.asistencia,
    'pases_asignados', i.pases_asignados, 'pases_confirmados', i.pases_confirmados,
    'mensaje', i.mensaje, 'mesa', i.mesa, 'respuesta_novios', i.respuesta_novios)
$$;

-- origen: 'invitado' si vino de la invitación (rol anon, sin correo); 'panel' si hay sesión
create or replace function public._invitados_historial() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  em  text := nullif(auth.jwt() ->> 'email', '');
  org text := case when nullif(auth.jwt() ->> 'email', '') is null then 'invitado' else 'panel' end;
  a jsonb; d jsonb;
begin
  if tg_op = 'INSERT' then
    insert into public.historial (invitado_id, codigo, nombre, evento, origen, usuario, antes, despues)
    values (new.id, new.codigo, new.nombre, 'nuevo', org, em, null, public._estado_rsvp(new));
  elsif tg_op = 'UPDATE' then
    a := public._estado_rsvp(old);
    d := public._estado_rsvp(new);
    if a is distinct from d then
      insert into public.historial (invitado_id, codigo, nombre, evento, origen, usuario, antes, despues)
      values (new.id, new.codigo, new.nombre, 'cambio', org, em, a, d);
    end if;
  else
    insert into public.historial (invitado_id, codigo, nombre, evento, origen, usuario, antes, despues)
    values (old.id, old.codigo, old.nombre, 'eliminado', org, em, public._estado_rsvp(old), null);
  end if;
  return null;
end $$;
drop trigger if exists invitados_historial on public.invitados;
create trigger invitados_historial after insert or update or delete on public.invitados
  for each row execute function public._invitados_historial();

alter table public.historial enable row level security;
drop policy if exists historial_admin_leer on public.historial;
create policy historial_admin_leer on public.historial for select to authenticated using (public.es_admin());
revoke all on public.historial from anon;

-- "Borrar todo" también limpia el historial
create or replace function public.admin_borrar_todo(p_confirmacion text) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare n int;
begin
  if not public.es_admin() then raise exception 'no_autorizado'; end if;
  if p_confirmacion is distinct from 'BORRAR' then raise exception 'confirmacion_invalida'; end if;
  delete from public.invitados where true;
  get diagnostics n = row_count;
  delete from public.historial where true;
  update public.config set reporte_ultimos_kpis = null where id = 1;
  return jsonb_build_object('ok', true, 'borrados', n);
end $$;

-- -------------------------------------------------------------------------------------
-- 3. DATOS DEL REPORTE
-- -------------------------------------------------------------------------------------
create or replace function public._kpis() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'invitados',        count(*),
    'asignados',        coalesce(sum(pases_asignados), 0),
    'si',               count(*) filter (where asistencia = 'si'),
    'pases_si',         coalesce(sum(pases_confirmados) filter (where asistencia = 'si'), 0),
    'no',               count(*) filter (where asistencia = 'no'),
    'pases_no',         coalesce(sum(pases_asignados) filter (where asistencia = 'no'), 0),
    'pendientes',       count(*) filter (where asistencia is null),
    'pases_pendientes', coalesce(sum(pases_asignados) filter (where asistencia is null), 0),
    'abrieron',         count(*) filter (where vistas > 0))
  from public.invitados
$$;

-- Cambios hechos por los INVITADOS desde p_desde, agrupados por invitado (primer "antes" → último "después")
create or replace function public._reporte_datos(p_desde timestamptz) returns jsonb
language sql stable security definer set search_path = public as $$
  with h as (
    select * from public.historial
     where creado > p_desde and origen = 'invitado' and evento <> 'eliminado'
  ), g as (
    select invitado_id,
           (array_agg(antes   order by creado))[1]      as antes,
           (array_agg(despues order by creado desc))[1] as despues,
           (array_agg(codigo  order by creado desc))[1] as codigo,
           (array_agg(nombre  order by creado desc))[1] as nombre,
           bool_or(evento = 'nuevo')                     as nuevo,
           max(creado)                                   as ultimo
      from h group by invitado_id
  )
  select jsonb_build_object(
    'kpis', public._kpis(),
    'cambios', coalesce((
      select jsonb_agg(jsonb_build_object('codigo', codigo, 'nombre', nombre, 'nuevo', nuevo,
                                          'antes', antes, 'despues', despues, 'ultimo', ultimo) order by ultimo desc)
        from g where nuevo or antes is distinct from despues), '[]'::jsonb))
$$;

-- -------------------------------------------------------------------------------------
-- 4. HTML DEL CORREO (estilos en línea: compatible con Gmail, Outlook y Apple Mail)
-- -------------------------------------------------------------------------------------
create or replace function public._h(t text) returns text
language sql immutable as $$
  select replace(replace(replace(replace(coalesce(t, ''), '&', '&amp;'), '<', '&lt;'), '>', '&gt;'), '"', '&quot;')
$$;

create or replace function public._estado_txt(j jsonb) returns text
language sql immutable as $$
  select case j ->> 'asistencia'
    when 'si' then 'Asistirá · ' || coalesce(j ->> 'pases_confirmados', j ->> 'pases_asignados') || ' de '
                   || (j ->> 'pases_asignados') || case when (j ->> 'pases_asignados') = '1' then ' pase' else ' pases' end
    when 'no' then 'No asistirá'
    else 'Pendiente' end
$$;

create or replace function public._delta(p_k jsonb, p_prev jsonb, p_campo text) returns text
language sql immutable as $$
  select case
    when p_prev is null or p_prev ->> p_campo is null then ''
    when (p_k ->> p_campo)::int > (p_prev ->> p_campo)::int
      then ' <span style="font-size:13px;color:#7a7066">+' || ((p_k ->> p_campo)::int - (p_prev ->> p_campo)::int) || '</span>'
    when (p_k ->> p_campo)::int < (p_prev ->> p_campo)::int
      then ' <span style="font-size:13px;color:#7a7066">&minus;' || ((p_prev ->> p_campo)::int - (p_k ->> p_campo)::int) || '</span>'
    else '' end
$$;

create or replace function public._kpi_celda(p_titulo text, p_valor text, p_delta text, p_sub text, p_color text) returns text
language sql immutable as $$
  select '<td width="50%" style="padding:12px;background:#f7f3ee;border-radius:10px;vertical-align:top">'
      || '<div style="font-size:12px;color:#7a7066">' || p_titulo || '</div>'
      || '<div style="font-size:24px;font-weight:700;color:' || p_color || ';margin-top:2px">' || p_valor || p_delta || '</div>'
      || '<div style="font-size:11px;color:#9a8f85;margin-top:2px">' || p_sub || '</div></td>'
$$;

create or replace function public._reporte_html(p_datos jsonb, p_prev jsonb, p_desde timestamptz, p_prueba boolean) returns text
language plpgsql stable security definer set search_path = public as $$
declare
  c       public.config;
  k       jsonb := p_datos -> 'kpis';
  n       int   := jsonb_array_length(p_datos -> 'cambios');
  e jsonb; a jsonb; d jsonb;
  filas   text := '';
  titulo  text; detalle text; tasa int; html text;
begin
  select * into c from public.config where id = 1;
  tasa := case when (k ->> 'invitados')::int > 0
               then round(100.0 * ((k ->> 'si')::int + (k ->> 'no')::int) / (k ->> 'invitados')::int) else 0 end;

  for e in select value from jsonb_array_elements(p_datos -> 'cambios') loop
    a := e -> 'antes';  if jsonb_typeof(a) = 'null' then a := null; end if;
    d := e -> 'despues';
    titulo := case
      when (e ->> 'nuevo')::boolean                                         then 'Se registró desde la invitación'
      when a ->> 'asistencia' is null and d ->> 'asistencia' is not null    then 'Nueva respuesta'
      when a ->> 'asistencia' is distinct from d ->> 'asistencia'           then 'Cambió su respuesta'
      when a ->> 'pases_confirmados' is distinct from d ->> 'pases_confirmados' then 'Cambió sus pases'
      when a ->> 'mensaje' is distinct from d ->> 'mensaje'                 then 'Actualizó su mensaje'
      else 'Actualizó sus datos' end;
    detalle := public._estado_txt(d);
    if a is not null and a ->> 'asistencia' is not null and public._estado_txt(a) <> public._estado_txt(d) then
      detalle := detalle || ' <span style="color:#9a8f85">(antes: ' || public._estado_txt(a) || ')</span>';
    end if;
    if coalesce(d ->> 'mesa', '') <> '' and d ->> 'asistencia' = 'si' then
      detalle := detalle || ' · Mesa ' || public._h(d ->> 'mesa');
    end if;
    if coalesce(d ->> 'mensaje', '') <> '' and (a is null or a ->> 'mensaje' is distinct from d ->> 'mensaje') then
      detalle := detalle || '<div style="margin-top:6px;padding:8px 10px;background:#fbf6ea;border-radius:8px;font-style:italic;color:#4a4038">&ldquo;'
                         || public._h(d ->> 'mensaje') || '&rdquo;</div>';
    end if;
    filas := filas
      || '<tr><td style="padding:12px 0;border-top:1px solid #eee6dc;vertical-align:top">'
      || '<div style="font-weight:600;color:#2b2622;font-size:15px">' || public._h(e ->> 'nombre') || '</div>'
      || '<div style="font-size:12px;color:#9a8f85;margin-top:2px">' || titulo || ' &middot; ' || public._h(e ->> 'codigo') || ' &middot; '
      || to_char((e ->> 'ultimo')::timestamptz at time zone c.zona_horaria, 'DD/MM HH24:MI') || '</div>'
      || '<div style="font-size:14px;color:#4a4038;margin-top:6px">' || detalle || '</div></td></tr>';
  end loop;
  if n = 0 then
    filas := '<tr><td style="padding:12px 0;border-top:1px solid #eee6dc;color:#9a8f85;font-size:14px">No hubo respuestas nuevas en este periodo.</td></tr>';
  end if;

  html :=
       '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>'
    || '<body style="margin:0;padding:0;background:#f1ece4;font-family:Helvetica,Arial,sans-serif">'
    || '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1ece4"><tr><td align="center" style="padding:24px 12px">'
    || '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:16px"><tr><td style="padding:28px 24px">'
    || '<div style="font-size:11px;letter-spacing:3px;color:#b08d57;text-transform:uppercase">'
    || case when p_prueba then 'Reporte de prueba' else 'Reporte diario RSVP' end || '</div>'
    || '<h1 style="margin:6px 0 4px;font-family:Georgia,serif;font-weight:400;font-size:28px;color:#2b2622">' || public._h(c.proyecto) || '</h1>'
    || '<p style="margin:0 0 18px;color:#7a7066;font-size:13px">Cambios desde el '
    || to_char(p_desde at time zone c.zona_horaria, 'DD/MM/YYYY HH24:MI') || ' hasta el '
    || to_char(now() at time zone c.zona_horaria, 'DD/MM/YYYY HH24:MI') || '</p>'
    || '<table role="presentation" width="100%" cellpadding="0" cellspacing="6" style="border-collapse:separate"><tr>'
    || public._kpi_celda('Asistirán', k ->> 'pases_si', public._delta(k, p_prev, 'pases_si'), 'pases &middot; ' || (k ->> 'si') || ' registros', '#3f7a46')
    || public._kpi_celda('No asistirán', k ->> 'no', public._delta(k, p_prev, 'no'), (k ->> 'pases_no') || ' pases liberados', '#b3402f')
    || '</tr><tr>' || public._kpi_celda('Pendientes', k ->> 'pendientes', public._delta(k, p_prev, 'pendientes'), (k ->> 'pases_pendientes') || ' pases por confirmar', '#a16207')
    || public._kpi_celda('Invitados', k ->> 'invitados', public._delta(k, p_prev, 'invitados'), (k ->> 'asignados') || ' pases asignados', '#2b2622')
    || '</tr></table>'
    || '<p style="margin:14px 0 0;font-size:13px;color:#7a7066">Tasa de respuesta: <b style="color:#2b2622">' || tasa || '%</b> &middot; '
    || (k ->> 'abrieron') || ' de ' || (k ->> 'invitados') || ' abrieron la invitación</p>'
    || '<h2 style="margin:24px 0 4px;font-size:16px;color:#2b2622">'
    || case when n = 0 then 'Sin cambios' when n = 1 then '1 invitado con cambios' else n || ' invitados con cambios' end || '</h2>'
    || '<table role="presentation" width="100%" cellpadding="0" cellspacing="0">' || filas || '</table>'
    || '<p style="margin:26px 0 0;text-align:center"><a href="' || public._h(c.url_panel)
    || '" style="display:inline-block;background:#b9966f;color:#ffffff;text-decoration:none;padding:12px 26px;border-radius:999px;font-weight:600;font-size:14px">Abrir panel de invitados</a></p>'
    || '</td></tr></table>'
    || '<p style="max-width:600px;margin:16px auto 0;color:#9a8f85;font-size:11px;line-height:1.5">Recibes este correo porque figuras como destinatario del reporte de '
    || public._h(c.proyecto) || '. Solo se envía los días en que hubo respuestas nuevas. Puedes desactivarlo en Panel &rsaquo; Configuración.</p>'
    || '</td></tr></table></body></html>';
  return html;
end $$;

-- -------------------------------------------------------------------------------------
-- 5. ENVÍO (Resend vía pg_net) Y PROGRAMACIÓN
-- -------------------------------------------------------------------------------------
create or replace function public._reporte_destinatarios(p text) returns text[]
language sql immutable as $$
  select coalesce(array_agg(distinct lower(x)), '{}')
    from unnest(regexp_split_to_array(coalesce(p, ''), '[,;[:space:]]+')) x
   where x ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
$$;

-- p_prueba = true: se envía aunque no haya cambios y NO mueve la marca "desde"
create or replace function public._reporte_enviar(p_prueba boolean default false) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  c      public.config;
  dest   text[];
  clave  text;
  desde  timestamptz;
  datos  jsonb;
  n      int;
  asunto text;
  req    bigint;
  hoy    date;
begin
  select * into c from public.config where id = 1 for update;
  hoy  := (now() at time zone c.zona_horaria)::date;
  dest := public._reporte_destinatarios(c.reporte_destinatarios);
  if cardinality(dest) = 0 then return jsonb_build_object('ok', false, 'error', 'sin_destinatarios'); end if;
  select decrypted_secret into clave from vault.decrypted_secrets where name = 'resend_api_key';
  if clave is null then return jsonb_build_object('ok', false, 'error', 'sin_api_key'); end if;

  desde := coalesce(c.reporte_ultimo_envio, now() - interval '1 day');
  datos := public._reporte_datos(desde);
  n     := jsonb_array_length(datos -> 'cambios');

  if n = 0 and not p_prueba then
    update public.config set reporte_ultima_revision = hoy where id = 1;
    return jsonb_build_object('ok', true, 'enviado', false, 'motivo', 'sin_cambios');
  end if;

  asunto := case when p_prueba then '[Prueba] ' else '' end || 'RSVP ' || c.proyecto || ' · '
         || case when n = 0 then 'sin cambios' when n = 1 then '1 cambio' else n || ' cambios' end
         || ' · ' || to_char(now() at time zone c.zona_horaria, 'DD/MM');

  select net.http_post(
           url     := 'https://api.resend.com/emails',
           body    := jsonb_build_object('from', c.reporte_remitente, 'to', to_jsonb(dest), 'subject', asunto,
                                         'html', public._reporte_html(datos, c.reporte_ultimos_kpis, desde, p_prueba)),
           headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || clave),
           timeout_milliseconds := 15000)
    into req;

  update public.config set
    reporte_ultima_revision  = case when p_prueba then reporte_ultima_revision else hoy end,
    reporte_ultimo_envio     = case when p_prueba then reporte_ultimo_envio else now() end,
    reporte_ultimos_kpis     = case when p_prueba then reporte_ultimos_kpis else datos -> 'kpis' end,
    reporte_ultimo_resultado = jsonb_build_object('request_id', req, 'fecha', now(), 'prueba', p_prueba,
                                                  'cambios', n, 'destinatarios', to_jsonb(dest))
  where id = 1;
  return jsonb_build_object('ok', true, 'enviado', true, 'request_id', req, 'cambios', n);
end $$;

-- Se ejecuta cada hora; envía solo a la hora configurada (hora local) y una vez por día
create or replace function public._reporte_tick() returns void
language plpgsql volatile security definer set search_path = public as $$
declare c public.config;
begin
  select * into c from public.config where id = 1;
  if c.id is null or not c.reporte_activo then return; end if;
  if extract(hour from now() at time zone c.zona_horaria)::int <> c.reporte_hora then return; end if;
  if c.reporte_ultima_revision is not distinct from (now() at time zone c.zona_horaria)::date then return; end if;
  perform public._reporte_enviar(false);
end $$;

select cron.schedule('reporte-rsvp', '0 * * * *', 'select public._reporte_tick()');

-- -------------------------------------------------------------------------------------
-- 6. API DEL PANEL (solo admin)
-- -------------------------------------------------------------------------------------
create or replace function public.admin_reporte_probar() returns jsonb
language plpgsql volatile security definer set search_path = public as $$
begin
  if not public.es_admin() then raise exception 'no_autorizado'; end if;
  return public._reporte_enviar(true);
end $$;

create or replace function public.admin_reporte_vista_previa() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare c public.config; desde timestamptz; datos jsonb;
begin
  if not public.es_admin() then raise exception 'no_autorizado'; end if;
  select * into c from public.config where id = 1;
  desde := coalesce(c.reporte_ultimo_envio, now() - interval '1 day');
  datos := public._reporte_datos(desde);
  return jsonb_build_object('ok', true, 'desde', desde, 'cambios', jsonb_array_length(datos -> 'cambios'),
                            'html', public._reporte_html(datos, c.reporte_ultimos_kpis, desde, false));
end $$;

-- Estado: último envío, respuesta de Resend (pg_net la conserva ~6 h) y verificaciones
create or replace function public.admin_reporte_estado() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare c public.config; r record; resp jsonb := null;
begin
  if not public.es_admin() then raise exception 'no_autorizado'; end if;
  select * into c from public.config where id = 1;
  if c.reporte_ultimo_resultado ? 'request_id' then
    select status_code, error_msg, timed_out, left(content, 300) as content into r
      from net._http_response where id = (c.reporte_ultimo_resultado ->> 'request_id')::bigint;
    if found then
      resp := jsonb_build_object('status', r.status_code, 'error', r.error_msg, 'timeout', r.timed_out, 'detalle', r.content);
    end if;
  end if;
  return jsonb_build_object('ok', true,
    'ultimo_envio', c.reporte_ultimo_envio, 'ultima_revision', c.reporte_ultima_revision,
    'resultado', c.reporte_ultimo_resultado, 'respuesta', resp,
    'tiene_api_key', exists (select 1 from vault.secrets where name = 'resend_api_key'),
    'programado', exists (select 1 from cron.job where jobname = 'reporte-rsvp' and active),
    'destinatarios_validos', to_jsonb(public._reporte_destinatarios(c.reporte_destinatarios)));
end $$;

-- -------------------------------------------------------------------------------------
-- 7. PERMISOS de las funciones nuevas
-- -------------------------------------------------------------------------------------
revoke execute on function
  public._estado_rsvp(public.invitados), public._invitados_historial(), public._kpis(),
  public._reporte_datos(timestamptz), public._h(text), public._estado_txt(jsonb), public._delta(jsonb, jsonb, text),
  public._kpi_celda(text, text, text, text, text), public._reporte_html(jsonb, jsonb, timestamptz, boolean),
  public._reporte_destinatarios(text), public._reporte_enviar(boolean), public._reporte_tick(),
  public.admin_reporte_probar(), public.admin_reporte_vista_previa(), public.admin_reporte_estado()
  from public, anon, authenticated;
grant execute on function public.admin_reporte_probar(), public.admin_reporte_vista_previa(), public.admin_reporte_estado()
  to authenticated;

-- Pruebas manuales en el SQL Editor:
--   select public.admin_reporte_estado();          -- (como postgres falla es_admin: usa _reporte_enviar)
--   select public._reporte_enviar(true);           -- envía un reporte de prueba
--   select * from net._http_response order by id desc limit 5;   -- respuesta de Resend
--   select * from cron.job_run_details where jobid = (select jobid from cron.job where jobname = 'reporte-rsvp') order by start_time desc limit 5;
