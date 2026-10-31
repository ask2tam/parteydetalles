-- =====================================================================================
-- RSVP + Panel de Gestión de Invitados · Supabase (Postgres)
-- Ejecutar completo en: Supabase > SQL Editor > New query > Run
-- Es idempotente: se puede volver a ejecutar para actualizar funciones.
-- =====================================================================================

create extension if not exists pgcrypto with schema extensions;
create extension if not exists unaccent with schema extensions;

-- -------------------------------------------------------------------------------------
-- 1. TABLAS
-- -------------------------------------------------------------------------------------

-- Parámetros del proyecto (una sola fila). Se editan desde el Panel > Configuración.
create table if not exists public.config (
  id               int primary key default 1 check (id = 1),
  proyecto         text not null default 'Ignacio & Suly',
  url_base         text not null default 'https://bodas.parteydetalles.com/ignacioysuly?to=',
  fecha_limite     timestamptz,                         -- null = RSVP sin fecha de cierre
  permitir_nuevos  boolean not null default true,       -- invitados sin código pueden crear su registro
  pases_max        int not null default 10 check (pases_max between 1 and 50),
  codigo_pais      text not null default '51',          -- prefijo para números de WhatsApp de 9 dígitos
  mensaje_whatsapp text not null default
    E'Hola {tratamiento} {nombre} 💛\n\nCon mucha alegría te compartimos nuestra invitación. Tienes {pases} reservado(s) para ti.\n\nConfirma tu asistencia aquí antes del {fecha_limite}:\n{link}\n\nCon cariño,\n{novios}',
  actualizado      timestamptz not null default now()
);
insert into public.config (id) values (1) on conflict (id) do nothing;

-- Secretos: sin políticas RLS ni permisos → solo lo leen las funciones SECURITY DEFINER.
create table if not exists public._secretos (clave text primary key, valor text not null);
insert into public._secretos (clave, valor) values ('hash_codigo', 'ignacioysuly-parteydetalles')
  on conflict (clave) do nothing;   -- NO cambiarlo después de enviar links

-- Quién entra al panel. rol: admin (todo) | seguridad (solo registro de ingreso desde el QR)
create table if not exists public.miembros (
  email  text primary key,
  rol    text not null check (rol in ('admin', 'seguridad')),
  creado timestamptz not null default now()
);

-- UNA fila por invitado: cada respuesta reemplaza los valores de su fila.
create table if not exists public.invitados (
  id                  bigint generated always as identity primary key,
  nombre              text not null check (char_length(btrim(nombre)) between 2 and 80),
  nombre_norm         text not null,                    -- clave de unicidad (sin tildes, minúsculas)
  tratamiento         text not null default '',
  codigo              text not null unique check (codigo ~ '^[A-Z0-9]{4,8}$'),
  asistencia          text check (asistencia in ('si', 'no')),
  pases_asignados     int  not null default 1 check (pases_asignados between 1 and 50),
  pases_confirmados   int  check (pases_confirmados >= 0),
  mensaje             text not null default '',
  respuesta_novios    text not null default '',
  mesa                text not null default '',
  telefono            text not null default '',
  fecha_registro      timestamptz not null default now(),
  primera_vista       timestamptz,
  ultima_vista        timestamptz,
  vistas              int  not null default 0,
  primera_respuesta   timestamptz,
  ultima_modificacion timestamptz,
  ediciones           int  not null default 0,
  whatsapp_enviado    timestamptz,
  ingreso_pases       int  not null default 0 check (ingreso_pases >= 0),
  ingreso_fecha       timestamptz,
  origen              text not null default 'panel' check (origen in ('panel', 'importacion', 'invitacion')),
  actualizado         timestamptz not null default now(),
  constraint pases_confirmados_max check (pases_confirmados is null or pases_confirmados <= pases_asignados),
  constraint ingreso_max check (ingreso_pases <= pases_asignados)
);
create unique index if not exists invitados_nombre_norm_uk on public.invitados (nombre_norm);

-- -------------------------------------------------------------------------------------
-- 2. UTILIDADES
-- -------------------------------------------------------------------------------------

-- Igual que normalizar_() del Apps Script anterior: sin tildes, minúsculas, espacios simples.
create or replace function public.normalizar(t text) returns text
language sql immutable parallel safe set search_path = public, extensions as $$
  select lower(btrim(regexp_replace(
           extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(t, '')), '\s+', ' ', 'g')))
$$;

create or replace function public._entero(t text) returns int
language sql immutable as $$
  select case when btrim(coalesce(t, '')) ~ '^-?\d{1,6}$' then btrim(t)::int end
$$;

-- Código de 4 caracteres: HMAC-SHA256(secreto, nombre normalizado [+ '#k']) → 4 bytes → base 31.
-- Mismo algoritmo que el Apps Script anterior (compatible con códigos ya generados).
-- 31 caracteres sin 0/O/1/I/L → 31^4 = 923 521 combinaciones; no secuencial ni deducible sin el secreto.
create or replace function public._codigo_de(p_nombre text, p_intento int) returns text
language plpgsql stable security definer set search_path = public, extensions as $$
declare
  alf  constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  msg  text := public.normalizar(p_nombre) || case when p_intento > 0 then '#' || p_intento else '' end;
  k    text;
  b    bytea;
  n    bigint;
  sal  text := '';
begin
  select valor into k from public._secretos where clave = 'hash_codigo';
  b := extensions.hmac(convert_to(msg, 'UTF8'), convert_to(k, 'UTF8'), 'sha256');
  n := (((get_byte(b, 0)::bigint * 256 + get_byte(b, 1)) * 256 + get_byte(b, 2)) * 256 + get_byte(b, 3)) % 923521;
  for i in 1..4 loop
    sal := substr(alf, (n % 31)::int + 1, 1) || sal;
    n := n / 31;
  end loop;
  return sal;
end $$;

create or replace function public._codigo_unico(p_nombre text) returns text
language plpgsql stable security definer set search_path = public as $$
declare c text;
begin
  for k in 0..200 loop
    c := public._codigo_de(p_nombre, k);
    if not exists (select 1 from public.invitados where codigo = c) then return c; end if;
  end loop;
  raise exception 'No se pudo generar un código único';
end $$;

-- Disparador: limpia el nombre, genera el código (solo si falta: nunca cambia uno ya enviado)
-- y mantiene la coherencia asistencia ↔ pases confirmados.
create or replace function public._invitados_antes() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.nombre      := regexp_replace(btrim(new.nombre), '\s+', ' ', 'g');
  new.nombre_norm := public.normalizar(new.nombre);
  new.tratamiento := btrim(coalesce(new.tratamiento, ''));
  new.mesa        := btrim(coalesce(new.mesa, ''));
  new.telefono    := btrim(coalesce(new.telefono, ''));
  new.codigo      := upper(regexp_replace(coalesce(new.codigo, ''), '[^A-Za-z0-9]', '', 'g'));
  if new.codigo = '' then new.codigo := public._codigo_unico(new.nombre); end if;
  if new.asistencia = 'no' then new.pases_confirmados := 0;
  elsif new.asistencia is null then new.pases_confirmados := null;
  elsif new.pases_confirmados is null or new.pases_confirmados < 1 then new.pases_confirmados := new.pases_asignados;
  end if;
  new.ingreso_fecha := case when new.ingreso_pases > 0 then coalesce(new.ingreso_fecha, now()) end;
  new.actualizado := now();
  return new;
end $$;
drop trigger if exists invitados_antes on public.invitados;
create trigger invitados_antes before insert or update on public.invitados
  for each row execute function public._invitados_antes();

-- Roles
create or replace function public.rol_actual() returns text
language sql stable security definer set search_path = public as $$
  select rol from public.miembros where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
$$;
create or replace function public.es_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.rol_actual() = 'admin', false)
$$;

-- Ficha pública (lo que ve el invitado): sin teléfono ni datos internos
create or replace function public._publico(i public.invitados) returns jsonb
language sql stable as $$
  select jsonb_build_object(
    'nombre', i.nombre, 'tratamiento', i.tratamiento, 'codigo', i.codigo,
    'asistencia', coalesce(i.asistencia, ''), 'pases', i.pases_asignados, 'pasesConfirmados', i.pases_confirmados,
    'mensaje', i.mensaje, 'respuestaNovios', i.respuesta_novios, 'mesa', i.mesa,
    'primera', i.primera_respuesta, 'ultima', i.ultima_modificacion, 'ediciones', i.ediciones)
$$;

create or replace function public._rsvp_estado() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('fechaLimite', c.fecha_limite,
                            'abierto', c.fecha_limite is null or now() <= c.fecha_limite,
                            'permitirNuevos', c.permitir_nuevos, 'pasesMax', c.pases_max)
  from public.config c where c.id = 1
$$;

-- -------------------------------------------------------------------------------------
-- 3. API DEL INVITADO (rol anon) — única puerta de entrada: no hay acceso directo a tablas
-- -------------------------------------------------------------------------------------

create or replace function public.rsvp_publico() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('ok', true, 'rsvp', public._rsvp_estado())
$$;

-- Lee por código y registra la vista (primera / última). p_registrar=false para el equipo.
create or replace function public.rsvp_obtener(p_codigo text, p_registrar boolean default true) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  c text := upper(regexp_replace(coalesce(p_codigo, ''), '[^A-Za-z0-9]', '', 'g'));
  r public.invitados;
begin
  if length(c) not between 4 and 8 then
    return jsonb_build_object('ok', true, 'encontrado', false, 'rsvp', public._rsvp_estado());
  end if;
  if p_registrar then
    update public.invitados
       set primera_vista = coalesce(primera_vista, now()), ultima_vista = now(), vistas = vistas + 1
     where codigo = c returning * into r;
  else
    select * into r from public.invitados where codigo = c;
  end if;
  if r.id is null then
    return jsonb_build_object('ok', true, 'encontrado', false, 'rsvp', public._rsvp_estado());
  end if;
  return jsonb_build_object('ok', true, 'encontrado', true, 'invitado', public._publico(r), 'rsvp', public._rsvp_estado());
end $$;

-- Búsqueda por nombre: exacto → registro; parcial → hasta 5 nombres (mín. 3 letras)
create or replace function public.rsvp_buscar(p_nombre text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  q text := public.normalizar(left(coalesce(p_nombre, ''), 80));
  r public.invitados;
  cand jsonb;
begin
  if char_length(q) < 3 then return jsonb_build_object('ok', true, 'encontrado', false, 'candidatos', '[]'::jsonb); end if;
  select * into r from public.invitados where nombre_norm = q;
  if r.id is not null then
    return jsonb_build_object('ok', true, 'encontrado', true, 'invitado', public._publico(r));
  end if;
  select coalesce(jsonb_agg(nombre), '[]'::jsonb) into cand
    from (select nombre from public.invitados where position(q in nombre_norm) > 0 order by nombre limit 5) s;
  return jsonb_build_object('ok', true, 'encontrado', false, 'candidatos', cand);
end $$;

-- Guarda la respuesta. p = {modo: codigo|editar|nuevo, codigo, nombre, asistencia: si|no,
--                           pases_confirmados, mensaje, pases (solo invitados nuevos: ?pase=N)}
create or replace function public.rsvp_guardar(p jsonb) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  cfg   public.config;
  r     public.invitados;
  modo  text := coalesce(p ->> 'modo', 'nuevo');
  cod   text := upper(regexp_replace(coalesce(p ->> 'codigo', ''), '[^A-Za-z0-9]', '', 'g'));
  nom   text := left(regexp_replace(btrim(coalesce(p ->> 'nombre', '')), '\s+', ' ', 'g'), 80);
  asis  text := lower(coalesce(p ->> 'asistencia', ''));
  msg   text := left(btrim(regexp_replace(coalesce(p ->> 'mensaje', ''), '[\x01-\x08\x0B\x0C\x0E-\x1F]', '', 'g')), 1000);
  pc    int;
  pn    int;
  cambio boolean;
begin
  select * into cfg from public.config where id = 1;
  if cfg.fecha_limite is not null and now() > cfg.fecha_limite then
    return jsonb_build_object('ok', false, 'error', 'cerrado');
  end if;
  if asis not in ('si', 'no') then return jsonb_build_object('ok', false, 'error', 'asistencia'); end if;

  if length(cod) between 4 and 8 then
    select * into r from public.invitados where codigo = cod for update;
  end if;

  if r.id is null then
    if char_length(nom) < 3 then return jsonb_build_object('ok', false, 'error', 'nombre'); end if;
    select * into r from public.invitados where nombre_norm = public.normalizar(nom) for update;
    if r.id is not null and modo = 'nuevo' then
      return jsonb_build_object('ok', false, 'error', 'duplicado');
    end if;
    if r.id is null and modo = 'editar' then return jsonb_build_object('ok', false, 'error', 'no_encontrado'); end if;
    if r.id is null then
      if not cfg.permitir_nuevos then return jsonb_build_object('ok', false, 'error', 'sin_registro'); end if;
      pn := greatest(1, least(cfg.pases_max, coalesce(public._entero(p ->> 'pases'), 1)));
      pc := case when asis = 'no' then 0
                 else greatest(1, least(pn, coalesce(public._entero(p ->> 'pases_confirmados'), pn))) end;
      begin
        insert into public.invitados (nombre, asistencia, pases_asignados, pases_confirmados, mensaje,
                                      primera_respuesta, ultima_modificacion, ediciones, primera_vista, ultima_vista, vistas, origen)
        values (nom, asis, pn, pc, msg, now(), now(), 1, now(), now(), 1, 'invitacion')
        returning * into r;
      exception when unique_violation then
        return jsonb_build_object('ok', false, 'error', 'duplicado');
      end;
      return jsonb_build_object('ok', true, 'nuevo', true, 'cambio', true, 'invitado', public._publico(r));
    end if;
  end if;

  pc := case when asis = 'no' then 0
             else greatest(1, least(r.pases_asignados, coalesce(public._entero(p ->> 'pases_confirmados'), r.pases_asignados))) end;
  cambio := r.primera_respuesta is null or r.asistencia is distinct from asis
            or r.pases_confirmados is distinct from pc or r.mensaje is distinct from msg;
  if cambio then
    update public.invitados
       set asistencia = asis, pases_confirmados = pc, mensaje = msg,
           primera_respuesta = coalesce(primera_respuesta, now()), ultima_modificacion = now(), ediciones = ediciones + 1
     where id = r.id returning * into r;
  end if;
  return jsonb_build_object('ok', true, 'nuevo', false, 'cambio', cambio, 'invitado', public._publico(r));
end $$;

-- -------------------------------------------------------------------------------------
-- 4. API DEL EQUIPO (requiere sesión: admin o seguridad)
-- -------------------------------------------------------------------------------------

create or replace function public.staff_ficha(p_codigo text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare r public.invitados;
begin
  if public.rol_actual() is null then return jsonb_build_object('ok', false, 'error', 'no_autorizado'); end if;
  select * into r from public.invitados where codigo = upper(regexp_replace(coalesce(p_codigo, ''), '[^A-Za-z0-9]', '', 'g'));
  if r.id is null then return jsonb_build_object('ok', true, 'encontrado', false); end if;
  return jsonb_build_object('ok', true, 'encontrado', true, 'rol', public.rol_actual(),
    'invitado', public._publico(r) || jsonb_build_object('ingresoPases', r.ingreso_pases, 'ingresoFecha', r.ingreso_fecha));
end $$;

-- Fija cuántos pases ingresaron (valor absoluto 0..pases asignados)
create or replace function public.staff_ingreso(p_codigo text, p_pases int) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare r public.invitados;
begin
  if public.rol_actual() is null then return jsonb_build_object('ok', false, 'error', 'no_autorizado'); end if;
  update public.invitados
     set ingreso_pases = greatest(0, least(pases_asignados, coalesce(p_pases, 0))),
         ingreso_fecha = case when coalesce(p_pases, 0) > 0 then now() end
   where codigo = upper(regexp_replace(coalesce(p_codigo, ''), '[^A-Za-z0-9]', '', 'g'))
   returning * into r;
  if r.id is null then return jsonb_build_object('ok', false, 'error', 'no_encontrado'); end if;
  return jsonb_build_object('ok', true, 'invitado', public._publico(r) || jsonb_build_object('ingresoPases', r.ingreso_pases, 'ingresoFecha', r.ingreso_fecha));
end $$;

-- Carga masiva: agrega nuevos y actualiza existentes (clave: Código si existe, si no Nombre).
-- Solo se tocan las columnas presentes en el archivo. Celdas vacías: se ignoran salvo p_vacias_borran.
-- Cada fila se procesa por separado: un error no detiene el resto.
create or replace function public.admin_importar(p_filas jsonb, p_vacias_borran boolean default false) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  e jsonb; idx int := 0;
  r public.invitados; n public.invitados;
  nuevos int := 0; actualizados int := 0; iguales int := 0;
  errores jsonb := '[]'::jsonb;
  cod text; nom text;
begin
  if not public.es_admin() then raise exception 'no_autorizado'; end if;
  for e in select * from jsonb_array_elements(coalesce(p_filas, '[]'::jsonb)) loop
    idx := idx + 1;
    begin
      r := null;
      cod := upper(regexp_replace(coalesce(e ->> 'codigo', ''), '[^A-Za-z0-9]', '', 'g'));
      nom := regexp_replace(btrim(coalesce(e ->> 'nombre', '')), '\s+', ' ', 'g');
      if cod <> '' then select * into r from public.invitados where codigo = cod for update; end if;
      if r.id is null and nom <> '' then select * into r from public.invitados where nombre_norm = public.normalizar(nom) for update; end if;

      if r.id is null then
        if nom = '' then raise exception 'Falta el nombre del invitado'; end if;
        insert into public.invitados (nombre, codigo, tratamiento, pases_asignados, pases_confirmados, asistencia,
                                      mesa, telefono, respuesta_novios, origen)
        values (nom,
                case when cod ~ '^[A-Z0-9]{4,8}$' and not exists (select 1 from public.invitados where codigo = cod) then cod end,
                coalesce(e ->> 'tratamiento', ''),
                coalesce(public._entero(e ->> 'pases_asignados'), 1),
                public._entero(e ->> 'pases_confirmados'),
                nullif(e ->> 'asistencia', ''),
                coalesce(e ->> 'mesa', ''), coalesce(e ->> 'telefono', ''), coalesce(e ->> 'respuesta_novios', ''),
                'importacion');
        nuevos := nuevos + 1;
      else
        update public.invitados t set
          nombre            = case when nom <> '' then nom else t.nombre end,
          tratamiento       = case when e ? 'tratamiento' and (p_vacias_borran or btrim(e ->> 'tratamiento') <> '') then coalesce(e ->> 'tratamiento', '') else t.tratamiento end,
          pases_asignados   = case when public._entero(e ->> 'pases_asignados') is not null then public._entero(e ->> 'pases_asignados') else t.pases_asignados end,
          asistencia        = case when e ? 'asistencia' and (p_vacias_borran or btrim(e ->> 'asistencia') <> '') then nullif(e ->> 'asistencia', '') else t.asistencia end,
          pases_confirmados = case when public._entero(e ->> 'pases_confirmados') is not null then public._entero(e ->> 'pases_confirmados')
                                   when e ? 'pases_confirmados' and p_vacias_borran then null else t.pases_confirmados end,
          mesa              = case when e ? 'mesa' and (p_vacias_borran or btrim(e ->> 'mesa') <> '') then coalesce(e ->> 'mesa', '') else t.mesa end,
          telefono          = case when e ? 'telefono' and (p_vacias_borran or btrim(e ->> 'telefono') <> '') then coalesce(e ->> 'telefono', '') else t.telefono end,
          respuesta_novios  = case when e ? 'respuesta_novios' and (p_vacias_borran or btrim(e ->> 'respuesta_novios') <> '') then coalesce(e ->> 'respuesta_novios', '') else t.respuesta_novios end
        where t.id = r.id returning * into n;
        if (to_jsonb(r) - 'actualizado') = (to_jsonb(n) - 'actualizado') then iguales := iguales + 1;
        else actualizados := actualizados + 1; end if;
      end if;
    exception
      when unique_violation then
        errores := errores || jsonb_build_object('fila', coalesce((e ->> '_fila')::int, idx), 'nombre', nom,
                     'error', 'Nombre o código repetido: agrega apellido o parentesco, p. ej. "Pérez (Padre)"');
      when check_violation then
        errores := errores || jsonb_build_object('fila', coalesce((e ->> '_fila')::int, idx), 'nombre', nom,
                     'error', case when sqlerrm like '%pases_confirmados_max%' then 'Pases confirmados mayor que pases asignados'
                                   when sqlerrm like '%codigo%' then 'Código inválido'
                                   else 'Valor fuera de rango' end);
      when others then
        errores := errores || jsonb_build_object('fila', coalesce((e ->> '_fila')::int, idx), 'nombre', nom, 'error', sqlerrm);
    end;
  end loop;
  return jsonb_build_object('ok', true, 'nuevos', nuevos, 'actualizados', actualizados, 'sin_cambios', iguales, 'errores', errores);
end $$;

create or replace function public.admin_borrar_todo(p_confirmacion text) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare n int;
begin
  if not public.es_admin() then raise exception 'no_autorizado'; end if;
  if p_confirmacion is distinct from 'BORRAR' then raise exception 'confirmacion_invalida'; end if;
  delete from public.invitados where true;
  get diagnostics n = row_count;
  return jsonb_build_object('ok', true, 'borrados', n);
end $$;

-- Prueba desde el SQL Editor:  select public._codigo_de('Juan Pérez', 0);   → YZCD

-- -------------------------------------------------------------------------------------
-- 5. SEGURIDAD (RLS + permisos)
-- -------------------------------------------------------------------------------------
alter table public.invitados enable row level security;
alter table public.config    enable row level security;
alter table public.miembros  enable row level security;
alter table public._secretos enable row level security;

drop policy if exists invitados_admin on public.invitados;
create policy invitados_admin on public.invitados for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

drop policy if exists config_leer on public.config;
create policy config_leer on public.config for select to authenticated using (public.rol_actual() is not null);
drop policy if exists config_editar on public.config;
create policy config_editar on public.config for update to authenticated using (public.es_admin()) with check (public.es_admin());

drop policy if exists miembros_leer on public.miembros;
create policy miembros_leer on public.miembros for select to authenticated
  using (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')) or public.es_admin());

revoke all on public.invitados, public.config, public.miembros, public._secretos from anon;
revoke all on public._secretos from authenticated;

revoke execute on all functions in schema public from public, anon;
grant execute on function public.rsvp_publico()                  to anon, authenticated;
grant execute on function public.rsvp_obtener(text, boolean)      to anon, authenticated;
grant execute on function public.rsvp_buscar(text)                to anon, authenticated;
grant execute on function public.rsvp_guardar(jsonb)              to anon, authenticated;
grant execute on function public.staff_ficha(text)                to authenticated;
grant execute on function public.staff_ingreso(text, int)         to authenticated;
grant execute on function public.admin_importar(jsonb, boolean)   to authenticated;
grant execute on function public.admin_borrar_todo(text)          to authenticated;
grant execute on function public.rol_actual(), public.es_admin(), public.normalizar(text) to authenticated;

-- -------------------------------------------------------------------------------------
-- 6. REALTIME (el panel recibe los cambios al instante)
-- -------------------------------------------------------------------------------------
do $$ begin
  alter publication supabase_realtime add table public.invitados;
exception when duplicate_object then null; end $$;

-- -------------------------------------------------------------------------------------
-- 7. ACCESOS: reemplaza los correos y ejecuta
-- -------------------------------------------------------------------------------------
-- insert into public.miembros (email, rol) values
--   ('novia@correo.com', 'admin'), ('novio@correo.com', 'admin'), ('recepcion@correo.com', 'seguridad')
-- on conflict (email) do update set rol = excluded.rol;
