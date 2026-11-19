-- =====================================================================
-- 0011 · Portal del propietario: reportar pagos con foto del voucher
-- - El propietario reporta un pago (queda "por validar").
-- - La foto se guarda en un bucket privado: vouchers/<empresa>/<cuota>/<archivo>
-- - El staff valida (cuenta para la cuota) o rechaza (se elimina).
-- =====================================================================

-- 1) Reporte de pago: solo por esta función (fija empresa, autor y validado=false)
drop policy if exists pagos_reportar on pagos;

create or replace function reportar_pago(
  p_cuota uuid, p_monto numeric, p_fecha date, p_medio medio_pago,
  p_operacion text, p_voucher text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_cuota cuotas%rowtype;
  v_id uuid;
begin
  select * into v_cuota from cuotas where id = p_cuota;
  if v_cuota.id is null or not es_mi_unidad(v_cuota.unidad_id) then
    raise exception 'Esta cuota no corresponde a tu unidad.';
  end if;
  if v_cuota.estado = 'anulada' then
    raise exception 'La cuota está anulada.';
  end if;
  if p_monto is null or p_monto <= 0 then
    raise exception 'Ingresa un monto válido.';
  end if;
  if p_fecha is not null and p_fecha > current_date + 1 then
    raise exception 'La fecha del pago no puede ser futura.';
  end if;
  if p_voucher is not null and p_voucher not like v_cuota.empresa_id::text || '/' || p_cuota::text || '/%' then
    raise exception 'Archivo de voucher no válido.';
  end if;
  if (select count(*) from pagos where cuota_id = p_cuota and not validado) >= 3 then
    raise exception 'Ya tienes pagos en revisión para esta cuota. Espera a que la administración los valide.';
  end if;

  insert into pagos (empresa_id, cuota_id, fecha, monto, medio, operacion, voucher_url, validado, registrado_por)
  values (v_cuota.empresa_id, p_cuota, coalesce(p_fecha, current_date), round(p_monto, 2), p_medio,
          nullif(trim(p_operacion), ''), p_voucher, false, auth.uid())
  returning id into v_id;
  return v_id;
end $$;
revoke all on function reportar_pago(uuid, numeric, date, medio_pago, text, text) from public, anon;
grant execute on function reportar_pago(uuid, numeric, date, medio_pago, text, text) to authenticated;

-- 2) Bucket privado para los vouchers (máx. 5 MB, solo imágenes y PDF)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('vouchers', 'vouchers', false, 5242880, array['image/jpeg','image/png','image/webp','image/heic','application/pdf'])
on conflict (id) do update set public = false,
  file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- ¿Puedo subir un voucher a esta ruta? (<empresa>/<cuota>/archivo, cuota de mi unidad)
create or replace function puedo_subir_voucher(p_nombre text) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  v_partes text[] := string_to_array(p_nombre, '/');
  v_cuota uuid;
begin
  if array_length(v_partes, 1) <> 3 or v_partes[2] !~ '^[0-9a-f-]{36}$' then
    return false;
  end if;
  v_cuota := v_partes[2]::uuid;
  return exists (select 1 from cuotas c
                  where c.id = v_cuota and c.empresa_id::text = v_partes[1]
                    and es_mi_unidad(c.unidad_id));
end $$;

-- ¿Puedo ver este voucher? (dueño de la unidad o staff del edificio)
create or replace function puedo_ver_voucher(p_nombre text) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  v_partes text[] := string_to_array(p_nombre, '/');
  v_cuota uuid;
begin
  if array_length(v_partes, 1) <> 3 or v_partes[2] !~ '^[0-9a-f-]{36}$' then
    return false;
  end if;
  v_cuota := v_partes[2]::uuid;
  return exists (select 1 from cuotas c
                  where c.id = v_cuota and c.empresa_id::text = v_partes[1]
                    and (es_mi_unidad(c.unidad_id) or puede_gestionar(c.edificio_id)));
end $$;
revoke all on function puedo_subir_voucher(text) from public, anon;
revoke all on function puedo_ver_voucher(text) from public, anon;
grant execute on function puedo_subir_voucher(text) to authenticated;
grant execute on function puedo_ver_voucher(text) to authenticated;

drop policy if exists vouchers_subir on storage.objects;
create policy vouchers_subir on storage.objects for insert to authenticated
  with check (bucket_id = 'vouchers' and public.puedo_subir_voucher(name));

drop policy if exists vouchers_ver on storage.objects;
create policy vouchers_ver on storage.objects for select to authenticated
  using (bucket_id = 'vouchers' and public.puedo_ver_voucher(name));

drop policy if exists vouchers_borrar on storage.objects;
create policy vouchers_borrar on storage.objects for delete to authenticated
  using (bucket_id = 'vouchers' and exists (
    select 1 from public.cuotas c
     where c.id::text = split_part(name, '/', 2) and public.puede_gestionar(c.edificio_id)));
