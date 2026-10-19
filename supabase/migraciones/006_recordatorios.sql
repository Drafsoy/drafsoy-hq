-- =====================================================================
-- DRAFSOY HQ · Recordatorios por Telegram ("recuérdame en 2 minutos revisar WSE")
-- Cómo usarlo: Supabase -> SQL Editor -> pestaña NUEVA -> pegar -> Run (una vez).
-- Antes hay que guardar el secreto del aviso en la caja fuerte (Vault): mira supabase/TELEGRAM.md.
-- =====================================================================

-- 1) Los recordatorios. chat_id vacío = al Telegram del dueño (lo que crea la app de escritorio).
--    enviado_en vacío = todavía no se ha mandado.
create table if not exists public.recordatorios (
  id          uuid primary key default gen_random_uuid(),
  dueno       uuid not null default auth.uid() references auth.users on delete cascade,
  chat_id     bigint,
  texto       text not null,
  cuando      timestamptz not null,
  enviado_en  timestamptz,
  creado_en   timestamptz not null default now()
);
create index if not exists recordatorios_pendientes on public.recordatorios (cuando) where enviado_en is null;

-- 2) Seguridad: activada. La app (con tu sesión) solo ve y toca los tuyos; la Edge Function usa su llave de servidor.
alter table public.recordatorios enable row level security;
drop policy if exists solo_dueno on public.recordatorios;
create policy solo_dueno on public.recordatorios for all to authenticated using (dueno = auth.uid()) with check (dueno = auth.uid());

-- 3) Resumen diario de agenda: a qué hora (vacío = apagado) y qué día se mandó el último
alter table public.telegram_chats add column if not exists resumen_diario time;
alter table public.telegram_chats add column if not exists resumen_enviado_el date;

-- 4) El "despertador": cada minuto Supabase llama a la función aura-recordatorios,
--    con el secreto guardado en la caja fuerte (Vault) con el nombre aura_recordatorios_secreto.
create extension if not exists pg_cron;
create extension if not exists pg_net;
select cron.schedule(
  'aura-recordatorios',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://qgmqygahwgiucwdoezpz.supabase.co/functions/v1/aura-recordatorios',
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-aura-secreto', (select decrypted_secret from vault.decrypted_secrets where name = 'aura_recordatorios_secreto')
    ),
    body := '{}'::jsonb
  )
  $$
);

-- 5) Resultado: debe mostrar la tabla y el despertador
select 'tabla' as que, table_name as nombre from information_schema.tables where table_schema = 'public' and table_name = 'recordatorios'
union all
select 'despertador', jobname from cron.job where jobname = 'aura-recordatorios';
