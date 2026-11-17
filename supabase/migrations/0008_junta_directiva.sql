-- =====================================================================
-- Junta directiva por edificio: presidente, tesorero y miembros.
-- Es opcional: un propietario puede no ser parte de la junta.
-- =====================================================================
create table if not exists junta_directiva (
  edificio_id uuid not null references edificios(id) on delete cascade,
  persona_id  uuid not null references personas(id) on delete cascade,
  cargo       text not null check (cargo in ('presidente', 'tesorero', 'miembro')),
  creado_en   timestamptz not null default now(),
  primary key (edificio_id, persona_id)
);

-- Un solo presidente y un solo tesorero por edificio
create unique index if not exists junta_un_presidente on junta_directiva (edificio_id) where cargo = 'presidente';
create unique index if not exists junta_un_tesorero on junta_directiva (edificio_id) where cargo = 'tesorero';

alter table junta_directiva enable row level security;

drop policy if exists junta_ver on junta_directiva;
create policy junta_ver on junta_directiva for select using (puede_ver_edificio(edificio_id));

drop policy if exists junta_gestion on junta_directiva;
create policy junta_gestion on junta_directiva for all
  using (puede_gestionar(edificio_id))
  with check (
    puede_gestionar(edificio_id)
    -- solo propietarios de una unidad de ese edificio
    and exists (select 1 from unidades u where u.edificio_id = junta_directiva.edificio_id
                and u.propietario_id = junta_directiva.persona_id));

-- Si la persona deja de ser propietaria en el edificio, sale de la junta
create or replace function limpiar_junta() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.propietario_id is not null
     and (tg_op = 'DELETE' or new.propietario_id is distinct from old.propietario_id or new.edificio_id <> old.edificio_id)
     and not exists (select 1 from unidades u
                      where u.edificio_id = old.edificio_id and u.propietario_id = old.propietario_id) then
    delete from junta_directiva where edificio_id = old.edificio_id and persona_id = old.propietario_id;
  end if;
  return null;
end $$;
revoke execute on function limpiar_junta() from public, anon, authenticated;

drop trigger if exists trg_limpiar_junta on unidades;
create trigger trg_limpiar_junta after update of propietario_id or delete on unidades
  for each row execute function limpiar_junta();
