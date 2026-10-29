import Anthropic from '@anthropic-ai/sdk'
import type { SupabaseClient } from '@supabase/supabase-js'
import { consultarConector } from './conectores'
import { COLUMNAS_AGENTE, Contador, crearAnthropic, crearDb, llamarModelo, mensajeError, superaTope, textoDe, type AgenteDb } from './comun'

// Chat directo de Rafa con un empleado. El empleado conoce sus cuentas, la memoria de cada cliente
// y sus tareas; puede apuntarse tareas nuevas o retomar una con las indicaciones de Rafa.
// Nunca ejecuta acciones externas: eso sigue pasando por una tarea, el supervisor y la bandeja.

const MAX_VUELTAS = 5
const HISTORIAL = 20
const PRIORIDADES = ['baja', 'media', 'alta', 'urgente'] as const

const decir = (db: SupabaseClient, canal: string, rol: 'asistente' | 'sistema', contenido: string, tareaId: string | null = null) =>
  db.from('mensajes').insert({ canal, rol, contenido, tarea_id: tareaId })

const recorte = (texto: unknown, largo: number) => {
  const t = String(texto ?? '')
  return t.length > largo ? `${t.slice(0, largo)}…` : t
}

export async function charlarConEmpleado(agenteId: string, texto: string, token: string): Promise<void> {
  const db = crearDb(token)
  const canal = agenteId
  await db.from('mensajes').insert({ canal, rol: 'usuario', contenido: texto })

  const { data: agente } = await db.from('agentes').select(COLUMNAS_AGENTE).eq('id', agenteId).maybeSingle()
  if (!agente) {
    await decir(db, canal, 'sistema', 'Este empleado ya no existe.')
    return
  }
  const yo = agente as AgenteDb
  const tope = await superaTope(db, yo)
  if (tope) {
    await decir(db, canal, 'sistema', `${tope} Súbelo en Ajustes o en su ficha para seguir.`)
    return
  }

  const contador = new Contador(yo.modelo)
  try {
    await conversar(db, yo, canal, contador)
  } catch (e) {
    await decir(db, canal, 'sistema', `No pude responder: ${mensajeError(e)}`)
  } finally {
    await contador.registrar(db, yo.id, null)
  }
}

async function conversar(db: SupabaseClient, yo: AgenteDb, canal: string, contador: Contador) {
  const [{ data: asignaciones }, { data: tareas }, { data: historial }] = await Promise.all([
    db.from('agente_clientes').select('cliente_id').eq('agente_id', yo.id),
    db
      .from('tareas')
      .select('id, titulo, estado, prioridad, cliente_id, fecha_limite, revision, resultado, actualizado_en')
      .eq('agente_id', yo.id)
      .order('actualizado_en', { ascending: false })
      .limit(15),
    db.from('mensajes').select('rol, contenido').eq('canal', canal).order('creado_en', { ascending: false }).limit(HISTORIAL)
  ])
  const idsClientes = (asignaciones ?? []).map((a) => a.cliente_id as string)
  const [{ data: clientes }, { data: memoria }] = idsClientes.length
    ? await Promise.all([
        db.from('clientes').select('id, nombre, descripcion').in('id', idsClientes),
        db.from('memoria_cliente').select('cliente_id, clave, contenido').in('cliente_id', idsClientes)
      ])
    : [{ data: [] }, { data: [] }]
  const misClientes = (clientes ?? []) as { id: string; nombre: string; descripcion: string | null }[]
  const misTareas = (tareas ?? []) as Record<string, unknown>[]
  const puede = (h: string) => yo.herramientas.includes(h)

  const hoy = new Date()
  const contexto = {
    hoy: hoy.toLocaleDateString('en-CA'),
    dia_semana: hoy.toLocaleDateString('es', { weekday: 'long' }),
    mis_clientes: misClientes.map((c) => ({
      id: c.id,
      nombre: c.nombre,
      descripcion: c.descripcion,
      memoria: (memoria ?? []).filter((m) => m.cliente_id === c.id).map((m) => `${m.clave}: ${m.contenido}`)
    })),
    mis_tareas: misTareas.map((t) => ({
      id: t.id,
      titulo: t.titulo,
      estado: t.estado,
      prioridad: t.prioridad,
      cliente: misClientes.find((c) => c.id === t.cliente_id)?.nombre ?? null,
      fecha_limite: t.fecha_limite,
      revision: t.revision ? recorte(t.revision, 1200) : null,
      entregable: t.resultado ? recorte(t.resultado, 1500) : null
    }))
  }

  const herramientas: Anthropic.Beta.BetaToolUnion[] = [
    {
      name: 'apuntar_tarea',
      description:
        'Te apunta una tarea nueva a ti mismo cuando Rafa te pide un trabajo en el chat. Empezarás a trabajarla enseguida y, como siempre, la revisará el supervisor. ' +
        'Si el trabajo incluye una acción externa (enviar un correo, publicar, subir al Drive, agendar), escríbela en la descripción: la propondrás al hacer la tarea.',
      input_schema: {
        type: 'object',
        properties: {
          titulo: { type: 'string', description: 'Título corto y accionable' },
          descripcion: { type: 'string', description: 'El encargo COMPLETO tal como lo pidió Rafa, sin resumir: acciones, importes, plataformas, correos y fechas.' },
          cliente_id: { type: 'string', description: 'id de uno de tus clientes' },
          prioridad: { type: 'string', enum: [...PRIORIDADES] },
          fecha_limite: { type: 'string', description: 'AAAA-MM-DD, solo si Rafa da una fecha' }
        },
        required: ['titulo', 'descripcion', 'cliente_id', 'prioridad']
      }
    },
    {
      name: 'retomar_tarea',
      description:
        'Vuelve a trabajar una de tus tareas (por ejemplo una que "te necesita" o una ya completada que Rafa quiere cambiar) con las indicaciones que te dio Rafa en el chat.',
      input_schema: {
        type: 'object',
        properties: {
          tarea_id: { type: 'string', description: 'id de una de tus tareas' },
          indicaciones: { type: 'string', description: 'Lo que Rafa quiere que cambies, con sus palabras' }
        },
        required: ['tarea_id', 'indicaciones']
      }
    }
  ]
  // Consultas reales de solo lectura a Meta Ads y HubSpot (por el Claude Code de esta PC)
  if (puede('meta_ads')) {
    herramientas.push({
      name: 'consultar_meta_ads',
      description:
        'Consulta datos REALES de Meta Ads (Facebook e Instagram) de Rafa: cuentas publicitarias, campañas, conjuntos, anuncios, públicos, creatividades, métricas, tendencias y la biblioteca de anuncios. ' +
        'Solo lectura: no cambia nada. Escribe la consulta en lenguaje natural y con detalle (cuenta o cliente, fechas, métricas). Tarda un poco: agrupa lo que necesites en una sola consulta.',
      input_schema: { type: 'object', properties: { consulta: { type: 'string' } }, required: ['consulta'] }
    })
  }
  if (puede('hubspot')) {
    herramientas.push({
      name: 'consultar_hubspot',
      description:
        'Consulta datos REALES del HubSpot de Rafa: contactos, empresas, negocios, etapas del embudo, propietarios, campañas y reportes. ' +
        'Solo lectura: no cambia nada. Escribe la consulta en lenguaje natural y con detalle. Tarda un poco: agrupa lo que necesites en una sola consulta.',
      input_schema: { type: 'object', properties: { consulta: { type: 'string' } }, required: ['consulta'] }
    })
  }
  if (puede('memoria_cliente') && misClientes.length) {
    herramientas.push({
      name: 'guardar_memoria',
      description: 'Guarda un dato duradero de un cliente que Rafa te cuenta (tono, público, oferta, correos, prohibiciones…). Solo datos confirmados por Rafa.',
      input_schema: {
        type: 'object',
        properties: { cliente_id: { type: 'string' }, clave: { type: 'string' }, contenido: { type: 'string' } },
        required: ['cliente_id', 'clave', 'contenido']
      }
    })
  }

  const system = [
    `Eres ${yo.nombre}, ${yo.rol} en Drafsoy HQ, la agencia de trafficking digital de Rafa. Estás hablando directamente con Rafa, tu jefe, en tu chat.`,
    yo.instrucciones,
    'Cómo hablas:',
    '- En español, cercano y breve (2 a 6 frases salvo que Rafa pida detalle). Formato sencillo: **negrita** y listas con "- ".',
    '- Rafa no es programador: explica las cosas fácil.',
    '- Responde sobre tus clientes y tus tareas con los datos del contexto. Si algo no está ahí, dilo; no inventes cifras ni resultados.',
    '- Si una tarea "te necesita", explica en palabras simples qué pasó y qué decisión necesitas de Rafa.',
    'Qué puedes hacer:',
    '- Si Rafa te pide un trabajo nuevo, usa apuntar_tarea (no lo hagas en el chat). Si te pide cambiar o seguir una tarea tuya, usa retomar_tarea.',
    '- No puedes enviar, publicar, subir ni agendar nada desde el chat: esas acciones salen de una tarea, las revisa el supervisor y Rafa las aprueba en su bandeja.',
    '- Si Rafa te cuenta un dato duradero de un cliente, guárdalo con guardar_memoria (si la tienes).',
    '- Si te pregunta por campañas o por el CRM y tienes consultar_meta_ads o consultar_hubspot, consulta los datos reales antes de responder (avísale de que tardas un poco).',
    `Contexto actual (JSON):\n${JSON.stringify(contexto)}`
  ].join('\n')

  // Historial del chat (el último mensaje es el de Rafa); los avisos del sistema no se le pasan al modelo
  const messages: Anthropic.Beta.BetaMessageParam[] = []
  for (const m of (historial ?? []).reverse()) {
    if (m.rol === 'sistema') continue
    const role = m.rol === 'usuario' ? 'user' : 'assistant'
    const ultimo = messages[messages.length - 1]
    if (ultimo?.role === role) ultimo.content = `${ultimo.content}\n\n${m.contenido}`
    else messages.push({ role, content: String(m.contenido) })
  }
  while (messages.length && messages[0].role !== 'user') messages.shift()

  const anthropic = crearAnthropic()
  let tareaCreada: string | null = null
  for (let vuelta = 0; vuelta < MAX_VUELTAS; vuelta++) {
    const respuesta = await llamarModelo(anthropic, { model: yo.modelo, max_tokens: 4000, system, tools: herramientas, messages })
    contador.sumar(respuesta.usage)
    if (respuesta.stop_reason === 'refusal') throw new Error('El modelo no quiso responder a eso.')
    const usos = respuesta.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === 'tool_use')
    if (!usos.length) {
      const texto = textoDe(respuesta.content).trim()
      await decir(db, canal, 'asistente', texto || '👍', tareaCreada)
      return
    }
    messages.push({ role: 'assistant', content: respuesta.content })
    const resultados: Anthropic.Beta.BetaToolResultBlockParam[] = []
    for (const uso of usos) {
      const datos = uso.input as Record<string, unknown>
      try {
        let contenido: string
        if (uso.name === 'apuntar_tarea') {
          if (!misClientes.some((c) => c.id === datos.cliente_id)) throw new Error('Ese cliente no es de tus cuentas.')
          const prioridad = PRIORIDADES.includes(datos.prioridad as (typeof PRIORIDADES)[number]) ? datos.prioridad : 'media'
          const fecha = typeof datos.fecha_limite === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(datos.fecha_limite) ? datos.fecha_limite : null
          const { data, error } = await db
            .from('tareas')
            .insert({ titulo: String(datos.titulo).trim(), descripcion: String(datos.descripcion ?? ''), cliente_id: datos.cliente_id, agente_id: yo.id, prioridad, fecha_limite: fecha })
            .select('id')
            .single()
          if (error) throw new Error(error.message)
          tareaCreada = data.id
          contenido = 'Tarea apuntada. Empezarás a trabajarla en cuanto termines lo que tengas en marcha.'
        } else if (uso.name === 'retomar_tarea') {
          const tarea = misTareas.find((t) => t.id === datos.tarea_id)
          if (!tarea) throw new Error('Esa tarea no es tuya.')
          if (tarea.estado === 'en_progreso') throw new Error('Esa tarea está en marcha ahora mismo; espera a que termine.')
          const revision = `${tarea.revision ?? ''}\n\n🗣️ Rafa: ${String(datos.indicaciones).trim()}`.trim()
          const { error } = await db.from('tareas').update({ estado: 'pendiente', intentos: 0, revision }).eq('id', tarea.id as string)
          if (error) throw new Error(error.message)
          if (tarea.estado === 'te_necesita' && !misTareas.some((t) => t.id !== tarea.id && t.estado === 'te_necesita')) {
            await db.from('agentes').update({ estado: 'disponible' }).eq('id', yo.id)
          }
          contenido = 'Tarea retomada con las indicaciones de Rafa.'
        } else if (uso.name === 'consultar_meta_ads' || uso.name === 'consultar_hubspot') {
          contenido = await consultarConector(uso.name === 'consultar_meta_ads' ? 'meta' : 'hubspot', String(datos.consulta ?? ''))
        } else if (uso.name === 'guardar_memoria') {
          if (!misClientes.some((c) => c.id === datos.cliente_id)) throw new Error('Ese cliente no es de tus cuentas.')
          const { error } = await db.from('memoria_cliente').insert({ cliente_id: datos.cliente_id, clave: String(datos.clave), contenido: String(datos.contenido) })
          if (error) throw new Error(error.message)
          contenido = 'Guardado en la memoria del cliente.'
        } else {
          throw new Error(`Herramienta desconocida: ${uso.name}`)
        }
        resultados.push({ type: 'tool_result', tool_use_id: uso.id, content: contenido })
      } catch (e) {
        resultados.push({ type: 'tool_result', tool_use_id: uso.id, content: mensajeError(e), is_error: true })
      }
    }
    messages.push({ role: 'user', content: resultados })
  }
  await decir(db, canal, 'sistema', 'Me lié con tantas vueltas. ¿Me lo puedes pedir de otra forma?', tareaCreada)
}
