# Hablar con la recepcionista por Telegram

Con esto le escribes a tu recepcionista desde el móvil y te responde **aunque el PC esté apagado**.

## Cómo funciona (en simple)

```
Tú (Telegram) ──► Bot de Telegram ──► Supabase (función "aura-telegram", en la nube)
                                         │  1. ¿Es Rafa? (lista blanca)
                                         │  2. Guarda tu mensaje en el chat de recepción
                                         │  3. La recepcionista piensa (Claude) y crea/cambia tareas
                                         │  4. Apunta lo que costó (gastos y topes)
Tú (Telegram) ◄── respuesta ◄────────────┘
```

- El código está en `supabase/functions/aura-telegram/index.ts`. Es la misma lógica que la
  recepcionista de la app (`electron/agentes/recepcionista.ts`): si cambias una, cambia la otra.
- Lo que hablas por Telegram aparece también en el chat de recepción de la app, y al revés.
- Las tareas que crea quedan guardadas al momento. **Los empleados las trabajan cuando abres la app.**
- Si la app está abierta cuando escribes, la tarea cae en paracaídas en la oficina. Si está cerrada,
  la verás en su sitio al abrirla.

Tardas unos 15 minutos. Necesitas: Telegram en el móvil, entrar a supabase.com y tu archivo `.env`.

---

## Paso 1 · Crear el bot con BotFather

1. En Telegram busca **@BotFather** (tiene la marca azul de verificado) y ábrelo.
2. Escribe `/newbot`.
3. Te pide un **nombre** (el que se ve): por ejemplo `Recepción Drafsoy`.
4. Te pide un **usuario** que termine en `bot`: por ejemplo `drafsoy_recepcion_bot`.
5. Te responde con un **token**, algo como `7123456789:AAH...`. Cópialo y guárdalo: es la llave del bot.
   No se lo pases a nadie.

## Paso 2 · Preparar la base de datos

Supabase → **SQL Editor** → pestaña nueva → pega todo `supabase/migraciones/005_telegram.sql` → **Run**.
Debe mostrar dos tablas: `telegram_chats` y `telegram_recibidos`.

## Paso 3 · Subir la función a Supabase

**Opción fácil (desde la web):**

1. Supabase → **Edge Functions** → **Deploy a new function** → **Via Editor**.
2. Nombre: `aura-telegram` (exactamente así).
3. Borra el ejemplo, pega todo el contenido de `supabase/functions/aura-telegram/index.ts` y pulsa **Deploy**.
4. Entra en la función → **Settings** (o Details) → **desactiva "Verify JWT"** (o "Enforce JWT
   verification") y guarda. Hace falta porque quien llama es Telegram, no la app. La función se protege
   con su propio secreto (paso 4).

**Opción terminal (si lo prefieres)**, desde `D:\drafsoy-hq`. `TU_PROYECTO` es lo que va entre
`https://` y `.supabase.co` en `RENDERER_VITE_SUPABASE_URL` de tu `.env`:

```bash
npx supabase login
```

```bash
npx supabase functions deploy aura-telegram --project-ref TU_PROYECTO --no-verify-jwt
```

## Paso 4 · Guardar los secretos

Supabase → **Edge Functions** → **Secrets** → añade estos (nombre exacto, valor a la derecha):

| Nombre | Valor |
|---|---|
| `ANTHROPIC_API_KEY` | La misma llave que tienes en tu `.env` |
| `TELEGRAM_BOT_TOKEN` | El token que te dio BotFather |
| `TELEGRAM_WEBHOOK_SECRET` | Una contraseña que inventes: solo letras, números, `-` y `_`. Ej: `aura-x7Kp29-drafsoy-Qm41` |
| `ZONA_HORARIA` | (Opcional) Tu zona, para que "hoy" y "mañana" sean los tuyos. Si no lo pones: `America/Lima`. Otras: `America/Bogota`, `America/Mexico_City`, `Europe/Madrid` |

`SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` **no** los tienes que poner: Supabase ya se los da a la función.

## Paso 5 · Conectar el bot con la función

Esto le dice a Telegram "cada mensaje que reciba el bot, mándalo a la función". En PowerShell, cambia
las tres primeras líneas por tus datos y ejecútalo:

```powershell
$token   = "EL_TOKEN_DE_BOTFATHER"
$secreto = "EL_MISMO_TELEGRAM_WEBHOOK_SECRET_DEL_PASO_4"
$url     = "https://TU_PROYECTO.supabase.co/functions/v1/aura-telegram"
Invoke-RestMethod "https://api.telegram.org/bot$token/setWebhook" -Method Post -ContentType "application/json" -Body (@{ url = $url; secret_token = $secreto; allowed_updates = @("message") } | ConvertTo-Json)
```

Debe responder `ok : True` y `Webhook was set`.

## Paso 6 · Autorizarte (lista blanca)

1. Abre tu bot en Telegram (búscalo por su usuario) y escríbele `hola`.
2. Te responde: *"Este chat no está autorizado. Tu número de chat es 123456789"*. Copia ese número.
3. Supabase → **SQL Editor** → pestaña nueva → pega esto cambiando el número y tu correo de la app → **Run**:

```sql
insert into public.telegram_chats (chat_id, dueno, nota)
select 123456789, id, 'Telegram de Rafa' from auth.users where email = 'TU_CORREO_DE_LA_APP';
```

Debe decir `1 row` (si dice `0 rows`, el correo no coincide con el de tu cuenta de la app).

## Paso 7 · Probar

Escríbele al bot: **`para WSE 3 copies urgente`**

- En unos segundos te confirma qué tarea creó, para quién y cuándo vence.
- En la app: la tarea aparece y (si la app está abierta) cae en paracaídas sobre la mesa del empleado.

También puedes preguntarle `¿qué hay hoy?` o `pásala a prioridad baja`.

---

## Recordatorios y resumen diario (ya instalado)

La recepcionista también te **avisa ella sola** por Telegram, con el PC apagado:

- `recuérdame en 2 minutos revisar WSE` → a los 2 minutos te llega "⏰ Recordatorio: revisar WSE".
- `avísame mañana a las 9 de llamar a Pedro` → te llega mañana a las 9:00 (tu hora, la de `ZONA_HORARIA`).
- `¿qué recordatorios tengo?` y `cancela el de Pedro` → los lista o los borra.
- `mándame la agenda cada día a las 8` → cada día a las 8:00 te llega un resumen: tareas atrasadas,
  las que vencen hoy, urgentes y recordatorios. `ya no me mandes la agenda` lo apaga.
- Desde el chat de la app también puedes pedir recordatorios: te llegan igual por Telegram.

Cómo funciona por dentro:

```
Tú: "recuérdame…" ──► aura-telegram guarda el aviso en la tabla "recordatorios" (hora en UTC)
Cada minuto: Supabase (pg_cron) ──► función "aura-recordatorios" ──► manda los que ya tocan por Telegram
                                                                     y los marca como enviados
```

- Código: `supabase/functions/aura-recordatorios/index.ts`. Tabla y despertador:
  `supabase/migraciones/006_recordatorios.sql`.
- El despertador se protege con un secreto que está en dos sitios y **tiene que ser el mismo**:
  el secreto `RECORDATORIOS_SECRETO` de las Edge Functions y el secreto `aura_recordatorios_secreto`
  de la caja fuerte (Supabase → Project Settings → Vault). Ya están puestos; no hay que tocarlos.
- El aviso puede llegar hasta ~1 minuto tarde (el despertador pasa una vez por minuto).
- Si no llega un aviso: Supabase → Edge Functions → `aura-recordatorios` → **Logs**. Si ves `401`,
  los dos secretos de arriba no coinciden.

---

## Seguridad (qué está protegido)

- **Solo tú**: el bot solo atiende los chats de la tabla `telegram_chats`. A cualquier otro solo le dice
  su número de chat; no ve ni toca nada.
- **Solo Telegram**: la función rechaza cualquier llamada que no traiga tu `TELEGRAM_WEBHOOK_SECRET`.
- **Las llaves no salen de Supabase**: la de Anthropic y la del bot viven como secretos de la función.
- La función usa la llave de servidor de Supabase (que se salta las reglas de seguridad), así que en el
  código **cada consulta filtra por tu usuario** a mano. Si algún día añades herramientas, mantén eso.
- Igual que en la app, la recepcionista **no envía ni publica nada**: solo crea y cambia tareas
  (y te manda a ti tus recordatorios; solo a chats de la lista blanca).
  Lo de afuera sigue pasando por tu bandeja de aprobaciones.
- Los topes de gasto se respetan: si se alcanzó el del mes, te lo dice y no gasta más.

## Si algo no va

- **El bot no contesta nada**: Supabase → Edge Functions → `aura-telegram` → **Logs**. Y mira qué ve
  Telegram (en PowerShell, con tu token):

  ```powershell
  Invoke-RestMethod "https://api.telegram.org/botEL_TOKEN_DE_BOTFATHER/getWebhookInfo"
  ```

  Si `last_error_message` dice `401`: el secreto del paso 4 y el del paso 5 no son iguales, o
  "Verify JWT" sigue activado (paso 3.4).
- **"La llave de Anthropic no es válida"**: revisa el secreto `ANTHROPIC_API_KEY`.
- **"No hay ninguna recepcionista"**: en la app, marca a un agente como recepcionista.
- **Cambié el código**: vuelve a pegarlo y pulsa Deploy (o repite el comando de deploy). Los pasos 5 y 6
  no hace falta repetirlos.
