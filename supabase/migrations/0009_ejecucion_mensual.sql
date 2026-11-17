-- =====================================================================
-- Ejecución mensual del presupuesto: cada mes se registra el gasto real
-- de cada partida y los gastos no presupuestados del edificio.
-- =====================================================================
create table if not exists informes_mensuales (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references empresas(id) on delete cascade,
  edificio_id uuid not null references edificios(id) on delete cascade,
  periodo     date not null check (extract(day from periodo) = 1),  -- primer día del mes
  estado      text not null default 'borrador' check (estado in ('borrador', 'cerrado')),
  notas       text,
  actualizado_por uuid references perfiles(id) on delete set null,
  actualizado_en  timestamptz not null default now(),
  unique (edificio_id, periodo)
);

create table if not exists informe_lineas (
  id             uuid primary key default gen_random_uuid(),
  informe_id     uuid not null references informes_mensuales(id) on delete cascade,
  partida_id     uuid references partidas(id) on delete set null,  -- null = no presupuestado
  concepto       text not null,
  presupuestado  numeric(12,2) not null default 0 check (presupuestado >= 0),
  real           numeric(12,2) not null default 0 check (real >= 0),
  nota           text
);
create index if not exists informe_lineas_informe_idx on informe_lineas (informe_id);
create index if not exists informes_mensuales_edificio_idx on informes_mensuales (edificio_id, periodo);

alter table informes_mensuales enable row level security;
alter table informe_lineas enable row level security;

-- Lectura: todos los que ven el edificio (transparencia para la junta y propietarios)
drop policy if exists informes_ver on informes_mensuales;
create policy informes_ver on informes_mensuales for select using (puede_ver_edificio(edificio_id));

-- Escritura: quien gestiona el edificio (admin. de empresa o su supervisor)
drop policy if exists informes_gestion on informes_mensuales;
create policy informes_gestion on informes_mensuales for all
  using (puede_gestionar(edificio_id))
  with check (puede_gestionar(edificio_id)
              and empresa_id = (select e.empresa_id from edificios e where e.id = edificio_id));

create or replace function informe_edificio(p_informe uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select edificio_id from informes_mensuales where id = p_informe
$$;
revoke execute on function informe_edificio(uuid) from public, anon;
grant execute on function informe_edificio(uuid) to authenticated;

drop policy if exists lineas_ver on informe_lineas;
create policy lineas_ver on informe_lineas for select using (puede_ver_edificio(informe_edificio(informe_id)));

-- Las líneas de un informe cerrado no se pueden modificar
drop policy if exists lineas_gestion on informe_lineas;
create policy lineas_gestion on informe_lineas for all
  using (puede_gestionar(informe_edificio(informe_id))
         and exists (select 1 from informes_mensuales i where i.id = informe_id and i.estado = 'borrador'))
  with check (puede_gestionar(informe_edificio(informe_id))
              and exists (select 1 from informes_mensuales i where i.id = informe_id and i.estado = 'borrador'));

-- Gasto real acumulado por partida y año (para la columna "Gastado" del presupuesto)
create or replace view ejecucion_mensual_anual with (security_invoker = true) as
select i.edificio_id, extract(year from i.periodo)::int as anio, l.partida_id, sum(l.real) as ejecutado
  from informes_mensuales i
  join informe_lineas l on l.informe_id = i.id
 group by i.edificio_id, extract(year from i.periodo), l.partida_id;
