-- =====================================================================
-- Distribución de la cuota mensual por edificio:
--   metraje : según el área (m²) de cada unidad
--   igual   : el mismo monto para todas las unidades
--   libre   : % de participación definido a mano (debe sumar 100 %)
-- =====================================================================
alter table edificios add column if not exists metodo_distribucion text not null default 'metraje'
  check (metodo_distribucion in ('metraje', 'igual', 'libre'));

-- Los edificios que ya existían conservan su reparto por % (no cambia nada para ellos)
update edificios set metodo_distribucion = 'libre'
 where exists (select 1 from unidades u where u.edificio_id = edificios.id and u.porcentaje_participacion > 0);

create or replace function generar_cuotas(p_edificio uuid, p_periodo date)
returns integer language plpgsql security invoker set search_path = public as $$
declare
  v_total   numeric(12,2);
  v_dia     smallint;
  v_metodo  text;
  v_periodo date := date_trunc('month', p_periodo)::date;
  v_unidades integer;
  v_area    numeric;
  v_pct     numeric;
  v_faltan  text;
  v_n       integer;
  v_dif     numeric(12,2);
begin
  if not puede_gestionar(p_edificio) then
    raise exception 'Sin permiso para este edificio';
  end if;

  select coalesce(sum(pa.monto_mensual), 0) into v_total
    from presupuestos pr join partidas pa on pa.presupuesto_id = pr.id
   where pr.edificio_id = p_edificio and pr.anio = extract(year from v_periodo);
  if v_total = 0 then
    raise exception 'No hay presupuesto cargado para %', extract(year from v_periodo);
  end if;

  select dia_vencimiento, metodo_distribucion into v_dia, v_metodo from edificios where id = p_edificio;
  select count(*), sum(area_m2), sum(porcentaje_participacion)
    into v_unidades, v_area, v_pct
    from unidades where edificio_id = p_edificio;
  if v_unidades = 0 then
    raise exception 'El edificio no tiene unidades registradas';
  end if;

  if v_metodo = 'metraje' then
    select string_agg(codigo, ', ' order by codigo) into v_faltan
      from unidades where edificio_id = p_edificio and coalesce(area_m2, 0) <= 0;
    if v_faltan is not null then
      raise exception 'Falta el área (m²) de las unidades: %', v_faltan;
    end if;
  elsif v_metodo = 'libre' and abs(coalesce(v_pct, 0) - 100) > 0.01 then
    raise exception 'Los %% de participación suman % %%; deben sumar 100 %%', round(coalesce(v_pct, 0), 2);
  end if;

  insert into cuotas (empresa_id, edificio_id, unidad_id, periodo, monto, vencimiento)
  select u.empresa_id, u.edificio_id, u.id, v_periodo,
         round(v_total * case v_metodo
                           when 'metraje' then u.area_m2 / v_area
                           when 'igual'   then 1.0 / v_unidades
                           else u.porcentaje_participacion / 100 end, 2),
         v_periodo + (v_dia - 1)
    from unidades u
   where u.edificio_id = p_edificio
     and (v_metodo <> 'libre' or u.porcentaje_participacion > 0)
  on conflict (unidad_id, periodo) do nothing;
  get diagnostics v_n = row_count;

  -- Ajuste de céntimos por redondeo: la suma de cuotas debe ser exactamente el total
  if v_n > 0 then
    select v_total - sum(monto) into v_dif
      from cuotas where edificio_id = p_edificio and periodo = v_periodo and estado <> 'anulada';
    if v_dif <> 0 and abs(v_dif) < 1 then
      update cuotas set monto = monto + v_dif
       where id = (select id from cuotas
                    where edificio_id = p_edificio and periodo = v_periodo and estado = 'pendiente'
                    order by monto desc limit 1);
    end if;
  end if;

  return v_n;
end $$;
revoke execute on function generar_cuotas(uuid, date) from public, anon;
grant execute on function generar_cuotas(uuid, date) to authenticated;
