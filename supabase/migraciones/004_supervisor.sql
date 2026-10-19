-- =====================================================================
-- DRAFSOY HQ · Supervisor (tu agente), revisión y trabajo automático
-- Cómo usarlo: Supabase -> SQL Editor -> pestaña NUEVA -> pegar -> Run (una vez).
-- =====================================================================

-- 1) Tu agente supervisor: revisa todo lo que hacen los demás
alter table public.agentes add column if not exists es_supervisor boolean not null default false;

-- 2) Las propuestas pasan primero por revisión del supervisor ('en_revision')
alter table public.aprobaciones drop constraint if exists aprobaciones_estado_check;
alter table public.aprobaciones add constraint aprobaciones_estado_check
  check (estado in ('en_revision', 'pendiente', 'aprobada', 'rechazada', 'ejecutada', 'fallida'));
alter table public.aprobaciones add column if not exists nota_supervisor text;

-- 3) Notas de revisión e intentos en cada tarea
alter table public.tareas add column if not exists revision text;
alter table public.tareas add column if not exists intentos int not null default 0;

-- 4) Interruptor de trabajo automático
alter table public.ajustes add column if not exists trabajo_automatico boolean not null default true;

-- 5) Crear tu supervisor si aún no existe
insert into public.agentes (dueno, nombre, rol, color, modelo, es_supervisor, herramientas, tope_gasto_usd, instrucciones)
select distinct a.dueno, 'Rafa IA', 'Supervisor', '#1b1f4b', 'claude-opus-5-5', true, '{revisar,buscar_web}'::text[], 20,
  'Eres el supervisor de la agencia y representas el criterio de Rafa. Revisas todo lo que entregan los empleados antes de que llegue a Rafa: que cumpla lo pedido, que respete la memoria del cliente (tono, público, prohibiciones) y que los datos sean reales y comprobables. Si algo no está bien, lo devuelves con correcciones concretas.'
from public.agentes a
where not exists (select 1 from public.agentes b where b.dueno = a.dueno and b.es_supervisor);

-- 6) Cancelar las tareas de prueba que siguen pendientes (para que no gasten al arrancar el trabajo automático)
update public.tareas set estado = 'cancelada' where titulo = 'Tarea de prueba' and estado in ('pendiente', 'en_progreso');

-- 7) Resultado: debe aparecer tu supervisor
select nombre, rol, modelo, es_supervisor from public.agentes where es_supervisor;
