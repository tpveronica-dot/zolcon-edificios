-- =====================================================================
-- Alta de una nueva empresa administradora (autoregistro).
-- El usuario recién registrado (sin empresa) crea su empresa y pasa
-- a ser admin_empresa de ella.
-- =====================================================================
create or replace function registrar_empresa(p_nombre text, p_ruc text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_empresa uuid;
begin
  if auth.uid() is null then
    raise exception 'Debe iniciar sesión';
  end if;
  if exists (select 1 from perfiles where id = auth.uid() and empresa_id is not null) then
    raise exception 'El usuario ya pertenece a una empresa';
  end if;
  if coalesce(trim(p_nombre), '') = '' then
    raise exception 'El nombre de la empresa es obligatorio';
  end if;

  insert into empresas (nombre, ruc, email)
  values (trim(p_nombre), nullif(trim(p_ruc), ''), (select email from perfiles where id = auth.uid()))
  returning id into v_empresa;

  update perfiles set empresa_id = v_empresa, rol = 'admin_empresa' where id = auth.uid();
  return v_empresa;
end $$;

revoke all on function registrar_empresa(text, text) from public;
grant execute on function registrar_empresa(text, text) to authenticated;
