import Anthropic from '@anthropic-ai/sdk'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { CONFIG } from '../config'
import { costeUsd, gastoDelMes, registrarGasto } from './gastos'
import { DATOS_ACCIONES, REGLA_IMAGENES, historialConImagenes, problemaEnDetalle } from './comun'
import { revisarPropuestas } from './supervisor'
import { googleConectado, listarEventos } from '../google'

// La recepcionista: recibe encargos en lenguaje natural, los convierte en tareas
// y se los asigna al empleado que lleva esa cuenta. Corre en "el cerebro" (proceso principal),
// así la llave de Anthropic nunca llega a la pantalla.

const MAX_VUELTAS = 6
const PRIORIDADES = ['baja', 'media', 'alta', 'urgente'] as const
const ESTADOS_ABIERTOS = ['pendiente', 'en_progreso', 'te_necesita', 'esperando_aprobacion']

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
        descripcion: {
          type: 'string',
          description:
            'El encargo COMPLETO tal como lo pidió Rafa, sin resumir: incluye cualquier acción que pida (publicar, enviar, subir al Drive, agendar), importes, plataformas, correos y fechas.'
        },
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
    name: 'ver_calendario',
    description: 'Lee los eventos REALES del Google Calendar de Rafa entre dos fechas (reuniones, horas, enlaces de Meet, invitados). Solo lectura: no crea ni cambia nada. Úsala cuando Rafa pregunte por sus reuniones, su día o el enlace de una reunión.',
    input_schema: {
      type: 'object',
      properties: {
        desde: { type: 'string', description: 'Primer día, AAAA-MM-DD' },
        hasta: { type: 'string', description: 'Último día, AAAA-MM-DD (si es solo un día, igual que desde)' }
      },
      required: ['desde', 'hasta']
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
    name: 'buscar_entregables',
    description: 'Lista los últimos trabajos terminados o en curso de un cliente que ya tienen entregable (copies, planes, reportes…), con un extracto. Úsala antes de proponer subir_archivo para encontrar la tarea correcta.',
    input_schema: {
      type: 'object',
      properties: {
        cliente_id: { type: 'string' },
        texto: { type: 'string', description: 'Palabra a buscar en el título, p. ej. "copies"' }
      },
      required: ['cliente_id']
    }
  },
  {
    name: 'proponer_accion',
    description:
      'Propone una acción con Google en nombre de Rafa: subir_archivo (dejar el entregable de una tarea en el Drive del cliente) o agendar_reunion (evento en Google Calendar con invitados). ' +
      'NO la ejecuta: la revisa el supervisor y luego Rafa la aprueba en su bandeja. ' +
      DATOS_ACCIONES +
      ' Para subir_archivo indica tarea_id (de buscar_entregables).',
    input_schema: {
      type: 'object',
      properties: {
        tipo_accion: { type: 'string', enum: ['subir_archivo', 'agendar_reunion'] },
        titulo: { type: 'string', description: 'Qué se hará, en una línea' },
        cliente_id: { type: 'string' },
        tarea_id: { type: 'string', description: 'Tarea cuyo entregable se sube (obligatorio en subir_archivo)' },
        detalle: { type: 'object', additionalProperties: { type: 'string' } }
      },
      required: ['tipo_accion', 'titulo', 'detalle']
    }
  },
  {
    name: 'crear_recordatorio',
    description:
      'Programa un aviso que le llegará a Rafa por Telegram a una hora concreta ("recuérdame en 2 minutos…", "avísame mañana a las 9…"), aunque el PC esté apagado. ' +
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
  }
]

const fechaValida = (f: unknown): f is string => typeof f === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(f)

// "2026-10-18 15:30" en la hora de este PC → instante real
function horaLocal(texto: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})$/.exec(texto.trim())
  return m ? new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) : null
}
const horaParaRafa = (d: Date) => d.toLocaleString('es', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false })

export async function atenderMensaje(texto: string, token: string, imagen: string | null = null): Promise<void> {
  if (!CONFIG.anthropicApiKey) throw new Error('Falta ANTHROPIC_API_KEY en el archivo .env')
  // Cliente de Supabase con la sesión de Rafa: las reglas de seguridad se aplican igual que en la pantalla
  const db = createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false }
  })

  // 1) Guardar el mensaje de Rafa
  await db.from('mensajes').insert({ canal: 'recepcion', rol: 'usuario', contenido: texto, imagen })

  const [{ data: agentes }, { data: clientes }, { data: asignaciones }, { data: ajustes }] = await Promise.all([
    db.from('agentes').select('id, nombre, rol, modelo, instrucciones, tope_gasto_usd, es_recepcionista, es_supervisor, estado'),
    db.from('clientes').select('id, nombre, descripcion').eq('activo', true),
    db.from('agente_clientes').select('agente_id, cliente_id'),
    db.from('ajustes').select('tope_mensual_usd').maybeSingle()
  ])
  const recepcionista = (agentes as Agente[] | null)?.find((a) => a.es_recepcionista)
  if (!recepcionista) {
    await decir(db, 'sistema', 'No hay ninguna recepcionista en el equipo. Marca a un agente como recepcionista.')
    return
  }

  // 2) Topes de gasto: si se alcanzó el tope, Aura no gasta más
  const gasto = await gastoDelMes(db, recepcionista.id)
  const topeTotal = Number(ajustes?.tope_mensual_usd ?? 50)
  if (gasto.total >= topeTotal || gasto.delAgente >= Number(recepcionista.tope_gasto_usd)) {
    await decir(db, 'sistema', `Se alcanzó el tope de gasto de IA de este mes ($${topeTotal.toFixed(2)} en total o el de ${recepcionista.nombre}). Súbelo en Ajustes o en su ficha para seguir.`)
    return
  }

  await db.from('agentes').update({ estado: 'trabajando' }).eq('id', recepcionista.id)
  const propuestas: string[] = []
  try {
    await conversar(db, recepcionista, (agentes as Agente[]) ?? [], (clientes as Cliente[]) ?? [], asignaciones ?? [], propuestas)
  } catch (e) {
    const mensaje = e instanceof Anthropic.AuthenticationError ? 'La llave de Anthropic no es válida. Revisa ANTHROPIC_API_KEY en el .env.'
      : e instanceof Anthropic.RateLimitError ? 'Anthropic me pide esperar un momento (límite de uso). Vuelve a intentarlo en un minuto.'
      : e instanceof Anthropic.APIError ? `Error de la IA (${e.status}): ${e.message}`
      : `Algo falló: ${e instanceof Error ? e.message : String(e)}`
    await decir(db, 'sistema', mensaje)
  } finally {
    await db.from('agentes').update({ estado: 'disponible' }).eq('id', recepcionista.id)
  }
  // Lo que propuso pasa por el supervisor (en segundo plano: Rafa ya tiene su respuesta)
  if (propuestas.length) revisarPropuestas(db, propuestas).catch((e) => console.error('[supervisor]', e))
}

async function conversar(
  db: SupabaseClient,
  yo: Agente,
  agentes: Agente[],
  clientes: Cliente[],
  asignaciones: { agente_id: string; cliente_id: string }[],
  propuestas: string[]
) {
  const anthropic = new Anthropic({ apiKey: CONFIG.anthropicApiKey })
  const { data: abiertas } = await db.from('tareas').select('id, titulo, estado, prioridad, cliente_id, agente_id, fecha_limite').in('estado', ESTADOS_ABIERTOS)
  const tareas = (abiertas as Tarea[]) ?? []

  // Contexto actual de la agencia
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
    hoy: hoy.toLocaleDateString('en-CA'),
    dia_semana: hoy.toLocaleDateString('es', { weekday: 'long' }),
    hora: hoy.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
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
        '- Para sus reuniones y eventos del calendario ("¿qué reuniones tengo?", "pásame el link de la reunión de las 4"), usa ver_calendario y dale la hora, el título y el enlace de Meet.',
        '- Tú no envías, publicas ni tocas campañas: eso lo hacen los empleados y siempre pasa por la bandeja de aprobaciones de Rafa.',
        '- Google Drive y Calendar: si Rafa pide dejar un trabajo YA HECHO en el Drive ("deja los copies en el Drive de X"), usa buscar_entregables y luego proponer_accion subir_archivo con esa tarea. ' +
          'Si ese trabajo aún no existe, crea la tarea normal y añade en la descripción: "Al terminar, proponer subir_archivo para dejarlo en el Drive del cliente".',
        '- Si Rafa pide agendar una reunión, usa proponer_accion agendar_reunion. Pregunta solo si falta la fecha, la hora o el correo de algún invitado; nunca inventes correos.',
        '- Tras proponer, dile a Rafa que el supervisor lo revisa y luego le llega a su bandeja para aprobar. Nada se sube ni se agenda sin su aprobación.',
        REGLA_IMAGENES,
        '- Si Rafa pide que le recuerdes o avises de algo a una hora ("recuérdame en 2 minutos…", "avísame mañana a las 9…"), usa crear_recordatorio (no crees una tarea): le llega por Telegram. Confirma la hora en una línea. Si no da hora ni plazo, pregúntala.'
      ].join('\n')
    },
    { type: 'text', text: `Contexto actual (JSON):\n${JSON.stringify(contexto)}` }
  ]

  // Historial reciente del chat (el último mensaje es el de Rafa recién guardado)
  const { data: historial } = await db.from('mensajes').select('rol, contenido, imagen').eq('canal', 'recepcion').in('rol', ['usuario', 'asistente']).order('creado_en', { ascending: false }).limit(20)
  const messages = historialConImagenes(historial ?? [])

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
        await decir(db, 'asistente', 'Eso no puedo gestionarlo. ¿Me lo planteas de otra forma?')
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
        await decir(db, 'asistente', texto || 'Listo.', ultimaTarea)
        return
      }

      // Ejecutar las herramientas y devolver todos los resultados en un solo mensaje
      const resultados: Anthropic.ToolResultBlockParam[] = []
      for (const uso of usos) {
        try {
          const { texto, tareaId, propuestaId } = await ejecutar(db, uso.name, uso.input as Record<string, unknown>, yo, agentes, clientes, tareas)
          if (tareaId) ultimaTarea = tareaId
          if (propuestaId) propuestas.push(propuestaId)
          resultados.push({ type: 'tool_result', tool_use_id: uso.id, content: texto })
        } catch (e) {
          resultados.push({ type: 'tool_result', tool_use_id: uso.id, content: e instanceof Error ? e.message : String(e), is_error: true })
        }
      }
      messages.push({ role: 'user', content: resultados })
    }
    await decir(db, 'asistente', 'Me he liado con este encargo. ¿Me lo repites en pocas palabras?')
  } finally {
    if (entrada || salida) await registrarGasto(db, { agenteId: yo.id, tareaId: ultimaTarea, modelo: yo.modelo, entrada, salida, coste })
  }
}

async function ejecutar(
  db: SupabaseClient,
  nombre: string,
  datos: Record<string, unknown>,
  yo: Agente,
  agentes: Agente[],
  clientes: Cliente[],
  tareas: Tarea[]
): Promise<{ texto: string; tareaId?: string; propuestaId?: string }> {
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
    case 'ver_calendario': {
      if (!googleConectado()) return { texto: 'Google no está conectado: Rafa debe conectarlo en Ajustes.' }
      const eventos = await listarEventos(String(datos.desde), String(datos.hasta ?? datos.desde))
      return { texto: eventos.length ? JSON.stringify(eventos) : 'No hay eventos en esas fechas.' }
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
      const { error } = await db.from('tareas').update(cambios).eq('id', datos.tarea_id)
      if (error) throw new Error(`No pude cambiar la tarea: ${error.message}`)
      return { texto: `Tarea ${datos.tarea_id} actualizada: ${JSON.stringify(cambios)}`, tareaId: String(datos.tarea_id) }
    }
    case 'buscar_entregables': {
      if (!nombreCliente(datos.cliente_id)) throw new Error('cliente_id no existe.')
      let consulta = db
        .from('tareas')
        .select('id, titulo, estado, actualizado_en, resultado')
        .eq('cliente_id', datos.cliente_id)
        .not('resultado', 'is', null)
        .order('actualizado_en', { ascending: false })
        .limit(8)
      if (typeof datos.texto === 'string' && datos.texto.trim()) consulta = consulta.ilike('titulo', `%${datos.texto.trim()}%`)
      const { data, error } = await consulta
      if (error) throw new Error(error.message)
      if (!data?.length) return { texto: 'Ese cliente no tiene trabajos con entregable que coincidan.' }
      return {
        texto: JSON.stringify(
          data.map((t) => ({ tarea_id: t.id, titulo: t.titulo, estado: t.estado, fecha: String(t.actualizado_en).slice(0, 10), extracto: String(t.resultado).slice(0, 300) }))
        )
      }
    }
    case 'proponer_accion': {
      const tipo = String(datos.tipo_accion)
      if (tipo !== 'subir_archivo' && tipo !== 'agendar_reunion') throw new Error('Solo puedes proponer subir_archivo o agendar_reunion.')
      if (typeof datos.titulo !== 'string' || !datos.titulo.trim()) throw new Error('Falta el título.')
      const detalle = typeof datos.detalle === 'object' && datos.detalle ? (datos.detalle as Record<string, unknown>) : {}
      const problema = problemaEnDetalle(tipo, detalle)
      if (problema) throw new Error(problema)
      let clienteId = datos.cliente_id && nombreCliente(datos.cliente_id) ? String(datos.cliente_id) : null
      let tareaId: string | null = null
      if (tipo === 'subir_archivo') {
        const { data: tarea } = await db.from('tareas').select('id, cliente_id, resultado').eq('id', String(datos.tarea_id ?? '')).maybeSingle()
        if (!tarea) throw new Error('tarea_id no existe. Búscala con buscar_entregables.')
        if (!tarea.resultado) throw new Error('Esa tarea aún no tiene entregable. Espera a que termine o crea la tarea para que lo haga.')
        tareaId = tarea.id
        clienteId = tarea.cliente_id ?? clienteId
      }
      const { data, error } = await db
        .from('aprobaciones')
        .insert({ tarea_id: tareaId, agente_id: yo.id, cliente_id: clienteId, tipo_accion: tipo, titulo: datos.titulo.trim(), detalle, estado: 'en_revision' })
        .select('id')
        .single()
      if (error) throw new Error(`No pude registrar la propuesta: ${error.message}`)
      return { texto: 'Propuesta registrada. La revisa el supervisor y luego llega a la bandeja de Rafa; no se ejecuta nada todavía.', propuestaId: data.id }
    }
    case 'crear_recordatorio': {
      // Sin chat_id: la función aura-recordatorios lo manda al Telegram autorizado de Rafa
      if (typeof datos.texto !== 'string' || !datos.texto.trim()) throw new Error('Falta el texto del recordatorio.')
      const minutos = Number(datos.en_minutos)
      const cuando = Number.isFinite(minutos) && minutos > 0
        ? new Date(Date.now() + minutos * 60_000)
        : typeof datos.cuando === 'string' ? horaLocal(datos.cuando) : null
      if (!cuando) throw new Error('Indica en_minutos o cuando (AAAA-MM-DD HH:MM).')
      if (cuando.getTime() < Date.now() - 60_000) throw new Error(`Esa hora ya pasó (ahora son las ${horaParaRafa(new Date())}).`)
      const { data, error } = await db.from('recordatorios').insert({ texto: datos.texto.trim(), cuando: cuando.toISOString() }).select('id').single()
      if (error) throw new Error(`No pude guardar el recordatorio: ${error.message}`)
      return { texto: `Recordatorio guardado (id ${data.id}): llegará por Telegram el ${horaParaRafa(cuando)}.` }
    }
    case 'ver_recordatorios': {
      const { data, error } = await db.from('recordatorios').select('id, texto, cuando').is('enviado_en', null).order('cuando').limit(30)
      if (error) throw new Error(error.message)
      if (!data?.length) return { texto: 'No hay recordatorios pendientes.' }
      return { texto: JSON.stringify(data.map((r) => ({ id: r.id, texto: r.texto, cuando: horaParaRafa(new Date(r.cuando)) }))) }
    }
    case 'cancelar_recordatorio': {
      const { data, error } = await db.from('recordatorios').delete().eq('id', String(datos.recordatorio_id)).is('enviado_en', null).select('texto')
      if (error) throw new Error(`No pude cancelarlo: ${error.message}`)
      if (!data?.length) throw new Error('Ese recordatorio no existe o ya se envió.')
      return { texto: `Recordatorio "${data[0].texto}" cancelado.` }
    }
    default:
      throw new Error(`Herramienta desconocida: ${nombre}`)
  }
}

async function decir(db: SupabaseClient, rol: 'asistente' | 'sistema', contenido: string, tareaId: string | null = null) {
  await db.from('mensajes').insert({ canal: 'recepcion', rol, contenido, tarea_id: tareaId })
}
