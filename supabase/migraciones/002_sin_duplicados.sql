-- =====================================================================
-- DRAFSOY HQ · Arreglo: evitar pisos/agentes duplicados al arrancar
-- Cómo usarlo: Supabase -> SQL Editor -> pestaña NUEVA -> pegar -> Run.
-- Se puede ejecutar más de una vez sin problema.
-- =====================================================================

-- 1) Borra los datos iniciales duplicados (todavía no hay tareas reales).
--    La app los vuelve a crear, una sola vez, al entrar.
delete from public.agentes;
delete from public.pisos;

-- 2) No puede haber dos pisos con el mismo número en tu edificio.
alter table public.pisos drop constraint if exists pisos_numero_unico;
alter table public.pisos add constraint pisos_numero_unico unique (dueno, numero);

-- 3) La función de datos iniciales ahora "hace fila": si se llama dos veces
--    a la vez, la segunda espera a la primera y ve que ya hay pisos.
create or replace function public.sembrar_inicio() returns void
language plpgsql security invoker as $$
declare
  yo uuid := auth.uid();
  p_lobby uuid; p_wse uuid; p_nawara uuid; p_archivo uuid; p_drafsoy uuid; p_azotea uuid;
begin
  if yo is null then raise exception 'Necesitas iniciar sesión'; end if;

  perform pg_advisory_xact_lock(hashtext('sembrar_inicio:' || yo::text));
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

-- 4) Resultado: debe decir pisos = 0, agentes = 0, regla_unica = 1, funcion_con_fila = true
select
  (select count(*) from public.pisos) as pisos,
  (select count(*) from public.agentes) as agentes,
  (select count(*) from pg_constraint where conname = 'pisos_numero_unico') as regla_unica,
  (select prosrc like '%pg_advisory_xact_lock%' from pg_proc where proname = 'sembrar_inicio') as funcion_con_fila;
