-- =====================================================================
-- DRAFSOY HQ · Modelo de agencia: clientes y cuentas por empleado
-- Antes: cada piso era un cliente con un agente.
-- Ahora: una sola oficina; cada empleado lleva varias cuentas (clientes).
-- Cómo usarlo: Supabase -> SQL Editor -> pestaña NUEVA -> pegar -> Run (una vez).
-- =====================================================================

-- 1) Clientes (las cuentas de la agencia)
create table public.clientes (
  id           uuid primary key default gen_random_uuid(),
  dueno        uuid not null default auth.uid() references auth.users on delete cascade,
  nombre       text not null,
  color        text not null default '#3fb6ff',
  descripcion  text,
  activo       boolean not null default true,
  creado_en    timestamptz not null default now()
);

-- 2) Qué cuentas lleva cada empleado (uno puede llevar varias, y una cuenta puede tener varios)
create table public.agente_clientes (
  id          uuid primary key default gen_random_uuid(),
  dueno       uuid not null default auth.uid() references auth.users on delete cascade,
  agente_id   uuid not null references public.agentes on delete cascade,
  cliente_id  uuid not null references public.clientes on delete cascade,
  creado_en   timestamptz not null default now(),
  unique (agente_id, cliente_id)
);

-- 3) Pasar los clientes actuales (los pisos de tipo "cliente") con el mismo id
insert into public.clientes (id, dueno, nombre, color, descripcion, creado_en)
select id, dueno, nombre, color, descripcion, creado_en from public.pisos where tipo = 'cliente';

insert into public.agente_clientes (dueno, agente_id, cliente_id)
select a.dueno, a.id, a.piso_id from public.agentes a join public.clientes c on c.id = a.piso_id;

-- 4) Tareas, aprobaciones y memoria apuntan ahora al cliente
alter table public.tareas add column cliente_id uuid references public.clientes on delete set null;
update public.tareas set cliente_id = piso_id where piso_id in (select id from public.clientes);

alter table public.aprobaciones add column cliente_id uuid references public.clientes on delete set null;
update public.aprobaciones set cliente_id = piso_id where piso_id in (select id from public.clientes);

alter table public.memoria_cliente add column cliente_id uuid references public.clientes on delete cascade;
update public.memoria_cliente set cliente_id = piso_id where piso_id in (select id from public.clientes);
delete from public.memoria_cliente where cliente_id is null;
alter table public.memoria_cliente alter column cliente_id set not null;
alter table public.memoria_cliente alter column piso_id drop not null;

create index on public.tareas (cliente_id);
create index on public.aprobaciones (cliente_id);
create index on public.memoria_cliente (cliente_id);
create index on public.agente_clientes (agente_id);

-- 5) Seguridad y tiempo real para las tablas nuevas
alter table public.clientes enable row level security;
alter table public.agente_clientes enable row level security;
create policy solo_dueno on public.clientes for all to authenticated using (dueno = auth.uid()) with check (dueno = auth.uid());
create policy solo_dueno on public.agente_clientes for all to authenticated using (dueno = auth.uid()) with check (dueno = auth.uid());
alter publication supabase_realtime add table public.clientes, public.agente_clientes;

-- 6) Datos iniciales para una cuenta nueva (ya no crea pisos)
create or replace function public.sembrar_inicio() returns void
language plpgsql security invoker as $$
declare
  yo uuid := auth.uid();
  c_wse uuid; c_nawara uuid; c_archivo uuid; c_drafsoy uuid;
  a_max uuid; a_kai uuid; a_luna uuid; a_leo uuid;
begin
  if yo is null then raise exception 'Necesitas iniciar sesión'; end if;
  perform pg_advisory_xact_lock(hashtext('sembrar_inicio:' || yo::text));
  if exists (select 1 from public.agentes where dueno = yo) then return; end if;

  insert into public.ajustes (dueno) values (yo) on conflict do nothing;

  insert into public.clientes (nombre, color) values ('Wall Street English', '#ff5a6e') returning id into c_wse;
  insert into public.clientes (nombre, color) values ('Nawara Nikkei', '#ff9f40') returning id into c_nawara;
  insert into public.clientes (nombre, color) values ('Archivo Draf', '#5ad15a') returning id into c_archivo;
  insert into public.clientes (nombre, color) values ('Drafsoy', '#a15cff') returning id into c_drafsoy;

  insert into public.agentes (nombre, rol, color, modelo, es_recepcionista, herramientas, instrucciones) values
    ('Rocío', 'Recepcionista', '#ffc93c', 'claude-haiku-5-5', true, '{crear_tarea,asignar_tarea,consultar_agenda}',
     'Recibes las tareas de Rafa en lenguaje natural, detectas cliente, tipo, fecha y prioridad, y las asignas al empleado correcto. Preguntas solo si falta algo esencial.');

  insert into public.agentes (nombre, rol, color, herramientas, instrucciones) values
    ('Max', 'Trafficker', '#ff5a6e', '{redactar,analizar,memoria_cliente,proponer_accion}', 'Trafficker digital de la agencia.') returning id into a_max;
  insert into public.agentes (nombre, rol, color, herramientas, instrucciones) values
    ('Kai', 'Trafficker', '#ff9f40', '{redactar,analizar,memoria_cliente,proponer_accion}', 'Trafficker digital de la agencia.') returning id into a_kai;
  insert into public.agentes (nombre, rol, color, herramientas, instrucciones) values
    ('Luna', 'Trafficker', '#5ad15a', '{redactar,analizar,memoria_cliente,proponer_accion}', 'Trafficker digital de la agencia.') returning id into a_luna;
  insert into public.agentes (nombre, rol, color, herramientas, instrucciones) values
    ('Leo', 'Trafficker', '#a15cff', '{redactar,analizar,memoria_cliente,proponer_accion}', 'Trafficker digital de la agencia.') returning id into a_leo;

  insert into public.agente_clientes (agente_id, cliente_id) values
    (a_max, c_wse), (a_kai, c_nawara), (a_luna, c_archivo), (a_leo, c_drafsoy);
end $$;

-- 7) Resultado: debe mostrar tus clientes y cuántas cuentas lleva cada empleado
select a.nombre as empleado, count(ac.id) as cuentas
from public.agentes a left join public.agente_clientes ac on ac.agente_id = a.id
group by a.nombre order by a.nombre;
