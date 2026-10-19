-- =====================================================================
-- DRAFSOY HQ · Esquema de base de datos (Reto 1)
-- Cómo usarlo: Supabase -> SQL Editor -> New query -> pegar todo -> Run.
-- Se puede ejecutar una sola vez en un proyecto nuevo.
-- =====================================================================

-- Cada fila guarda quién es su dueño (tu usuario). Las reglas de seguridad
-- (RLS) hacen que solo tu usuario pueda ver o tocar tus datos.

-- ---------- PISOS (cada piso de cliente es un cliente) ----------
create table public.pisos (
  id           uuid primary key default gen_random_uuid(),
  dueno        uuid not null default auth.uid() references auth.users on delete cascade,
  nombre       text not null,
  numero       int  not null,                    -- orden en el edificio (0 = Lobby)
  tipo         text not null default 'cliente' check (tipo in ('lobby', 'cliente', 'azotea')),
  color        text not null default '#3fb6ff',
  descripcion  text,
  creado_en    timestamptz not null default now()
);

-- ---------- AGENTES ----------
create table public.agentes (
  id                       uuid primary key default gen_random_uuid(),
  dueno                    uuid not null default auth.uid() references auth.users on delete cascade,
  nombre                   text not null,
  skin_avatar              text,                 -- ruta a .png (luego)
  skin_modelo              text,                 -- ruta a .glb (luego)
  color                    text not null default '#a15cff',
  piso_id                  uuid references public.pisos on delete set null,
  rol                      text not null,
  instrucciones            text not null default '',
  herramientas             text[] not null default '{}',
  modelo                   text not null default 'claude-sonnet-5-5',
  acciones_con_aprobacion  text[] not null default '{enviar,publicar,pausar,cambiar_presupuesto,subir_archivo}',
  tareas_recurrentes       jsonb not null default '[]',
  tope_gasto_usd           numeric(10,2) not null default 10,
  estado                   text not null default 'disponible'
                           check (estado in ('disponible', 'trabajando', 'te_necesita', 'esperando_aprobacion')),
  es_recepcionista         boolean not null default false,
  creado_en                timestamptz not null default now()
);

-- ---------- TAREAS ----------
create table public.tareas (
  id              uuid primary key default gen_random_uuid(),
  dueno           uuid not null default auth.uid() references auth.users on delete cascade,
  titulo          text not null,
  descripcion     text,
  tipo            text,                          -- copy, reporte, campaña, diseño...
  estado          text not null default 'pendiente'
                  check (estado in ('pendiente', 'en_progreso', 'te_necesita', 'esperando_aprobacion', 'completada', 'cancelada')),
  prioridad       text not null default 'media' check (prioridad in ('baja', 'media', 'alta', 'urgente')),
  piso_id         uuid references public.pisos on delete set null,      -- el cliente
  agente_id       uuid references public.agentes on delete set null,
  fecha_limite    date,
  resultado       text,
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now()
);

-- ---------- APROBACIONES (la bandeja) ----------
create table public.aprobaciones (
  id           uuid primary key default gen_random_uuid(),
  dueno        uuid not null default auth.uid() references auth.users on delete cascade,
  tarea_id     uuid references public.tareas on delete cascade,
  agente_id    uuid references public.agentes on delete set null,
  piso_id      uuid references public.pisos on delete set null,
  tipo_accion  text not null,                    -- enviar, publicar, pausar, cambiar_presupuesto, subir_archivo
  titulo       text not null,
  detalle      jsonb not null default '{}',       -- qué exactamente se va a hacer
  estado       text not null default 'pendiente'
               check (estado in ('pendiente', 'aprobada', 'rechazada', 'ejecutada', 'fallida')),
  comentario   text,                             -- tu nota al aprobar/rechazar
  resultado    jsonb,
  creado_en    timestamptz not null default now(),
  resuelto_en  timestamptz
);

-- ---------- MENSAJES (chat con la recepción y con agentes) ----------
create table public.mensajes (
  id         uuid primary key default gen_random_uuid(),
  dueno      uuid not null default auth.uid() references auth.users on delete cascade,
  canal      text not null default 'recepcion',  -- 'recepcion' o el id de un agente
  rol        text not null check (rol in ('usuario', 'asistente', 'sistema')),
  contenido  text not null,
  tarea_id   uuid references public.tareas on delete set null,
  creado_en  timestamptz not null default now()
);

-- ---------- MEMORIA POR CLIENTE ----------
create table public.memoria_cliente (
  id              uuid primary key default gen_random_uuid(),
  dueno           uuid not null default auth.uid() references auth.users on delete cascade,
  piso_id         uuid not null references public.pisos on delete cascade,
  clave           text not null,                 -- p. ej. "tono de marca", "público objetivo"
  contenido       text not null,
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now()
);

-- ---------- GASTOS (cada llamada a la IA) ----------
create table public.gastos (
  id              uuid primary key default gen_random_uuid(),
  dueno           uuid not null default auth.uid() references auth.users on delete cascade,
  agente_id       uuid references public.agentes on delete set null,
  tarea_id        uuid references public.tareas on delete set null,
  modelo          text not null,
  tokens_entrada  int not null default 0,
  tokens_salida   int not null default 0,
  costo_usd       numeric(12,6) not null default 0,
  creado_en       timestamptz not null default now()
);

-- ---------- AJUSTES GENERALES ----------
create table public.ajustes (
  dueno             uuid primary key default auth.uid() references auth.users on delete cascade,
  tope_mensual_usd  numeric(10,2) not null default 50,
  modelo_recepcion  text not null default 'claude-haiku-5-5',
  modelo_agentes    text not null default 'claude-sonnet-5-5',
  actualizado_en    timestamptz not null default now()
);

-- ---------- Índices para que todo cargue rápido ----------
create index on public.agentes (piso_id);
create index on public.tareas (piso_id, estado);
create index on public.tareas (agente_id);
create index on public.aprobaciones (estado);
create index on public.mensajes (canal, creado_en);
create index on public.memoria_cliente (piso_id);
create index on public.gastos (creado_en);

-- ---------- "actualizado_en" se rellena solo ----------
create function public.tocar_actualizado() returns trigger language plpgsql as $$
begin
  new.actualizado_en := now();
  return new;
end $$;

create trigger tareas_actualizado before update on public.tareas
  for each row execute function public.tocar_actualizado();
create trigger memoria_actualizado before update on public.memoria_cliente
  for each row execute function public.tocar_actualizado();
create trigger ajustes_actualizado before update on public.ajustes
  for each row execute function public.tocar_actualizado();

-- ---------- SEGURIDAD: solo tu usuario ve y toca tus filas ----------
do $$
declare t text;
begin
  foreach t in array array['pisos','agentes','tareas','aprobaciones','mensajes','memoria_cliente','gastos','ajustes'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy solo_dueno on public.%I for all to authenticated using (dueno = auth.uid()) with check (dueno = auth.uid())', t);
  end loop;
end $$;

-- ---------- TIEMPO REAL: cambios visibles al instante en Windows y Mac ----------
alter publication supabase_realtime add table
  public.pisos, public.agentes, public.tareas, public.aprobaciones,
  public.mensajes, public.memoria_cliente, public.gastos, public.ajustes;

-- ---------- DATOS INICIALES ----------
-- La app llama a esta función la primera vez que entras. Si ya tienes pisos, no hace nada.
create function public.sembrar_inicio() returns void
language plpgsql security invoker as $$
declare
  yo uuid := auth.uid();
  p_lobby uuid; p_wse uuid; p_nawara uuid; p_archivo uuid; p_drafsoy uuid; p_azotea uuid;
begin
  if yo is null then raise exception 'Necesitas iniciar sesión'; end if;
  if exists (select 1 from public.pisos where dueno = yo) then return; end if;

  insert into public.ajustes (dueno) values (yo) on conflict do nothing;

  insert into public.pisos (nombre, numero, tipo, color, descripcion) values
    ('Lobby', 0, 'lobby', '#ffc93c', 'Recepción y correo') returning id into p_lobby;
  insert into public.pisos (nombre, numero, tipo, color) values
    ('Wall Street English', 1, 'cliente', '#ff5a6e') returning id into p_wse;
  insert into public.pisos (nombre, numero, tipo, color) values
    ('Nawara Nikkei', 2, 'cliente', '#ff9f40') returning id into p_nawara;
  insert into public.pisos (nombre, numero, tipo, color) values
    ('Archivo Draf', 3, 'cliente', '#5ad15a') returning id into p_archivo;
  insert into public.pisos (nombre, numero, tipo, color) values
    ('Drafsoy', 4, 'cliente', '#a15cff') returning id into p_drafsoy;
  insert into public.pisos (nombre, numero, tipo, color, descripcion) values
    ('Azotea', 99, 'azotea', '#3fb6ff', 'Aprobaciones') returning id into p_azotea;

  insert into public.agentes (nombre, piso_id, rol, color, modelo, es_recepcionista, herramientas, instrucciones) values
    ('Rocío', p_lobby, 'Recepcionista', '#ffc93c', 'claude-haiku-5-5', true,
     '{crear_tarea,asignar_tarea,consultar_agenda}',
     'Recibes las tareas de Rafa en lenguaje natural, detectas cliente, tipo, fecha y prioridad, y las asignas al agente correcto. Preguntas solo si falta algo esencial.');

  insert into public.agentes (nombre, piso_id, rol, color, herramientas, instrucciones) values
    ('Max',  p_wse,     'Trafficker', '#ff5a6e', '{redactar,analizar,memoria_cliente,proponer_accion}', 'Trafficker digital de Wall Street English.'),
    ('Kai',  p_nawara,  'Trafficker', '#ff9f40', '{redactar,analizar,memoria_cliente,proponer_accion}', 'Trafficker digital de Nawara Nikkei.'),
    ('Luna', p_archivo, 'Trafficker', '#5ad15a', '{redactar,analizar,memoria_cliente,proponer_accion}', 'Trafficker digital de Archivo Draf.'),
    ('Leo',  p_drafsoy, 'Trafficker', '#a15cff', '{redactar,analizar,memoria_cliente,proponer_accion}', 'Trafficker digital de Drafsoy.');
end $$;
