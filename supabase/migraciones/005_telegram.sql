-- =====================================================================
-- DRAFSOY HQ · Hablar con la recepcionista por Telegram
-- Cómo usarlo: Supabase -> SQL Editor -> pestaña NUEVA -> pegar -> Run (una vez).
-- Después, para autorizar tu Telegram, mira el paso 6 de supabase/TELEGRAM.md.
-- =====================================================================

-- 1) Lista blanca: qué chats de Telegram pueden hablar con la recepcionista, y de quién son los datos.
--    Si un chat no está aquí, el bot no hace nada (solo le dice su número de chat).
create table if not exists public.telegram_chats (
  chat_id    bigint primary key,
  dueno      uuid not null references auth.users on delete cascade,
  nota       text,
  creado_en  timestamptz not null default now()
);

-- 2) Mensajes de Telegram ya atendidos (si Telegram reenvía uno, no se crean tareas repetidas)
create table if not exists public.telegram_recibidos (
  update_id  bigint primary key,
  creado_en  timestamptz not null default now()
);

-- 3) Seguridad: activada y SIN reglas → nadie las puede leer desde la app ni desde fuera.
--    Solo la Edge Function (con su llave de servidor) las usa.
alter table public.telegram_chats enable row level security;
alter table public.telegram_recibidos enable row level security;

-- 4) Resultado: debe mostrar las dos tablas
select table_name from information_schema.tables
where table_schema = 'public' and table_name in ('telegram_chats', 'telegram_recibidos');
