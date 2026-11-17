-- =====================================================================
-- Personal de la empresa: supervisores, conserjes, personal de limpieza.
-- Puede o no tener cuenta en la app (usuario_id opcional) y se asigna
-- a uno o más edificios.
-- =====================================================================
create table if not exists personal (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references empresas(id) on delete cascade,
  nombre      text not null,
  telefono    text,
  email       text,
  usuario_id  uuid unique references perfiles(id) on delete set null,
  cargo       text not null check (cargo in ('supervisor', 'conserje', 'limpieza')),
  activo      boolean not null default true,
  creado_en   timestamptz not null default now()
);

create table if not exists personal_edificios (
  personal_id uuid not null references personal(id) on delete cascade,
  edificio_id uuid not null references edificios(id) on delete cascade,
  primary key (personal_id, edificio_id)
);

create index if not exists personal_empresa_idx on personal (empresa_id);
create index if not exists personal_edificios_edificio_idx on personal_edificios (edificio_id);

alter table personal enable row level security;
alter table personal_edificios enable row level security;

-- Funciones auxiliares (evitan que las reglas de las dos tablas se llamen en bucle)
create or replace function administro_personal(p_personal uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from personal p where p.id = p_personal
                 and ((p.empresa_id = mi_empresa_id() and mi_rol() = 'admin_empresa') or mi_rol() = 'superadmin'))
$$;

create or replace function veo_personal(p_personal uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from personal_edificios pe
                 where pe.personal_id = p_personal
                   and (puede_gestionar(pe.edificio_id) or asignado_a(pe.edificio_id)))
$$;

revoke execute on function administro_personal(uuid), veo_personal(uuid) from public, anon;
grant execute on function administro_personal(uuid), veo_personal(uuid) to authenticated;

-- La administradora de la empresa gestiona todo su personal
drop policy if exists personal_admin on personal;
create policy personal_admin on personal for all
  using ((empresa_id = mi_empresa_id() and mi_rol() = 'admin_empresa') or mi_rol() = 'superadmin')
  with check ((empresa_id = mi_empresa_id() and mi_rol() = 'admin_empresa') or mi_rol() = 'superadmin');

-- Supervisores y junta ven al personal de sus edificios (por ejemplo, el conserje)
drop policy if exists personal_ver on personal;
create policy personal_ver on personal for select using (veo_personal(id));

drop policy if exists personal_edificios_admin on personal_edificios;
create policy personal_edificios_admin on personal_edificios for all
  using (administro_personal(personal_id))
  with check (administro_personal(personal_id)
              and exists (select 1 from edificios e where e.id = edificio_id and e.empresa_id = mi_empresa_id()));

drop policy if exists personal_edificios_ver on personal_edificios;
create policy personal_edificios_ver on personal_edificios for select
  using (puede_gestionar(edificio_id) or asignado_a(edificio_id));

-- El usuario vinculado debe ser de la misma empresa
create or replace function validar_personal() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.usuario_id is not null and not exists (
       select 1 from perfiles where id = new.usuario_id and empresa_id = new.empresa_id) then
    raise exception 'El usuario vinculado no pertenece a la empresa';
  end if;
  return new;
end $$;
revoke execute on function validar_personal() from public, anon, authenticated;

drop trigger if exists trg_validar_personal on personal;
create trigger trg_validar_personal before insert or update on personal
  for each row execute function validar_personal();
