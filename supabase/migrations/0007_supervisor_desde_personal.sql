-- =====================================================================
-- Personal es la fuente única de qué edificios supervisa cada supervisor.
-- Si el supervisor tiene usuario en la app (rol Supervisor = 'administrador'),
-- su acceso (edificio_usuarios) se sincroniza solo desde personal_edificios.
-- =====================================================================

-- 1) Migrar supervisores existentes (antes de activar la sincronización):
--    crear su ficha de Personal con los edificios a los que ya tienen acceso
insert into personal (empresa_id, nombre, email, usuario_id, cargo)
select pf.empresa_id, coalesce(nullif(pf.nombre, ''), pf.email), pf.email, pf.id, 'supervisor'
  from perfiles pf
 where pf.rol = 'administrador' and pf.empresa_id is not null
   and not exists (select 1 from personal p where p.usuario_id = pf.id);

insert into personal_edificios (personal_id, edificio_id)
select p.id, eu.edificio_id
  from personal p
  join perfiles pf on pf.id = p.usuario_id and pf.rol = 'administrador'
  join edificio_usuarios eu on eu.usuario_id = pf.id
 where p.cargo = 'supervisor'
on conflict do nothing;

-- Recalcula el acceso de un usuario supervisor según el Personal
create or replace function sincronizar_acceso_supervisor(p_usuario uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_usuario is null then
    return;
  end if;
  -- Solo se administra el acceso de usuarios con rol Supervisor
  if not exists (select 1 from perfiles where id = p_usuario and rol = 'administrador') then
    return;
  end if;

  delete from edificio_usuarios eu
   where eu.usuario_id = p_usuario
     and eu.edificio_id not in (
       select pe.edificio_id from personal p
         join personal_edificios pe on pe.personal_id = p.id
        where p.usuario_id = p_usuario and p.cargo = 'supervisor' and p.activo);

  insert into edificio_usuarios (edificio_id, usuario_id)
  select pe.edificio_id, p_usuario from personal p
    join personal_edificios pe on pe.personal_id = p.id
   where p.usuario_id = p_usuario and p.cargo = 'supervisor' and p.activo
  on conflict do nothing;
end $$;
revoke execute on function sincronizar_acceso_supervisor(uuid) from public, anon, authenticated;

-- Cambios en los edificios asignados a una persona del personal
create or replace function trg_sync_personal_edificios() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform sincronizar_acceso_supervisor(
    (select usuario_id from personal where id = coalesce(new.personal_id, old.personal_id)));
  return null;
end $$;
revoke execute on function trg_sync_personal_edificios() from public, anon, authenticated;

drop trigger if exists trg_sync_personal_edificios on personal_edificios;
create trigger trg_sync_personal_edificios after insert or delete on personal_edificios
  for each row execute function trg_sync_personal_edificios();

-- Cambios en la persona (cargo, usuario vinculado, activo) o su eliminación
create or replace function trg_sync_personal() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op <> 'INSERT' then
    perform sincronizar_acceso_supervisor(old.usuario_id);
  end if;
  if tg_op <> 'DELETE' then
    perform sincronizar_acceso_supervisor(new.usuario_id);
  end if;
  return null;
end $$;
revoke execute on function trg_sync_personal() from public, anon, authenticated;

drop trigger if exists trg_sync_personal on personal;
create trigger trg_sync_personal after insert or update or delete on personal
  for each row execute function trg_sync_personal();

-- Si un usuario pasa a tener rol Supervisor, su acceso se toma del Personal
create or replace function trg_sync_rol_supervisor() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.rol = 'administrador' and old.rol is distinct from new.rol then
    perform sincronizar_acceso_supervisor(new.id);
  end if;
  return null;
end $$;
revoke execute on function trg_sync_rol_supervisor() from public, anon, authenticated;

drop trigger if exists trg_sync_rol_supervisor on perfiles;
create trigger trg_sync_rol_supervisor after update of rol on perfiles
  for each row execute function trg_sync_rol_supervisor();

-- Al aceptar una invitación: vincular la ficha de Personal con el mismo correo
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

  if inv.rol = 'propietario' then
    update personas set usuario_id = p_usuario
     where empresa_id = inv.empresa_id and lower(email) = lower(p_email) and usuario_id is null;
  end if;

  update personal set usuario_id = p_usuario
   where empresa_id = inv.empresa_id and lower(email) = lower(p_email) and usuario_id is null;

  update invitaciones set aceptada_en = now() where id = inv.id;
  perform sincronizar_acceso_supervisor(p_usuario);
  return true;
end $$;
revoke all on function aplicar_invitacion(uuid, text) from public, anon, authenticated;
