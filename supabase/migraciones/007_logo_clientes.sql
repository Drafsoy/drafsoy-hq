-- Logo de cada cliente: una imagen pequeña (data URL webp) que se ve en la lista, la ficha y la analítica.
alter table public.clientes add column if not exists logo text;
