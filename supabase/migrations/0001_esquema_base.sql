-- =====================================================================
-- Zolcon Edificios — Esquema base multiempresa (multi-tenant)
-- Cada fila de negocio lleva empresa_id; las políticas RLS garantizan
-- que cada administradora vea solo lo suyo y cada propietario solo
-- su(s) unidad(es).
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------- Tipos ----------
create type rol_usuario as enum ('superadmin', 'admin_empresa', 'administrador', 'junta', 'propietario');
create type tipo_unidad  as enum ('departamento', 'estacionamiento', 'deposito', 'local');
create type estado_cuota as enum ('pendiente', 'parcial', 'pagada', 'anulada');
create type medio_pago   as enum ('transferencia', 'yape', 'plin', 'efectivo', 'deposito', 'otro');
create type estado_incidencia as enum ('abierta', 'en_proceso', 'resuelta', 'cerrada');

-- ---------- Empresas administradoras (clientes de Zolcon) ----------
create table empresas (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null,
  ruc         text,
  email       text,
  telefono    text,
  plan        text not null default 'basico',
  activa      boolean not null default true,
  creado_en   timestamptz not null default now()
);

-- ---------- Perfiles de usuario (1:1 con auth.users) ----------
create table perfiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  empresa_id  uuid references empresas(id) on delete cascade,
  rol         rol_usuario not null default 'propietario',
  nombre      text,
  email       text,
  creado_en   timestamptz not null default now()
);

-- ---------- Edificios ----------
create table edificios (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references empresas(id) on delete cascade,
  nombre      text not null,
  direccion   text,
  distrito    text,
  dia_vencimiento smallint not null default 10 check (dia_vencimiento between 1 and 28),
  creado_en   timestamptz not null default now()
);

-- Usuarios del staff asignados a edificios concretos (administrador / junta)
create table edificio_usuarios (
  edificio_id uuid references edificios(id) on delete cascade,
  usuario_id  uuid references perfiles(id) on delete cascade,
  primary key (edificio_id, usuario_id)
);

-- ---------- Personas (propietarios / inquilinos) ----------
create table personas (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references empresas(id) on delete cascade,
  usuario_id  uuid references perfiles(id) on delete set null, -- acceso al portal
  nombres     text not null,
  documento   text,
  email       text,
  telefono    text,
  creado_en   timestamptz not null default now()
);

-- ---------- Unidades ----------
create table unidades (
  id             uuid primary key default gen_random_uuid(),
  empresa_id     uuid not null references empresas(id) on delete cascade,
  edificio_id    uuid not null references edificios(id) on delete cascade,
  codigo         text not null,                 -- ej. "301", "E-12"
  tipo           tipo_unidad not null default 'departamento',
  area_m2        numeric(10,2),
  porcentaje_participacion numeric(7,4) not null default 0, -- % según reglamento interno
  propietario_id uuid references personas(id) on delete set null,
  unique (edificio_id, codigo)
);

-- ---------- Presupuesto ----------
create table presupuestos (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references empresas(id) on delete cascade,
  edificio_id uuid not null references edificios(id) on delete cascade,
  anio        smallint not null,
  aprobado    boolean not null default false,
  unique (edificio_id, anio)
);

create table partidas (
  id             uuid primary key default gen_random_uuid(),
  empresa_id     uuid not null references empresas(id) on delete cascade,
  presupuesto_id uuid not null references presupuestos(id) on delete cascade,
  nombre         text not null,                 -- vigilancia, limpieza, luz áreas comunes…
  monto_mensual  numeric(12,2) not null default 0,
  es_fondo_reserva boolean not null default false
);

-- ---------- Gastos ejecutados ----------
create table gastos (
  id            uuid primary key default gen_random_uuid(),
  empresa_id    uuid not null references empresas(id) on delete cascade,
  edificio_id   uuid not null references edificios(id) on delete cascade,
  partida_id    uuid references partidas(id) on delete set null, -- null = no planificado
  fecha         date not null default current_date,
  proveedor     text,
  descripcion   text not null,
  monto         numeric(12,2) not null check (monto >= 0),
  comprobante_url text,
  creado_por    uuid references perfiles(id),
  creado_en     timestamptz not null default now()
);

-- ---------- Cuotas ----------
create table cuotas (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references empresas(id) on delete cascade,
  edificio_id uuid not null references edificios(id) on delete cascade,
  unidad_id   uuid not null references unidades(id) on delete cascade,
  periodo     date not null,                    -- primer día del mes
  monto       numeric(12,2) not null,
  vencimiento date not null,
  estado      estado_cuota not null default 'pendiente',
  unique (unidad_id, periodo)
);

-- ---------- Pagos ----------
create table pagos (
  id           uuid primary key default gen_random_uuid(),
  empresa_id   uuid not null references empresas(id) on delete cascade,
  cuota_id     uuid not null references cuotas(id) on delete cascade,
  fecha        date not null default current_date,
  monto        numeric(12,2) not null check (monto > 0),
  medio        medio_pago not null default 'transferencia',
  operacion    text,                            -- nº de operación
  voucher_url  text,
  validado     boolean not null default false,  -- el administrador confirma
  registrado_por uuid references perfiles(id),
  creado_en    timestamptz not null default now()
);

-- ---------- Incidencias / atenciones no planificadas ----------
create table incidencias (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references empresas(id) on delete cascade,
  edificio_id uuid not null references edificios(id) on delete cascade,
  unidad_id   uuid references unidades(id) on delete set null,
  titulo      text not null,
  descripcion text,
  estado      estado_incidencia not null default 'abierta',
  costo       numeric(12,2),
  gasto_id    uuid references gastos(id) on delete set null,
  reportado_por uuid references perfiles(id),
  creado_en   timestamptz not null default now()
);

-- Índices por empresa (todas las consultas filtran por tenant)
create index on edificios (empresa_id);
create index on unidades (edificio_id);
create index on cuotas (edificio_id, periodo);
create index on pagos (cuota_id);
create index on gastos (edificio_id, fecha);
create index on incidencias (edificio_id, estado);

-- =====================================================================
-- Funciones auxiliares de seguridad
-- =====================================================================
create or replace function mi_empresa_id() returns uuid
language sql stable security definer set search_path = public as $$
  select empresa_id from perfiles where id = auth.uid()
$$;

create or replace function mi_rol() returns rol_usuario
language sql stable security definer set search_path = public as $$
  select rol from perfiles where id = auth.uid()
$$;

-- ¿Es staff de la empresa con acceso a este edificio?
create or replace function puede_gestionar(p_edificio uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select case mi_rol()
    when 'superadmin' then true
    when 'admin_empresa' then exists (select 1 from edificios e where e.id = p_edificio and e.empresa_id = mi_empresa_id())
    when 'administrador' then exists (select 1 from edificio_usuarios eu where eu.edificio_id = p_edificio and eu.usuario_id = auth.uid())
    else false end
$$;

-- ¿Puede ver (lectura) este edificio? staff, junta o propietario de una unidad
create or replace function puede_ver_edificio(p_edificio uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select puede_gestionar(p_edificio)
    or exists (select 1 from edificio_usuarios eu where eu.edificio_id = p_edificio and eu.usuario_id = auth.uid())
    or exists (select 1 from unidades u join personas p on p.id = u.propietario_id
               where u.edificio_id = p_edificio and p.usuario_id = auth.uid())
$$;

-- ¿Es el propietario de la unidad?
create or replace function es_mi_unidad(p_unidad uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from unidades u join personas p on p.id = u.propietario_id
                 where u.id = p_unidad and p.usuario_id = auth.uid())
$$;

-- =====================================================================
-- Row Level Security
-- =====================================================================
alter table empresas          enable row level security;
alter table perfiles          enable row level security;
alter table edificios         enable row level security;
alter table edificio_usuarios enable row level security;
alter table personas          enable row level security;
alter table unidades          enable row level security;
alter table presupuestos      enable row level security;
alter table partidas          enable row level security;
alter table gastos            enable row level security;
alter table cuotas            enable row level security;
alter table pagos             enable row level security;
alter table incidencias       enable row level security;

-- Empresas
create policy empresas_ver on empresas for select
  using (id = mi_empresa_id() or mi_rol() = 'superadmin');
create policy empresas_admin on empresas for all
  using (mi_rol() = 'superadmin') with check (mi_rol() = 'superadmin');

-- Perfiles
create policy perfiles_propio on perfiles for select
  using (id = auth.uid() or (empresa_id = mi_empresa_id() and mi_rol() in ('admin_empresa','administrador')) or mi_rol() = 'superadmin');
create policy perfiles_gestion on perfiles for all
  using ((empresa_id = mi_empresa_id() and mi_rol() = 'admin_empresa') or mi_rol() = 'superadmin')
  with check ((empresa_id = mi_empresa_id() and mi_rol() = 'admin_empresa') or mi_rol() = 'superadmin');

-- Edificios
create policy edificios_ver on edificios for select using (puede_ver_edificio(id));
create policy edificios_gestion on edificios for all
  using ((empresa_id = mi_empresa_id() and mi_rol() = 'admin_empresa') or mi_rol() = 'superadmin')
  with check ((empresa_id = mi_empresa_id() and mi_rol() = 'admin_empresa') or mi_rol() = 'superadmin');

create policy eu_ver on edificio_usuarios for select using (puede_ver_edificio(edificio_id));
create policy eu_gestion on edificio_usuarios for all
  using (puede_gestionar(edificio_id) and mi_rol() in ('admin_empresa','superadmin'))
  with check (puede_gestionar(edificio_id) and mi_rol() in ('admin_empresa','superadmin'));

-- Personas
create policy personas_ver on personas for select
  using (usuario_id = auth.uid() or (empresa_id = mi_empresa_id() and mi_rol() in ('admin_empresa','administrador','junta')) or mi_rol() = 'superadmin');
create policy personas_gestion on personas for all
  using ((empresa_id = mi_empresa_id() and mi_rol() in ('admin_empresa','administrador')) or mi_rol() = 'superadmin')
  with check ((empresa_id = mi_empresa_id() and mi_rol() in ('admin_empresa','administrador')) or mi_rol() = 'superadmin');

-- Tablas por edificio: lectura para quien puede ver, escritura para staff
create policy unidades_ver on unidades for select using (puede_ver_edificio(edificio_id));
create policy unidades_gestion on unidades for all
  using (puede_gestionar(edificio_id)) with check (puede_gestionar(edificio_id) and empresa_id = (select empresa_id from edificios where id = edificio_id));

create policy presupuestos_ver on presupuestos for select using (puede_ver_edificio(edificio_id));
create policy presupuestos_gestion on presupuestos for all
  using (puede_gestionar(edificio_id)) with check (puede_gestionar(edificio_id));

create policy partidas_ver on partidas for select
  using (exists (select 1 from presupuestos p where p.id = presupuesto_id and puede_ver_edificio(p.edificio_id)));
create policy partidas_gestion on partidas for all
  using (exists (select 1 from presupuestos p where p.id = presupuesto_id and puede_gestionar(p.edificio_id)))
  with check (exists (select 1 from presupuestos p where p.id = presupuesto_id and puede_gestionar(p.edificio_id)));

create policy gastos_ver on gastos for select using (puede_ver_edificio(edificio_id));
create policy gastos_gestion on gastos for all
  using (puede_gestionar(edificio_id)) with check (puede_gestionar(edificio_id));

-- Cuotas: el propietario ve solo las suyas; staff y junta todas las del edificio
create policy cuotas_ver on cuotas for select
  using (puede_gestionar(edificio_id) or es_mi_unidad(unidad_id)
         or exists (select 1 from edificio_usuarios eu where eu.edificio_id = cuotas.edificio_id and eu.usuario_id = auth.uid()));
create policy cuotas_gestion on cuotas for all
  using (puede_gestionar(edificio_id)) with check (puede_gestionar(edificio_id));

-- Pagos: el propietario puede ver y reportar pagos de sus cuotas (quedan sin validar)
create policy pagos_ver on pagos for select
  using (exists (select 1 from cuotas c where c.id = cuota_id
                 and (puede_gestionar(c.edificio_id) or es_mi_unidad(c.unidad_id)
                      or exists (select 1 from edificio_usuarios eu where eu.edificio_id = c.edificio_id and eu.usuario_id = auth.uid()))));
create policy pagos_reportar on pagos for insert
  with check (validado = false and exists (select 1 from cuotas c where c.id = cuota_id and es_mi_unidad(c.unidad_id)));
create policy pagos_gestion on pagos for all
  using (exists (select 1 from cuotas c where c.id = cuota_id and puede_gestionar(c.edificio_id)))
  with check (exists (select 1 from cuotas c where c.id = cuota_id and puede_gestionar(c.edificio_id)));

-- Incidencias: todos los que ven el edificio pueden verlas y reportarlas
create policy incidencias_ver on incidencias for select using (puede_ver_edificio(edificio_id));
create policy incidencias_reportar on incidencias for insert
  with check (puede_ver_edificio(edificio_id) and reportado_por = auth.uid());
create policy incidencias_gestion on incidencias for all
  using (puede_gestionar(edificio_id)) with check (puede_gestionar(edificio_id));

-- =====================================================================
-- Lógica de negocio
-- =====================================================================

-- Genera las cuotas de un mes: cuota = total mensual del presupuesto × % participación
create or replace function generar_cuotas(p_edificio uuid, p_periodo date)
returns integer language plpgsql security invoker as $$
declare
  v_total numeric(12,2);
  v_dia smallint;
  v_periodo date := date_trunc('month', p_periodo)::date;
  v_n integer;
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

  select dia_vencimiento into v_dia from edificios where id = p_edificio;

  insert into cuotas (empresa_id, edificio_id, unidad_id, periodo, monto, vencimiento)
  select u.empresa_id, u.edificio_id, u.id, v_periodo,
         round(v_total * u.porcentaje_participacion / 100, 2),
         v_periodo + (v_dia - 1)
  from unidades u
  where u.edificio_id = p_edificio and u.porcentaje_participacion > 0
  on conflict (unidad_id, periodo) do nothing;

  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- Recalcula el estado de la cuota cuando se valida/edita un pago
create or replace function actualizar_estado_cuota() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_cuota uuid := coalesce(new.cuota_id, old.cuota_id);
  v_pagado numeric(12,2);
  v_monto numeric(12,2);
begin
  select coalesce(sum(monto), 0) into v_pagado from pagos where cuota_id = v_cuota and validado;
  select monto into v_monto from cuotas where id = v_cuota;
  update cuotas set estado = case
      when v_pagado >= v_monto then 'pagada'::estado_cuota
      when v_pagado > 0 then 'parcial'::estado_cuota
      else 'pendiente'::estado_cuota end
  where id = v_cuota and estado <> 'anulada';
  return null;
end $$;

create trigger trg_pagos_estado after insert or update or delete on pagos
  for each row execute function actualizar_estado_cuota();

-- Vista: estado de cuenta por unidad (deuda acumulada)
create or replace view estado_cuenta with (security_invoker = true) as
select c.edificio_id, c.unidad_id, u.codigo,
       sum(c.monto) as total_emitido,
       coalesce(sum(pg.pagado), 0) as total_pagado,
       sum(c.monto) - coalesce(sum(pg.pagado), 0) as deuda,
       count(*) filter (where c.estado in ('pendiente','parcial') and c.vencimiento < current_date) as cuotas_vencidas
from cuotas c
join unidades u on u.id = c.unidad_id
left join (select cuota_id, sum(monto) pagado from pagos where validado group by cuota_id) pg on pg.cuota_id = c.id
where c.estado <> 'anulada'
group by c.edificio_id, c.unidad_id, u.codigo;

-- Vista: presupuesto vs. ejecutado por partida (transparencia para la junta)
create or replace view ejecucion_presupuesto with (security_invoker = true) as
select pr.edificio_id, pr.anio, pa.id as partida_id, pa.nombre,
       pa.monto_mensual * 12 as presupuesto_anual,
       coalesce(sum(g.monto), 0) as ejecutado
from presupuestos pr
join partidas pa on pa.presupuesto_id = pr.id
left join gastos g on g.partida_id = pa.id and extract(year from g.fecha) = pr.anio
group by pr.edificio_id, pr.anio, pa.id, pa.nombre, pa.monto_mensual;

-- Crear perfil automáticamente al registrarse un usuario
create or replace function crear_perfil() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into perfiles (id, email, nombre) values (new.id, new.email, new.raw_user_meta_data->>'nombre');
  return new;
end $$;

create trigger trg_auth_nuevo_usuario after insert on auth.users
  for each row execute function crear_perfil();
