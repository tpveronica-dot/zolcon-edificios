-- =====================================================================
-- Seguridad: impedir que un usuario se dé más permisos de los que tiene.
--  * Nadie (salvo superadmin) puede asignar el rol superadmin.
--  * Nadie (salvo superadmin) puede cambiar su propio rol.
--  * Nadie (salvo superadmin) puede mover un usuario a otra empresa.
-- Las funciones internas de confianza (registrar_empresa, crear_perfil)
-- corren como el dueño de la base y no pasan por esta validación.
-- =====================================================================
create or replace function proteger_perfiles() returns trigger
language plpgsql as $$
begin
  -- Cambios hechos por funciones internas de confianza
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
    if new.empresa_id is distinct from old.empresa_id then
      raise exception 'No está permitido cambiar la empresa de un usuario';
    end if;
  end if;

  if tg_op = 'INSERT' and new.empresa_id is distinct from mi_empresa_id() then
    raise exception 'Solo puedes crear usuarios de tu propia empresa';
  end if;

  return new;
end $$;

drop trigger if exists trg_proteger_perfiles on perfiles;
create trigger trg_proteger_perfiles before insert or update on perfiles
  for each row execute function proteger_perfiles();
