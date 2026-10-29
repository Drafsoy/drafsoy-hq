-- Imagen adjunta en un mensaje del chat (data URL jpeg ya reducida en la pantalla, máx. ~1600 px).
alter table public.mensajes add column if not exists imagen text;
