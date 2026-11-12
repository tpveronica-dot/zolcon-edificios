-- =====================================================================
-- Usuarios: activar/desactivar, invitaciones y asignación de roles
-- =====================================================================

-- ---------- Usuarios activos / desactivados ----------
alter table perfiles add column if not exists activo boolean not null default true;

create or replace function yo_activo() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select activo from perfiles where id = auth.uid()), false)
$$;

-- Un usuario desactivado pierde todo acceso: sin empresa ni rol efectivos
create or replace function mi_empresa_id() returns uuid
language sql stable security definer set search_path = public as $$
  select empresa_id from perfiles where id = auth.uid() and activo
$$;

create or replace function mi_rol() returns rol_usuario
language sql stable security definer set search_path = public as $$
  select rol from perfiles where id = auth.uid() and activo
$$;

-- ¿Es miembro (administrador o junta) asignado a este edificio?
create or replace function asignado_a(p_edificio uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select yo_activo() and exists (
    select 1 from edificio_usuarios eu where eu.edificio_id = p_edificio and eu.usuario_id = auth.uid())
$$;

create or replace function puede_ver_edificio(p_edificio uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select puede_gestionar(p_edificio)
    or asignado_a(p_edificio)
    or (yo_activo() and exists (select 1 from unidades u join personas p on p.id = u.propietario_id
               where u.edificio_id = p_edificio and p.usuario_id = auth.uid()))
$$;

create or replace function es_mi_unidad(p_unidad uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select yo_activo() and exists (select 1 from unidades u join personas p on p.id = u.propietario_id
                 where u.id = p_unidad and p.usuario_id = auth.uid())
$$;

-- Políticas que consultaban edificio_usuarios directamente
drop policy if exists cuotas_ver on cuotas;
create policy cuotas_ver on cuotas for select
  using (puede_gestionar(edificio_id) or es_mi_unidad(unidad_id) or asignado_a(edificio_id));

drop policy if exists pagos_ver on pagos;
create policy pagos_ver on pagos for select
  using (exists (select 1 from cuotas c where c.id = cuota_id
                 and (puede_gestionar(c.edificio_id) or es_mi_unidad(c.unidad_id) or asignado_a(c.edificio_id))));

-- Proteger perfiles: además, nadie puede desactivarse a sí mismo
create or replace function proteger_perfiles() returns trigger
language plpgsql as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if mi_rol() = 'superadmin' then
    return new;
  end if;
  if new.rol = 'superadmin' then
    raise exception 'No está permitido asignar el rol superadmin';
  end if;
  if tg_op = 'UPDATE' then
    if new.id = auth.uid() and new.rol is distinct from old.rol then
      raise exception 'No puedes cambiar tu propio rol';
    end if;
    if new.id = auth.uid() and new.activo is distinct from old.activo then
      raise exception 'No puedes desactivar tu propia cuenta';
    end if;
    if new.empresa_id is distinct from old.empresa_id then
      raise exception 'No está permitido cambiar la empresa de un usuario';
    end if;
  end if;
  if tg_op = 'INSERT' and new.empresa_id is distinct from mi_empresa_id() then
    raise exception 'Solo puedes crear usuarios de tu propia empresa';
  end if;
  return new;
end $$;

-- ---------- Invitaciones ----------
create table if not exists invitaciones (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references empresas(id) on delete cascade,
  email       text not null,
  nombre      text,
  rol         rol_usuario not null check (rol <> 'superadmin'),
  edificios   uuid[] not null default '{}',
  creado_por  uuid references perfiles(id) on delete set null,
  creado_en   timestamptz not null default now(),
  aceptada_en timestamptz
);
create unique index if not exists invitaciones_pendiente_unica
  on invitaciones (lower(email)) where aceptada_en is null;

alter table invitaciones enable row level security;
drop policy if exists invitaciones_admin on invitaciones;
create policy invitaciones_admin on invitaciones for all
  using ((empresa_id = mi_empresa_id() and mi_rol() = 'admin_empresa') or mi_rol() = 'superadmin')
  with check ((empresa_id = mi_empresa_id() and mi_rol() = 'admin_empresa') or mi_rol() = 'superadmin');

-- Aplica la invitación pendiente de un correo a un usuario sin empresa
create or replace function aplicar_invitacion(p_usuario uuid, p_email text) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  inv invitaciones%rowtype;
begin
  select * into inv from invitaciones
   where lower(email) = lower(p_email) and aceptada_en is null
   order by creado_en desc limit 1;
  if not found then
    return false;
  end if;
  if exists (select 1 from perfiles where id = p_usuario and empresa_id is not null) then
    return false;
  end if;

  update perfiles
     set empresa_id = inv.empresa_id,
         rol = inv.rol,
         activo = true,
         nombre = coalesce(nullif(nombre, ''), inv.nombre)
   where id = p_usuario;

  insert into edificio_usuarios (edificio_id, usuario_id)
  select e.id, p_usuario from edificios e
   where e.id = any(inv.edificios) and e.empresa_id = inv.empresa_id
  on conflict do nothing;

  -- Propietario: se vincula con su ficha de persona (mismo correo)
  if inv.rol = 'propietario' then
    update personas set usuario_id = p_usuario
     where empresa_id = inv.empresa_id and lower(email) = lower(p_email) and usuario_id is null;
  end if;

  update invitaciones set aceptada_en = now() where id = inv.id;
  return true;
end $$;
revoke all on function aplicar_invitacion(uuid, text) from public, anon, authenticated;

-- Al registrarse un usuario: crear su perfil y aplicar su invitación si la tiene
create or replace function crear_perfil() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into perfiles (id, email, nombre) values (new.id, new.email, new.raw_user_meta_data->>'nombre');
  perform aplicar_invitacion(new.id, new.email);
  return new;
end $$;

-- La administradora invita a un usuario (o le da acceso si ya tiene cuenta sin empresa)
create or replace function invitar_usuario(p_email text, p_nombre text, p_rol rol_usuario, p_edificios uuid[] default '{}')
returns text language plpgsql security definer set search_path = public as $$
declare
  v_empresa uuid := mi_empresa_id();
  v_email text := lower(trim(p_email));
  v_perfil perfiles%rowtype;
  v_existe boolean;
begin
  if mi_rol() is distinct from 'admin_empresa' and mi_rol() is distinct from 'superadmin' then
    raise exception 'Solo la administradora de la empresa puede crear usuarios';
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Correo no válido';
  end if;
  if p_rol = 'superadmin' then
    raise exception 'No está permitido asignar el rol superadmin';
  end if;

  select * into v_perfil from perfiles where lower(email) = v_email;
  v_existe := found;
  if v_existe and v_perfil.empresa_id = v_empresa then
    raise exception 'Ese correo ya es usuario de tu empresa';
  elsif v_existe and v_perfil.empresa_id is not null then
    raise exception 'Ese correo ya pertenece a otra empresa';
  end if;

  delete from invitaciones where lower(email) = v_email and aceptada_en is null and empresa_id = v_empresa;
  if exists (select 1 from invitaciones where lower(email) = v_email and aceptada_en is null) then
    raise exception 'Ese correo tiene una invitación pendiente de otra empresa';
  end if;

  insert into invitaciones (empresa_id, email, nombre, rol, edificios, creado_por)
  values (v_empresa, v_email, nullif(trim(p_nombre), ''), p_rol,
          coalesce((select array_agg(id) from edificios where id = any(p_edificios) and empresa_id = v_empresa), '{}'),
          auth.uid());

  -- Ya tenía cuenta (sin empresa): se le da acceso de inmediato
  if v_existe then
    perform aplicar_invitacion(v_perfil.id, v_email);
    return 'activado';
  end if;
  return 'invitado';
end $$;
revoke all on function invitar_usuario(text, text, rol_usuario, uuid[]) from public, anon;
grant execute on function invitar_usuario(text, text, rol_usuario, uuid[]) to authenticated;
