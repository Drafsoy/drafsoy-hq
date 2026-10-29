import type Anthropic from '@anthropic-ai/sdk'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  ACCIONES_EXTERNAS,
  COLUMNAS_AGENTE,
  Contador,
  DATOS_ACCIONES,
  crearAnthropic,
  crearDb,
  llamarModelo,
  memoriaDelCliente,
  mensajeError,
  problemaEnDetalle,
  superaTope,
  textoDe,
  type AgenteDb
} from './comun'
import { consultarConector } from './conectores'
import { revisarTarea } from './supervisor'

// Un empleado trabaja una tarea: produce el entregable y, si hace falta tocar algo fuera
// (publicar, enviar, pausar…), solo puede PROPONERLO. Luego el supervisor lo revisa.

const MAX_VUELTAS = 8

export async function trabajarTarea(tareaId: string, token: string): Promise<void> {
  const db = crearDb(token)

  // Reclamar la tarea (si otro proceso ya la cogió, no hace nada)
  const { data: tarea } = await db.from('tareas').update({ estado: 'en_progreso' }).eq('id', tareaId).eq('estado', 'pendiente').select('*').maybeSingle()
  if (!tarea || !tarea.agente_id) return

  const { data: agente } = await db.from('agentes').select(COLUMNAS_AGENTE).eq('id', tarea.agente_id).single<AgenteDb>()
  if (!agente || agente.es_recepcionista || agente.es_supervisor) {
    await db.from('tareas').update({ estado: 'pendiente' }).eq('id', tareaId)
    return
  }

  const aviso = await superaTope(db, agente)
  if (aviso) {
    await db.from('tareas').update({ estado: 'te_necesita', revision: aviso }).eq('id', tareaId)
    await db.from('agentes').update({ estado: 'te_necesita' }).eq('id', agente.id)
    return
  }

  await db.from('agentes').update({ estado: 'trabajando' }).eq('id', agente.id)
  const contador = new Contador(agente.modelo)
  try {
    const entregado = await producirTrabajo(db, agente, tarea, contador)
    await db.from('tareas').update({ resultado: entregado }).eq('id', tareaId)
    await db.from('agentes').update({ estado: 'disponible' }).eq('id', agente.id)
  } catch (e) {
    await db.from('tareas').update({ estado: 'te_necesita', revision: `No pude terminarla: ${mensajeError(e)}` }).eq('id', tareaId)
    await db.from('agentes').update({ estado: 'te_necesita' }).eq('id', agente.id)
    return
  } finally {
    await contador.registrar(db, agente.id, tareaId)
  }

  // Todo lo que hace un empleado pasa por el supervisor antes de llegar a Rafa
  await revisarTarea(db, tareaId)
}

async function producirTrabajo(
  db: SupabaseClient,
  agente: AgenteDb,
  tarea: Record<string, unknown>,
  contador: Contador
): Promise<string> {
  const anthropic = crearAnthropic()
  const { cliente, memoria } = await memoriaDelCliente(db, (tarea.cliente_id as string) ?? null)
  const puede = (h: string) => agente.herramientas.includes(h)

  const herramientas: Anthropic.Beta.BetaToolUnion[] = [
    {
      name: 'entregar_trabajo',
      description: 'Entrega el resultado final de la tarea. Llámala una sola vez, al terminar, con el trabajo completo listo para que lo revise el supervisor.',
      input_schema: {
        type: 'object',
        properties: {
          resultado: { type: 'string', description: 'El entregable completo (copies, plan, análisis, reporte…) en texto con formato sencillo' },
          resumen: { type: 'string', description: 'Una línea con lo que hiciste' },
          notas_internas: { type: 'string', description: 'Opcional: avisos para el supervisor y Rafa (datos que faltan, supuestos). No se suben al cliente.' }
        },
        required: ['resultado', 'resumen']
      }
    }
  ]
  if (puede('proponer_accion')) {
    herramientas.push({
      name: 'proponer_accion',
      description:
        'Propone una acción en el mundo exterior (enviar un correo desde el Gmail de Rafa, publicar, pausar, cambiar presupuesto, subir el entregable a Google Drive, agendar una reunión en Google Calendar). ' +
        'NO la ejecuta: queda en revisión del supervisor y luego en la bandeja de Rafa. Incluye todos los detalles necesarios para ejecutarla. ' +
        DATOS_ACCIONES,
      input_schema: {
        type: 'object',
        properties: {
          tipo_accion: { type: 'string', enum: [...ACCIONES_EXTERNAS] },
          titulo: { type: 'string', description: 'Qué se hará, en una línea' },
          detalle: { type: 'object', description: 'Datos concretos: plataforma, texto, presupuesto, campaña, destinatario…', additionalProperties: { type: 'string' } },
          motivo: { type: 'string', description: 'Por qué conviene hacerlo' }
        },
        required: ['tipo_accion', 'titulo', 'detalle', 'motivo']
      }
    })
  }
  if (puede('memoria_cliente') && cliente) {
    herramientas.push({
      name: 'guardar_memoria',
      description: 'Guarda un dato duradero del cliente para el futuro (tono, público, oferta vigente, prohibiciones…). Solo datos confirmados, no suposiciones.',
      input_schema: {
        type: 'object',
        properties: { clave: { type: 'string' }, contenido: { type: 'string' } },
        required: ['clave', 'contenido']
      }
    })
  }

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

  const system = [
    `Eres ${agente.nombre}, ${agente.rol} en Drafsoy HQ, la agencia de trafficking digital de Rafa. Trabajas en español.`,
    agente.instrucciones,
    'Reglas:',
    '- Haz el trabajo completo y concreto, listo para usar. Nada de plantillas vacías.',
    '- Respeta siempre la memoria del cliente (tono, público, prohibiciones).',
    '- No inventes datos (cifras, resultados de campañas, precios). Si te faltan datos reales, dilo claramente en el entregable y propone cómo conseguirlos.',
    '- Todavía no tienes acceso directo a las cuentas publicitarias: cualquier cambio fuera (publicar, pausar, presupuestos, envíos) se hace con proponer_accion.',
    '- Si la tarea pide publicar, lanzar, pausar o cambiar el presupuesto de un anuncio o campaña, propón la acción (publicar, pausar o cambiar_presupuesto) con todos los datos: plataforma, texto o pieza, presupuesto diario y duración. No basta con mencionarlo en el entregable.',
    '- Si la tarea pide dejar el trabajo en el Drive (o "subirlo", "compartirlo en un doc"), propone subir_archivo: se subirá tu entregable tal cual, así que entrégalo limpio y final.',
    '- El resultado de entregar_trabajo es SOLO lo que verá el cliente: nada de notas para el supervisor o para Rafa, dudas ni pendientes. Eso va en el campo "notas_internas".',
    '- Si la tarea pide enviar un correo (a un cliente, proveedor…), propone enviar con el texto completo y final del correo. Solo a correos reales que aparezcan en la tarea o en la memoria del cliente; nunca inventes destinatarios.',
    '- Si la tarea pide agendar una reunión, propone agendar_reunion con fecha, hora y correos reales que aparezcan en la tarea o en la memoria del cliente. Nunca inventes correos.',
    '- Tu trabajo lo revisará el supervisor de Rafa antes de llegarle. Si hay notas de revisión anteriores, corrígelas todas.',
    '- Si tienes consultar_meta_ads o consultar_hubspot, úsalas para trabajar con datos reales antes de recomendar nada. Son de solo lectura: cualquier cambio se propone con proponer_accion.',
    '- Termina siempre llamando a entregar_trabajo.'
  ].join('\n')

  const encargo = {
    tarea: { titulo: tarea.titulo, descripcion: tarea.descripcion, tipo: tarea.tipo, prioridad: tarea.prioridad, fecha_limite: tarea.fecha_limite },
    cliente: cliente ? { nombre: cliente.nombre, descripcion: cliente.descripcion } : null,
    memoria_del_cliente: memoria,
    notas_de_revision_anteriores: tarea.revision ?? null,
    intento: Number(tarea.intentos ?? 0) + 1,
    hoy: new Date().toISOString().slice(0, 10)
  }

  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: 'user', content: `Esta es tu tarea (JSON):\n${JSON.stringify(encargo, null, 2)}` }]

  for (let vuelta = 0; vuelta < MAX_VUELTAS; vuelta++) {
    const respuesta = await llamarModelo(anthropic, { model: agente.modelo, max_tokens: 16000, system, tools: herramientas, messages })
    contador.sumar(respuesta.usage)
    if (respuesta.stop_reason === 'refusal') throw new Error('El modelo rechazó esta tarea.')
    messages.push({ role: 'assistant', content: respuesta.content })

    const usos = respuesta.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === 'tool_use')
    if (respuesta.stop_reason !== 'tool_use' || usos.length === 0) {
      // Respondió sin usar entregar_trabajo: su texto es el entregable
      const texto = textoDe(respuesta.content)
      if (texto) return texto
      messages.push({ role: 'user', content: 'Entrega tu trabajo con entregar_trabajo.' })
      continue
    }

    const resultados: Anthropic.Beta.BetaToolResultBlockParam[] = []
    let entrega: string | null = null
    for (const uso of usos) {
      const datos = uso.input as Record<string, unknown>
      try {
        if (uso.name === 'entregar_trabajo') {
          if (typeof datos.resultado !== 'string' || !datos.resultado.trim()) throw new Error('El resultado está vacío.')
          entrega = datos.resultado
          // Las notas internas se guardan junto a la revisión (las ve el supervisor), nunca dentro del entregable
          if (typeof datos.notas_internas === 'string' && datos.notas_internas.trim()) {
            await db.from('tareas').update({ revision: `📝 Notas de ${agente.nombre}: ${datos.notas_internas.trim()}` }).eq('id', tarea.id)
          }
          resultados.push({ type: 'tool_result', tool_use_id: uso.id, content: 'Entregado. Pasa a revisión del supervisor.' })
        } else if (uso.name === 'proponer_accion') {
          if (!ACCIONES_EXTERNAS.includes(datos.tipo_accion as (typeof ACCIONES_EXTERNAS)[number])) throw new Error('tipo_accion no válido.')
          if (typeof datos.titulo !== 'string' || !datos.titulo.trim()) throw new Error('Falta el título.')
          const detalle: Record<string, unknown> =
            typeof datos.detalle === 'object' && datos.detalle ? { ...(datos.detalle as object), motivo: String(datos.motivo ?? '') } : { motivo: String(datos.motivo ?? '') }
          const problema = problemaEnDetalle(String(datos.tipo_accion), detalle)
          if (problema) throw new Error(problema)
          const { error } = await db.from('aprobaciones').insert({
            tarea_id: tarea.id,
            agente_id: agente.id,
            cliente_id: tarea.cliente_id,
            tipo_accion: datos.tipo_accion,
            titulo: datos.titulo,
            detalle,
            estado: 'en_revision'
          })
          if (error) throw new Error(error.message)
          resultados.push({ type: 'tool_result', tool_use_id: uso.id, content: 'Propuesta registrada. Queda en revisión; no se ejecuta nada todavía.' })
        } else if (uso.name === 'consultar_meta_ads' || uso.name === 'consultar_hubspot') {
          const texto = await consultarConector(uso.name === 'consultar_meta_ads' ? 'meta' : 'hubspot', String(datos.consulta ?? ''))
          resultados.push({ type: 'tool_result', tool_use_id: uso.id, content: texto })
        } else if (uso.name === 'guardar_memoria') {
          const { error } = await db.from('memoria_cliente').insert({ cliente_id: tarea.cliente_id, clave: String(datos.clave), contenido: String(datos.contenido) })
          if (error) throw new Error(error.message)
          resultados.push({ type: 'tool_result', tool_use_id: uso.id, content: 'Guardado en la memoria del cliente.' })
        } else {
          throw new Error(`Herramienta desconocida: ${uso.name}`)
        }
      } catch (e) {
        resultados.push({ type: 'tool_result', tool_use_id: uso.id, content: mensajeError(e), is_error: true })
      }
    }
    if (entrega) return entrega
    messages.push({ role: 'user', content: resultados })
  }
  throw new Error('No terminó la tarea tras varios intentos.')
}
