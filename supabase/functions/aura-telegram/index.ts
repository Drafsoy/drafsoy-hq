// La recepcionista por Telegram: funciona en Supabase (en la nube), así que responde
// aunque el PC esté apagado. Es la misma lógica que electron/agentes/recepcionista.ts
// (si cambias una, cambia la otra). Las tareas que crea las trabajan los empleados
// cuando la app de escritorio está abierta.
//
// Los recordatorios que crea aquí los manda la función aura-recordatorios (la llama pg_cron cada minuto).
//
// Secretos que necesita (Supabase -> Edge Functions -> Secrets):
//   ANTHROPIC_API_KEY, TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET, ZONA_HORARIA (opcional)
// SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY los pone Supabase solo.

import Anthropic from 'npm:@anthropic-ai/sdk@0.135.0'
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.118.0'

// Lo pone Supabase: deja terminar un trabajo después de haber respondido
declare const EdgeRuntime: { waitUntil(promesa: Promise<unknown>): void }

const MAX_VUELTAS = 6
const PRIORIDADES = ['baja', 'media', 'alta', 'urgente'] as const
const ESTADOS_ABIERTOS = ['pendiente', 'en_progreso', 'te_necesita', 'esperando_aprobacion']
const ZONA = Deno.env.get('ZONA_HORARIA') || 'America/Lima'
const BOT = Deno.env.get('TELEGRAM_BOT_TOKEN') ?? ''

// Precio por millón de tokens (entrada, salida) en USD. Igual que electron/agentes/gastos.ts
const PRECIOS: Record<string, [number, number]> = {
  'claude-haiku-5-5': [0.1, 0.5],
  'claude-sonnet-5-5': [2, 10],
  'claude-opus-5-5': [4, 20]
}

interface Agente {
  id: string
  nombre: string
  rol: string
  modelo: string
  instrucciones: string
  tope_gasto_usd: number
  es_recepcionista: boolean
  es_supervisor: boolean
  estado: string
}
interface Cliente {
  id: string
  nombre: string
  descripcion: string | null
}
interface Tarea {
  id: string
  titulo: string
  estado: string
  prioridad: string
  cliente_id: string | null
  agente_id: string | null
  fecha_limite: string | null
}

// Con la llave de servidor la base de datos NO filtra sola por dueño:
// por eso cada consulta lleva .eq('dueno', ...) y cada fila nueva lleva su dueno.
interface Ctx {
  db: SupabaseClient
  dueno: string
  chatId: number
}

const HERRAMIENTAS: Anthropic.Tool[] = [
  {
    name: 'crear_tarea',
    description:
      'Crea una tarea nueva para un cliente y la asigna a un empleado. Úsala cuando Rafa pida un trabajo y ya sepas al menos el cliente y qué hay que hacer. ' +
      'Si no indica empleado, asígnala a quien lleve la cuenta de ese cliente (si son varios, al que tenga menos tareas abiertas).',
    input_schema: {
      type: 'object',
      properties: {
        titulo: { type: 'string', description: 'Título corto y accionable, p. ej. "3 copies para campaña de verano"' },
        descripcion: { type: 'string', description: 'Detalles del encargo tal como los pidió Rafa' },
        tipo: { type: 'string', description: 'Tipo de trabajo: copy, campaña, reporte, diseño, optimización, estrategia, otro' },
        cliente_id: { type: 'string', description: 'id del cliente (de la lista de clientes)' },
        agente_id: { type: 'string', description: 'id del empleado asignado (de la lista del equipo)' },
        prioridad: { type: 'string', enum: [...PRIORIDADES] },
        fecha_limite: { type: 'string', description: 'Fecha límite en formato AAAA-MM-DD, si la hay' }
      },
      required: ['titulo', 'cliente_id', 'prioridad']
    }
  },
  {
    name: 'consultar_agenda',
    description: 'Lista las tareas abiertas (todas, o las que vencen hasta una fecha), ordenadas por urgencia. Úsala para armar la agenda del día o responder qué hay pendiente.',
    input_schema: {
      type: 'object',
      properties: {
        hasta: { type: 'string', description: 'Fecha AAAA-MM-DD: solo tareas que vencen hasta ese día (incluye las sin fecha si se pide todo)' },
        cliente_id: { type: 'string', description: 'Filtrar por cliente' }
      }
    }
  },
  {
    name: 'cambiar_tarea',
    description: 'Cambia una tarea existente: prioridad, fecha límite, empleado asignado o estado (por ejemplo cancelarla).',
    input_schema: {
      type: 'object',
      properties: {
        tarea_id: { type: 'string' },
        prioridad: { type: 'string', enum: [...PRIORIDADES] },
        fecha_limite: { type: 'string', description: 'AAAA-MM-DD' },
        agente_id: { type: 'string' },
        estado: { type: 'string', enum: ['pendiente', 'en_progreso', 'completada', 'cancelada'] }
      },
      required: ['tarea_id']
    }
  },
  {
    name: 'crear_recordatorio',
    description:
      'Programa un aviso que le llegará a Rafa por Telegram a una hora concreta ("recuérdame en 2 minutos…", "avísame mañana a las 9…"). ' +
      'Usa en_minutos para plazos relativos ("en 10 minutos", "en 2 horas" = 120) y cuando para una fecha y hora concretas.',
    input_schema: {
      type: 'object',
      properties: {
        texto: { type: 'string', description: 'Qué hay que recordarle, corto, p. ej. "Revisar WSE"' },
        en_minutos: { type: 'number', description: 'Dentro de cuántos minutos avisar (desde ahora)' },
        cuando: { type: 'string', description: 'Fecha y hora de Rafa en formato AAAA-MM-DD HH:MM (24 h)' }
      },
      required: ['texto']
    }
  },
  {
    name: 'ver_recordatorios',
    description: 'Lista los recordatorios pendientes (aún no enviados), con su id y hora.',
    input_schema: { type: 'object', properties: {} }
  },
  {
    name: 'cancelar_recordatorio',
    description: 'Cancela (borra) un recordatorio pendiente. Usa ver_recordatorios antes para saber su id.',
    input_schema: {
      type: 'object',
      properties: { recordatorio_id: { type: 'string' } },
      required: ['recordatorio_id']
    }
  },
  {
    name: 'configurar_resumen_diario',
    description: 'Activa, cambia o apaga el resumen diario de agenda que llega por Telegram cada mañana (o a la hora que diga Rafa).',
    input_schema: {
      type: 'object',
      properties: {
        hora: { type: 'string', description: 'Hora HH:MM (24 h) a la que mandarlo. Vacío o "apagado" para desactivarlo.' }
      },
      required: ['hora']
    }
  }
]

const fechaValida = (f: unknown): f is string => typeof f === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(f)

// ---------- Horas en la zona de Rafa (el servidor vive en UTC) ----------
// Cuántos ms va la zona de Rafa por delante de UTC en ese instante (negativo en América)
function desfase(instante: Date): number {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone: ZONA, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
      .formatToParts(instante)
      .map((x) => [x.type, x.value])
  )
  const comoUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second)
  return comoUtc - Math.floor(instante.getTime() / 1000) * 1000
}

// "2026-10-18 15:30" en la zona de Rafa → instante real (UTC)
function horaLocalAUtc(texto: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})$/.exec(texto.trim())
  if (!m) return null
  const comoUtc = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5])
  const aprox = comoUtc - desfase(new Date(comoUtc))
  return new Date(comoUtc - desfase(new Date(aprox))) // segunda vuelta por si cae en cambio de horario
}

// Instante → "sáb 18 oct, 15:30" en la zona de Rafa
const horaParaRafa = (d: Date) =>
  d.toLocaleString('es', { timeZone: ZONA, weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false })

// ---------- Entrada: Telegram llama aquí cada vez que alguien escribe al bot ----------
Deno.serve(async (req) => {
  // Solo Telegram conoce este secreto (se lo damos al registrar el webhook)
  const secreto = Deno.env.get('TELEGRAM_WEBHOOK_SECRET')
  if (!secreto || req.headers.get('x-telegram-bot-api-secret-token') !== secreto) return new Response('no', { status: 401 })

  const update = await req.json().catch(() => null)
  const mensaje = update?.message
  if (typeof update?.update_id !== 'number' || !mensaje?.chat?.id) return new Response('ok')

  // Respondemos "ok" a Telegram al momento y trabajamos en segundo plano (si no, Telegram reintenta)
  EdgeRuntime.waitUntil(atenderUpdate(update.update_id, mensaje).catch((e) => console.error('aura-telegram', e)))
  return new Response('ok')
})

async function atenderUpdate(updateId: number, mensaje: { chat: { id: number }; text?: string }) {
  const chatId = mensaje.chat.id
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false }
  })

  // ¿Es Rafa? Solo los chats de la lista blanca
  const { data: vinculo } = await db.from('telegram_chats').select('dueno').eq('chat_id', chatId).maybeSingle()
  if (!vinculo) {
    await enviarTelegram(chatId, `Este chat no está autorizado. Tu número de chat es ${chatId} (pásaselo a Rafa para darte acceso).`)
    return
  }

  // Si Telegram reenvía el mismo mensaje, no lo atendemos dos veces
  const { error: repetido } = await db.from('telegram_recibidos').insert({ update_id: updateId })
  if (repetido) return

  const texto = mensaje.text?.trim()
  if (!texto) {
    await enviarTelegram(chatId, 'Por ahora solo entiendo mensajes de texto.')
    return
  }
  if (texto === '/start') {
    await enviarTelegram(chatId, '¡Hola, Rafa! Escríbeme encargos como "para WSE 3 copies urgente" o pregúntame "¿qué hay hoy?".')
    return
  }
  if (texto.length > 8000) {
    await enviarTelegram(chatId, 'Ese mensaje es demasiado largo. ¿Me lo resumes?')
    return
  }

  await atenderMensaje({ db, dueno: vinculo.dueno, chatId }, texto)
}

async function atenderMensaje(ctx: Ctx, texto: string): Promise<void> {
  const { db, dueno } = ctx
  if (!Deno.env.get('ANTHROPIC_API_KEY')) {
    await enviarTelegram(ctx.chatId, 'Falta el secreto ANTHROPIC_API_KEY en la Edge Function.')
    return
  }
  enviarTelegram(ctx.chatId, null) // "escribiendo..."

  // 1) Guardar el mensaje de Rafa (aparece también en el chat de la app)
  await db.from('mensajes').insert({ dueno, canal: 'recepcion', rol: 'usuario', contenido: texto })

  const [{ data: agentes }, { data: clientes }, { data: asignaciones }, { data: ajustes }] = await Promise.all([
    db.from('agentes').select('id, nombre, rol, modelo, instrucciones, tope_gasto_usd, es_recepcionista, es_supervisor, estado').eq('dueno', dueno),
    db.from('clientes').select('id, nombre, descripcion').eq('dueno', dueno).eq('activo', true),
    db.from('agente_clientes').select('agente_id, cliente_id').eq('dueno', dueno),
    db.from('ajustes').select('tope_mensual_usd').eq('dueno', dueno).maybeSingle()
  ])
  const recepcionista = (agentes as Agente[] | null)?.find((a) => a.es_recepcionista)
  if (!recepcionista) {
    await decir(ctx, 'sistema', 'No hay ninguna recepcionista en el equipo. Marca a un agente como recepcionista.')
    return
  }

  // 2) Topes de gasto: si se alcanzó el tope, Aura no gasta más
  const gasto = await gastoDelMes(ctx, recepcionista.id)
  const topeTotal = Number(ajustes?.tope_mensual_usd ?? 50)
  if (gasto.total >= topeTotal || gasto.delAgente >= Number(recepcionista.tope_gasto_usd)) {
    await decir(ctx, 'sistema', `Se alcanzó el tope de gasto de IA de este mes ($${topeTotal.toFixed(2)} en total o el de ${recepcionista.nombre}). Súbelo en Ajustes o en su ficha para seguir.`)
    return
  }

  await db.from('agentes').update({ estado: 'trabajando' }).eq('id', recepcionista.id).eq('dueno', dueno)
  try {
    await conversar(ctx, recepcionista, (agentes as Agente[]) ?? [], (clientes as Cliente[]) ?? [], asignaciones ?? [])
  } catch (e) {
    const mensaje = e instanceof Anthropic.AuthenticationError ? 'La llave de Anthropic no es válida. Revisa el secreto ANTHROPIC_API_KEY de la Edge Function.'
      : e instanceof Anthropic.RateLimitError ? 'Anthropic me pide esperar un momento (límite de uso). Vuelve a intentarlo en un minuto.'
      : e instanceof Anthropic.APIError ? `Error de la IA (${e.status}): ${e.message}`
      : `Algo falló: ${e instanceof Error ? e.message : String(e)}`
    await decir(ctx, 'sistema', mensaje)
  } finally {
    await db.from('agentes').update({ estado: 'disponible' }).eq('id', recepcionista.id).eq('dueno', dueno)
  }
}

async function conversar(ctx: Ctx, yo: Agente, agentes: Agente[], clientes: Cliente[], asignaciones: { agente_id: string; cliente_id: string }[]) {
  const { db, dueno } = ctx
  const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') })
  const { data: abiertas } = await db
    .from('tareas')
    .select('id, titulo, estado, prioridad, cliente_id, agente_id, fecha_limite')
    .eq('dueno', dueno)
    .in('estado', ESTADOS_ABIERTOS)
  const tareas = (abiertas as Tarea[]) ?? []

  // Contexto actual de la agencia (la fecha en la zona horaria de Rafa, no la del servidor)
  const hoy = new Date()
  const equipo = agentes
    .filter((a) => !a.es_recepcionista && !a.es_supervisor)
    .map((a) => ({
      id: a.id,
      nombre: a.nombre,
      rol: a.rol,
      cuentas: asignaciones.filter((x) => x.agente_id === a.id).map((x) => clientes.find((c) => c.id === x.cliente_id)?.nombre).filter(Boolean),
      tareas_abiertas: tareas.filter((t) => t.agente_id === a.id).length
    }))
  const contexto = {
    hoy: hoy.toLocaleDateString('en-CA', { timeZone: ZONA }),
    dia_semana: hoy.toLocaleDateString('es', { weekday: 'long', timeZone: ZONA }),
    hora: hoy.toLocaleTimeString('en-GB', { timeZone: ZONA, hour: '2-digit', minute: '2-digit' }),
    zona_horaria: ZONA,
    clientes: clientes.map((c) => ({ id: c.id, nombre: c.nombre, descripcion: c.descripcion })),
    equipo
  }

  const system: Anthropic.TextBlockParam[] = [
    {
      type: 'text',
      text: [
        `Eres ${yo.nombre}, la recepcionista de Drafsoy HQ, la agencia de trafficking digital de Rafa. Hablas siempre en español, cercana y breve.`,
        yo.instrucciones,
        'Tu trabajo: convertir lo que Rafa pide en tareas bien definidas y asignarlas.',
        '- Detecta cliente, tipo de trabajo, fecha límite y prioridad. Interpreta fechas relativas ("el viernes", "mañana") a partir de la fecha de hoy.',
        '- Si Rafa dice "urgente", "ya", "hoy" → prioridad urgente o alta. Si no dice nada → media.',
        '- Asigna al empleado que lleva la cuenta de ese cliente; si son varios, al que tenga menos tareas abiertas. Si nadie la lleva, al empleado con menos carga y avísalo.',
        '- Si un mensaje pide varias cosas, crea una tarea por cada una.',
        '- Pregunta SOLO si no queda claro el cliente o qué hay que hacer. Nunca preguntes por la fecha, la prioridad ni detalles que el empleado puede resolver: si no hay fecha, crea la tarea sin fecha (o con la de hoy si es urgente).',
        '- Si Rafa nombra a un empleado, asígnasela a él aunque no lleve esa cuenta.',
        '- Tras crear tareas, confirma en 1-3 líneas: qué creaste, para quién y cuándo vence.',
        '- Para "la agenda", "qué hay hoy" o similares, usa consultar_agenda y resume por prioridad.',
        '- Tú no envías, publicas ni tocas campañas: eso lo hacen los empleados y siempre pasa por la bandeja de aprobaciones de Rafa.',
        '- Si Rafa pide que le recuerdes o avises de algo a una hora ("recuérdame en 2 minutos…", "avísame mañana a las 9…"), usa crear_recordatorio (no crees una tarea) y confirma la hora en una línea. Si no da hora ni plazo, pregúntala.',
        '- Si pide que le mandes la agenda cada día (o que deje de hacerlo), usa configurar_resumen_diario.',
        '- Rafa te escribe ahora por Telegram: responde en texto plano, sin Markdown ni tablas.'
      ].join('\n')
    },
    { type: 'text', text: `Contexto actual (JSON):\n${JSON.stringify(contexto)}` }
  ]

  // Historial reciente del chat (el de la app y el de Telegram son el mismo)
  const { data: historial } = await db
    .from('mensajes')
    .select('rol, contenido')
    .eq('dueno', dueno)
    .eq('canal', 'recepcion')
    .in('rol', ['usuario', 'asistente'])
    .order('creado_en', { ascending: false })
    .limit(20)
  const messages: Anthropic.MessageParam[] = ((historial ?? []) as { rol: string; contenido: string }[])
    .reverse()
    .map((m) => ({ role: m.rol === 'usuario' ? 'user' : 'assistant', content: m.contenido }) as Anthropic.MessageParam)
  while (messages.length && messages[0].role !== 'user') messages.shift()

  let ultimaTarea: string | null = null
  let entrada = 0
  let salida = 0
  let coste = 0

  try {
    for (let vuelta = 0; vuelta < MAX_VUELTAS; vuelta++) {
      const respuesta = await anthropic.messages.create({
        model: yo.modelo,
        max_tokens: 16000,
        system,
        tools: HERRAMIENTAS,
        messages
      })
      entrada += respuesta.usage.input_tokens
      salida += respuesta.usage.output_tokens
      coste += costeUsd(yo.modelo, respuesta.usage)

      if (respuesta.stop_reason === 'refusal') {
        await decir(ctx, 'asistente', 'Eso no puedo gestionarlo. ¿Me lo planteas de otra forma?')
        return
      }

      messages.push({ role: 'assistant', content: respuesta.content })
      const usos = respuesta.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')

      if (respuesta.stop_reason !== 'tool_use' || usos.length === 0) {
        const texto = respuesta.content
          .filter((b): b is Anthropic.TextBlock => b.type === 'text')
          .map((b) => b.text)
          .join('\n')
          .trim()
        await decir(ctx, 'asistente', texto || 'Listo.', ultimaTarea)
        return
      }

      // Ejecutar las herramientas y devolver todos los resultados en un solo mensaje
      const resultados: Anthropic.ToolResultBlockParam[] = []
      for (const uso of usos) {
        try {
          const { texto, tareaId } = await ejecutar(ctx, uso.name, uso.input as Record<string, unknown>, agentes, clientes, tareas)
          if (tareaId) ultimaTarea = tareaId
          resultados.push({ type: 'tool_result', tool_use_id: uso.id, content: texto })
        } catch (e) {
          resultados.push({ type: 'tool_result', tool_use_id: uso.id, content: e instanceof Error ? e.message : String(e), is_error: true })
        }
      }
      messages.push({ role: 'user', content: resultados })
    }
    await decir(ctx, 'asistente', 'Me he liado con este encargo. ¿Me lo repites en pocas palabras?')
  } finally {
    if (entrada || salida) {
      await db.from('gastos').insert({
        dueno,
        agente_id: yo.id,
        tarea_id: ultimaTarea,
        modelo: yo.modelo,
        tokens_entrada: entrada,
        tokens_salida: salida,
        costo_usd: Number(coste.toFixed(6))
      })
    }
  }
}

async function ejecutar(
  ctx: Ctx,
  nombre: string,
  datos: Record<string, unknown>,
  agentes: Agente[],
  clientes: Cliente[],
  tareas: Tarea[]
): Promise<{ texto: string; tareaId?: string }> {
  const { db, dueno } = ctx
  const nombreCliente = (id: unknown) => clientes.find((c) => c.id === id)?.nombre
  const nombreAgente = (id: unknown) => agentes.find((a) => a.id === id)?.nombre

  switch (nombre) {
    case 'crear_tarea': {
      if (typeof datos.titulo !== 'string' || !datos.titulo.trim()) throw new Error('Falta el título.')
      if (!nombreCliente(datos.cliente_id)) throw new Error('cliente_id no existe. Usa un id de la lista de clientes.')
      if (datos.agente_id && !nombreAgente(datos.agente_id)) throw new Error('agente_id no existe. Usa un id de la lista del equipo.')
      const prioridad = PRIORIDADES.includes(datos.prioridad as (typeof PRIORIDADES)[number]) ? datos.prioridad : 'media'
      const { data, error } = await db
        .from('tareas')
        .insert({
          dueno,
          titulo: datos.titulo.trim(),
          descripcion: typeof datos.descripcion === 'string' ? datos.descripcion : null,
          tipo: typeof datos.tipo === 'string' ? datos.tipo : null,
          cliente_id: datos.cliente_id,
          agente_id: datos.agente_id ?? null,
          prioridad,
          fecha_limite: fechaValida(datos.fecha_limite) ? datos.fecha_limite : null
        })
        .select('id')
        .single()
      if (error) throw new Error(`No pude guardar la tarea: ${error.message}`)
      return {
        tareaId: data.id,
        texto: `Tarea creada (id ${data.id}) para ${nombreCliente(datos.cliente_id)}, asignada a ${nombreAgente(datos.agente_id) ?? 'nadie'}, prioridad ${prioridad}${fechaValida(datos.fecha_limite) ? `, vence ${datos.fecha_limite}` : ''}.`
      }
    }
    case 'consultar_agenda': {
      const orden = { urgente: 0, alta: 1, media: 2, baja: 3 } as Record<string, number>
      const lista = tareas
        .filter((t) => !datos.cliente_id || t.cliente_id === datos.cliente_id)
        .filter((t) => !fechaValida(datos.hasta) || (t.fecha_limite !== null && t.fecha_limite <= datos.hasta))
        .sort((a, b) => (orden[a.prioridad] ?? 9) - (orden[b.prioridad] ?? 9) || (a.fecha_limite ?? '9999').localeCompare(b.fecha_limite ?? '9999'))
        .map((t) => ({
          id: t.id,
          titulo: t.titulo,
          cliente: nombreCliente(t.cliente_id),
          empleado: nombreAgente(t.agente_id) ?? 'sin asignar',
          prioridad: t.prioridad,
          estado: t.estado,
          vence: t.fecha_limite
        }))
      return { texto: lista.length ? JSON.stringify(lista) : 'No hay tareas abiertas con ese filtro.' }
    }
    case 'cambiar_tarea': {
      const cambios: Record<string, unknown> = {}
      if (PRIORIDADES.includes(datos.prioridad as (typeof PRIORIDADES)[number])) cambios.prioridad = datos.prioridad
      if (fechaValida(datos.fecha_limite)) cambios.fecha_limite = datos.fecha_limite
      if (datos.agente_id) {
        if (!nombreAgente(datos.agente_id)) throw new Error('agente_id no existe.')
        cambios.agente_id = datos.agente_id
      }
      if (typeof datos.estado === 'string') cambios.estado = datos.estado
      if (!Object.keys(cambios).length) throw new Error('No indicaste ningún cambio válido.')
      const { data, error } = await db.from('tareas').update(cambios).eq('id', datos.tarea_id).eq('dueno', dueno).select('id')
      if (error) throw new Error(`No pude cambiar la tarea: ${error.message}`)
      if (!data?.length) throw new Error('Esa tarea no existe.')
      return { texto: `Tarea ${datos.tarea_id} actualizada: ${JSON.stringify(cambios)}`, tareaId: String(datos.tarea_id) }
    }
    case 'crear_recordatorio': {
      if (typeof datos.texto !== 'string' || !datos.texto.trim()) throw new Error('Falta el texto del recordatorio.')
      const minutos = Number(datos.en_minutos)
      const cuando = Number.isFinite(minutos) && minutos > 0
        ? new Date(Date.now() + minutos * 60_000)
        : typeof datos.cuando === 'string' ? horaLocalAUtc(datos.cuando) : null
      if (!cuando) throw new Error('Indica en_minutos o cuando (AAAA-MM-DD HH:MM).')
      if (cuando.getTime() < Date.now() - 60_000) throw new Error(`Esa hora ya pasó (ahora son las ${horaParaRafa(new Date())}).`)
      const { data, error } = await db
        .from('recordatorios')
        .insert({ dueno, chat_id: ctx.chatId, texto: datos.texto.trim(), cuando: cuando.toISOString() })
        .select('id')
        .single()
      if (error) throw new Error(`No pude guardar el recordatorio: ${error.message}`)
      return { texto: `Recordatorio guardado (id ${data.id}): llegará por Telegram el ${horaParaRafa(cuando)}.` }
    }
    case 'ver_recordatorios': {
      const { data, error } = await db.from('recordatorios').select('id, texto, cuando').eq('dueno', dueno).is('enviado_en', null).order('cuando').limit(30)
      if (error) throw new Error(error.message)
      if (!data?.length) return { texto: 'No hay recordatorios pendientes.' }
      return { texto: JSON.stringify(data.map((r) => ({ id: r.id, texto: r.texto, cuando: horaParaRafa(new Date(r.cuando)) }))) }
    }
    case 'cancelar_recordatorio': {
      const { data, error } = await db.from('recordatorios').delete().eq('id', datos.recordatorio_id).eq('dueno', dueno).is('enviado_en', null).select('texto')
      if (error) throw new Error(`No pude cancelarlo: ${error.message}`)
      if (!data?.length) throw new Error('Ese recordatorio no existe o ya se envió.')
      return { texto: `Recordatorio "${data[0].texto}" cancelado.` }
    }
    case 'configurar_resumen_diario': {
      const m = /^(\d{1,2}):(\d{2})$/.exec(String(datos.hora ?? '').trim())
      const hora = m && +m[1] < 24 && +m[2] < 60 ? `${m[1].padStart(2, '0')}:${m[2]}` : null
      // Si se activa hoy después de esa hora, el primero llega mañana (lo damos por enviado hoy)
      const ahora = new Date()
      const yaPaso = hora !== null && ahora.toLocaleTimeString('en-GB', { timeZone: ZONA, hour: '2-digit', minute: '2-digit' }) >= hora
      const { error } = await db
        .from('telegram_chats')
        .update({ resumen_diario: hora, resumen_enviado_el: yaPaso ? ahora.toLocaleDateString('en-CA', { timeZone: ZONA }) : null })
        .eq('chat_id', ctx.chatId)
        .eq('dueno', dueno)
      if (error) throw new Error(`No pude guardarlo: ${error.message}`)
      return { texto: hora ? `Resumen diario activado: cada día a las ${hora}${yaPaso ? ' (el primero, mañana)' : ' (el primero, hoy)'}.` : 'Resumen diario apagado.' }
    }
    default:
      throw new Error(`Herramienta desconocida: ${nombre}`)
  }
}

// ---------- Gastos (igual que electron/agentes/gastos.ts) ----------
function costeUsd(modelo: string, uso: Anthropic.Usage): number {
  const [entrada, salida] = PRECIOS[modelo] ?? PRECIOS['claude-opus-5-5']
  const tokensEntrada = uso.input_tokens + (uso.cache_creation_input_tokens ?? 0) * 1.25 + (uso.cache_read_input_tokens ?? 0) * 0.1
  return (tokensEntrada * entrada + uso.output_tokens * salida) / 1_000_000
}

async function gastoDelMes(ctx: Ctx, agenteId: string) {
  const d = new Date()
  const inicioDeMes = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString()
  const { data, error } = await ctx.db.from('gastos').select('agente_id, costo_usd').eq('dueno', ctx.dueno).gte('creado_en', inicioDeMes)
  if (error) throw new Error(`No pude leer los gastos: ${error.message}`)
  let total = 0
  let delAgente = 0
  for (const g of data ?? []) {
    total += Number(g.costo_usd)
    if (g.agente_id === agenteId) delAgente += Number(g.costo_usd)
  }
  return { total, delAgente }
}

// ---------- Responder: se guarda en la app y se manda por Telegram ----------
async function decir(ctx: Ctx, rol: 'asistente' | 'sistema', contenido: string, tareaId: string | null = null) {
  await ctx.db.from('mensajes').insert({ dueno: ctx.dueno, canal: 'recepcion', rol, contenido, tarea_id: tareaId })
  await enviarTelegram(ctx.chatId, contenido)
}

// texto = null → solo muestra "escribiendo..." en Telegram
async function enviarTelegram(chatId: number, texto: string | null) {
  if (!BOT) return console.error('Falta el secreto TELEGRAM_BOT_TOKEN')
  const [metodo, cuerpo] = texto === null
    ? ['sendChatAction', { chat_id: chatId, action: 'typing' }]
    : ['sendMessage', { chat_id: chatId, text: texto.slice(0, 4000) }]
  const r = await fetch(`https://api.telegram.org/bot${BOT}/${metodo}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(cuerpo)
  }).catch((e) => e as Error)
  if (r instanceof Error || !r.ok) console.error('Telegram no aceptó el mensaje', r instanceof Error ? r.message : await r.text())
}
